import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import { SkinScanner, SkinEntry } from './services/skinScanner';
import { AssetService } from './services/assetService';
import { GameDetector } from './services/gameDetector';
import { CslolService } from './services/cslolService';
import { BackupService } from './services/backupService';
import { SkinUpdater } from './services/skinUpdater';

let mainWindow: BrowserWindow | null = null;
let skinScanner: SkinScanner;
let assetService: AssetService;
let gameDetector: GameDetector;
let cslolService: CslolService;
let backupService: BackupService;
let skinUpdater: SkinUpdater;

const isDev = !app.isPackaged;

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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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
}

function registerIPC() {
  // Window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  // Skin scanning
  ipcMain.handle('skins:scan', async (_e, skinsPath: string) => {
    return skinScanner.scan(skinsPath);
  });

  ipcMain.handle('skins:validate', async (_e, skinPath: string) => {
    return skinScanner.validateSkin(skinPath);
  });

  // Assets
  ipcMain.handle('assets:getChampions', async () => {
    return assetService.getChampions();
  });

  ipcMain.handle('assets:getChampionSkins', async (_e, championId: string) => {
    return assetService.getChampionSkins(championId);
  });

  ipcMain.handle('assets:getSplashUrl', async (_e, championId: string, skinNum: number) => {
    return assetService.getSplashUrl(championId, skinNum);
  });

  ipcMain.handle('assets:getIconUrl', async (_e, championId: string) => {
    return assetService.getChampionIconUrl(championId);
  });

  ipcMain.handle('assets:getCurrentPatch', async () => {
    return assetService.getCurrentPatch();
  });

  // Game detection
  ipcMain.handle('game:detect', async () => {
    return gameDetector.detect();
  });

  ipcMain.handle('game:getPatch', async () => {
    return gameDetector.getGamePatch();
  });

  // CSLoL Manager
  ipcMain.handle('cslol:setup', async () => {
    return cslolService.setup();
  });

  ipcMain.handle('cslol:isReady', async () => {
    return cslolService.isReady();
  });

  ipcMain.handle('cslol:apply', async (_e, skins: SkinEntry[]) => {
    return cslolService.applySkins(skins);
  });

  ipcMain.handle('cslol:remove', async () => {
    return cslolService.removeAll();
  });

  ipcMain.handle('cslol:removeSkin', async (_e, skinName: string) => {
    return cslolService.removeSkin(skinName);
  });

  ipcMain.handle('cslol:listInstalled', async () => {
    return cslolService.listInstalled();
  });

  ipcMain.handle('cslol:launch', async () => {
    return cslolService.launchManager();
  });

  // Skin Updater
  ipcMain.handle('skins:update', async (_e, skinsPath: string) => {
    return skinUpdater.update(skinsPath);
  });

  ipcMain.handle('skins:isGitRepo', async (_e, skinsPath: string) => {
    return skinUpdater.isGitRepo(skinsPath);
  });

  ipcMain.handle('skins:lastUpdate', async (_e, skinsPath: string) => {
    return skinUpdater.getLastUpdateDate(skinsPath);
  });

  ipcMain.handle('skins:clone', async (_e, targetDir: string) => {
    return skinUpdater.clone(targetDir);
  });

  // Backup
  ipcMain.handle('backup:create', async (_e, gamePath: string) => {
    return backupService.create(gamePath);
  });

  ipcMain.handle('backup:restore', async (_e, backupId: string, gamePath: string) => {
    return backupService.restore(backupId, gamePath);
  });

  ipcMain.handle('backup:list', async () => {
    return backupService.list();
  });

  // Dialog
  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // Shell
  ipcMain.on('shell:openExternal', (_e, url: string) => {
    shell.openExternal(url);
  });
}

app.whenReady().then(() => {
  initServices();
  registerIPC();
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
