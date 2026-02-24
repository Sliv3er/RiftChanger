/**
 * InjectorService — uses cslol-tools mod-tools.exe to inject skins.
 * mod-tools mkoverlay expects EXTRACTED mod folders (not .fantome zips).
 * Each mod folder: <name>/META/info.json + <name>/WAD/<Champ>.wad.client
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawn, execFile, ChildProcess } from 'child_process';
import axios from 'axios';
import AdmZip from 'adm-zip';

let overlayLog = ''; // Keep last output for debugging

const CSLOL_RELEASES_API = 'https://api.github.com/repos/LeagueToolkit/cslol-manager/releases/latest';

export class InjectorService {
  private basePath: string;
  private toolsDir = '';
  private modsDir: string;
  private overlayDir: string;
  private configFile: string;
  private gamePath = 'C:\\Riot Games\\League of Legends\\Game';
  private overlayProcess: ChildProcess | null = null;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.modsDir = path.join(basePath, 'mods');
    this.overlayDir = path.join(basePath, 'overlay');
    this.configFile = path.join(basePath, 'overlay-config.json');
    fs.mkdirSync(this.modsDir, { recursive: true });
    this.findTools();
  }

  private findTools(): boolean {
    const cslolDir = path.join(this.basePath, 'cslol-manager');
    if (!fs.existsSync(cslolDir)) return false;
    const walk = (dir: string, d: number): string | null => {
      if (d > 4) return null;
      try {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (e.isFile() && e.name === 'mod-tools.exe') return dir;
          if (e.isDirectory()) { const r = walk(path.join(dir, e.name), d + 1); if (r) return r; }
        }
      } catch {} return null;
    };
    const found = walk(cslolDir, 0);
    if (found) { this.toolsDir = found; return true; }
    return false;
  }

  isReady(): boolean {
    return !!this.toolsDir && fs.existsSync(path.join(this.toolsDir, 'mod-tools.exe'));
  }

  async setup(): Promise<{ success: boolean; message: string }> {
    if (this.isReady()) return { success: true, message: 'cslol-tools ready' };
    try {
      const cslolDir = path.join(this.basePath, 'cslol-manager');
      fs.mkdirSync(cslolDir, { recursive: true });
      const rel = await axios.get(CSLOL_RELEASES_API, { headers: { 'User-Agent': 'RiftChanger/1.0' }, timeout: 15000 });
      const asset = rel.data.assets.find((a: any) => a.name.toLowerCase().includes('win') && a.name.endsWith('.zip'))
                 || rel.data.assets.find((a: any) => a.name.endsWith('.zip'));
      if (!asset) return { success: false, message: 'No CSLoL release found' };
      const dlPath = path.join(this.basePath, asset.name);
      const res = await axios.get(asset.browser_download_url, { responseType: 'arraybuffer', headers: { 'User-Agent': 'RiftChanger/1.0' }, timeout: 120000, maxContentLength: 500 * 1024 * 1024 });
      fs.writeFileSync(dlPath, Buffer.from(res.data));
      const zip = new AdmZip(dlPath);
      zip.extractAllTo(cslolDir, true);
      fs.unlinkSync(dlPath);
      return this.findTools() ? { success: true, message: 'cslol-tools installed' } : { success: false, message: 'mod-tools.exe not found' };
    } catch (e: any) { return { success: false, message: e.message }; }
  }

  /**
   * Import a skin .zip — EXTRACT it into a mod folder.
   * mod-tools needs: modsDir/<modName>/META/info.json + WAD/*.wad.client
   */
  importMod(zipPath: string, modName: string): { success: boolean; message: string } {
    try {
      const safe = modName.replace(/[<>:"/\\|?*]/g, '_');
      const modDir = path.join(this.modsDir, safe);

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
   * Build overlay + inject. Uses execFile (array args) to handle spaces in mod names.
   */
  async apply(modNames?: string[]): Promise<{ success: boolean; message: string }> {
    if (!this.isReady()) return { success: false, message: 'cslol-tools not ready. Go to Settings → Setup.' };

    const modTools = path.join(this.toolsDir, 'mod-tools.exe');

    let mods: string[];
    if (modNames) {
      mods = modNames.map(m => m.replace('.fantome', '').replace(/[<>:"/\\|?*]/g, '_'));
    } else {
      mods = fs.readdirSync(this.modsDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && fs.existsSync(path.join(this.modsDir, e.name, 'META', 'info.json')))
        .map(e => e.name);
    }

    if (mods.length === 0) return { success: false, message: 'No mods to apply' };

    // Clean overlay
    if (fs.existsSync(this.overlayDir)) fs.rmSync(this.overlayDir, { recursive: true, force: true });
    fs.mkdirSync(this.overlayDir, { recursive: true });

    // mkoverlay — use execFile with proper args array (handles spaces correctly)
    const modsArg = mods.join('/');
    const mkArgs = [
      'mkoverlay',
      this.modsDir,
      this.overlayDir,
      `--game:${this.gamePath}`,
      `--mods:${modsArg}`,
      '--ignoreConflict',
    ];

    try {
      await new Promise<void>((resolve, reject) => {
        execFile(modTools, mkArgs, { timeout: 60000, windowsHide: true }, (err, stdout, stderr) => {
          if (err) {
            const msg = stderr || stdout || err.message;
            reject(new Error(msg));
          } else {
            resolve();
          }
        });
      });
    } catch (e: any) {
      return { success: false, message: `mkoverlay failed: ${e.message.slice(0, 500)}` };
    }

    // Config
    fs.writeFileSync(this.configFile, JSON.stringify({ gamePath: this.gamePath }));

    // runoverlay — keep stdio so we can monitor and the process stays alive
    try {
      this.stopOverlay();
      overlayLog = '';

      this.overlayProcess = spawn(
        modTools,
        ['runoverlay', this.overlayDir, this.configFile, `--game:${this.gamePath}`, '--opts:none'],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }
      );

      this.overlayProcess.stdout?.on('data', (d: Buffer) => {
        overlayLog += d.toString();
        // Keep last 2KB
        if (overlayLog.length > 2048) overlayLog = overlayLog.slice(-2048);
      });
      this.overlayProcess.stderr?.on('data', (d: Buffer) => {
        overlayLog += d.toString();
        if (overlayLog.length > 2048) overlayLog = overlayLog.slice(-2048);
      });
      this.overlayProcess.on('exit', (code) => {
        overlayLog += `\n[process exited with code ${code}]`;
        this.overlayProcess = null;
      });

      // Wait a moment to make sure it didn't crash immediately
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
      try {
        // CSLoL stops the patcher by writing newline to stdin
        this.overlayProcess.stdin?.write('\n');
        this.overlayProcess.stdin?.end();
      } catch {}
      // Give it a moment to exit gracefully, then force kill
      setTimeout(() => {
        try { this.overlayProcess?.kill(); } catch {}
        this.overlayProcess = null;
      }, 2000);
    }
    try { require('child_process').execSync('taskkill /F /IM mod-tools.exe 2>nul', { windowsHide: true }); } catch {}
  }

  listMods(): string[] {
    if (!fs.existsSync(this.modsDir)) return [];
    return fs.readdirSync(this.modsDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && fs.existsSync(path.join(this.modsDir, e.name, 'META', 'info.json')))
      .map(e => e.name);
  }

  removeMod(name: string): boolean {
    const safe = name.replace(/[<>:"/\\|?*]/g, '_');
    const dir = path.join(this.modsDir, safe);
    if (fs.existsSync(dir)) { fs.rmSync(dir, { recursive: true, force: true }); return true; }
    const all = this.listMods();
    const match = all.find(m => m.includes(name) || name.includes(m));
    if (match) { fs.rmSync(path.join(this.modsDir, match), { recursive: true, force: true }); return true; }
    return false;
  }

  getOverlayStatus(): { running: boolean; log: string } {
    return {
      running: this.overlayProcess !== null && this.overlayProcess.exitCode === null,
      log: overlayLog,
    };
  }

  removeAllMods() {
    for (const m of this.listMods()) {
      fs.rmSync(path.join(this.modsDir, m), { recursive: true, force: true });
    }
  }
}
