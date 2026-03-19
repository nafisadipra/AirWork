import { app, BrowserWindow, ipcMain} from 'electron';
import * as path from 'path';
import { EncryptedDatabase } from './database/encrypted-db';
import { v4 as uuidv4 } from 'uuid';
import * as bip39 from 'bip39';

let activeDatabase: EncryptedDatabase | null = null;
let mainWindow : BrowserWindow | null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'SecureCollab',
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
    ipcMain.handle('auth:login' , async (_event, credentials)=> {
        console.log('Login attempt for:', credentials.userId);
        try {
      activeDatabase = new EncryptedDatabase(credentials.userId);
      // isNewUser = false
      const success = await activeDatabase.initialize(credentials.password, false); 
      
      if (success) {
        return { success: true };
      } else {
        return { success: false, error: 'Invalid password or corrupted database' };
      }
    } catch (error) {
      return { success: false, error: 'Login failed' };
    }
    });

    ipcMain.handle('auth:register', async (event, credentials) => {
  const { userId, email, password } = credentials; 

  try {
    // 1. Generate 256 bits of entropy (which equals exactly 24 words)
    const recoveryPhrase = bip39.generateMnemonic(256);

    const db = new EncryptedDatabase(userId);
    
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

    ipcMain.handle('doc:create', async (_event , metadata)=>{
        console.log('Creating new document:',metadata.title);
        return{success: true, id:`doc-${Date.now()}`};

    });

    ipcMain.handle('doc:list', async ()=>{
        return{success: true, documents:[]};
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