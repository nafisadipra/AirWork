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

                    // <--- NEW: INCOMING REAL-TIME SYNC LOGIC --->
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
    // 1. Generate 256 bits of entropy (which equals exactly 24 words)
    const recoveryPhrase = bip39.generateMnemonic(256);

    const db = new EncryptedDatabase(userId);
    
    activeDatabase = db
    // 2. We pass the recoveryPhrase into initialize so the DB can create the "Second Envelope"
    const success = await db.initialize(password, true, recoveryPhrase);

    if (success) {
      // 3. Save the user to their own local phonebook
      const stmt = db.getDb().prepare(`
        INSERT INTO peers (id, username, email, public_key) 
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(uuidv4(), userId, email, 'placeholder_pub_key');
      
      // 4. CRITICAL: We return the recovery phrase to Next.js so the user can write it down!
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
        return{ success: true};

    });

    // 1. Create a new document in the database
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

    // 2. List all documents for the current project
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
            
            // <--- THE FIX: Look up the user's internal UUID using their username --->
            const userRecord = db.prepare(`SELECT id FROM peers WHERE username = ?`).get(userId) as any;
            
            if (!userRecord) {
                return { success: false, error: 'Could not find local user profile.' };
            }
            
            const peerId = userRecord.id;

            // 1. Insert the project using the correct UUID (peerId)
            const projectStmt = db.prepare(`
                INSERT INTO projects (id, name, created_by) 
                VALUES (?, ?, ?)
            `);
            projectStmt.run(projectId, name, peerId);

            // 2. Make the creator an 'admin' member using the correct UUID
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
            
            // 1. Get the internal UUID for the current user
            const userRecord = db.prepare(`SELECT id FROM peers WHERE username = ?`).get(userId) as any;
            if (!userRecord) return { success: false, error: 'User not found' };
            
            // 2. Fetch all projects where this user is a member
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

    // 1. Fetch all tasks for a specific project
    ipcMain.handle('task:list', async (_event, { projectId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const db = activeDatabase.getDb();
            // Fetch tasks, ordering them by their saved position
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

    // 2. Create a new task
    // 2. Create a new task
    ipcMain.handle('task:create', async (_event, args: any) => { // <--- Added 'args: any' here
        const { projectId, title, status, assigneeId, startDate, dueDate } = args; // <--- Destructured here
        
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        
        try {
            const taskId = uuidv4();
            const db = activeDatabase.getDb();
            
            // Give it a default position
            const posResult = db.prepare(`SELECT MAX(position) as maxPos FROM tasks WHERE project_id = ? AND status = ?`).get(projectId, status) as any;
            const position = (posResult?.maxPos || 0) + 1000;

            const stmt = db.prepare(`
                INSERT INTO tasks (id, project_id, title, status, position, assigned_to, start_date, due_date) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            // <--- UPDATED: Fallback to null so SQLite doesn't crash on undefined --->
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
            
            // Broadcast to P2P if active
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

    // 3. Move a task to a different column
    ipcMain.handle('task:updateStatus', async (_event, { taskId, newStatus }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const db = activeDatabase.getDb();
            db.prepare(`UPDATE tasks SET status = ? WHERE id = ?`).run(newStatus, taskId);
            
            // <--- NEW: BROADCAST THE CHANGE --->
            if (p2pEngine) {
                const updatedTask = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(taskId);
                p2pEngine.broadcast({ type: 'SYNC_TASK_UPSERT', task: updatedTask });
            }

            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // 4. Delete a task
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

    // 1. Fetch the real team roster for a project
    ipcMain.handle('project:getMembers', async (_event, { projectId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const db = activeDatabase.getDb();
            // Join peers and project_members to get the actual usernames and roles
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

    // 2. Generate a secure invite token
    ipcMain.handle('project:generateInvite', async (_event, { projectId, userId }) => {
        if (!activeDatabase) return { success: false, error: 'Database not active' };
        try {
            const db = activeDatabase.getDb();
            
            // Get the internal UUID of the user generating the invite
            const userRecord = db.prepare(`SELECT id FROM peers WHERE username = ?`).get(userId) as any;
            if (!userRecord) throw new Error("User not found");

            // Create a short, readable token (e.g., aw-a1b2c3d4)
            const inviteToken = 'aw-' + uuidv4().split('-')[0]; 
            
            // Set expiry for 24 hours from now
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