import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { AssetService } from './services/assetService';
import { GameDetector } from './services/gameDetector';
import { BackupService } from './services/backupService';
import { SkinGenerator } from './services/skinGenerator';
import { SkinScanner } from './services/skinScanner';
import { InjectorService } from './services/injectorService';
import { setWadMakeConfig } from './services/wadPacker';

let mainWindow: BrowserWindow | null = null;
let assetService: AssetService;
let gameDetector: GameDetector;
let backupService: BackupService;
let skinGenerator: SkinGenerator;
let skinScanner: SkinScanner;
let injector: InjectorService;

function findCslolToolsDir(basePath: string): string | null {
  const cslolDir = path.join(basePath, 'cslol-manager');
  if (!fs.existsSync(cslolDir)) return null;
  const walk = (dir: string, d: number): string | null => {
    if (d > 4) return null;
    try {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isFile() && e.name === 'mod-tools.exe') return dir;
        if (e.isDirectory()) { const r = walk(path.join(dir, e.name), d + 1); if (r) return r; }
      }
    } catch {} return null;
  };
  return walk(cslolDir, 0);
}

const isDev = !app.isPackaged;
const LOL_SKINS_DIR = isDev
  ? path.join(__dirname, '..', 'lol-skins')
  : path.join(path.dirname(app.getPath('exe')), 'lol-skins');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1100, minHeight: 700,
    frame: false, backgroundColor: '#010A13',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  mainWindow.on('closed', () => { mainWindow = null; });
}

function initServices() {
  const ud = app.getPath('userData');
  assetService = new AssetService(path.join(ud, 'cache'));
  gameDetector = new GameDetector();
  backupService = new BackupService(path.join(ud, 'backups'));
  skinGenerator = new SkinGenerator(LOL_SKINS_DIR);
  skinScanner = new SkinScanner();
  injector = new InjectorService(ud);
  setWadMakeConfig(ud);

  // Pass cslol-tools dir to generator so it can use wad-extract + wad-make
  const toolsDir = findCslolToolsDir(ud);
  if (toolsDir) skinGenerator.setToolsDir(toolsDir);

  fs.mkdirSync(LOL_SKINS_DIR, { recursive: true });
}

function registerIPC() {
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  // Data
  ipcMain.handle('getSkinsPath', () => LOL_SKINS_DIR);
  ipcMain.handle('scan', (_e, p?: string) => skinScanner.scan(p || LOL_SKINS_DIR));
  ipcMain.handle('getChampions', () => assetService.getChampions());
  ipcMain.handle('getChampionSkins', (_e, id: string) => assetService.getChampionSkins(id));
  ipcMain.handle('getPatch', () => assetService.getCurrentPatch());
  ipcMain.handle('detectGame', () => gameDetector.detect());

  // Injector
  ipcMain.handle('injector:isReady', () => injector.isReady());
  ipcMain.handle('injector:setup', () => injector.setup());
  ipcMain.handle('injector:import', (_e, zipPath: string, modName: string) => injector.importMod(zipPath, modName));
  ipcMain.handle('injector:apply', (_e, modNames?: string[]) => injector.apply(modNames));
  ipcMain.handle('injector:stop', () => { injector.stopOverlay(); return { success: true }; });
  ipcMain.handle('injector:listMods', () => injector.listMods());
  ipcMain.handle('injector:removeMod', (_e, name: string) => injector.removeMod(name));
  ipcMain.handle('injector:removeAll', () => { injector.removeAllMods(); return true; });
  ipcMain.handle('injector:status', () => injector.getOverlayStatus());

  // Generator
  ipcMain.handle('gen:champion', async (_e, id: string) => {
    try {
      if (!skinGenerator.toolsReady) {
        const td = findCslolToolsDir(app.getPath('userData'));
        if (td) skinGenerator.setToolsDir(td);
      }
      const result = await skinGenerator.generateChampion(id, m => {
        try { mainWindow?.webContents.send('gen:progress', m); } catch {}
      });
      // Send explicit done event
      try { mainWindow?.webContents.send('gen:championDone', result); } catch {}
      return result;
    } catch (e: any) {
      const result = { generated: 0, failed: 1, errors: [e.message] };
      try { mainWindow?.webContents.send('gen:championDone', result); } catch {}
      return result;
    }
  });
  ipcMain.handle('gen:all', async () => {
    try {
      if (!skinGenerator.toolsReady) {
        const td = findCslolToolsDir(app.getPath('userData'));
        if (td) skinGenerator.setToolsDir(td);
      }
      return await skinGenerator.generateAll(p => mainWindow?.webContents.send('gen:allProgress', p));
    } catch (e: any) {
      return { total: 0, done: 0, current: '', errors: [e.message], generated: 0 };
    }
  });

  ipcMain.handle('selectFolder', async () => {
    const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });
}

app.whenReady().then(() => { initServices(); registerIPC(); createWindow(); });
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!mainWindow) createWindow(); });
app.on('before-quit', () => {
  // Stop overlay and clean up mods so skins don't stay applied after closing
  try { injector?.stopOverlay(); } catch {}
  try { injector?.removeAllMods(); } catch {}
});
