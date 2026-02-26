/**
 * InjectorService — uses the actual cslol-manager.exe for injection.
 * 
 * mod-tools.exe alone causes C0000229 DLL injection errors.
 * cslol-manager.exe has its own built-in patcher that works correctly.
 * 
 * Workflow:
 * 1. Download/detect cslol-manager installation (latest from LeagueToolkit GitHub)
 * 2. Import mods using mod-tools import into installed/ dir
 * 3. Write profile config (current.profile + profiles/<name>.profile)
 * 4. Launch cslol-manager.exe — user clicks "Run" in its window
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawn, execFile, execFileSync, ChildProcess } from 'child_process';
import axios from 'axios';

const CSLOL_LATEST_API = 'https://api.github.com/repos/LeagueToolkit/cslol-manager/releases/latest';

let overlayLog = '';

export class InjectorService {
  private basePath: string;
  private cslolRoot = '';
  private cslolExe = '';
  private toolsDir = '';
  private modToolsExe = '';
  private installedDir = '';
  private profilesDir = '';
  private gamePath = 'C:\\Riot Games\\League of Legends\\Game';
  private cslolProcess: ChildProcess | null = null;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.findCslol();
  }

  private findCslol(): boolean {
    const candidates = [
      path.join(this.basePath, 'cslol-manager'),
      path.join(this.basePath, 'cslol-manager', 'cslol-manager'),
      path.join(process.env.APPDATA || '', 'riftchanger', 'cslol-manager'),
      path.join(process.env.APPDATA || '', 'riftchanger', 'cslol-manager', 'cslol-manager'),
      path.join(process.env.USERPROFILE || '', 'Downloads', 'cslol-manager'),
    ];

    for (const dir of candidates) {
      const exe = path.join(dir, 'cslol-manager.exe');
      const tools = path.join(dir, 'cslol-tools');
      const modTools = path.join(tools, 'mod-tools.exe');
      
      if (fs.existsSync(exe) && fs.existsSync(modTools)) {
        this.cslolRoot = dir;
        this.cslolExe = exe;
        this.toolsDir = tools;
        this.modToolsExe = modTools;
        this.installedDir = path.join(dir, 'installed');
        this.profilesDir = path.join(dir, 'profiles');
        fs.mkdirSync(this.installedDir, { recursive: true });
        fs.mkdirSync(this.profilesDir, { recursive: true });
        return true;
      }
    }
    return false;
  }

  isReady(): boolean {
    return !!this.cslolExe && fs.existsSync(this.cslolExe) 
      && !!this.modToolsExe && fs.existsSync(this.modToolsExe);
  }

  getStatus(): { ready: boolean; version: string; path: string } {
    if (!this.isReady()) return { ready: false, version: '', path: '' };
    let version = '';
    try {
      const vFile = path.join(this.cslolRoot, 'version.txt');
      if (fs.existsSync(vFile)) version = fs.readFileSync(vFile, 'utf8').trim().replace('Version: ', '');
    } catch {}
    return { ready: true, version, path: this.cslolRoot };
  }

  /**
   * Download and install latest cslol-manager from GitHub releases.
   * The release asset is a 7z SFX .exe — we extract it using the embedded 7z or a fallback.
   */
  async setup(forceReinstall = false, onProgress?: (pct: number, msg: string) => void): Promise<{ success: boolean; message: string }> {
    if (!forceReinstall && this.isReady() && this.cslolRoot.startsWith(this.basePath)) {
      return { success: true, message: 'cslol-manager ready' };
    }

    try {
      onProgress?.(0, 'Fetching latest release info...');

      // Get latest release info
      const releaseRes = await axios.get(CSLOL_LATEST_API, {
        headers: { 'User-Agent': 'RiftChanger/1.0' },
        timeout: 15000,
      });
      const release = releaseRes.data;
      const winAsset = release.assets?.find((a: any) => a.name?.includes('windows'));
      if (!winAsset) return { success: false, message: 'No Windows asset found in latest release' };

      const downloadUrl = winAsset.browser_download_url;
      const totalSize = winAsset.size || 0;
      const version = release.tag_name || 'unknown';

      onProgress?.(5, `Downloading ${version} (${Math.round(totalSize / 1024 / 1024)}MB)...`);

      // Download the .exe (7z SFX archive)
      const dlPath = path.join(this.basePath, 'cslol-manager-windows.exe');
      const dlDir = path.join(this.basePath, 'cslol-manager');

      const res = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'RiftChanger/1.0' },
        timeout: 300000,
        maxContentLength: 500 * 1024 * 1024,
        onDownloadProgress: (evt) => {
          if (totalSize > 0 && evt.loaded) {
            const pct = 5 + Math.round((evt.loaded / totalSize) * 70);
            onProgress?.(Math.min(pct, 75), `Downloading... ${Math.round(evt.loaded / 1024 / 1024)}/${Math.round(totalSize / 1024 / 1024)}MB`);
          }
        },
      });

      fs.writeFileSync(dlPath, Buffer.from(res.data));
      onProgress?.(80, 'Extracting...');

      // Clean target dir
      if (fs.existsSync(dlDir)) {
        fs.rmSync(dlDir, { recursive: true, force: true });
      }
      fs.mkdirSync(dlDir, { recursive: true });

      // Extract the 7z SFX exe
      const extracted = await this.extract7zSfx(dlPath, dlDir);
      if (!extracted) {
        // Cleanup and fail
        try { fs.unlinkSync(dlPath); } catch {}
        return { success: false, message: 'Failed to extract cslol-manager. Install 7-Zip or manually extract.' };
      }

      // Cleanup download
      try { fs.unlinkSync(dlPath); } catch {}

      onProgress?.(95, 'Configuring...');

      if (this.findCslol()) {
        this.writeConfig();
        onProgress?.(100, 'Done!');
        return { success: true, message: `CSLoL Manager ${version} installed!` };
      }

      return { success: false, message: 'cslol-manager.exe not found after extraction' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Extract a 7z SFX .exe to a destination folder.
   * Tries multiple 7z locations, then falls back to running the SFX exe itself.
   */
  private async extract7zSfx(sfxPath: string, destDir: string): Promise<boolean> {
    // Try to find 7z.exe on the system
    const sevenZipPaths = [
      'C:\\Program Files\\7-Zip\\7z.exe',
      'C:\\Program Files (x86)\\7-Zip\\7z.exe',
      'C:\\Program Files\\AMD\\AMDInstallManager\\7z.exe',  // Available on this machine
    ];

    for (const szPath of sevenZipPaths) {
      if (fs.existsSync(szPath)) {
        try {
          execFileSync(szPath, ['x', sfxPath, `-o${destDir}`, '-y'], {
            timeout: 120000,
            windowsHide: true,
          });
          // Check if extracted properly — might be in a subfolder
          const files = fs.readdirSync(destDir);
          if (files.includes('cslol-manager.exe')) return true;
          // Check one level deep
          for (const f of files) {
            const sub = path.join(destDir, f);
            if (fs.statSync(sub).isDirectory() && fs.existsSync(path.join(sub, 'cslol-manager.exe'))) {
              // Move contents up
              for (const inner of fs.readdirSync(sub)) {
                fs.renameSync(path.join(sub, inner), path.join(destDir, inner));
              }
              fs.rmdirSync(sub);
              return true;
            }
          }
          return files.length > 0;
        } catch {}
      }
    }

    // Fallback: run the SFX exe with /S (silent) flag — some SFX archives support this
    try {
      execFileSync(sfxPath, ['-o' + destDir, '-y'], { timeout: 60000, windowsHide: true });
      if (fs.existsSync(path.join(destDir, 'cslol-manager.exe'))) return true;
    } catch {}

    return false;
  }

  /**
   * Setup from a user-provided path (browse button).
   */
  setupFromPath(folderPath: string): { success: boolean; message: string } {
    const candidates = [folderPath, path.join(folderPath, 'cslol-manager')];
    for (const dir of candidates) {
      const exe = path.join(dir, 'cslol-manager.exe');
      const tools = path.join(dir, 'cslol-tools', 'mod-tools.exe');
      if (fs.existsSync(exe) && fs.existsSync(tools)) {
        const dest = path.join(this.basePath, 'cslol-manager');
        if (path.resolve(dest) !== path.resolve(dir)) {
          try {
            if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
            fs.cpSync(dir, dest, { recursive: true });
          } catch (e: any) {
            return { success: false, message: `Failed to copy: ${e.message}` };
          }
        }
        if (this.findCslol()) {
          this.writeConfig();
          const status = this.getStatus();
          return { success: true, message: `CSLoL Manager configured! Version: ${status.version || 'unknown'}` };
        }
      }
    }
    return { success: false, message: 'Could not find cslol-manager.exe + cslol-tools/mod-tools.exe in selected folder' };
  }

  private writeConfig() {
    const configPath = path.join(this.cslolRoot, 'config.ini');
    const config = [
      '[General]',
      'themeDarkMode=true',
      `leaguePath=${this.gamePath.replace(/\\/g, '/')}`,
      'detectGamePath=true',
      'blacklist=true',
      'removeUnknownNames=true',
      'ignorebad=false',
      'enableSystray=false',
      'verbosePatcher=false',
      'enableAutoRun=false',
      'suppressInstallConflicts=true',
      'windowHeight=1',
      'windowWidth=1',
      'windowMaximised=false',
    ].join('\n');
    fs.writeFileSync(configPath, config);
  }

  importMod(zipPath: string, modName: string): { success: boolean; message: string } {
    try {
      const safe = modName.replace(/[<>:"/\\|?*]/g, '_');
      const modDir = path.join(this.installedDir, safe);
      if (fs.existsSync(modDir)) fs.rmSync(modDir, { recursive: true, force: true });

      try {
        execFileSync(this.modToolsExe, [
          'import', zipPath, modDir, `--game:${this.gamePath}`, '--noTFT'
        ], { timeout: 60000, windowsHide: true, cwd: this.toolsDir });
      } catch {
        // Fallback: manual extract
        if (!fs.existsSync(path.join(modDir, 'WAD'))) {
          const AdmZip = require('adm-zip');
          const zip = new AdmZip(zipPath);
          zip.extractAllTo(modDir, true);
        }
      }

      const wadDir = path.join(modDir, 'WAD');
      if (!fs.existsSync(wadDir) || !fs.readdirSync(wadDir).some((f: string) => f.endsWith('.wad.client'))) {
        try { fs.rmSync(modDir, { recursive: true, force: true }); } catch {}
        return { success: false, message: `Invalid mod: ${modName}` };
      }
      return { success: true, message: `Imported: ${modName}` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  async apply(modNames?: string[]): Promise<{ success: boolean; message: string }> {
    if (!this.isReady()) return { success: false, message: 'cslol-manager not ready. Go to Settings → Setup.' };

    let mods: string[];
    if (modNames) {
      mods = modNames.map(m => m.replace('.fantome', '').replace('.zip', '').replace(/[<>:"/\\|?*]/g, '_'));
    } else {
      mods = this.listMods();
    }
    if (mods.length === 0) return { success: false, message: 'No mods to apply' };

    this.stopOverlay();
    await new Promise(r => setTimeout(r, 1500));

    const profileName = 'RiftChanger';
    const profileFile = path.join(this.profilesDir, `${profileName}.profile`);
    fs.writeFileSync(profileFile, mods.join('\n') + '\n');
    fs.writeFileSync(path.join(this.cslolRoot, 'current.profile'), profileName);

    const overlayDir = path.join(this.profilesDir, profileName);
    if (fs.existsSync(overlayDir)) fs.rmSync(overlayDir, { recursive: true, force: true });
    fs.mkdirSync(overlayDir, { recursive: true });

    try {
      await new Promise<void>((resolve, reject) => {
        execFile(this.modToolsExe, [
          'mkoverlay', this.installedDir, overlayDir,
          `--game:${this.gamePath}`, `--mods:${mods.join('/')}`,
          '--noTFT', '--ignoreConflict'
        ], { timeout: 180000, windowsHide: true, cwd: this.toolsDir }, (err, stdout, stderr) => {
          if (err && !stdout?.includes('Done!')) reject(new Error(stderr || err.message));
          else resolve();
        });
      });
    } catch (e: any) {
      return { success: false, message: `mkoverlay failed: ${e.message.slice(0, 300)}` };
    }

    this.writeConfig();

    try {
      overlayLog = '';
      this.cslolProcess = spawn(this.cslolExe, [], {
        cwd: this.cslolRoot,
        windowsHide: false,
        stdio: 'ignore',
        detached: true,
      });
      this.cslolProcess.unref();

      const logFile = path.join(overlayDir, 'log.txt');
      const logInterval = setInterval(() => {
        try {
          if (fs.existsSync(logFile)) overlayLog = fs.readFileSync(logFile, 'utf8');
        } catch {}
      }, 2000);
      this.cslolProcess.on('exit', () => {
        clearInterval(logInterval);
        this.cslolProcess = null;
      });

      return { 
        success: true, 
        message: `${mods.length} skin(s) ready! CSLoL Manager launched — click "Run" to start the patcher.` 
      };
    } catch (e: any) {
      return { success: false, message: `Failed to launch cslol-manager: ${e.message}` };
    }
  }

  stopOverlay() {
    if (this.cslolProcess) {
      try { this.cslolProcess.kill(); } catch {}
      this.cslolProcess = null;
    }
    try { require('child_process').execSync('taskkill /F /IM cslol-manager.exe 2>nul', { windowsHide: true }); } catch {}
    try { require('child_process').execSync('taskkill /F /IM mod-tools.exe 2>nul', { windowsHide: true }); } catch {}
  }

  listMods(): string[] {
    if (!fs.existsSync(this.installedDir)) return [];
    return fs.readdirSync(this.installedDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
  }

  removeMod(name: string): boolean {
    const safe = name.replace(/[<>:"/\\|?*]/g, '_');
    const dir = path.join(this.installedDir, safe);
    if (fs.existsSync(dir)) { fs.rmSync(dir, { recursive: true, force: true }); return true; }
    const all = this.listMods();
    const match = all.find(m => m.includes(name) || name.includes(m));
    if (match) { fs.rmSync(path.join(this.installedDir, match), { recursive: true, force: true }); return true; }
    return false;
  }

  removeAllMods() {
    this.stopOverlay();
    for (const m of this.listMods()) {
      try { fs.rmSync(path.join(this.installedDir, m), { recursive: true, force: true }); } catch {}
    }
    const profilePath = path.join(this.profilesDir, 'RiftChanger');
    try { if (fs.existsSync(profilePath)) fs.rmSync(profilePath, { recursive: true, force: true }); } catch {}
    try { if (fs.existsSync(profilePath + '.profile')) fs.unlinkSync(profilePath + '.profile'); } catch {}
  }

  getOverlayStatus(): { running: boolean; log: string } {
    let running = false;
    try {
      const result = require('child_process').execSync('tasklist /FI "IMAGENAME eq cslol-manager.exe" /NH', { windowsHide: true, encoding: 'utf8' });
      running = result.includes('cslol-manager.exe');
    } catch {}

    const logFile = path.join(this.profilesDir, 'RiftChanger', 'log.txt');
    try {
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, 'utf8');
        if (content) overlayLog = content;
      }
    } catch {}

    return { running, log: overlayLog || (running ? 'CSLoL Manager running' : 'Not running') };
  }
}
