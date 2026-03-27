// electron/main.ts
import { app, BrowserWindow, ipcMain} from 'electron';
import * as path from 'path';
import { EncryptedDatabase } from './database/encrypted-db';
import { v4 as uuidv4 } from 'uuid';
import * as bip39 from 'bip39';
import { P2PEngine } from './p2p';

let activeDatabase: EncryptedDatabase | null = null;
let p2pEngine: P2PEngine | null = null;
let mainWindow : BrowserWindow | null;

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

  // Check if we are running the 'npm run dev' script
  const isDev = process.env.npm_lifecycle_event === 'dev' || !app.isPackaged;

  if (isDev) {
    console.log('Running in Dev Mode: Loading localhost:3000');
    mainWindow.loadURL('http://localhost:3000');
    //mainWindow.webContents.openDevTools();
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

// IPC (Inter-Process Communication)

function setupIpcHandlers(){
    ipcMain.handle('auth:login', async (_event, credentials) => {
        console.log('Login attempt for:', credentials.userId);
        try {
            // 1. Initialize the encrypted local vault
            activeDatabase = new EncryptedDatabase(credentials.userId);
            const success = await activeDatabase.initialize(credentials.password, false); 
            
            if (success) {
                // 2. Start the P2P Engine so other local users can find us
                const db = activeDatabase.getDb();
                const userRecord = db.prepare(`SELECT id FROM peers WHERE username = ?`).get(credentials.userId) as any;
                
                if (userRecord) {
                    p2pEngine = new P2PEngine(userRecord.id, credentials.userId);
                    p2pEngine.start();
                    
                    // Listen for newly discovered peers and send them to the frontend
                    p2pEngine.on('peer-discovered', (peerData) => {
                        if (mainWindow) {
                            mainWindow.webContents.send('peer-discovered', peerData);
                        }
                    });

                    // <--- INCOMING REAL-TIME SYNC LOGIC --->
                    p2pEngine.on('message', (payload) => {
                        if (!activeDatabase) return;
                        const db = activeDatabase.getDb();
                        
                        try {
                            if (payload.type === 'SYNC_TASK_UPSERT') {
                                const t = payload.task;
                                console.log(`[SYNC] 📥 Receiving task update: ${t.title}`);
                                
                                // Insert the task, or Update it if it already exists!
                                db.prepare(`
                                    INSERT INTO tasks (id, project_id, title, status, position, start_date, due_date)
                                    VALUES (?, ?, ?, ?, ?, ?, ?)
                                    ON CONFLICT(id) DO UPDATE SET
                                    status=excluded.status, position=excluded.position, title=excluded.title
                                `).run(t.id, t.project_id, t.title, t.status, t.position, t.start_date, t.due_date);
                                
                                // Tell the React Frontend to instantly refresh!
                                if (mainWindow) mainWindow.webContents.send('sync-refresh');
                            } 
                            else if (payload.type === 'SYNC_TASK_DELETE') {
                                console.log(`[SYNC] 🗑️ Receiving task deletion: ${payload.taskId}`);
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
                            // <--- NEW: SOMEONE IS KNOCKING WITH A TOKEN --->
                            else if (payload.type === 'JOIN_PROJECT_REQUEST') {
                                const invite = db.prepare(`SELECT * FROM project_invites WHERE invite_token = ? AND expires_at > ?`).get(payload.token, new Date().toISOString()) as any;
                                
                                if (invite) {
                                    console.log(`[P2P] 🔑 Valid token received from ${payload.username}. Beaming project data...`);
                                    
                                    // Add them to our local members table
                                    db.prepare(`
                                        INSERT INTO project_members (project_id, peer_id, role) 
                                        VALUES (?, ?, ?) ON CONFLICT DO NOTHING
                                    `).run(invite.project_id, payload.peerId, invite.role);
                                    
                                    // Make sure we have their peer record
                                    db.prepare(`
                                        INSERT INTO peers (id, username, email, public_key) 
                                        VALUES (?, ?, '', 'placeholder') ON CONFLICT DO NOTHING
                                    `).run(payload.peerId, payload.username);

                                    // Gather all the project data
                                    const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(invite.project_id);
                                    const tasks = db.prepare(`SELECT * FROM tasks WHERE project_id = ?`).all(invite.project_id);
                                    const docs = db.prepare(`SELECT * FROM documents WHERE project_id = ?`).all(invite.project_id);
                                    const members = db.prepare(`SELECT * FROM project_members WHERE project_id = ?`).all(invite.project_id);

                                    // Beam it directly back to them
                                    p2pEngine?.broadcast({
                                        type: 'JOIN_PROJECT_ACCEPT',
                                        targetPeerId: payload.peerId,
                                        project,
                                        tasks,
                                        docs,
                                        members
                                    });
                                    
                                    // Refresh our own UI to show the new member!
                                    if (mainWindow) mainWindow.webContents.send('sync-refresh');
                                }
                            }
                            // <--- NEW: OUR KNOCK WAS ANSWERED, HERE IS THE DATA --->
                            else if (payload.type === 'JOIN_PROJECT_ACCEPT') {
                                const userRecord = db.prepare(`SELECT id FROM peers WHERE username = ?`).get(credentials.userId) as any;
                                
                                // Only process it if the data is meant for US
                                if (userRecord && payload.targetPeerId === userRecord.id) {
                                    console.log(`[P2P] 🎉 Project access granted! Saving locally...`);
                                    
                                    // Save Project
                                    db.prepare(`INSERT INTO projects (id, name, created_by, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`)
                                      .run(payload.project.id, payload.project.name, payload.project.created_by, payload.project.created_at);
                                    
                                    // Save Members
                                    const insertMember = db.prepare(`INSERT INTO project_members (project_id, peer_id, role, joined_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`);
                                    payload.members.forEach((m: any) => insertMember.run(m.project_id, m.peer_id, m.role, m.joined_at));

                                    // Save Tasks
                                    const insertTask = db.prepare(`
                                        INSERT INTO tasks (id, project_id, title, status, position, assigned_to, start_date, due_date) 
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING
                                    `);
                                    payload.tasks.forEach((t: any) => insertTask.run(t.id, t.project_id, t.title, t.status, t.position, t.assigned_to, t.start_date, t.due_date));

                                    // Save Docs
                                    const insertDoc = db.prepare(`INSERT INTO documents (id, project_id, title, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`);
                                    payload.docs.forEach((d: any) => insertDoc.run(d.id, d.project_id, d.title, d.updated_at));

                                    // Refresh the UI to show the new project!
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
                const stmt = db.getDb().prepare(`
                    INSERT INTO peers (id, username, email, public_key) 
                    VALUES (?, ?, ?, ?)
                `);
                stmt.run(uuidv4(), userId, email, 'placeholder_pub_key');
                return { success: true, recoveryPhrase: recoveryPhrase };
            }
            
            return { success: false, error: 'Failed to initialize encrypted vault' };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('auth:logout', async () =>{
        console.log('logging out, clearing...');
        if (activeDatabase) {
            activeDatabase.close(); 
            activeDatabase = null;
        }
        if (p2pEngine) {
            p2pEngine.stop();
            p2pEngine = null;
        }
        return{ success: true};
    });

    ipcMain.handle('doc:create', async (_event, { projectId, title }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const docId = uuidv4();
            const db = activeDatabase.getDb();
            
            db.prepare(`
                INSERT INTO documents (id, project_id, title) 
                VALUES (?, ?, ?)
            `).run(docId, projectId, title);

            console.log(`[DOC] 📄 Created new document: ${title}`);
            return { success: true, id: docId };
        } catch (error: any) {
            console.error('Failed to create document:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('doc:list', async (_event, { projectId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const db = activeDatabase.getDb();
            const documents = db.prepare(`
                SELECT * FROM documents 
                WHERE project_id = ? 
                ORDER BY updated_at DESC
            `).all(projectId);
            
            return { success: true, documents };
        } catch (error: any) {
            console.error('Failed to list documents:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('project:create', async (_event, { name, userId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };

        try {
            const projectId = uuidv4();
            const db = activeDatabase.getDb();
            
            const userRecord = db.prepare(`SELECT id FROM peers WHERE username = ?`).get(userId) as any;
            if (!userRecord) return { success: false, error: 'Could not find local user profile.' };
            
            const peerId = userRecord.id;

            const projectStmt = db.prepare(`
                INSERT INTO projects (id, name, created_by) 
                VALUES (?, ?, ?)
            `);
            projectStmt.run(projectId, name, peerId);

            const memberStmt = db.prepare(`
                INSERT INTO project_members (project_id, peer_id, role) 
                VALUES (?, ?, 'admin')
            `);
            memberStmt.run(projectId, peerId);

            console.log(`Project "${name}" initialized with ID: ${projectId}`);
            return { success: true, projectId };
        } catch (error: any) {
            console.error('Failed to create project:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('project:list', async (_event, { userId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };

        try {
            const db = activeDatabase.getDb();
            
            const userRecord = db.prepare(`SELECT id FROM peers WHERE username = ?`).get(userId) as any;
            if (!userRecord) return { success: false, error: 'User not found' };
            
            const projects = db.prepare(`
                SELECT p.id, p.name, pm.role, p.created_at
                FROM projects p
                JOIN project_members pm ON p.id = pm.project_id
                WHERE pm.peer_id = ?
                ORDER BY p.created_at DESC
            `).all(userRecord.id);

            return { success: true, projects };
        } catch (error: any) {
            console.error('Failed to fetch projects:', error);
            return { success: false, error: error.message };
        }
    });

    // --- KANBAN BOARD HANDLERS ---
    ipcMain.handle('task:list', async (_event, { projectId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const db = activeDatabase.getDb();
            const tasks = db.prepare(`
                SELECT * FROM tasks 
                WHERE project_id = ? 
                ORDER BY position ASC, created_at DESC
            `).all(projectId);
            return { success: true, tasks };
        } catch (error: any) {
            console.error('Failed to fetch tasks:', error);
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

            const stmt = db.prepare(`
                INSERT INTO tasks (id, project_id, title, status, position, assigned_to, start_date, due_date) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run(
                taskId, 
                projectId, 
                title, 
                status, 
                position, 
                assigneeId || null, 
                startDate || null, 
                dueDate || null
            );
            
            if (p2pEngine) {
                const newTask = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(taskId);
                p2pEngine.broadcast({ type: 'SYNC_TASK_UPSERT', task: newTask });
            }

            return { success: true, taskId };
        } catch (error: any) {
            console.error('Failed to create task:', error);
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
            const db = activeDatabase.getDb();
            db.prepare(`DELETE FROM tasks WHERE id = ?`).run(taskId);
            return { success: true };
        } catch (error: any) {
            console.error('Failed to delete task:', error);
            return { success: false, error: error.message };
        }
    });

    // --- PROJECT SETTINGS & MEMBERS ---
    ipcMain.handle('project:getMembers', async (_event, { projectId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const db = activeDatabase.getDb();
            const members = db.prepare(`
                SELECT p.id, p.username, pm.role, pm.joined_at 
                FROM peers p
                JOIN project_members pm ON p.id = pm.peer_id
                WHERE pm.project_id = ?
            `).all(projectId);
            
            return { success: true, members };
        } catch (error: any) {
            console.error('Failed to fetch members:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('project:generateInvite', async (_event, { projectId, userId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const db = activeDatabase.getDb();
            const userRecord = db.prepare(`SELECT id FROM peers WHERE username = ?`).get(userId) as any;
            if (!userRecord) throw new Error("User not found");

            const inviteToken = 'aw-' + uuidv4().split('-')[0]; 
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

            db.prepare(`
                INSERT INTO project_invites (invite_token, project_id, created_by, role, expires_at)
                VALUES (?, ?, ?, 'editor', ?)
            `).run(inviteToken, projectId, userRecord.id, expiresAt);

            return { success: true, inviteToken };
        } catch (error: any) {
            console.error('Failed to generate invite:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.on('doc:send-update', (_event, { docId, update }) => {
        if (p2pEngine) {
            p2pEngine.broadcast({ type: 'SYNC_DOC_UPDATE', docId, update });
        }
    });

    // <--- NEW: INITIATE A PROJECT JOIN OVER THE NETWORK --->
    ipcMain.handle('project:join', async (_event, { token, userId }) => {
        if (!activeDatabase || !p2pEngine) return { success: false, error: 'Network engine not ready' };
        try {
            const db = activeDatabase.getDb();
            const userRecord = db.prepare(`SELECT id FROM peers WHERE username = ?`).get(userId) as any;
            if (!userRecord) return { success: false, error: 'User profile not found' };

            console.log(`[P2P] 📡 Broadcasting token: ${token}`);
            
            // Broadcast the token to everyone on the network
            p2pEngine.broadcast({
                type: 'JOIN_PROJECT_REQUEST',
                token: token,
                peerId: userRecord.id,
                username: userId
            });

            // We immediately return success. The UI will wait 1.5s for the 
            // JOIN_PROJECT_ACCEPT to hit the background sync listener!
            return { success: true };
        } catch (error: any) {
            console.error('Failed to request project join:', error);
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
});

app.on('window-all-closed', () =>{
    if (process.platform !== 'darwin'){
        app.quit();
    }
});