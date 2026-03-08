import { app, BrowserWindow, ipcMain} from 'electron';
import * as path from 'path';

let mainWindow : BrowserWindow | null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    if (process.env.NODE_ENV === 'development'){
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
        } else {
            mainWindow.loadFile(path.join(__dirname, '../../next/server/app/index.html'))
        }

        mainWindow.webContents.on('will-navigate', (event, url)=> {
            if (!url.startsWith('http://localhost:3000') && !url.startsWith('file://')){
                event.preventDefault();
            }
        });
       
}

// IPC (Inter-Process Communication)

function setupIpcHandlers(){
    ipcMain.handle('auth:login' , async (_event, credentials)=> {
        console.log('Login attempt for:', credentials.userId);
        return {success: true};
    });

    ipcMain.handle('auth:register', async (_event, credentials)=>{
        console.log('Register attempt for:', credentials.userId);
        return{success: true};
    });

    ipcMain.handle('auth:logout', async () =>{
        console.log('logging out, clearing...');
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