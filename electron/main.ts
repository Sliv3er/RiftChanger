import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { SkinScanner, SkinEntry } from './services/skinScanner';
import { AssetService } from './services/assetService';
import { GameDetector } from './services/gameDetector';
import { CslolService } from './services/cslolService';
import { BackupService } from './services/backupService';
import { SkinUpdater } from './services/skinUpdater';
import { SkinGenerator } from './services/skinGenerator';
import { SkinLibrary } from './services/skinLibrary';

let mainWindow: BrowserWindow | null = null;
let skinScanner: SkinScanner;
let assetService: AssetService;
let gameDetector: GameDetector;
let cslolService: CslolService;
let backupService: BackupService;
let skinUpdater: SkinUpdater;
let skinGenerator: SkinGenerator;
let skinLibrary: SkinLibrary;

const isDev = !app.isPackaged;
const DEFAULT_LIB_PATH = 'C:\\Users\\n3tgg\\OneDrive\\Documents\\lol-skins-main\\lol-skins-main\\skins';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    backgroundColor: '#010A13',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../public/icon.png'),
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
  const userDataPath = app.getPath('userData');
  const cachePath = path.join(userDataPath, 'cache');
  const backupPath = path.join(userDataPath, 'backups');

  skinScanner = new SkinScanner();
  assetService = new AssetService(cachePath);
  gameDetector = new GameDetector();
  cslolService = new CslolService(userDataPath);
  backupService = new BackupService(backupPath);
  skinUpdater = new SkinUpdater();
  skinGenerator = new SkinGenerator(DEFAULT_LIB_PATH);
  skinLibrary = new SkinLibrary(DEFAULT_LIB_PATH);
}

function registerIPC() {
  // Window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  // ─── SKIN LIBRARY ───
  ipcMain.handle('library:getIndex', async () => {
    return skinLibrary.loadCachedIndex();
  });

  ipcMain.handle('library:buildIndex', async () => {
    return skinLibrary.buildIndex((msg) => {
      mainWindow?.webContents.send('library:indexProgress', msg);
    });
  });

  ipcMain.handle('library:setPath', async (_e, libPath: string) => {
    skinLibrary = new SkinLibrary(libPath);
    skinGenerator = new SkinGenerator(libPath);
    return true;
  });

  ipcMain.handle('library:getPath', async () => {
    return skinLibrary.getLibPath();
  });

  // ─── APPLY SKIN (copy .fantome to CSLoL installed dir) ───
  ipcMain.handle('skins:applySingle', async (_e, zipPath: string, skinName: string, champName: string) => {
    try {
      if (!fs.existsSync(zipPath)) {
        return { success: false, message: `File not found: ${zipPath}` };
      }

      // Ensure CSLoL is set up
      if (!cslolService.isReady()) {
        const setup = await cslolService.setup();
        if (!setup.success) return { success: false, message: 'CSLoL not ready. ' + setup.message };
      }

      const modsDir = cslolService.getInstalledDir();
      fs.mkdirSync(modsDir, { recursive: true });

      const safeName = `${champName} - ${skinName}`.replace(/[<>:"/\\|?*]/g, '_');
      const destPath = path.join(modsDir, `${safeName}.fantome`);
      fs.copyFileSync(zipPath, destPath);

      return { success: true, message: `Applied: ${skinName}. Launch CSLoL and click Run.` };
    } catch (e: any) {
      return { success: false, message: `Apply failed: ${e.message}` };
    }
  });

  // ─── LEGACY SKIN SCANNING ───
  ipcMain.handle('skins:scan', async (_e, skinsPath: string) => {
    return skinScanner.scan(skinsPath);
  });

  // ─── ASSETS ───
  ipcMain.handle('assets:getChampions', async () => assetService.getChampions());
  ipcMain.handle('assets:getChampionSkins', async (_e, id: string) => assetService.getChampionSkins(id));
  ipcMain.handle('assets:getSplashUrl', async (_e, id: string, num: number) => assetService.getSplashUrl(id, num));
  ipcMain.handle('assets:getIconUrl', async (_e, id: string) => assetService.getChampionIconUrl(id));
  ipcMain.handle('assets:getCurrentPatch', async () => assetService.getCurrentPatch());

  // ─── GAME ───
  ipcMain.handle('game:detect', async () => gameDetector.detect());
  ipcMain.handle('game:getPatch', async () => gameDetector.getGamePatch());

  // ─── CSLOL ───
  ipcMain.handle('cslol:setup', async () => cslolService.setup());
  ipcMain.handle('cslol:isReady', async () => cslolService.isReady());
  ipcMain.handle('cslol:apply', async (_e, skins: SkinEntry[]) => cslolService.applySkins(skins));
  ipcMain.handle('cslol:remove', async () => cslolService.removeAll());
  ipcMain.handle('cslol:removeSkin', async (_e, name: string) => cslolService.removeSkin(name));
  ipcMain.handle('cslol:listInstalled', async () => cslolService.listInstalled());
  ipcMain.handle('cslol:launch', async () => cslolService.launchManager());

  // ─── UPDATER ───
  ipcMain.handle('skins:update', async (_e, p: string) => skinUpdater.update(p));
  ipcMain.handle('skins:isGitRepo', async (_e, p: string) => skinUpdater.isGitRepo(p));
  ipcMain.handle('skins:lastUpdate', async (_e, p: string) => skinUpdater.getLastUpdateDate(p));
  ipcMain.handle('skins:clone', async (_e, dir: string) => skinUpdater.clone(dir));

  // ─── GENERATOR ───
  ipcMain.handle('generator:generateSkin', async (_e, champId: string, skinNum: number, skinName: string) => {
    return skinGenerator.generateSkin(champId, skinNum, skinName);
  });
  ipcMain.handle('generator:generateChampion', async (_e, champId: string) => {
    return skinGenerator.generateChampion(champId, (msg) => {
      mainWindow?.webContents.send('generator:progress', msg);
    });
  });
  ipcMain.handle('generator:generateAll', async (_e, outputDir?: string) => {
    if (outputDir) {
      skinGenerator = new SkinGenerator(outputDir);
    }
    return skinGenerator.generateAll((progress) => {
      mainWindow?.webContents.send('generator:allProgress', progress);
    });
  });

  // ─── BACKUP ───
  ipcMain.handle('backup:create', async (_e, gamePath: string) => backupService.create(gamePath));
  ipcMain.handle('backup:restore', async (_e, id: string, gamePath: string) => backupService.restore(id, gamePath));
  ipcMain.handle('backup:list', async () => backupService.list());

  // ─── DIALOG ───
  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });

  // ─── SHELL ───
  ipcMain.on('shell:openExternal', (_e, url: string) => shell.openExternal(url));
}

app.whenReady().then(() => {
  initServices();
  registerIPC();
  createWindow();
});

app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (mainWindow === null) createWindow(); });
