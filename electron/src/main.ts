import { app, BrowserWindow, ipcMain, session } from 'electron';
import * as path from 'path';
import { TabManager } from './tabs';

// Enable speech recognition features in Chromium
app.commandLine.appendSwitch('enable-speech-input');
app.commandLine.appendSwitch('enable-features', 'SpeechRecognition');

// Disable hardware acceleration to avoid GPU errors on machines without dedicated drivers
app.disableHardwareAcceleration();

let mainWindow: BrowserWindow | null = null;
let tabManager: TabManager | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
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

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (allowedPermissions.includes(permission)) return true;
    return false;
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // In development, load from vite. In production, load from dist.
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/index.html'));
  }

  tabManager = new TabManager(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
    tabManager = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers for Tab Management
ipcMain.handle('tab:create', (event, url: string) => {
  return tabManager?.createTab(url);
});

ipcMain.handle('tab:switch', (event, id: string) => {
  tabManager?.switchTab(id);
});

ipcMain.handle('tab:close', (event, id: string) => {
  tabManager?.closeTab(id);
});

ipcMain.handle('tab:navigate', (event, { id, url }: { id: string; url: string }) => {
  tabManager?.navigateTab(id, url);
});

ipcMain.handle('tab:extract', async (event, id: string) => {
  return await tabManager?.extractContent(id);
});

ipcMain.handle('tab:click', async (event, { id, agentId }: { id: string; agentId: string }) => {
  return await tabManager?.clickById(id, agentId);
});

ipcMain.handle('tab:type', async (event, { id, agentId, text }: { id: string; agentId: string; text: string }) => {
  return await tabManager?.typeById(id, agentId, text);
});

ipcMain.handle('tab:scroll', async (event, { id, direction }: { id: string; direction: 'up' | 'down' }) => {
  return await tabManager?.scrollPage(id, direction);
});

ipcMain.handle('tab:press-key', async (event, { id, key }: { id: string; key: string }) => {
  return await tabManager?.pressKey(id, key);
});

ipcMain.handle('tab:get-simplified-dom', async (event, id: string) => {
  return await tabManager?.getSimplifiedDom(id);
});

ipcMain.handle('tab:scrape', async (event, { id, query }: { id: string; query: string }) => {
  return await tabManager?.scrapePage(id, query);
});

ipcMain.handle('tab:screenshot', async (event, id: string) => {
  return await tabManager?.takeScreenshot(id);
});

ipcMain.handle('tab:wait-for-idle', async (event, id: string) => {
  return await tabManager?.waitForIdle(id);
});
