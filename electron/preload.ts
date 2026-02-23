import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Window
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Skins
  scanSkins: (path: string) => ipcRenderer.invoke('skins:scan', path),
  validateSkin: (path: string) => ipcRenderer.invoke('skins:validate', path),

  // Assets
  getChampions: () => ipcRenderer.invoke('assets:getChampions'),
  getChampionSkins: (id: string) => ipcRenderer.invoke('assets:getChampionSkins', id),
  getSplashUrl: (id: string, num: number) => ipcRenderer.invoke('assets:getSplashUrl', id, num),
  getIconUrl: (id: string) => ipcRenderer.invoke('assets:getIconUrl', id),
  getCurrentPatch: () => ipcRenderer.invoke('assets:getCurrentPatch'),

  // Game
  detectGame: () => ipcRenderer.invoke('game:detect'),
  getGamePatch: () => ipcRenderer.invoke('game:getPatch'),

  // CSLoL
  setupCslol: () => ipcRenderer.invoke('cslol:setup'),
  isCslolReady: () => ipcRenderer.invoke('cslol:isReady'),
  applySkins: (skins: any[]) => ipcRenderer.invoke('cslol:apply', skins),
  removeSkins: () => ipcRenderer.invoke('cslol:remove'),

  // Backup
  createBackup: (path: string) => ipcRenderer.invoke('backup:create', path),
  restoreBackup: (id: string, path: string) => ipcRenderer.invoke('backup:restore', id, path),
  listBackups: () => ipcRenderer.invoke('backup:list'),

  // Dialog
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),

  // Shell
  openExternal: (url: string) => ipcRenderer.send('shell:openExternal', url),
});
