/**
 * InjectorService — uses the actual cslol-manager.exe for injection.
 * 
 * mod-tools.exe alone causes C0000229 DLL injection errors.
 * cslol-manager.exe has its own built-in patcher that works correctly.
 * 
 * Workflow:
 * 1. Download/detect cslol-manager installation
 * 2. Import mods using mod-tools import into installed/ dir
 * 3. Write profile config (current.profile + profiles/<name>.profile)
 * 4. Launch cslol-manager.exe hidden with auto-run enabled
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawn, execFile, execFileSync, ChildProcess } from 'child_process';
import axios from 'axios';
import AdmZip from 'adm-zip';

// Known working CSLoL Manager .zip release (matches Rift app approach)

let overlayLog = '';

export class InjectorService {
  private basePath: string;
  private cslolRoot = '';       // Root dir containing cslol-manager.exe
  private cslolExe = '';        // Path to cslol-manager.exe
  private toolsDir = '';        // cslol-tools/ subdir
  private modToolsExe = '';     // mod-tools.exe for import
  private installedDir = '';    // installed/ dir for mods
  private profilesDir = '';     // profiles/ dir
  private gamePath = 'C:\\Riot Games\\League of Legends\\Game';
  private cslolProcess: ChildProcess | null = null;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.findCslol();
  }

  private findCslol(): boolean {
    const candidates = [
      // Next to the app exe (primary location)
      path.join(this.basePath, 'cslol-manager'),
      // Nested (from GitHub release zip structure)
      path.join(this.basePath, 'cslol-manager', 'cslol-manager'),
      // AppData\Roaming fallback
      path.join(process.env.APPDATA || '', 'riftchanger', 'cslol-manager'),
      path.join(process.env.APPDATA || '', 'riftchanger', 'cslol-manager', 'cslol-manager'),
      // User's standalone
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
    // Must have BOTH cslol-manager.exe AND mod-tools.exe (cslol-tools extracted)
    return !!this.cslolExe && fs.existsSync(this.cslolExe) 
      && !!this.modToolsExe && fs.existsSync(this.modToolsExe);
  }

  async setup(forceReinstall = false): Promise<{ success: boolean; message: string }> {
    // Only skip download if ready AND not forcing reinstall AND cslol is in our basePath (not a fallback)
    if (!forceReinstall && this.isReady() && this.cslolRoot.startsWith(this.basePath)) {
      return { success: true, message: 'cslol-manager ready' };
    }
    try {
      const dlDir = path.join(this.basePath, 'cslol-manager');
      // Clean existing to force fresh install
      if (fs.existsSync(dlDir)) {
        try { fs.rmSync(dlDir, { recursive: true, force: true }); } catch {}
      }
      fs.mkdirSync(dlDir, { recursive: true });
      
      // Use known working .zip release (same approach as Rift app)
      // Recent releases are .exe (7z SFX) which can't be easily extracted
      const CSLOL_ZIP_URL = 'https://github.com/LeagueToolkit/cslol-manager/releases/download/2025-06-26-a2fb470/cslol-manager.zip';
      const CSLOL_EXTRACT_FOLDER = 'cslol-manager-2025-06-26-a2fb470';
      
      const dlPath = path.join(this.basePath, 'cslol-manager.zip');
      const res = await axios.get(CSLOL_ZIP_URL, { 
        responseType: 'arraybuffer', 
        headers: { 'User-Agent': 'RiftChanger/1.0' }, 
        timeout: 300000, 
        maxContentLength: 500 * 1024 * 1024 
      });
      fs.writeFileSync(dlPath, Buffer.from(res.data));
      
      // Extract to temp dir first
      const tempDir = path.join(this.basePath, 'temp_extract');
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
      
      const zip = new AdmZip(dlPath);
      zip.extractAllTo(tempDir, true);
      
      // Move extracted folder to final location
      const extracted = path.join(tempDir, CSLOL_EXTRACT_FOLDER);
      if (fs.existsSync(extracted)) {
        if (fs.existsSync(dlDir)) fs.rmSync(dlDir, { recursive: true, force: true });
        fs.renameSync(extracted, dlDir);
      } else {
        // Fallback: the zip might extract directly
        if (fs.existsSync(dlDir)) fs.rmSync(dlDir, { recursive: true, force: true });
        fs.renameSync(tempDir, dlDir);
      }
      
      // Cleanup
      try { fs.unlinkSync(dlPath); } catch {}
      try { if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      
      if (this.findCslol()) {
        // Write initial config
        this.writeConfig();
        return { success: true, message: 'cslol-manager installed and configured' };
      }
      return { success: false, message: 'cslol-manager.exe not found after extract' };
    } catch (e: any) { 
      return { success: false, message: e.message }; 
    }
  }

  /**
   * Setup from a user-provided path (browse).
   */
  setupFromPath(folderPath: string): { success: boolean; message: string } {
    // Check if the folder itself has cslol-manager.exe
    const candidates = [
      folderPath,
      path.join(folderPath, 'cslol-manager'),
    ];
    for (const dir of candidates) {
      const exe = path.join(dir, 'cslol-manager.exe');
      const tools = path.join(dir, 'cslol-tools', 'mod-tools.exe');
      if (fs.existsSync(exe) && fs.existsSync(tools)) {
        // Copy to our basePath so it's always next to the app
        const dest = path.join(this.basePath, 'cslol-manager');
        if (dest !== dir) {
          try {
            if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
            fs.cpSync(dir, dest, { recursive: true });
          } catch (e: any) {
            return { success: false, message: `Failed to copy: ${e.message}` };
          }
        }
        if (this.findCslol()) {
          this.writeConfig();
          return { success: true, message: 'CSLoL Manager configured!' };
        }
      }
    }
    return { success: false, message: 'cslol-manager.exe not found in selected folder' };
  }

  /**
   * Write config.ini for cslol-manager.exe
   */
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

  /**
   * Import a skin zip using mod-tools import.
   */
  importMod(zipPath: string, modName: string): { success: boolean; message: string } {
    try {
      const safe = modName.replace(/[<>:"/\\|?*]/g, '_');
      const modDir = path.join(this.installedDir, safe);
      if (fs.existsSync(modDir)) fs.rmSync(modDir, { recursive: true, force: true });

      // Use mod-tools import
      try {
        execFileSync(this.modToolsExe, [
          'import', zipPath, modDir, `--game:${this.gamePath}`, '--noTFT'
        ], { timeout: 60000, windowsHide: true, cwd: this.toolsDir });
      } catch {
        // Fallback: manual extract if mod-tools import fails
        if (!fs.existsSync(path.join(modDir, 'WAD'))) {
          const zip = new AdmZip(zipPath);
          zip.extractAllTo(modDir, true);
        }
      }

      // Verify
      const wadDir = path.join(modDir, 'WAD');
      if (!fs.existsSync(wadDir) || !fs.readdirSync(wadDir).some(f => f.endsWith('.wad.client'))) {
        try { fs.rmSync(modDir, { recursive: true, force: true }); } catch {}
        return { success: false, message: `Invalid mod: ${modName}` };
      }
      return { success: true, message: `Imported: ${modName}` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Apply mods by:
   * 1. Writing profile with active mod names
   * 2. Setting current.profile
   * 3. Launching cslol-manager.exe hidden — it runs its built-in patcher
   */
  async apply(modNames?: string[]): Promise<{ success: boolean; message: string }> {
    if (!this.isReady()) return { success: false, message: 'cslol-manager not ready. Go to Settings → Setup.' };

    let mods: string[];
    if (modNames) {
      mods = modNames.map(m => m.replace('.fantome', '').replace('.zip', '').replace(/[<>:"/\\|?*]/g, '_'));
    } else {
      mods = this.listMods();
    }
    if (mods.length === 0) return { success: false, message: 'No mods to apply' };

    // Stop any existing instance
    this.stopOverlay();
    await new Promise(r => setTimeout(r, 1500));

    // Write profile file (mod names, one per line)
    const profileName = 'RiftChanger';
    const profileFile = path.join(this.profilesDir, `${profileName}.profile`);
    fs.writeFileSync(profileFile, mods.join('\n') + '\n');

    // Set as current profile
    fs.writeFileSync(path.join(this.cslolRoot, 'current.profile'), profileName);

    // Build overlay using mod-tools mkoverlay first
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

    // Write config with auto-run DISABLED (we'll run the overlay via cslol-manager.exe GUI)
    this.writeConfig();

    // Launch cslol-manager.exe — it will use current.profile and the overlay we built
    // The GUI handles the actual DLL injection correctly (unlike mod-tools.exe alone)
    try {
      overlayLog = '';

      // Launch minimized/hidden
      this.cslolProcess = spawn(this.cslolExe, [], {
        cwd: this.cslolRoot,
        windowsHide: false,  // Must be false — Qt needs a window to function
        stdio: 'ignore',
        detached: true,
      });
      this.cslolProcess.unref();

      // Monitor by checking the overlay log file
      const logFile = path.join(overlayDir, 'log.txt');
      
      // Poll for status
      const checkLog = () => {
        try {
          if (fs.existsSync(logFile)) {
            overlayLog = fs.readFileSync(logFile, 'utf8');
          }
        } catch {}
      };
      
      const logInterval = setInterval(checkLog, 2000);
      this.cslolProcess.on('exit', () => {
        clearInterval(logInterval);
        this.cslolProcess = null;
      });

      return { 
        success: true, 
        message: `${mods.length} skin(s) ready! CSLoL Manager launched — click "Run" in its window to start the patcher, then start a game.` 
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
    // Kill all cslol processes
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
    // Clean profiles
    const profilePath = path.join(this.profilesDir, 'RiftChanger');
    try { if (fs.existsSync(profilePath)) fs.rmSync(profilePath, { recursive: true, force: true }); } catch {}
    try { if (fs.existsSync(profilePath + '.profile')) fs.unlinkSync(profilePath + '.profile'); } catch {}
  }

  getOverlayStatus(): { running: boolean; log: string } {
    // Check if cslol-manager.exe is running
    let running = false;
    try {
      const result = require('child_process').execSync('tasklist /FI "IMAGENAME eq cslol-manager.exe" /NH', { windowsHide: true, encoding: 'utf8' });
      running = result.includes('cslol-manager.exe');
    } catch {}

    // Read overlay log
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
