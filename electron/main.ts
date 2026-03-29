// electron/main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { EncryptedDatabase } from './database/encrypted-db';
import { v4 as uuidv4 } from 'uuid';
import * as bip39 from 'bip39';
import { P2PEngine } from './p2p';
import * as Y from 'yjs';

let activeDatabase: EncryptedDatabase | null = null;
let p2pEngine: P2PEngine | null = null;
let mainWindow: BrowserWindow | null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'AirWork',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const isDev = process.env.npm_lifecycle_event === 'dev' || !app.isPackaged;

  if (isDev) {
    console.log('Running in Dev Mode: Loading localhost:3000');
    mainWindow.loadURL('http://localhost:3000');
  } else {
    console.log('Running in Production: Loading compiled HTML');
    mainWindow.loadFile(path.join(__dirname, '../.next/server/app/index.html'));
  }

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost:3000') && !url.startsWith('file://')) {
      event.preventDefault();
    }
  });
}

function setupIpcHandlers() {
    ipcMain.handle('auth:login', async (_event, credentials) => {
        try {
            activeDatabase = new EncryptedDatabase(credentials.userId);
            const success = await activeDatabase.initialize(credentials.password, false); 
            
            if (success) {
                const db = activeDatabase.getDb();
                try { db.exec(`ALTER TABLE peers ADD COLUMN about_me TEXT;`); } catch(e) {}
                try { db.exec(`ALTER TABLE project_members ADD COLUMN nickname TEXT;`); } catch(e) {}
                // <--- FIX: Ensure existing databases add the new HTML column without crashing --->
                try { db.exec(`ALTER TABLE document_versions ADD COLUMN html TEXT;`); } catch(e) {}
                
                const userRecord = db.prepare(`SELECT id FROM peers WHERE username = ?`).get(credentials.userId) as any;
                
                if (userRecord) {
                    p2pEngine = new P2PEngine(userRecord.id, credentials.userId);
                    p2pEngine.start();
                    
                    p2pEngine.on('peer-discovered', (peerData) => {
                        if (mainWindow) mainWindow.webContents.send('peer-discovered', peerData);
                    });

                    p2pEngine.on('message', (payload) => {
                        if (!activeDatabase) return;
                        const db = activeDatabase.getDb();
                        
                        try {
                            if (payload.type === 'SYNC_TASK_UPSERT') {
                                const t = payload.task;
                                db.prepare(`
                                    INSERT INTO tasks (id, project_id, title, status, position, start_date, due_date)
                                    VALUES (?, ?, ?, ?, ?, ?, ?)
                                    ON CONFLICT(id) DO UPDATE SET
                                    status=excluded.status, position=excluded.position, title=excluded.title
                                `).run(t.id, t.project_id, t.title, t.status, t.position, t.start_date, t.due_date);
                                if (mainWindow) mainWindow.webContents.send('sync-refresh');
                            } 
                            else if (payload.type === 'SYNC_TASK_DELETE') {
                                db.prepare(`DELETE FROM tasks WHERE id = ?`).run(payload.taskId);
                                if (mainWindow) mainWindow.webContents.send('sync-refresh');
                            }
                            else if (payload.type === 'SYNC_DOC_UPDATE') {
                                if (mainWindow) {
                                    mainWindow.webContents.send('doc:receive-update', {
                                        docId: payload.docId,
                                        update: payload.update
                                    });
                                }
                            }
                            else if (payload.type === 'SYNC_CHAT_MESSAGE') {
                                const m = payload.message;
                                db.prepare(`
                                    INSERT INTO project_messages (id, project_id, sender, text, attachment, attachment_name, is_edited, timestamp)
                                    VALUES (?, ?, ?, ?, ?, ?, 0, ?) ON CONFLICT DO NOTHING
                                `).run(m.id, m.projectId, m.sender, m.text, m.attachment, m.attachmentName, m.timestamp);
                                if (mainWindow) mainWindow.webContents.send('sync-refresh');
                            }
                            else if (payload.type === 'SYNC_CHAT_EDIT') {
                                db.prepare(`UPDATE project_messages SET text = ?, is_edited = 1 WHERE id = ?`).run(payload.text, payload.id);
                                if (mainWindow) mainWindow.webContents.send('sync-refresh');
                            }
                            else if (payload.type === 'SYNC_CHAT_DELETE') {
                                db.prepare(`DELETE FROM project_messages WHERE id = ?`).run(payload.id);
                                if (mainWindow) mainWindow.webContents.send('sync-refresh');
                            }
                            else if (payload.type === 'JOIN_PROJECT_REQUEST') {
                                const invite = db.prepare(`SELECT * FROM project_invites WHERE invite_token = ? AND expires_at > ?`).get(payload.token, new Date().toISOString()) as any;
                                
                                if (invite) {
                                    db.prepare(`INSERT INTO project_members (project_id, peer_id, role) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`).run(invite.project_id, payload.peerId, invite.role);
                                    db.prepare(`INSERT INTO peers (id, username, email, public_key) VALUES (?, ?, '', 'placeholder') ON CONFLICT DO NOTHING`).run(payload.peerId, payload.username);

                                    const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(invite.project_id);
                                    const tasks = db.prepare(`SELECT * FROM tasks WHERE project_id = ?`).all(invite.project_id);
                                    const docs = db.prepare(`SELECT * FROM documents WHERE project_id = ?`).all(invite.project_id);
                                    const members = db.prepare(`SELECT * FROM project_members WHERE project_id = ?`).all(invite.project_id);
                                    const messages = db.prepare(`SELECT * FROM project_messages WHERE project_id = ?`).all(invite.project_id);

                                    p2pEngine?.broadcast({
                                        type: 'JOIN_PROJECT_ACCEPT',
                                        targetPeerId: payload.peerId,
                                        project,
                                        tasks,
                                        docs,
                                        members,
                                        messages
                                    });
                                    if (mainWindow) mainWindow.webContents.send('sync-refresh');
                                }
                            }
                            else if (payload.type === 'JOIN_PROJECT_ACCEPT') {
                                const userRecord = db.prepare(`SELECT id FROM peers WHERE username = ?`).get(credentials.userId) as any;
                                
                                if (userRecord && payload.targetPeerId === userRecord.id) {
                                    db.prepare(`INSERT INTO projects (id, name, created_by, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`)
                                      .run(payload.project.id, payload.project.name, payload.project.created_by, payload.project.created_at);
                                    
                                    const insertMember = db.prepare(`INSERT INTO project_members (project_id, peer_id, role, joined_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`);
                                    payload.members.forEach((m: any) => insertMember.run(m.project_id, m.peer_id, m.role, m.joined_at));

                                    const insertTask = db.prepare(`
                                        INSERT INTO tasks (id, project_id, title, status, position, assigned_to, start_date, due_date) 
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING
                                    `);
                                    payload.tasks.forEach((t: any) => insertTask.run(t.id, t.project_id, t.title, t.status, t.position, t.assigned_to, t.start_date, t.due_date));

                                    const insertDoc = db.prepare(`INSERT INTO documents (id, project_id, title, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`);
                                    payload.docs.forEach((d: any) => insertDoc.run(d.id, d.project_id, d.title, d.updated_at));

                                    if (payload.messages) {
                                        const insertMsg = db.prepare(`INSERT INTO project_messages (id, project_id, sender, text, attachment, attachment_name, is_edited, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`);
                                        payload.messages.forEach((m: any) => insertMsg.run(m.id, m.project_id, m.sender, m.text, m.attachment, m.attachment_name, m.is_edited, m.timestamp));
                                    }

                                    if (mainWindow) mainWindow.webContents.send('sync-refresh');
                                }
                            }
                        } catch (err) {
                            console.error('[SYNC] Failed to process incoming sync:', err);
                        }
                    });
                }

                return { success: true };
            } else {
                return { success: false, error: 'Invalid password or corrupted database' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Login failed' };
        }
    });

    ipcMain.handle('auth:register', async (event, credentials) => {
        const { userId, email, password } = credentials; 
        try {
            const recoveryPhrase = bip39.generateMnemonic(256);
            const db = new EncryptedDatabase(userId);
            activeDatabase = db
            const success = await db.initialize(password, true, recoveryPhrase);

            if (success) {
                const stmt = db.getDb().prepare(`INSERT INTO peers (id, username, email, public_key) VALUES (?, ?, ?, ?)`);
                stmt.run(uuidv4(), userId, email, 'placeholder_pub_key');
                return { success: true, recoveryPhrase: recoveryPhrase };
            }
            return { success: false, error: 'Failed to initialize encrypted vault' };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('auth:logout', async () =>{
        if (activeDatabase) {
            activeDatabase.close(); 
            activeDatabase = null;
        }
        if (p2pEngine) {
            p2pEngine.stop();
            p2pEngine = null;
        }
        return { success: true };
    });

    ipcMain.handle('project:create', async (_event, { name, userId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const projectId = uuidv4();
            const db = activeDatabase.getDb();
            const userRecord = db.prepare(`SELECT id FROM peers WHERE username = ?`).get(userId) as any;
            db.prepare(`INSERT INTO projects (id, name, created_by) VALUES (?, ?, ?)`).run(projectId, name, userRecord.id);
            db.prepare(`INSERT INTO project_members (project_id, peer_id, role) VALUES (?, ?, 'admin')`).run(projectId, userRecord.id);
            return { success: true, projectId };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('project:list', async (_event, { userId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const db = activeDatabase.getDb();
            const userRecord = db.prepare(`SELECT id FROM peers WHERE username = ?`).get(userId) as any;
            const projects = db.prepare(`
                SELECT p.id, p.name, pm.role, p.created_at
                FROM projects p
                JOIN project_members pm ON p.id = pm.project_id
                WHERE pm.peer_id = ?
                ORDER BY p.created_at DESC
            `).all(userRecord.id);
            return { success: true, projects };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('project:getMembers', async (_event, { projectId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const members = activeDatabase.getDb().prepare(`
                SELECT p.id, p.username, pm.role, pm.joined_at, pm.nickname 
                FROM peers p
                JOIN project_members pm ON p.id = pm.peer_id
                WHERE pm.project_id = ?
            `).all(projectId);
            return { success: true, members };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('project:generateInvite', async (_event, { projectId, userId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const db = activeDatabase.getDb();
            const userRecord = db.prepare(`SELECT id FROM peers WHERE username = ?`).get(userId) as any;
            const inviteToken = 'aw-' + uuidv4().split('-')[0]; 
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            db.prepare(`INSERT INTO project_invites (invite_token, project_id, created_by, role, expires_at) VALUES (?, ?, ?, 'editor', ?)`).run(inviteToken, projectId, userRecord.id, expiresAt);
            return { success: true, inviteToken };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('project:join', async (_event, { token, userId }) => {
        if (!activeDatabase || !p2pEngine) return { success: false, error: 'Network engine not ready' };
        try {
            const db = activeDatabase.getDb();
            const userRecord = db.prepare(`SELECT id FROM peers WHERE username = ?`).get(userId) as any;
            p2pEngine.broadcast({ type: 'JOIN_PROJECT_REQUEST', token: token, peerId: userRecord.id, username: userId });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('task:list', async (_event, { projectId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const tasks = activeDatabase.getDb().prepare(`SELECT * FROM tasks WHERE project_id = ? ORDER BY position ASC, created_at DESC`).all(projectId);
            return { success: true, tasks };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('task:create', async (_event, args: any) => { 
        const { projectId, title, status, assigneeId, startDate, dueDate } = args; 
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const taskId = uuidv4();
            const db = activeDatabase.getDb();
            const posResult = db.prepare(`SELECT MAX(position) as maxPos FROM tasks WHERE project_id = ? AND status = ?`).get(projectId, status) as any;
            const position = (posResult?.maxPos || 0) + 1000;
            db.prepare(`INSERT INTO tasks (id, project_id, title, status, position, assigned_to, start_date, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(taskId, projectId, title, status, position, assigneeId || null, startDate || null, dueDate || null);
            if (p2pEngine) {
                const newTask = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(taskId);
                p2pEngine.broadcast({ type: 'SYNC_TASK_UPSERT', task: newTask });
            }
            return { success: true, taskId };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('task:updateStatus', async (_event, { taskId, newStatus }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const db = activeDatabase.getDb();
            db.prepare(`UPDATE tasks SET status = ? WHERE id = ?`).run(newStatus, taskId);
            if (p2pEngine) {
                const updatedTask = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(taskId);
                p2pEngine.broadcast({ type: 'SYNC_TASK_UPSERT', task: updatedTask });
            }
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('task:delete', async (_event, { taskId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            activeDatabase.getDb().prepare(`DELETE FROM tasks WHERE id = ?`).run(taskId);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('doc:create', async (_event, { projectId, title }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const docId = uuidv4();
            activeDatabase.getDb().prepare(`INSERT INTO documents (id, project_id, title) VALUES (?, ?, ?)`).run(docId, projectId, title);
            return { success: true, id: docId };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('doc:list', async (_event, { projectId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const documents = activeDatabase.getDb().prepare(`SELECT * FROM documents WHERE project_id = ? ORDER BY updated_at DESC`).all(projectId);
            return { success: true, documents };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('doc:load', async (_event, docId) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const db = activeDatabase.getDb();
            let record = db.prepare(`SELECT yjs_state FROM document_branches WHERE id = ?`).get(docId) as any;
            if (!record) record = db.prepare(`SELECT yjs_state FROM documents WHERE id = ?`).get(docId) as any;
            if (record && record.yjs_state) return { success: true, state: Array.from(new Uint8Array(record.yjs_state)) };
            return { success: true, state: null }; 
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('doc:save', async (_event, { docId, state }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const db = activeDatabase.getDb();
            const buffer = Buffer.from(state);
            const info = db.prepare(`UPDATE document_branches SET yjs_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(buffer, docId);
            if (info.changes === 0) db.prepare(`UPDATE documents SET yjs_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(buffer, docId);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('doc:createBranch', async (_event, { documentId, branchName, userId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const branchId = uuidv4();
            const db = activeDatabase.getDb();
            const userRecord = db.prepare(`SELECT id FROM peers WHERE username = ?`).get(userId) as any;
            const doc = db.prepare(`SELECT yjs_state FROM documents WHERE id = ?`).get(documentId) as any;
            db.prepare(`INSERT INTO document_branches (id, document_id, branch_name, yjs_state, created_by) VALUES (?, ?, ?, ?, ?)`).run(branchId, documentId, branchName, doc?.yjs_state || null, userRecord?.id || null);
            return { success: true, branchId };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('doc:listBranches', async (_event, { documentId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const branches = activeDatabase.getDb().prepare(`SELECT db.*, p.username as creator_name FROM document_branches db LEFT JOIN peers p ON db.created_by = p.id WHERE db.document_id = ? ORDER BY db.updated_at DESC`).all(documentId);
            return { success: true, branches };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('doc:mergeBranch', async (_event, { branchId, documentId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const db = activeDatabase.getDb();
            const branch = db.prepare(`SELECT yjs_state, branch_name FROM document_branches WHERE id = ?`).get(branchId) as any;
            const doc = db.prepare(`SELECT yjs_state FROM documents WHERE id = ?`).get(documentId) as any;
            if (!branch) throw new Error("Branch not found");

            const ydoc = new Y.Doc();
            if (doc?.yjs_state) Y.applyUpdate(ydoc, new Uint8Array(doc.yjs_state));
            if (branch?.yjs_state) Y.applyUpdate(ydoc, new Uint8Array(branch.yjs_state));
            
            const mergedState = Buffer.from(Y.encodeStateAsUpdate(ydoc));
            db.prepare(`UPDATE documents SET yjs_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(mergedState, documentId);
            if (mainWindow) mainWindow.webContents.send('sync-refresh');
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('doc:forceOverwriteBranch', async (_event, { branchId, documentId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const db = activeDatabase.getDb();
            const branch = db.prepare(`SELECT yjs_state FROM document_branches WHERE id = ?`).get(branchId) as any;
            if (!branch) throw new Error("Branch not found");

            // We completely bypass the Yjs merge and ruthlessly replace the main document's state
            db.prepare(`UPDATE documents SET yjs_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(branch.yjs_state, documentId);
            
            if (mainWindow) mainWindow.webContents.send('sync-refresh');
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('doc:deleteBranch', async (_event, { branchId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            activeDatabase.getDb().prepare(`DELETE FROM document_branches WHERE id = ?`).run(branchId);
            if (mainWindow) mainWindow.webContents.send('sync-refresh');
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // <--- UPGRADED: Save and Restore now handle the HTML string directly! --->
    ipcMain.handle('doc:saveVersion', async (_event, { documentId, userId, message, state, html }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const versionId = uuidv4();
            const db = activeDatabase.getDb();
            const userRecord = db.prepare(`SELECT id FROM peers WHERE username = ?`).get(userId) as any;
            const buffer = Buffer.from(state);
            
            db.prepare(`
                INSERT INTO document_versions (id, document_id, message, yjs_state, created_by, html) 
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(versionId, documentId, message, buffer, userRecord?.id || null, html || '');

            return { success: true };
        } catch (error: any) {
            console.error('Failed to save version:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('doc:listVersions', async (_event, { documentId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const db = activeDatabase.getDb();
            const versions = db.prepare(`
                SELECT dv.id, dv.message, dv.created_at, p.username as creator_name
                FROM document_versions dv
                LEFT JOIN peers p ON dv.created_by = p.id
                WHERE dv.document_id = ?
                ORDER BY dv.created_at DESC
            `).all(documentId);
            return { success: true, versions };
        } catch (error: any) {
            console.error('Failed to list versions:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('doc:restoreVersion', async (_event, { documentId, versionId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const db = activeDatabase.getDb();
            const record = db.prepare(`SELECT yjs_state, html FROM document_versions WHERE id = ? AND document_id = ?`).get(versionId, documentId) as any;
            
            if (record) {
                return { 
                    success: true, 
                    state: record.yjs_state ? Array.from(new Uint8Array(record.yjs_state)) : undefined,
                    html: record.html
                };
            }
            return { success: false, error: 'Version not found' };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('doc:exportPdf', async (_event, { html, title }) => {
        try {
            const printWindow = new BrowserWindow({
                show: false,
                webPreferences: { nodeIntegration: false, contextIsolation: true }
            });
            const formattedHtml = `
                <html>
                <head>
                  <style>
                    body { font-family: Arial, sans-serif; padding: 40px; color: black; background: white; }
                    h1 { text-align: center; border-bottom: 1px solid #ccc; padding-bottom: 10px; color: #333; }
                    ul { list-style-type: disc; margin-left: 20px; }
                    ol { list-style-type: decimal; margin-left: 20px; }
                    blockquote { border-left: 4px solid #ccc; padding-left: 10px; color: #666; }
                    pre { background: #f4f4f4; padding: 10px; border-radius: 4px; color: black; }
                  </style>
                </head>
                <body>
                  <h1>${title}</h1>
                  ${html}
                </body>
                </html>
            `;
            await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(formattedHtml)}`);
            
            const pdfData = await printWindow.webContents.printToPDF({
                printBackground: true,
                pageSize: 'A4'
            });
            
            const { dialog } = require('electron');
            const { filePath } = await dialog.showSaveDialog({
                title: 'Save PDF',
                defaultPath: `${title}.pdf`,
                filters: [{ name: 'PDFs', extensions: ['pdf'] }]
            });

            if (filePath) {
                require('fs').writeFileSync(filePath, pdfData);
            }
            printWindow.close();
            return { success: true };
        } catch (error: any) {
            console.error('PDF Export Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.on('doc:send-update', (_event, { docId, update }) => {
        if (p2pEngine) p2pEngine.broadcast({ type: 'SYNC_DOC_UPDATE', docId, update });
    });

    ipcMain.handle('chat:get', async (_event, { projectId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const messages = activeDatabase.getDb().prepare(`SELECT * FROM project_messages WHERE project_id = ? ORDER BY timestamp ASC`).all(projectId);
            return { success: true, messages };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('chat:send', async (_event, data) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            activeDatabase.getDb().prepare(`INSERT INTO project_messages (id, project_id, sender, text, attachment, attachment_name, is_edited, timestamp) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`).run(data.id, data.projectId, data.sender, data.text, data.attachment, data.attachmentName, data.timestamp);
            if (p2pEngine) p2pEngine.broadcast({ type: 'SYNC_CHAT_MESSAGE', message: data });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('chat:edit', async (_event, { id, text }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            activeDatabase.getDb().prepare(`UPDATE project_messages SET text = ?, is_edited = 1 WHERE id = ?`).run(text, id);
            if (p2pEngine) p2pEngine.broadcast({ type: 'SYNC_CHAT_EDIT', id, text });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('chat:delete', async (_event, { id }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            activeDatabase.getDb().prepare(`DELETE FROM project_messages WHERE id = ?`).run(id);
            if (p2pEngine) p2pEngine.broadcast({ type: 'SYNC_CHAT_DELETE', id });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('profile:get', async (_event, userId) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const db = activeDatabase.getDb();
            const profile = db.prepare(`SELECT id, username, email, about_me FROM peers WHERE username = ?`).get(userId) as any;
            
            const aliases = db.prepare(`
                SELECT p.id as project_id, p.name as project_name, pm.nickname 
                FROM projects p
                JOIN project_members pm ON p.id = pm.project_id
                WHERE pm.peer_id = ?
            `).all(profile.id);

            return { success: true, profile, aliases };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('profile:update', async (_event, { userId, username, email, about }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const db = activeDatabase.getDb();
            db.prepare(`UPDATE peers SET username = ?, email = ?, about_me = ? WHERE username = ?`).run(username, email, about, userId);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('profile:updateAlias', async (_event, { userId, projectId, nickname }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const db = activeDatabase.getDb();
            const userRecord = db.prepare(`SELECT id FROM peers WHERE username = ?`).get(userId) as any;
            db.prepare(`UPDATE project_members SET nickname = ? WHERE peer_id = ? AND project_id = ?`).run(nickname, userRecord.id, projectId);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('profile:delete', async (_event, userId) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            activeDatabase.close();
            activeDatabase = null;
            if (p2pEngine) { p2pEngine.stop(); p2pEngine = null; }

            const userDataPath = app.getPath('userData');
            const fs = require('fs');
            const dbFile = path.join(userDataPath, `airwork_${userId}.db`);
            const keysFile = `${dbFile}.keys.json`;

            if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
            if (fs.existsSync(keysFile)) fs.unlinkSync(keysFile);

            return { success: true };
        } catch (error: any) {
            console.error(error);
            return { success: false, error: error.message };
        }
    });
}

app.whenReady().then(() => {
    setupIpcHandlers();
    createWindow();

    app.on('activate', () =>{
        if (BrowserWindow.getAllWindows().length === 0){
            createWindow();
        }
    });
}).catch(console.error);

app.on('window-all-closed', () =>{
    if (process.platform !== 'darwin'){
        app.quit();
    }
});