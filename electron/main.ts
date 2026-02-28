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
}