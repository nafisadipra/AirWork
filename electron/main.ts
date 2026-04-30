// electron/main.ts
import { app, BrowserWindow, ipcMain, protocol, net } from 'electron';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { EncryptedDatabase } from './database/encrypted-db';
import { v4 as uuidv4 } from 'uuid';
import * as bip39 from 'bip39';
import { P2PEngine } from './p2p';
import * as Y from 'yjs';


let activeDatabase: EncryptedDatabase | null = null;
let p2pEngine: P2PEngine | null = null;
let mainWindow: BrowserWindow | null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true }
  }
]);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'AirWork',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Change sandbox to false to ensure the bridge connects in production
      sandbox: false, 
      // Ensure the path correctly points to the file in dist-electron
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const isDev = process.env.npm_lifecycle_event === 'dev' || !app.isPackaged;
  mainWindow.webContents.openDevTools();

  if (isDev) {
    console.log('Running in Dev Mode: Loading localhost:3000');
    mainWindow.loadURL('http://localhost:3000');
  } else {
    console.log('Running in Production: Loading compiled HTML');
    mainWindow.loadURL('app://index.html');
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

                            else if (payload.type === 'SYNC_DOC_UPSERT') {
                            const d = payload.doc;
                            db.prepare(`
                                INSERT INTO documents (id, project_id, title, yjs_state, last_edited_by, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?)
                                ON CONFLICT(id) DO UPDATE SET
                                title = excluded.title,
                                updated_at = excluded.updated_at
                            `).run(
                                d.id,
                                d.project_id,
                                d.title,
                                d.yjs_state || null,
                                d.last_edited_by || null,
                                d.updated_at || new Date().toISOString()
                            );
                            if (mainWindow) mainWindow.webContents.send('sync-refresh');
                        }
                        else if (payload.type === 'SYNC_DOC_DELETE') {
                            db.prepare(`DELETE FROM documents WHERE id = ?`).run(payload.docId);
                            if (mainWindow) mainWindow.webContents.send('sync-refresh');
                        }
                            else if (payload.type === 'SYNC_DOC_UPDATE') {
    // Broadcast to all other peers
    p2pEngine?.broadcast({
        type: 'SYNC_DOC_UPDATE',
        docId: payload.docId,
        update: payload.update
    });
    
    // Send to our own renderer window
    if (mainWindow) {
        mainWindow.webContents.send('doc:receive-update', {
            docId: payload.docId,
            update: payload.update
        });
    }
    
    // Save to database
    try {
        if (activeDatabase && payload.update) {
            const db = activeDatabase.getDb();
            const fullState = Array.from(payload.update);
            db.prepare(`UPDATE documents SET yjs_state = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(fullState), payload.docId);
            console.log(`[P2P] Saved document update for ${payload.docId}`);
        }
    } catch (error) {
        console.error('[P2P] Failed to save document update:', error);
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

                            else if (payload.type === 'PEER_JOINED_PROJECT') {
                                if (!activeDatabase) return;
                                const db = activeDatabase.getDb();
                                
                                try {
                                    console.log(`[P2P] Received PEER_JOINED_PROJECT: ${payload.newUsername} joining ${payload.projectId}`);
                                    
                                    if (payload.projectData.project) {
                                    if (payload.projectData.members && Array.isArray(payload.projectData.members)) {
                                        payload.projectData.members.forEach((m: any) => {
                                            if (m.peer_id) {
                                                db.prepare(`
                                                    INSERT INTO peers (id, username, email, public_key)
                                                    VALUES (?, ?, '', 'placeholder')
                                                    ON CONFLICT(id) DO NOTHING
                                                `).run(m.peer_id, m.peer_id);
                                            }
                                        });
                                    }

                                    db.prepare(`
                                        INSERT INTO projects (id, name, created_by, created_at)
                                        VALUES (?, ?, ?, ?)
                                        ON CONFLICT(id) DO UPDATE SET
                                        name = excluded.name
                                    `).run(
                                        payload.projectData.project.id,
                                        payload.projectData.project.name,
                                        payload.projectData.project.created_by,
                                        payload.projectData.project.created_at
                                    );
                                    }
                                    
                                    if (payload.projectData.members && Array.isArray(payload.projectData.members)) {
                                        const insertMember = db.prepare(`
                                            INSERT INTO project_members (project_id, peer_id, role, joined_at, nickname)
                                            VALUES (?, ?, ?, ?, NULL)
                                            ON CONFLICT(project_id, peer_id) DO UPDATE SET
                                            role = excluded.role
                                        `);
                                        payload.projectData.members.forEach((m: any) => {
                                            insertMember.run(m.project_id, m.peer_id, m.role, m.joined_at || new Date().toISOString());
                                        });
                                    }
                                    
                                    if (payload.projectData.tasks && Array.isArray(payload.projectData.tasks)) {
                                        const insertTask = db.prepare(`
                                            INSERT INTO tasks (id, project_id, title, status, position, assigned_to, start_date, due_date)
                                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                                            ON CONFLICT(id) DO UPDATE SET
                                            status = excluded.status, 
                                            title = excluded.title, 
                                            position = excluded.position
                                        `);
                                        payload.projectData.tasks.forEach((t: any) => {
                                            insertTask.run(
                                                t.id, 
                                                t.project_id, 
                                                t.title, 
                                                t.status, 
                                                t.position || 0, 
                                                t.assigned_to || null, 
                                                t.start_date || null, 
                                                t.due_date || null
                                            );
                                        });
                                    }
                                    
                                    if (payload.projectData.docs && Array.isArray(payload.projectData.docs)) {
                                        const insertDoc = db.prepare(`
                                            INSERT INTO documents (id, project_id, title, yjs_state, last_edited_by, updated_at)
                                            VALUES (?, ?, ?, ?, ?, ?)
                                            ON CONFLICT(id) DO UPDATE SET
                                            title = excluded.title,
                                            yjs_state = excluded.yjs_state,
                                            updated_at = excluded.updated_at
                                        `);
                                        payload.projectData.docs.forEach((d: any) => {
                                            insertDoc.run(
                                                d.id, 
                                                d.project_id, 
                                                d.title, 
                                                d.yjs_state || null, 
                                                d.last_edited_by || null, 
                                                d.updated_at || new Date().toISOString()
                                            );
                                        });
                                    }
                                    
                                    if (payload.projectData.messages && Array.isArray(payload.projectData.messages)) {
                                        const insertMsg = db.prepare(`
                                            INSERT INTO project_messages (id, project_id, sender, text, attachment, attachment_name, is_edited, timestamp)
                                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                                            ON CONFLICT(id) DO UPDATE SET
                                            text = excluded.text,
                                            is_edited = excluded.is_edited
                                        `);
                                        payload.projectData.messages.forEach((m: any) => {
                                            insertMsg.run(
                                                m.id, 
                                                m.project_id, 
                                                m.sender, 
                                                m.text || '', 
                                                m.attachment || null, 
                                                m.attachment_name || null, 
                                                m.is_edited || 0, 
                                                m.timestamp
                                            );
                                        });
                                    }
                                    
                                    console.log(`[P2P] Successfully synced all project data for ${payload.projectId}`);
                                    
                                    if (mainWindow) mainWindow.webContents.send('sync-refresh');
                                } catch (error) {
                                    console.error('[P2P] Failed to process peer join:', error);
                                }
                            }
                            else if (payload.type === 'JOIN_PROJECT_WITH_TOKEN') {
                                console.log(`[P2P] ${payload.joiningUsername} wants to join with token: ${payload.token}`);
                                
                                // Check if WE have this token in our database
                                const invite = db.prepare(`
                                    SELECT * FROM project_invites 
                                    WHERE invite_token = ? AND expires_at > ?
                                `).get(payload.token, new Date().toISOString()) as any;
                                
                                if (!invite) {
                                    console.log(`[P2P] Token ${payload.token} not found on this machine - ignoring`);
                                    return;
                                }
                                
                                console.log(`[P2P] Token is valid! Processing join for ${payload.joiningUsername}`);
                                
                                // Add the joining peer to our peers table
                                db.prepare(`
                                    INSERT INTO peers (id, username, email, public_key)
                                    VALUES (?, ?, '', 'placeholder')
                                    ON CONFLICT(id) DO UPDATE SET 
                                    username = excluded.username
                                `).run(payload.joiningPeerId, payload.joiningUsername);
                                
                                // Add them to the project
                                db.prepare(`
                                    INSERT INTO project_members (project_id, peer_id, role, joined_at)
                                    VALUES (?, ?, ?, datetime('now'))
                                    ON CONFLICT DO NOTHING
                                `).run(invite.project_id, payload.joiningPeerId, invite.role);
                                
                                console.log(`[P2P] Added ${payload.joiningUsername} to project ${invite.project_id}`);
                                
                                // Get all the project data from our database
                                const project = db.prepare(`SELECT * FROM projects WHERE id = ?`)
                                    .get(invite.project_id) as any;
                                const tasks = db.prepare(`SELECT * FROM tasks WHERE project_id = ?`)
                                    .all(invite.project_id) as any[];
                                const docs = db.prepare(`SELECT * FROM documents WHERE project_id = ?`)
                                    .all(invite.project_id) as any[];
                                const members = db.prepare(`SELECT * FROM project_members WHERE project_id = ?`)
                                    .all(invite.project_id) as any[];
                                const messages = db.prepare(`SELECT * FROM project_messages WHERE project_id = ?`)
                                    .all(invite.project_id) as any[];
                                
                                console.log(`[P2P] Sending project data to ${payload.joiningUsername}: ${tasks.length} tasks, ${docs.length} docs, ${members.length} members`);
                                
                                // Send the project data back to the joiner
                                p2pEngine?.broadcast({
                                    type: 'PEER_JOINED_PROJECT_DATA',
                                    projectId: invite.project_id,
                                    joiningPeerId: payload.joiningPeerId,
                                    joiningUsername: payload.joiningUsername,
                                    projectData: {
                                        project,
                                        tasks,
                                        docs,
                                        members,
                                        messages
                                    }
                                });
                                
                                if (mainWindow) mainWindow.webContents.send('sync-refresh');
                            }

                            else if (payload.type === 'PEER_JOINED_PROJECT_DATA') {
                                console.log(`[P2P] Received project data for ${payload.joiningUsername}`);
                                
                                // Check if this data is for us (the current user joining)
                                if (payload.joiningUsername === credentials.userId) {
                                    console.log(`[P2P] This data is for us! Importing project ${payload.projectId}`);
                                    
                                    // Insert the project into OUR database
                                    if (payload.projectData.project) {
                                        db.prepare(`
                                            INSERT INTO projects (id, name, created_by, created_at)
                                            VALUES (?, ?, ?, ?)
                                            ON CONFLICT(id) DO UPDATE SET
                                            name = excluded.name
                                        `).run(
                                            payload.projectData.project.id,
                                            payload.projectData.project.name,
                                            payload.projectData.project.created_by,
                                            payload.projectData.project.created_at
                                        );
                                        console.log(`[P2P] Inserted project ${payload.projectId}`);
                                    }
                                    
                                    // Insert all members
                                    // Insert placeholder peers first to avoid FK constraint failures
                                    if (payload.projectData.members && Array.isArray(payload.projectData.members)) {
                                        const upsertPeer = db.prepare(`
                                            INSERT INTO peers (id, username, email, public_key)
                                            VALUES (?, ?, '', 'placeholder')
                                            ON CONFLICT(id) DO NOTHING
                                        `);
                                        payload.projectData.members.forEach((m: any) => {
                                            if (m.peer_id) upsertPeer.run(m.peer_id, m.peer_id);
                                        });
                                    }

                                    // Insert all members
                                    if (payload.projectData.members && Array.isArray(payload.projectData.members)) {
                                        const insertMember = db.prepare(`
                                            INSERT INTO project_members (project_id, peer_id, role, joined_at)
                                            VALUES (?, ?, ?, ?)
                                            ON CONFLICT(project_id, peer_id) DO UPDATE SET
                                            role = excluded.role
                                        `);
                                        payload.projectData.members.forEach((m: any) => {
                                            insertMember.run(m.project_id, m.peer_id, m.role, m.joined_at || new Date().toISOString());
                                        });
                                        console.log(`[P2P] Inserted ${payload.projectData.members.length} members`);
                                    }

                                    // Ensure the joiner's own membership row exists even if the host snapshot omitted them
                                    const selfPeer = db.prepare(`SELECT id FROM peers WHERE username = ?`).get(credentials.userId) as any;
                                    if (selfPeer && payload.projectData.project) {
                                        db.prepare(`
                                            INSERT INTO project_members (project_id, peer_id, role, joined_at)
                                            VALUES (?, ?, 'editor', datetime('now'))
                                            ON CONFLICT(project_id, peer_id) DO NOTHING
                                        `).run(payload.projectData.project.id, selfPeer.id);
}
                                    
                                    // Insert all tasks
                                    if (payload.projectData.tasks && Array.isArray(payload.projectData.tasks)) {
                                        const insertTask = db.prepare(`
                                            INSERT INTO tasks (id, project_id, title, status, position, assigned_to, start_date, due_date)
                                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                                            ON CONFLICT(id) DO UPDATE SET
                                            status = excluded.status,
                                            title = excluded.title
                                        `);
                                        payload.projectData.tasks.forEach((t: any) => {
                                            insertTask.run(
                                                t.id,
                                                t.project_id,
                                                t.title,
                                                t.status,
                                                t.position || 0,
                                                t.assigned_to || null,
                                                t.start_date || null,
                                                t.due_date || null
                                            );
                                        });
                                        console.log(`[P2P] Inserted ${payload.projectData.tasks.length} tasks`);
                                    }
                                    
                                    // Insert all documents
                                    if (payload.projectData.docs && Array.isArray(payload.projectData.docs)) {
                                        const insertDoc = db.prepare(`
                                            INSERT INTO documents (id, project_id, title, yjs_state, last_edited_by, updated_at)
                                            VALUES (?, ?, ?, ?, ?, ?)
                                            ON CONFLICT(id) DO UPDATE SET
                                            title = excluded.title
                                        `);
                                        payload.projectData.docs.forEach((d: any) => {
                                            insertDoc.run(
                                                d.id,
                                                d.project_id,
                                                d.title,
                                                d.yjs_state || null,
                                                d.last_edited_by || null,
                                                d.updated_at || new Date().toISOString()
                                            );
                                        });
                                        console.log(`[P2P] Inserted ${payload.projectData.docs.length} documents`);
                                    }
                                    
                                    // Insert all messages
                                    if (payload.projectData.messages && Array.isArray(payload.projectData.messages)) {
                                        const insertMsg = db.prepare(`
                                            INSERT INTO project_messages (id, project_id, sender, text, attachment, attachment_name, is_edited, timestamp)
                                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                                            ON CONFLICT(id) DO UPDATE SET
                                            text = excluded.text
                                        `);
                                        payload.projectData.messages.forEach((m: any) => {
                                            insertMsg.run(
                                                m.id,
                                                m.project_id,
                                                m.sender,
                                                m.text || '',
                                                m.attachment || null,
                                                m.attachment_name || null,
                                                m.is_edited || 0,
                                                m.timestamp
                                            );
                                        });
                                        console.log(`[P2P] Inserted ${payload.projectData.messages.length} messages`);
                                    }
                                    
                                    console.log(`[P2P] Successfully imported all project data!`);
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
        if (!activeDatabase || !p2pEngine) {
            return { success: false, error: 'P2P not initialized' };
        }
        
        try {
            const db = activeDatabase.getDb();
            console.log(`[Join] ${userId} requesting to join with token: ${token}`);
            
            // Ensure user exists in our peers table
            let userPeer = db.prepare(`SELECT id FROM peers WHERE username = ?`).get(userId) as any;
            if (!userPeer) {
                const peerId = uuidv4();
                console.log(`[Join] Creating new peer ${userId}`);
                db.prepare(`INSERT INTO peers (id, username, email, public_key) 
                           VALUES (?, ?, '', 'placeholder')`).run(peerId, userId);
                userPeer = { id: peerId };
            }
            
            // Broadcast the join request to all peers
            console.log(`[Join] Broadcasting join request to network`);
            p2pEngine.broadcast({
                type: 'JOIN_PROJECT_WITH_TOKEN',
                token: token,
                joiningPeerId: userPeer.id,
                joiningUsername: userId
            });
            
            return { success: true };
            
        } catch (error: any) {
            console.error('[Join] Error:', error);
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
        const db = activeDatabase.getDb();
        db.prepare(`INSERT INTO documents (id, project_id, title) VALUES (?, ?, ?)`).run(docId, projectId, title);
        if (p2pEngine) {
            const newDoc = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(docId);
            p2pEngine.broadcast({ type: 'SYNC_DOC_UPSERT', doc: newDoc });
        }
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

    ipcMain.handle('peers:list', async () => {
            if (!p2pEngine) return { success: true, peers: [] };
            
            try {
                return { success: true, peers: p2pEngine.getKnownPeers() };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        });

    ipcMain.handle('peers:trust', async (_event, peerId) => {
    if (!activeDatabase || !p2pEngine) {
        return { success: false, error: 'P2P not initialized' };
    }
    
    try {
        const db = activeDatabase.getDb();
        
        // Find the peer from the discovered peers list
        const peer = p2pEngine.getKnownPeers().find((p: any) => p.id === peerId);
        
        if (!peer) {
            console.error(`[Trust] Peer ${peerId} not found in network`);
            return { success: false, error: 'Peer not found in network' };
        }
        
        console.log(`[Trust] Attempting to trust peer: ${peer.user} (${peerId})`);
        
        // Check if peer already exists
        const existingPeer = db.prepare(`SELECT id FROM peers WHERE id = ?`).get(peerId) as any;
        
        if (existingPeer) {
            // Peer exists, just update
            console.log(`[Trust] Peer already exists, updating...`);
            db.prepare(`UPDATE peers SET username = ? WHERE id = ?`).run(peer.user, peerId);
        } else {
            // Peer doesn't exist, insert new
            console.log(`[Trust] Creating new peer entry...`);
            db.prepare(`
                INSERT INTO peers (id, username, email, public_key)
                VALUES (?, ?, ?, ?)
            `).run(peerId, peer.user, '', 'placeholder');
        }
        
        console.log(`[Trust] Peer ${peer.user} (${peerId}) is now trusted`);
        return { success: true };
        
    } catch (error: any) {
        console.error(`[Trust] Error:`, error);
        return { success: false, error: error.message };
    }
});
 
ipcMain.handle('peers:block', async (_event, peerId) => {
    if (!activeDatabase) {
        return { success: false, error: 'Database not active' };
    }
    
    try {
        const db = activeDatabase.getDb();
        console.log(`[Block] Peer ${peerId} blocked`);
        // TODO: Add 'blocked' column to peers table in future
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});
 
ipcMain.handle('peers:get-safety-number', async (_event, peerId) => {
    if (!activeDatabase) {
        return { success: false, error: 'Database not active' };
    }
    
    try {
        // Generate deterministic safety number from peerId
        const hash = peerId.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
        const safetyNumber = `${String(Math.abs(hash)).padStart(12, '0')}`.match(/.{1,3}/g)?.join(' ') || '000 000 000 000';
        
        console.log(`[Safety] Safety number for ${peerId}: ${safetyNumber}`);
        return { success: true, safetyNumber };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});  

app.whenReady().then(() => {
    // FIX: Use the standard URL parser to safely remove "localhost"
    protocol.handle('app', (request) => {
        const url = new URL(request.url);
        let urlPath = url.pathname;
        
        // Strip the leading slash so it joins correctly with our 'out' folder
        urlPath = urlPath.replace(/^\/+/, '');

        // Handle root or page routing
        if (!urlPath) {
            urlPath = 'index.html';
        } else if (!path.extname(urlPath)) {
            // If it's a Next.js page route (like 'dashboard'), append .html
            urlPath += '.html';
        }

        const filePath = path.join(__dirname, '../out', urlPath);
        return net.fetch(pathToFileURL(filePath).toString());
    });

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