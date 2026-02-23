/**
 * InjectorService — uses cslol-tools mod-tools.exe to inject skins directly.
 * No need for CSLoL Manager GUI.
 * 
 * Flow:
 * 1. Copy .fantome to mods dir
 * 2. mkoverlay: build overlay from mods
 * 3. runoverlay: inject overlay into running game
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawn, execSync, ChildProcess } from 'child_process';
import axios from 'axios';
import AdmZip from 'adm-zip';

const CSLOL_RELEASES_API = 'https://api.github.com/repos/LeagueToolkit/cslol-manager/releases/latest';

export class InjectorService {
  private basePath: string;
  private toolsDir: string;
  private modsDir: string;
  private overlayDir: string;
  private configFile: string;
  private gamePath: string;
  private overlayProcess: ChildProcess | null = null;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.toolsDir = '';
    this.modsDir = path.join(basePath, 'mods');
    this.overlayDir = path.join(basePath, 'overlay');
    this.configFile = path.join(basePath, 'overlay-config.json');
    this.gamePath = 'C:\\Riot Games\\League of Legends\\Game';

    fs.mkdirSync(this.modsDir, { recursive: true });
    fs.mkdirSync(this.overlayDir, { recursive: true });

    this.findTools();
  }

  private findTools(): boolean {
    const cslolDir = path.join(this.basePath, 'cslol-manager');
    if (!fs.existsSync(cslolDir)) return false;

    // Find mod-tools.exe recursively
    const walk = (dir: string, depth: number): string | null => {
      if (depth > 4) return null;
      try {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (e.isFile() && e.name === 'mod-tools.exe') return dir;
          if (e.isDirectory()) {
            const r = walk(path.join(dir, e.name), depth + 1);
            if (r) return r;
          }
        }
      } catch {}
      return null;
    };

    const found = walk(cslolDir, 0);
    if (found) { this.toolsDir = found; return true; }
    return false;
  }

  isReady(): boolean {
    return !!this.toolsDir && fs.existsSync(path.join(this.toolsDir, 'mod-tools.exe'));
  }

  getModToolsPath(): string {
    return path.join(this.toolsDir, 'mod-tools.exe');
  }

  async setup(): Promise<{ success: boolean; message: string }> {
    if (this.isReady()) return { success: true, message: 'cslol-tools ready' };

    try {
      const cslolDir = path.join(this.basePath, 'cslol-manager');
      fs.mkdirSync(cslolDir, { recursive: true });

      const releaseRes = await axios.get(CSLOL_RELEASES_API, {
        headers: { 'User-Agent': 'RiftChanger/1.0' },
        timeout: 15000,
      });

      const assets = releaseRes.data.assets;
      const winAsset = assets.find((a: any) =>
        a.name.toLowerCase().includes('win') && a.name.endsWith('.zip')
      ) || assets.find((a: any) => a.name.endsWith('.zip'));

      if (!winAsset) return { success: false, message: 'No CSLoL release found' };

      const dlPath = path.join(this.basePath, winAsset.name);
      const res = await axios.get(winAsset.browser_download_url, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'RiftChanger/1.0' },
        timeout: 120000,
        maxContentLength: 500 * 1024 * 1024,
      });
      fs.writeFileSync(dlPath, Buffer.from(res.data));

      const zip = new AdmZip(dlPath);
      zip.extractAllTo(cslolDir, true);
      fs.unlinkSync(dlPath);

      if (this.findTools()) return { success: true, message: 'cslol-tools installed' };
      return { success: false, message: 'Downloaded but mod-tools.exe not found' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  setGamePath(p: string) { this.gamePath = p; }
  getGamePath(): string { return this.gamePath; }

  /**
   * Import a skin zip as .fantome into the mods directory
   */
  importMod(zipPath: string, modName: string): { success: boolean; message: string } {
    try {
      fs.mkdirSync(this.modsDir, { recursive: true });
      const safe = modName.replace(/[<>:"/\\|?*]/g, '_');
      const dest = path.join(this.modsDir, `${safe}.fantome`);
      fs.copyFileSync(zipPath, dest);
      return { success: true, message: `Imported: ${modName}` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Build overlay + inject into game. Full apply pipeline.
   */
  async apply(modNames?: string[]): Promise<{ success: boolean; message: string }> {
    if (!this.isReady()) return { success: false, message: 'cslol-tools not ready' };

    const modTools = this.getModToolsPath();

    // Get list of mods to apply
    let mods: string[];
    if (modNames) {
      mods = modNames;
    } else {
      mods = this.listMods().map(m => m.replace('.fantome', ''));
    }

    if (mods.length === 0) return { success: false, message: 'No mods to apply' };

    // Clean overlay dir
    if (fs.existsSync(this.overlayDir)) {
      fs.rmSync(this.overlayDir, { recursive: true, force: true });
    }
    fs.mkdirSync(this.overlayDir, { recursive: true });

    // Step 1: mkoverlay
    const modsArg = mods.join('/');
    try {
      const mkResult = execSync(
        `"${modTools}" mkoverlay "${this.modsDir}" "${this.overlayDir}" --game:"${this.gamePath}" --mods:${modsArg} --ignoreConflict`,
        { timeout: 60000, windowsHide: true }
      ).toString();
    } catch (e: any) {
      const stderr = e.stderr?.toString() || e.message;
      return { success: false, message: `mkoverlay failed: ${stderr}` };
    }

    // Step 2: Create config
    const config = { gamePath: this.gamePath };
    fs.writeFileSync(this.configFile, JSON.stringify(config));

    // Step 3: runoverlay
    try {
      // Kill existing overlay if running
      this.stopOverlay();

      this.overlayProcess = spawn(
        modTools,
        ['runoverlay', this.overlayDir, this.configFile, `--game:${this.gamePath}`],
        { detached: true, stdio: 'ignore', windowsHide: true }
      );
      this.overlayProcess.unref();

      return { success: true, message: `✅ Skins injected! ${mods.length} mod(s) active. Play a game to see them.` };
    } catch (e: any) {
      return { success: false, message: `runoverlay failed: ${e.message}` };
    }
  }

  stopOverlay() {
    if (this.overlayProcess) {
      try { this.overlayProcess.kill(); } catch {}
      this.overlayProcess = null;
    }
    // Also kill any lingering mod-tools
    try {
      execSync('taskkill /F /IM mod-tools.exe 2>nul', { windowsHide: true });
    } catch {}
  }

  listMods(): string[] {
    if (!fs.existsSync(this.modsDir)) return [];
    return fs.readdirSync(this.modsDir).filter(f => f.endsWith('.fantome'));
  }

  removeMod(name: string): boolean {
    const safe = name.replace('.fantome', '').replace(/[<>:"/\\|?*]/g, '_');
    const candidates = [
      path.join(this.modsDir, `${safe}.fantome`),
      path.join(this.modsDir, name),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) { fs.unlinkSync(c); return true; }
    }
    // Fuzzy match
    const all = this.listMods();
    const match = all.find(m => m.includes(name) || name.includes(m.replace('.fantome', '')));
    if (match) { fs.unlinkSync(path.join(this.modsDir, match)); return true; }
    return false;
  }

  removeAllMods() {
    for (const m of this.listMods()) {
      fs.unlinkSync(path.join(this.modsDir, m));
    }
  }
}
