// Desktop shell for Steam: window management, save file (Steam Auto-Cloud), Steamworks achievements.
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');

// Replace with the real App ID from Steamworks. 480 = Spacewar (Valve's public test app).
const STEAM_APP_ID = Number(process.env.HUE_STEAM_APPID || readAppIdFile() || 480);

function readAppIdFile() {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'steam_appid.txt'), 'utf8').trim();
  } catch {
    return null;
  }
}

let steam = null;
try {
  const steamworks = require('steamworks.js');
  steam = steamworks.init(STEAM_APP_ID);
  steamworks.electronEnableSteamOverlay();
  console.log('[steam] initialised as', steam.localplayer.getName());
} catch (e) {
  console.log('[steam] not available, running standalone:', e && e.message);
}

const saveDir = () => app.getPath('userData');
const savePath = () => path.join(saveDir(), 'save.json');

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 960,
    minHeight: 540,
    fullscreen: !process.argv.includes('--windowed'),
    backgroundColor: '#0b0a10',
    autoHideMenuBar: true,
    title: 'HUE & CLAIM',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && (input.key === 'F11' || (input.alt && input.key === 'Enter'))) {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });
  return win;
}

ipcMain.on('save:load', (e) => {
  try {
    e.returnValue = fs.existsSync(savePath()) ? fs.readFileSync(savePath(), 'utf8') || null : null;
  } catch {
    e.returnValue = null;
  }
});
ipcMain.on('save:write', (_e, data) => {
  try {
    fs.mkdirSync(saveDir(), { recursive: true });
    const tmp = savePath() + '.tmp';
    fs.writeFileSync(tmp, data, 'utf8');
    fs.renameSync(tmp, savePath()); // atomic replace: never leaves a half-written save
  } catch (err) {
    console.error('[save] failed', err);
  }
});
ipcMain.on('ach', (_e, id) => {
  try {
    if (steam && !steam.achievement.isActivated(id)) steam.achievement.activate(id);
  } catch (err) {
    console.error('[steam] achievement failed', id, err);
  }
});
ipcMain.on('fs', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win) win.setFullScreen(!win.isFullScreen());
});
ipcMain.on('quit', () => app.quit());

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => app.quit());
