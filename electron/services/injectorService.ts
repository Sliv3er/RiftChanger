/**
 * InjectorService — integrates with a standalone CSLoL Manager installation.
 * 
 * Instead of calling mod-tools.exe directly (which causes C0000229 DLL injection errors),
 * we use the user's existing CSLoL Manager by:
 * 1. Importing fantome ZIPs into its `installed/` directory
 * 2. Writing a profile file listing active mods
 * 3. Calling mod-tools.exe mkoverlay + runoverlay from CSLoL Manager's own directory
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawn, execFile, ChildProcess } from 'child_process';
import axios from 'axios';
import AdmZip from 'adm-zip';

let overlayLog = '';

const CSLOL_RELEASES_API = 'https://api.github.com/repos/LeagueToolkit/cslol-manager/releases/latest';

export class InjectorService {
  private basePath: string;
  private cslolRoot = '';      // Root of CSLoL Manager (contains cslol-manager.exe)
  private toolsDir = '';       // cslol-tools subdirectory
  private installedDir = '';   // installed/ subdirectory for mods
  private profilesDir = '';    // profiles/ subdirectory
  private gamePath = 'C:\\Riot Games\\League of Legends\\Game';
  private overlayProcess: ChildProcess | null = null;
  private profileName = 'RiftChanger';

  constructor(basePath: string) {
    this.basePath = basePath;
    this.findCslol();
  }

  /**
   * Find CSLoL Manager installation. Check multiple locations.
   */
  private findCslol(): boolean {
    const candidates = [
      // Our own downloaded copy
      path.join(this.basePath, 'cslol-manager', 'cslol-manager'),
      path.join(this.basePath, 'cslol-manager'),
      // User's standalone installations
      path.join(process.env.USERPROFILE || '', 'Downloads', 'cslol-manager'),
      path.join(process.env.LOCALAPPDATA || '', 'cslol-manager'),
      path.join(process.env.APPDATA || '', 'cslol-manager'),
    ];

    for (const dir of candidates) {
      if (!fs.existsSync(dir)) continue;
      // Look for cslol-tools subdir with mod-tools.exe
      const toolsCandidates = [
        path.join(dir, 'cslol-tools'),
        path.join(dir, 'cslol-manager', 'cslol-tools'),
      ];
      for (const td of toolsCandidates) {
        if (fs.existsSync(path.join(td, 'mod-tools.exe'))) {
          const root = path.dirname(td);
          this.cslolRoot = root;
          this.toolsDir = td;
          this.installedDir = path.join(root, 'installed');
          this.profilesDir = path.join(root, 'profiles');
          fs.mkdirSync(this.installedDir, { recursive: true });
          fs.mkdirSync(this.profilesDir, { recursive: true });
          return true;
        }
      }
      // Maybe mod-tools.exe is directly in the dir
      if (fs.existsSync(path.join(dir, 'mod-tools.exe'))) {
        this.cslolRoot = path.dirname(dir);
        this.toolsDir = dir;
        this.installedDir = path.join(this.cslolRoot, 'installed');
        this.profilesDir = path.join(this.cslolRoot, 'profiles');
        fs.mkdirSync(this.installedDir, { recursive: true });
        fs.mkdirSync(this.profilesDir, { recursive: true });
        return true;
      }
    }
    return false;
  }

  isReady(): boolean {
    return !!this.toolsDir && fs.existsSync(path.join(this.toolsDir, 'mod-tools.exe'));
  }

  async setup(): Promise<{ success: boolean; message: string }> {
    if (this.isReady()) return { success: true, message: 'cslol-tools ready' };
    try {
      const dlDir = path.join(this.basePath, 'cslol-manager');
      fs.mkdirSync(dlDir, { recursive: true });
      const rel = await axios.get(CSLOL_RELEASES_API, { headers: { 'User-Agent': 'RiftChanger/1.0' }, timeout: 15000 });
      const asset = rel.data.assets.find((a: any) => a.name.toLowerCase().includes('win') && a.name.endsWith('.zip'))
                 || rel.data.assets.find((a: any) => a.name.endsWith('.zip'));
      if (!asset) return { success: false, message: 'No CSLoL release found' };
      const dlPath = path.join(this.basePath, asset.name);
      const res = await axios.get(asset.browser_download_url, { responseType: 'arraybuffer', headers: { 'User-Agent': 'RiftChanger/1.0' }, timeout: 120000, maxContentLength: 500 * 1024 * 1024 });
      fs.writeFileSync(dlPath, Buffer.from(res.data));
      const zip = new AdmZip(dlPath);
      zip.extractAllTo(dlDir, true);
      fs.unlinkSync(dlPath);
      return this.findCslol() ? { success: true, message: 'cslol-tools installed' } : { success: false, message: 'mod-tools.exe not found' };
    } catch (e: any) { return { success: false, message: e.message }; }
  }

  /**
   * Import a skin .zip — extract into CSLoL Manager's installed/ directory.
   */
  importMod(zipPath: string, modName: string): { success: boolean; message: string } {
    try {
      const safe = modName.replace(/[<>:"/\\|?*]/g, '_');
      const modDir = path.join(this.installedDir, safe);
      if (fs.existsSync(modDir)) fs.rmSync(modDir, { recursive: true, force: true });

      const zip = new AdmZip(zipPath);
      zip.extractAllTo(modDir, true);

      const hasInfo = fs.existsSync(path.join(modDir, 'META', 'info.json'));
      const wadDir = path.join(modDir, 'WAD');
      const hasWad = fs.existsSync(wadDir) && fs.readdirSync(wadDir).some(f => f.endsWith('.wad.client'));

      if (!hasInfo || !hasWad) {
        fs.rmSync(modDir, { recursive: true, force: true });
        return { success: false, message: `Invalid mod structure in ${modName}` };
      }
      return { success: true, message: `Imported: ${modName}` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Write profile file listing active mods (one per line, matching CSLoL Manager format).
   */
  private writeProfile(modNames: string[]) {
    const profileFile = path.join(this.profilesDir, `${this.profileName}.profile`);
    fs.writeFileSync(profileFile, modNames.join('\n') + '\n');
  }

  /**
   * Build overlay + inject using mod-tools.exe, matching CSLoL Manager's exact approach.
   */
  async apply(modNames?: string[]): Promise<{ success: boolean; message: string }> {
    if (!this.isReady()) return { success: false, message: 'cslol-tools not ready. Go to Settings → Setup.' };

    const modTools = path.join(this.toolsDir, 'mod-tools.exe');

    let mods: string[];
    if (modNames) {
      mods = modNames.map(m => m.replace('.fantome', '').replace(/[<>:"/\\|?*]/g, '_'));
    } else {
      mods = this.listMods();
    }

    if (mods.length === 0) return { success: false, message: 'No mods to apply' };

    // Write profile (CSLoL Manager format)
    this.writeProfile(mods);

    // Overlay directory (CSLoL Manager uses profiles/<name>/)
    const overlayDir = path.join(this.profilesDir, this.profileName);
    if (fs.existsSync(overlayDir)) fs.rmSync(overlayDir, { recursive: true, force: true });
    fs.mkdirSync(overlayDir, { recursive: true });

    // mkoverlay
    const modsArg = mods.join('/');
    const mkArgs = [
      'mkoverlay',
      this.installedDir,
      overlayDir,
      `--game:${this.gamePath}`,
      `--mods:${modsArg}`,
      '--ignoreConflict',
    ];

    try {
      await new Promise<void>((resolve, reject) => {
        execFile(modTools, mkArgs, { timeout: 60000, windowsHide: true, cwd: this.cslolRoot }, (err, stdout, stderr) => {
          if (err) reject(new Error(stderr || stdout || err.message));
          else resolve();
        });
      });
    } catch (e: any) {
      return { success: false, message: `mkoverlay failed: ${e.message.slice(0, 500)}` };
    }

    // Config file in cslol root
    const cfgFile = path.join(this.cslolRoot, `${this.profileName}.config.json`);

    // runoverlay — CWD set to cslolRoot (matching standalone behavior)
    try {
      this.stopOverlay();
      overlayLog = '';

      // Spawn DETACHED so mod-tools.exe is NOT a child of the Electron process.
      // This prevents any process-tree based detection that could cause C0000229.
      this.overlayProcess = spawn(
        modTools,
        ['runoverlay', overlayDir, cfgFile, `--game:${this.gamePath}`, '--opts:none'],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], cwd: this.cslolRoot, detached: true }
      );
      // Unref so Electron can exit even if overlay is running
      this.overlayProcess.unref();

      this.overlayProcess.stdout?.on('data', (d: Buffer) => {
        overlayLog += d.toString();
        if (overlayLog.length > 4096) overlayLog = overlayLog.slice(-4096);
      });
      this.overlayProcess.stderr?.on('data', (d: Buffer) => {
        overlayLog += d.toString();
        if (overlayLog.length > 4096) overlayLog = overlayLog.slice(-4096);
      });
      this.overlayProcess.on('exit', (code) => {
        overlayLog += `\n[process exited with code ${code}]`;
        this.overlayProcess = null;
      });

      await new Promise(r => setTimeout(r, 500));

      if (this.overlayProcess?.exitCode !== null && this.overlayProcess?.exitCode !== undefined) {
        return { success: false, message: `runoverlay exited immediately: ${overlayLog.trim()}` };
      }

      return { success: true, message: `${mods.length} skin(s) ready! Overlay waiting for game.` };
    } catch (e: any) {
      return { success: false, message: `runoverlay failed: ${e.message}` };
    }
  }

  stopOverlay() {
    if (this.overlayProcess) {
      try { this.overlayProcess.stdin?.write('\n'); this.overlayProcess.stdin?.end(); } catch {}
      setTimeout(() => {
        try { this.overlayProcess?.kill(); } catch {}
        this.overlayProcess = null;
      }, 2000);
    }
    try { require('child_process').execSync('taskkill /F /IM mod-tools.exe 2>nul', { windowsHide: true }); } catch {}
  }

  listMods(): string[] {
    if (!fs.existsSync(this.installedDir)) return [];
    return fs.readdirSync(this.installedDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && fs.existsSync(path.join(this.installedDir, e.name, 'META', 'info.json')))
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
    // Remove our mods from installed
    for (const m of this.listMods()) {
      fs.rmSync(path.join(this.installedDir, m), { recursive: true, force: true });
    }
    // Clean overlay directory
    const overlayDir = path.join(this.profilesDir, this.profileName);
    if (fs.existsSync(overlayDir)) {
      try { fs.rmSync(overlayDir, { recursive: true, force: true }); } catch {}
    }
    // Remove profile file
    const profileFile = path.join(this.profilesDir, `${this.profileName}.profile`);
    if (fs.existsSync(profileFile)) {
      try { fs.unlinkSync(profileFile); } catch {}
    }
  }

  getOverlayStatus(): { running: boolean; log: string } {
    return {
      running: this.overlayProcess !== null && this.overlayProcess.exitCode === null,
      log: overlayLog,
    };
  }
}
