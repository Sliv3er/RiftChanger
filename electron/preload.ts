import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Window
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Skins
  getSkinsPath: () => ipcRenderer.invoke('skins:getPath'),
  scan: (path?: string) => ipcRenderer.invoke('skins:scan', path),
  apply: (zipPath: string, skinName: string, champName: string) =>
    ipcRenderer.invoke('skins:apply', zipPath, skinName, champName),

  // Assets
  getChampions: () => ipcRenderer.invoke('assets:getChampions'),
  getChampionSkins: (id: string) => ipcRenderer.invoke('assets:getChampionSkins', id),
  getCurrentPatch: () => ipcRenderer.invoke('assets:getCurrentPatch'),

  // Game
  detectGame: () => ipcRenderer.invoke('game:detect'),

  // CSLoL
  setupCslol: () => ipcRenderer.invoke('cslol:setup'),
  isCslolReady: () => ipcRenderer.invoke('cslol:isReady'),
  launchCslol: () => ipcRenderer.invoke('cslol:launch'),
  listMods: () => ipcRenderer.invoke('cslol:listInstalled'),
  removeAllMods: () => ipcRenderer.invoke('cslol:removeAll'),
  removeMod: (name: string) => ipcRenderer.invoke('cslol:removeSkin', name),

  // Generator
  generateChampion: (champId: string) => ipcRenderer.invoke('gen:champion', champId),
  generateAll: () => ipcRenderer.invoke('gen:all'),
  onGenProgress: (cb: (msg: string) => void) => {
    ipcRenderer.on('gen:progress', (_e, msg) => cb(msg));
  },
  onGenAllProgress: (cb: (p: any) => void) => {
    ipcRenderer.on('gen:allProgress', (_e, p) => cb(p));
  },

  // Backup
  createBackup: (path: string) => ipcRenderer.invoke('backup:create', path),
  restoreBackup: (id: string, path: string) => ipcRenderer.invoke('backup:restore', id, path),
  listBackups: () => ipcRenderer.invoke('backup:list'),

  // Dialog
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  openExternal: (url: string) => ipcRenderer.send('shell:openExternal', url),
});
