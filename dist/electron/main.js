"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const tabs_1 = require("./tabs");
// Enable speech recognition features in Chromium
electron_1.app.commandLine.appendSwitch('enable-speech-input');
electron_1.app.commandLine.appendSwitch('enable-features', 'SpeechRecognition');
// Disable hardware acceleration to avoid GPU errors on machines without dedicated drivers
electron_1.app.disableHardwareAcceleration();
let mainWindow = null;
let tabManager = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        titleBarStyle: 'hiddenInset',
    });
    // Handle microphone and speech permissions
    const allowedPermissions = ['media', 'audio-capture', 'speech-recognition'];
    electron_1.session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
        if (allowedPermissions.includes(permission))
            return true;
        return false;
    });
    electron_1.session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        if (allowedPermissions.includes(permission)) {
            callback(true);
        }
        else {
            callback(false);
        }
    });
    // In development, load from vite. In production, load from dist.
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../frontend/index.html'));
    }
    tabManager = new tabs_1.TabManager(mainWindow);
    mainWindow.on('closed', () => {
        mainWindow = null;
        tabManager = null;
    });
}
electron_1.app.whenReady().then(() => {
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
// IPC handlers for Tab Management
electron_1.ipcMain.handle('tab:create', (event, url) => {
    return tabManager?.createTab(url);
});
electron_1.ipcMain.handle('tab:switch', (event, id) => {
    tabManager?.switchTab(id);
});
electron_1.ipcMain.handle('tab:close', (event, id) => {
    tabManager?.closeTab(id);
});
electron_1.ipcMain.handle('tab:navigate', (event, { id, url }) => {
    tabManager?.navigateTab(id, url);
});
electron_1.ipcMain.handle('tab:extract', async (event, id) => {
    return await tabManager?.extractContent(id);
});
electron_1.ipcMain.handle('tab:click', async (event, { id, agentId }) => {
    return await tabManager?.clickById(id, agentId);
});
electron_1.ipcMain.handle('tab:type', async (event, { id, agentId, text }) => {
    return await tabManager?.typeById(id, agentId, text);
});
electron_1.ipcMain.handle('tab:scroll', async (event, { id, direction }) => {
    return await tabManager?.scrollPage(id, direction);
});
electron_1.ipcMain.handle('tab:press-key', async (event, { id, key }) => {
    return await tabManager?.pressKey(id, key);
});
electron_1.ipcMain.handle('tab:get-simplified-dom', async (event, id) => {
    return await tabManager?.getSimplifiedDom(id);
});
electron_1.ipcMain.handle('tab:scrape', async (event, { id, query }) => {
    return await tabManager?.scrapePage(id, query);
});
electron_1.ipcMain.handle('tab:screenshot', async (event, id) => {
    return await tabManager?.takeScreenshot(id);
});
electron_1.ipcMain.handle('tab:wait-for-idle', async (event, id) => {
    return await tabManager?.waitForIdle(id);
});
