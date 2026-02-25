import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  getSkinsPath: () => ipcRenderer.invoke('getSkinsPath'),
  scan: (p?: string) => ipcRenderer.invoke('scan', p),
  getChampions: () => ipcRenderer.invoke('getChampions'),
  getChampionSkins: (id: string) => ipcRenderer.invoke('getChampionSkins', id),
  getPatch: () => ipcRenderer.invoke('getPatch'),
  detectGame: () => ipcRenderer.invoke('detectGame'),

  injectorReady: () => ipcRenderer.invoke('injector:isReady'),
  injectorSetup: () => ipcRenderer.invoke('injector:setup'),
  importMod: (zip: string, name: string) => ipcRenderer.invoke('injector:import', zip, name),
  applyMods: (names?: string[]) => ipcRenderer.invoke('injector:apply', names),
  stopOverlay: () => ipcRenderer.invoke('injector:stop'),
  listMods: () => ipcRenderer.invoke('injector:listMods'),
  removeMod: (name: string) => ipcRenderer.invoke('injector:removeMod', name),
  removeAllMods: () => ipcRenderer.invoke('injector:removeAll'),
  overlayStatus: () => ipcRenderer.invoke('injector:status'),

  generateChampion: (id: string) => ipcRenderer.invoke('gen:champion', id),
  generateAll: () => ipcRenderer.invoke('gen:all'),
  onGenProgress: (cb: (m: string) => void) => ipcRenderer.on('gen:progress', (_e, m) => cb(m)),
  onGenAllProgress: (cb: (p: any) => void) => ipcRenderer.on('gen:allProgress', (_e, p) => cb(p)),
  onGenChampionDone: (cb: (r: any) => void) => ipcRenderer.on('gen:championDone', (_e, r) => cb(r)),

  selectFolder: () => ipcRenderer.invoke('selectFolder'),
});
