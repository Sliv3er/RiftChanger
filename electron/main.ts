import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { AssetService } from './services/assetService';
import { GameDetector } from './services/gameDetector';
import { CslolService } from './services/cslolService';
import { BackupService } from './services/backupService';
import { SkinGenerator } from './services/skinGenerator';
import { SkinScanner } from './services/skinScanner';

let mainWindow: BrowserWindow | null = null;
let assetService: AssetService;
let gameDetector: GameDetector;
let cslolService: CslolService;
let backupService: BackupService;
let skinGenerator: SkinGenerator;
let skinScanner: SkinScanner;

const isDev = !app.isPackaged;

// In dev, lol-skins lives in the project. In production, next to the exe.
const LOL_SKINS_DIR = isDev
  ? path.join(__dirname, '..', 'lol-skins')
  : path.join(path.dirname(app.getPath('exe')), 'lol-skins');

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

  assetService = new AssetService(cachePath);
  gameDetector = new GameDetector();
  cslolService = new CslolService(userDataPath);
  backupService = new BackupService(backupPath);
  skinGenerator = new SkinGenerator(LOL_SKINS_DIR);
  skinScanner = new SkinScanner();

  fs.mkdirSync(LOL_SKINS_DIR, { recursive: true });
}

function registerIPC() {
  // Window
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  // ─── SKINS PATH ───
  ipcMain.handle('skins:getPath', () => LOL_SKINS_DIR);

  // ─── SCAN ───
  ipcMain.handle('skins:scan', async (_e, skinsPath?: string) => {
    return skinScanner.scan(skinsPath || LOL_SKINS_DIR);
  });

  // ─── APPLY ───
  ipcMain.handle('skins:apply', async (_e, zipPath: string, skinName: string, champName: string) => {
    if (!cslolService.isReady()) {
      const setup = await cslolService.setup();
      if (!setup.success) return { success: false, message: 'CSLoL not ready: ' + setup.message };
    }
    return cslolService.applySingle(zipPath, skinName, champName);
  });

  // ─── ASSETS ───
  ipcMain.handle('assets:getChampions', () => assetService.getChampions());
  ipcMain.handle('assets:getChampionSkins', (_e, id: string) => assetService.getChampionSkins(id));
  ipcMain.handle('assets:getCurrentPatch', () => assetService.getCurrentPatch());

  // ─── GAME ───
  ipcMain.handle('game:detect', () => gameDetector.detect());

  // ─── CSLOL ───
  ipcMain.handle('cslol:setup', () => cslolService.setup());
  ipcMain.handle('cslol:isReady', () => cslolService.isReady());
  ipcMain.handle('cslol:launch', () => cslolService.launchManager());
  ipcMain.handle('cslol:listInstalled', () => cslolService.listInstalled());
  ipcMain.handle('cslol:removeAll', () => cslolService.removeAll());
  ipcMain.handle('cslol:removeSkin', (_e, name: string) => cslolService.removeSkin(name));

  // ─── GENERATOR ───
  ipcMain.handle('gen:champion', async (_e, champId: string) => {
    return skinGenerator.generateChampion(champId, (msg) => {
      mainWindow?.webContents.send('gen:progress', msg);
    });
  });
  ipcMain.handle('gen:all', async () => {
    return skinGenerator.generateAll((progress) => {
      mainWindow?.webContents.send('gen:allProgress', progress);
    });
  });

  // ─── BACKUP ───
  ipcMain.handle('backup:create', (_e, gamePath: string) => backupService.create(gamePath));
  ipcMain.handle('backup:restore', (_e, id: string, gamePath: string) => backupService.restore(id, gamePath));
  ipcMain.handle('backup:list', () => backupService.list());

  // ─── DIALOG ───
  ipcMain.handle('dialog:selectFolder', async () => {
    const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });

  ipcMain.on('shell:openExternal', (_e, url: string) => shell.openExternal(url));
}

app.whenReady().then(() => { initServices(); registerIPC(); createWindow(); });
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!mainWindow) createWindow(); });
