/**
 * InjectorService — uses mod-tools.exe (cslol-tools) for skin injection.
 * 
 * Workflow (matching working Rift implementation):
 * 1. mod-tools import <zip> <dest> --game:<path> --noTFT
 * 2. mod-tools mkoverlay <installed> <profile> --game:<path> --mods:<names> --noTFT --ignoreConflict
 * 3. mod-tools runoverlay <profile> <config> --game:<path> --opts:none
 * 
 * Key: installed/ and profiles/ dirs live INSIDE the cslol-tools directory.
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawn, execFile, ChildProcess } from 'child_process';
import axios from 'axios';
import AdmZip from 'adm-zip';

const CSLOL_RELEASES_API = 'https://api.github.com/repos/LeagueToolkit/cslol-manager/releases/latest';

let overlayLog = '';

export class InjectorService {
  private basePath: string;
  private toolsDir = '';
  private modToolsExe = '';
  private installedDir = '';
  private profilesDir = '';
  private gamePath = 'C:\\Riot Games\\League of Legends\\Game';
  private overlayProcess: ChildProcess | null = null;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.findTools();
  }

  private findTools(): boolean {
    const candidates = [
      path.join(this.basePath, 'cslol-manager', 'cslol-manager', 'cslol-tools'),
      path.join(this.basePath, 'cslol-manager', 'cslol-tools'),
      path.join(process.env.USERPROFILE || '', 'Downloads', 'cslol-manager', 'cslol-tools'),
    ];

    for (const dir of candidates) {
      const mt = path.join(dir, 'mod-tools.exe');
      if (fs.existsSync(mt)) {
        this.toolsDir = dir;
        this.modToolsExe = mt;
        // installed/ and profiles/ live INSIDE cslol-tools (matching working Rift app)
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
    return !!this.modToolsExe && fs.existsSync(this.modToolsExe);
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
      try { fs.unlinkSync(dlPath); } catch {}
      return this.findTools() ? { success: true, message: 'cslol-tools installed' } : { success: false, message: 'mod-tools.exe not found after extract' };
    } catch (e: any) { return { success: false, message: e.message }; }
  }

  /**
   * Import a skin zip using mod-tools import (critical step the working Rift app uses).
   */
  importMod(zipPath: string, modName: string): { success: boolean; message: string } {
    try {
      const safe = modName.replace(/[<>:"/\\|?*]/g, '_');
      const modDir = path.join(this.installedDir, safe);

      // Remove existing if present
      if (fs.existsSync(modDir)) fs.rmSync(modDir, { recursive: true, force: true });

      // Use mod-tools import (this is what the working Rift app does)
      const { execFileSync } = require('child_process');
      try {
        execFileSync(this.modToolsExe, [
          'import',
          zipPath,
          modDir,
          `--game:${this.gamePath}`,
          '--noTFT'
        ], { timeout: 45000, windowsHide: true, cwd: this.toolsDir });
      } catch (importErr: any) {
        // mod-tools import might write to stderr even on success, check if dir was created
        if (!fs.existsSync(modDir) || !fs.existsSync(path.join(modDir, 'WAD'))) {
          // Fallback: manual extract (like our old approach)
          const zip = new AdmZip(zipPath);
          zip.extractAllTo(modDir, true);
        }
      }

      // Verify structure
      const hasWad = fs.existsSync(path.join(modDir, 'WAD')) && 
        fs.readdirSync(path.join(modDir, 'WAD')).some(f => f.endsWith('.wad.client'));
      
      if (!hasWad) {
        fs.rmSync(modDir, { recursive: true, force: true });
        return { success: false, message: `Invalid mod structure for ${modName}` };
      }

      return { success: true, message: `Imported: ${modName}` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Build overlay + start runoverlay (matching working Rift implementation exactly).
   */
  async apply(modNames?: string[]): Promise<{ success: boolean; message: string }> {
    if (!this.isReady()) return { success: false, message: 'cslol-tools not ready. Go to Settings → Setup.' };

    let mods: string[];
    if (modNames) {
      mods = modNames.map(m => m.replace('.fantome', '').replace('.zip', '').replace(/[<>:"/\\|?*]/g, '_'));
    } else {
      mods = this.listMods();
    }

    if (mods.length === 0) return { success: false, message: 'No mods to apply' };

    // Kill any existing overlay first
    this.stopOverlay();
    await new Promise(r => setTimeout(r, 1000));

    // Overlay/profile paths (inside cslol-tools)
    const profileName = 'RiftChanger_Unified';
    const profilePath = path.join(this.profilesDir, profileName);
    const configPath = profilePath + '.config';

    // mkoverlay with --noTFT (matching working Rift app)
    const mkArgs = [
      'mkoverlay',
      this.installedDir,
      profilePath,
      `--game:${this.gamePath}`,
      `--mods:${mods.join('/')}`,
      '--noTFT',
      '--ignoreConflict',
    ];

    try {
      await new Promise<void>((resolve, reject) => {
        execFile(this.modToolsExe, mkArgs, { timeout: 180000, windowsHide: true, cwd: this.toolsDir }, (err, stdout, stderr) => {
          if (err && !stdout?.includes('Done!')) {
            reject(new Error(stderr || stdout || err.message));
          } else {
            resolve();
          }
        });
      });
    } catch (e: any) {
      return { success: false, message: `mkoverlay failed: ${e.message.slice(0, 500)}` };
    }

    // runoverlay — NOT detached, matching working Rift app exactly
    try {
      overlayLog = '';

      this.overlayProcess = spawn(
        this.modToolsExe,
        ['runoverlay', profilePath, configPath, `--game:${this.gamePath}`, '--opts:none'],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], cwd: this.toolsDir, detached: false }
      );

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

      // Wait 2 seconds (matching Rift's approach) to check if it started
      await new Promise(r => setTimeout(r, 2000));

      if (this.overlayProcess?.exitCode !== null && this.overlayProcess?.exitCode !== undefined) {
        return { success: false, message: `runoverlay exited: ${overlayLog.trim()}` };
      }

      return { success: true, message: `${mods.length} skin(s) applied! Waiting for game.` };
    } catch (e: any) {
      return { success: false, message: `runoverlay failed: ${e.message}` };
    }
  }

  stopOverlay() {
    if (this.overlayProcess) {
      try { this.overlayProcess.stdin?.write('\n'); this.overlayProcess.stdin?.end(); } catch {}
      try { this.overlayProcess.kill(); } catch {}
      this.overlayProcess = null;
    }
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
    // Clean installed mods
    for (const m of this.listMods()) {
      try { fs.rmSync(path.join(this.installedDir, m), { recursive: true, force: true }); } catch {}
    }
    // Clean profiles
    const profilePath = path.join(this.profilesDir, 'RiftChanger_Unified');
    try { if (fs.existsSync(profilePath)) fs.rmSync(profilePath, { recursive: true, force: true }); } catch {}
    try { if (fs.existsSync(profilePath + '.config')) fs.unlinkSync(profilePath + '.config'); } catch {}
  }

  getOverlayStatus(): { running: boolean; log: string } {
    return {
      running: this.overlayProcess !== null && this.overlayProcess.exitCode === null,
      log: overlayLog,
    };
  }
}
