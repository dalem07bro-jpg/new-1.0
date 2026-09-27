// Minimal, safe bridge between the game (renderer) and the desktop shell.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hueNative', {
  loadSave: () => ipcRenderer.sendSync('save:load'),
  writeSave: (data) => ipcRenderer.send('save:write', String(data)),
  achievement: (id) => ipcRenderer.send('ach', String(id)),
  toggleFullscreen: () => ipcRenderer.send('fs'),
  quit: () => ipcRenderer.send('quit'),
});
