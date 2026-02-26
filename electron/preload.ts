import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Data
  getSkinsPath: () => ipcRenderer.invoke('getSkinsPath'),
  scan: (p?: string) => ipcRenderer.invoke('scan', p),
  getChampions: () => ipcRenderer.invoke('getChampions'),
  getChampionSkins: (id: string) => ipcRenderer.invoke('getChampionSkins', id),
  getPatch: () => ipcRenderer.invoke('getPatch'),
  detectGame: () => ipcRenderer.invoke('detectGame'),

  // Settings
  getSettings: () => ipcRenderer.invoke('getSettings'),
  updateSetting: (key: string, val: string) => ipcRenderer.invoke('updateSetting', key, val),
  selectFolder: () => ipcRenderer.invoke('selectFolder'),

  // Tools
  checkToolsAvailability: () => ipcRenderer.invoke('checkToolsAvailability'),
  testLeaguePath: (p: string) => ipcRenderer.invoke('testLeaguePath', p),
  downloadRepository: (repoType: string) => ipcRenderer.invoke('downloadRepository', repoType),

  // Skin files
  findSkinFiles: (folder: string, champ: string) => ipcRenderer.invoke('findSkinFiles', folder, champ),
  findChromaFiles: (folder: string, champ: string, skin: string) => ipcRenderer.invoke('findChromaFiles', folder, champ, skin),

  // Injection
  injectSkin: (champ: string, skin: string, zipPath: string) => ipcRenderer.invoke('inject-skin', champ, skin, zipPath),
  removeSkin: (champ: string) => ipcRenderer.invoke('remove-skin', champ),
  removeAllSkins: () => ipcRenderer.invoke('remove-all-skins'),
  getAppliedMods: () => ipcRenderer.invoke('get-applied-mods'),

  // Generator
  generateChampion: (id: string) => ipcRenderer.invoke('gen:champion', id),
  generateAll: () => ipcRenderer.invoke('gen:all'),
  onGenProgress: (cb: (data: any) => void) => {
    const handler = (_e: any, d: any) => cb(d);
    ipcRenderer.on('gen:progress', handler);
    return () => ipcRenderer.removeListener('gen:progress', handler);
  },
  onGenAllProgress: (cb: (data: any) => void) => {
    const handler = (_e: any, d: any) => cb(d);
    ipcRenderer.on('gen:allProgress', handler);
    return () => ipcRenderer.removeListener('gen:allProgress', handler);
  },
  onGenChampionDone: (cb: (data: any) => void) => {
    const handler = (_e: any, d: any) => cb(d);
    ipcRenderer.on('gen:championDone', handler);
    return () => ipcRenderer.removeListener('gen:championDone', handler);
  },

  // Download progress
  onDownloadProgress: (cb: (data: any) => void) => {
    const handler = (_e: any, d: any) => cb(d);
    ipcRenderer.on('downloadProgress', handler);
    return () => ipcRenderer.removeListener('downloadProgress', handler);
  },
});
