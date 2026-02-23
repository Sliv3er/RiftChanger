import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import axios from 'axios';
import AdmZip from 'adm-zip';

const CSLOL_RELEASES_API = 'https://api.github.com/repos/LeagueToolkit/cslol-manager/releases/latest';

export class CslolService {
  private basePath: string;
  private cslolDir: string;
  private modsDir: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.cslolDir = path.join(basePath, 'cslol-manager');
    this.modsDir = path.join(this.cslolDir, 'installed');
  }

  isReady(): boolean {
    return this.findExecutable() !== null;
  }

  private findExecutable(): string | null {
    if (!fs.existsSync(this.cslolDir)) return null;

    // Search recursively for cslol-manager.exe, prefer the one inside a subdirectory
    // (the root-level one is often the self-extracting archive)
    const found: { path: string; depth: number; size: number }[] = [];

    const walk = (dir: string, depth: number) => {
      if (depth > 3) return;
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isFile() && entry.name === 'cslol-manager.exe') {
            found.push({ path: full, depth, size: fs.statSync(full).size });
          } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
            walk(full, depth + 1);
          }
        }
      } catch {}
    };

    walk(this.cslolDir, 0);
    if (found.length === 0) return null;

    // Prefer the SMALLEST exe (real app ~28MB) over the self-extracting archive (~36MB)
    found.sort((a, b) => a.size - b.size);
    return found[0].path;
  }

  async setup(): Promise<{ success: boolean; message: string; exePath?: string }> {
    try {
      fs.mkdirSync(this.cslolDir, { recursive: true });
      fs.mkdirSync(this.modsDir, { recursive: true });

      const existing = this.findExecutable();
      if (existing) {
        return { success: true, message: `CSLoL Manager ready: ${existing}`, exePath: existing };
      }

      const releaseRes = await axios.get(CSLOL_RELEASES_API, {
        headers: { 'User-Agent': 'RiftChanger/1.0' },
        timeout: 15000,
      });

      const assets = releaseRes.data.assets;
      const winAsset = assets.find((a: any) =>
        a.name.toLowerCase().includes('win') &&
        (a.name.endsWith('.zip') || a.name.endsWith('.exe'))
      ) || assets.find((a: any) => a.name.endsWith('.zip'));

      if (!winAsset) {
        return { success: false, message: 'No compatible CSLoL release found.' };
      }

      const downloadPath = path.join(this.basePath, winAsset.name);
      const response = await axios.get(winAsset.browser_download_url, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'RiftChanger/1.0' },
        timeout: 120000,
        maxContentLength: 500 * 1024 * 1024,
      });
      fs.writeFileSync(downloadPath, Buffer.from(response.data));

      if (winAsset.name.endsWith('.zip')) {
        const zip = new AdmZip(downloadPath);
        zip.extractAllTo(this.cslolDir, true);
        fs.unlinkSync(downloadPath);
      }

      const exe = this.findExecutable();
      return exe
        ? { success: true, message: `CSLoL Manager installed`, exePath: exe }
        : { success: false, message: 'Downloaded but exe not found.' };
    } catch (e: any) {
      return { success: false, message: `Setup failed: ${e.message}` };
    }
  }

  /**
   * Apply a single skin .zip as .fantome into CSLoL mods dir
   */
  applySingle(zipPath: string, skinName: string, champName: string): { success: boolean; message: string } {
    try {
      if (!fs.existsSync(zipPath)) {
        return { success: false, message: `File not found: ${zipPath}` };
      }
      fs.mkdirSync(this.modsDir, { recursive: true });
      const safeName = `${champName} - ${skinName}`.replace(/[<>:"/\\|?*]/g, '_');
      const dest = path.join(this.modsDir, `${safeName}.fantome`);
      fs.copyFileSync(zipPath, dest);
      return { success: true, message: `Imported "${skinName}". Open CSLoL Manager → click Run.` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  launchManager(): { success: boolean; message: string } {
    const exe = this.findExecutable();
    if (!exe) return { success: false, message: 'CSLoL Manager not found. Run setup first.' };

    try {
      const child = spawn(exe, [], {
        detached: true,
        stdio: 'ignore',
        cwd: path.dirname(exe),
      });
      child.unref();
      return { success: true, message: `Launched CSLoL Manager` };
    } catch (e: any) {
      return { success: false, message: `Launch failed: ${e.message}` };
    }
  }

  removeAll(): { success: boolean; removed: number; message: string } {
    try {
      let removed = 0;
      if (fs.existsSync(this.modsDir)) {
        for (const f of fs.readdirSync(this.modsDir).filter(f => f.endsWith('.fantome'))) {
          fs.unlinkSync(path.join(this.modsDir, f));
          removed++;
        }
      }
      return { success: true, removed, message: `Removed ${removed} mods` };
    } catch (e: any) {
      return { success: false, removed: 0, message: e.message };
    }
  }

  removeSkin(skinName: string): { success: boolean; message: string } {
    try {
      if (fs.existsSync(this.modsDir)) {
        const match = fs.readdirSync(this.modsDir).find(f => f.includes(skinName));
        if (match) {
          fs.unlinkSync(path.join(this.modsDir, match));
          return { success: true, message: `Removed: ${match}` };
        }
      }
      return { success: false, message: `Not found: ${skinName}` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  listInstalled(): string[] {
    if (!fs.existsSync(this.modsDir)) return [];
    return fs.readdirSync(this.modsDir).filter(f => f.endsWith('.fantome'));
  }

  getInstalledDir(): string { return this.modsDir; }
}
