import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
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

// Simple settings store
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
function loadSettings(): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { return {}; }
}
function saveSettings(s: Record<string, string>) {
  fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2));
}
function getSetting(key: string): string {
  return loadSettings()[key] || '';
}
function setSetting(key: string, val: string) {
  const s = loadSettings(); s[key] = val; saveSettings(s);
}

const isDev = !app.isPackaged;
const appDir = isDev ? path.join(__dirname, '..') : path.dirname(app.getPath('exe'));
const LOL_SKINS_DIR = path.join(appDir, 'lol-skins');

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
  injector = new InjectorService(appDir);
  setWadMakeConfig(ud);

  // Restore saved settings
  const savedToolsPath = getSetting('cslolToolsPath');
  if (savedToolsPath && injector.testToolsPath(savedToolsPath)) {
    injector.setToolsPath(savedToolsPath.includes('mod-tools.exe') ? path.dirname(savedToolsPath) : savedToolsPath);
  }
  const savedGamePath = getSetting('leagueGamePath') || 'C:\\Riot Games\\League of Legends\\Game';
  injector.setGamePath(savedGamePath);

  // Set tools dir for generator
  if (injector.isReady()) {
    skinGenerator.setToolsDir(injector.getToolsPath());
  }

  fs.mkdirSync(LOL_SKINS_DIR, { recursive: true });
}

function registerIPC() {
  // Window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
  ipcMain.on('window:close', () => mainWindow?.close());

  // Data APIs
  ipcMain.handle('getSkinsPath', () => LOL_SKINS_DIR);
  ipcMain.handle('scan', (_e, p?: string) => skinScanner.scan(p || LOL_SKINS_DIR));
  ipcMain.handle('getChampions', () => assetService.getChampions());
  ipcMain.handle('getChampionSkins', (_e, id: string) => assetService.getChampionSkins(id));
  ipcMain.handle('getPatch', () => assetService.getCurrentPatch());
  ipcMain.handle('detectGame', () => gameDetector.detect());

  // Settings
  ipcMain.handle('getSettings', () => loadSettings());
  ipcMain.handle('updateSetting', (_e, key: string, val: string) => {
    setSetting(key, val);
    if (key === 'cslolToolsPath' && val) {
      const candidates = [val, path.join(val, 'cslol-tools')];
      for (const c of candidates) {
        if (fs.existsSync(path.join(c, 'mod-tools.exe'))) {
          injector.setToolsPath(c);
          skinGenerator.setToolsDir(c);
          break;
        }
      }
    }
    if (key === 'leagueGamePath' && val) injector.setGamePath(val);
    return { success: true };
  });

  // Tools availability
  ipcMain.handle('checkToolsAvailability', () => injector.checkToolsAvailability());
  ipcMain.handle('testLeaguePath', (_e, p: string) => injector.testLeaguePath(p));

  // Download cslol-manager
  ipcMain.handle('downloadRepository', async (_e, repoType: string) => {
    if (repoType === 'cslol-manager') {
      const result = await injector.downloadCslol((data) => {
        mainWindow?.webContents.send('downloadProgress', data);
      });
      if (result.success && result.suggestedPath) {
        setSetting('cslolToolsPath', result.suggestedPath);
        skinGenerator.setToolsDir(result.suggestedPath);
      }
      return { ...result, autoSaved: result.success };
    }
    return { success: false, error: 'Unknown repo type' };
  });

  // Injection
  ipcMain.handle('inject-skin', async (_e, championName: string, skinName: string, skinPath: string) => {
    return injector.injectSkin(championName, skinName, skinPath);
  });
  ipcMain.handle('remove-skin', async (_e, championName: string) => {
    return injector.removeSkin(championName);
  });
  ipcMain.handle('remove-all-skins', async () => {
    return injector.removeAllSkins();
  });
  ipcMain.handle('get-applied-mods', () => injector.getAppliedMods());

  // Find skin/chroma files in lol-skins folder
  ipcMain.handle('findSkinFiles', (_e, skinsFolder: string, championName: string) => {
    try {
      const champDir = path.join(skinsFolder, championName);
      if (!fs.existsSync(champDir)) return { success: false, skinFiles: [] };
      const files = fs.readdirSync(champDir)
        .filter(f => f.endsWith('.zip') || f.endsWith('.fantome'))
        .map(f => ({ name: f.replace(/\.(zip|fantome)$/, ''), path: path.join(champDir, f) }));
      return { success: true, skinFiles: files };
    } catch { return { success: false, skinFiles: [] }; }
  });

  ipcMain.handle('findChromaFiles', (_e, skinsFolder: string, championName: string, skinName: string) => {
    try {
      const chromaDir = path.join(skinsFolder, championName, 'chromas', skinName);
      if (!fs.existsSync(chromaDir)) return { success: false, chromaFiles: [] };
      const files = fs.readdirSync(chromaDir)
        .filter(f => f.endsWith('.zip') || f.endsWith('.fantome'))
        .map(f => ({ name: f.replace(/\.(zip|fantome)$/, ''), path: path.join(chromaDir, f) }));
      return { success: true, chromaFiles: files };
    } catch { return { success: false, chromaFiles: [] }; }
  });

  ipcMain.handle('scanSkinsFolder', (_e, p: string) => {
    try {
      if (!fs.existsSync(p)) return { success: false };
      // Check if it's a cslol-tools path (has mod-tools.exe)
      if (fs.existsSync(path.join(p, 'mod-tools.exe'))) return { success: true };
      // Check one level down
      for (const sub of ['cslol-tools']) {
        if (fs.existsSync(path.join(p, sub, 'mod-tools.exe'))) return { success: true };
      }
      // Check if it's a skins folder
      const dirs = fs.readdirSync(p, { withFileTypes: true }).filter(d => d.isDirectory());
      if (dirs.length > 0) return { success: true, champions: Object.fromEntries(dirs.map(d => [d.name, true])) };
      return { success: false };
    } catch { return { success: false }; }
  });

  // Generator
  ipcMain.handle('gen:champion', async (_e, id: string) => {
    try {
      const result = await skinGenerator.generateChampion(id, m => {
        try { mainWindow?.webContents.send('gen:progress', m); } catch {}
      });
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

app.whenReady().then(() => {
  console.log('[main] app ready');
  try { initServices(); console.log('[main] services initialized'); } catch (e) { console.error('[main] initServices failed:', e); }
  try { registerIPC(); console.log('[main] IPC registered'); } catch (e) { console.error('[main] registerIPC failed:', e); }
  createWindow();
  console.log('[main] window created');
});
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!mainWindow) createWindow(); });
app.on('before-quit', () => { try { injector?.cleanup(); } catch {} });
app.on('will-quit', () => {
  try { injector?.cleanup(); } catch {}
  try { execSync('taskkill /F /IM mod-tools.exe 2>nul', { windowsHide: true }); } catch {}
});
