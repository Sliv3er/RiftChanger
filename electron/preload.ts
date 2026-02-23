import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Window
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Skins
  scanSkins: (path: string) => ipcRenderer.invoke('skins:scan', path),
  validateSkin: (path: string) => ipcRenderer.invoke('skins:validate', path),

  // Skin Updater
  updateSkins: (path: string) => ipcRenderer.invoke('skins:update', path),
  isGitRepo: (path: string) => ipcRenderer.invoke('skins:isGitRepo', path),
  getLastUpdate: (path: string) => ipcRenderer.invoke('skins:lastUpdate', path),
  cloneSkins: (targetDir: string) => ipcRenderer.invoke('skins:clone', targetDir),

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
  removeSkin: (name: string) => ipcRenderer.invoke('cslol:removeSkin', name),
  listInstalledMods: () => ipcRenderer.invoke('cslol:listInstalled'),
  launchCslol: () => ipcRenderer.invoke('cslol:launch'),

  // Backup
  createBackup: (path: string) => ipcRenderer.invoke('backup:create', path),
  restoreBackup: (id: string, path: string) => ipcRenderer.invoke('backup:restore', id, path),
  listBackups: () => ipcRenderer.invoke('backup:list'),

  // Generator
  generateSkin: (champId: string, skinNum: number, skinName: string) =>
    ipcRenderer.invoke('generator:generateSkin', champId, skinNum, skinName),
  generateChampion: (champId: string) =>
    ipcRenderer.invoke('generator:generateChampion', champId),
  generateAll: (outputDir?: string) =>
    ipcRenderer.invoke('generator:generateAll', outputDir),
  onGeneratorProgress: (cb: (msg: string) => void) => {
    ipcRenderer.on('generator:progress', (_e, msg) => cb(msg));
  },
  onGeneratorAllProgress: (cb: (progress: any) => void) => {
    ipcRenderer.on('generator:allProgress', (_e, progress) => cb(progress));
  },

  // Dialog
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),

  // Shell
  openExternal: (url: string) => ipcRenderer.send('shell:openExternal', url),
});
