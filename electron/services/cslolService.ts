import * as fs from 'fs';
import * as path from 'path';
import { spawn, execSync } from 'child_process';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { SkinEntry } from './skinScanner';

const CSLOL_RELEASES_API = 'https://api.github.com/repos/LeagueToolkit/cslol-manager/releases/latest';

export interface CslolProfile {
  name: string;
  mods: string[];
}

export class CslolService {
  private basePath: string;
  private cslolDir: string;
  private modsDir: string;
  private profilesDir: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.cslolDir = path.join(basePath, 'cslol-manager');
    this.modsDir = path.join(this.cslolDir, 'installed');
    this.profilesDir = path.join(this.cslolDir, 'profiles');
  }

  isReady(): boolean {
    const exe = this.findExecutable();
    return exe !== null;
  }

  private findExecutable(): string | null {
    // CSLoL Manager ships as a portable exe or in a zip with subdirectories
    const candidates = [
      path.join(this.cslolDir, 'cslol-manager.exe'),
      // May be nested in a subdirectory after extraction
    ];

    // Also search one level deep
    if (fs.existsSync(this.cslolDir)) {
      try {
        const entries = fs.readdirSync(this.cslolDir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) {
            const nested = path.join(this.cslolDir, e.name, 'cslol-manager.exe');
            candidates.push(nested);
          }
          if (e.isFile() && e.name === 'cslol-manager.exe') {
            return path.join(this.cslolDir, e.name);
          }
        }
      } catch {}
    }

    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  }

  async setup(): Promise<{ success: boolean; message: string; exePath?: string }> {
    try {
      fs.mkdirSync(this.cslolDir, { recursive: true });
      fs.mkdirSync(this.modsDir, { recursive: true });
      fs.mkdirSync(this.profilesDir, { recursive: true });

      // Check if already downloaded
      const existing = this.findExecutable();
      if (existing) {
        return { success: true, message: `CSLoL Manager already installed at ${existing}`, exePath: existing };
      }

      // Fetch latest release info
      const releaseRes = await axios.get(CSLOL_RELEASES_API, {
        headers: { 'User-Agent': 'RiftChanger/1.0' },
        timeout: 15000,
      });

      const assets = releaseRes.data.assets;
      // Look for Windows zip/exe
      const winAsset = assets.find((a: any) =>
        a.name.toLowerCase().includes('win') && 
        (a.name.endsWith('.zip') || a.name.endsWith('.7z') || a.name.endsWith('.exe'))
      );

      // If no platform-specific name, try the first zip
      const downloadAsset = winAsset || assets.find((a: any) => a.name.endsWith('.zip'));

      if (!downloadAsset) {
        return { success: false, message: 'No compatible CSLoL Manager release found. Download manually from https://github.com/LeagueToolkit/cslol-manager/releases' };
      }

      const downloadPath = path.join(this.basePath, downloadAsset.name);

      // Download
      const response = await axios.get(downloadAsset.browser_download_url, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'RiftChanger/1.0' },
        timeout: 120000,
        maxContentLength: 500 * 1024 * 1024,
      });

      fs.writeFileSync(downloadPath, Buffer.from(response.data));

      // Extract if zip
      if (downloadAsset.name.endsWith('.zip')) {
        const zip = new AdmZip(downloadPath);
        zip.extractAllTo(this.cslolDir, true);
        fs.unlinkSync(downloadPath);
      } else if (downloadAsset.name.endsWith('.exe')) {
        // It's a standalone exe, just move it
        const destExe = path.join(this.cslolDir, 'cslol-manager.exe');
        fs.renameSync(downloadPath, destExe);
      }

      const exe = this.findExecutable();
      if (exe) {
        return { success: true, message: `CSLoL Manager installed: ${exe}`, exePath: exe };
      }

      return { success: false, message: 'Downloaded but could not find cslol-manager.exe. Check the cslol-manager directory.' };
    } catch (e: any) {
      return { success: false, message: `Setup failed: ${e.message}` };
    }
  }

  /**
   * Import fantome skin ZIPs into CSLoL's mod directory.
   * CSLoL Manager reads .fantome files from its installed/ directory.
   */
  async applySkins(skins: SkinEntry[]): Promise<{ success: boolean; applied: string[]; errors: string[]; launchCslol: boolean }> {
    const applied: string[] = [];
    const errors: string[] = [];

    fs.mkdirSync(this.modsDir, { recursive: true });

    for (const skin of skins) {
      try {
        if (!skin.valid) {
          errors.push(`${skin.skinName}: Invalid skin (${skin.validationErrors.join(', ')})`);
          continue;
        }

        // CSLoL uses .fantome extension — these are just renamed zip files
        const safeName = skin.skinName.replace(/[<>:"/\\|?*]/g, '_');
        const destName = `${skin.championName} - ${safeName}.fantome`;
        const destPath = path.join(this.modsDir, destName);

        // Copy the zip as .fantome
        fs.copyFileSync(skin.zipPath, destPath);
        applied.push(skin.skinName);
      } catch (e: any) {
        errors.push(`${skin.skinName}: ${e.message}`);
      }
    }

    // Write a RiftChanger profile
    this.writeProfile('RiftChanger', applied);

    return {
      success: errors.length === 0,
      applied,
      errors,
      launchCslol: applied.length > 0,
    };
  }

  /**
   * Write a profile JSON that tracks which mods are active
   */
  private writeProfile(name: string, modNames: string[]) {
    fs.mkdirSync(this.profilesDir, { recursive: true });
    const profile = {
      name,
      mods: modNames,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(this.profilesDir, `${name}.json`),
      JSON.stringify(profile, null, 2)
    );
  }

  /**
   * Launch CSLoL Manager GUI so the user can click apply/overlay
   */
  launchManager(): { success: boolean; message: string } {
    const exe = this.findExecutable();
    if (!exe) {
      return { success: false, message: 'CSLoL Manager not found. Run setup first.' };
    }

    try {
      // Detach the process so it runs independently
      const child = spawn(exe, [], {
        detached: true,
        stdio: 'ignore',
        cwd: path.dirname(exe),
      });
      child.unref();
      return { success: true, message: `Launched CSLoL Manager: ${exe}` };
    } catch (e: any) {
      return { success: false, message: `Failed to launch: ${e.message}` };
    }
  }

  removeAll(): { success: boolean; removed: number; message: string } {
    try {
      let removed = 0;
      if (fs.existsSync(this.modsDir)) {
        const files = fs.readdirSync(this.modsDir).filter(f => f.endsWith('.fantome'));
        for (const file of files) {
          fs.unlinkSync(path.join(this.modsDir, file));
          removed++;
        }
      }
      return { success: true, removed, message: `Removed ${removed} skins from CSLoL` };
    } catch (e: any) {
      return { success: false, removed: 0, message: e.message };
    }
  }

  removeSkin(skinName: string): { success: boolean; message: string } {
    try {
      if (fs.existsSync(this.modsDir)) {
        const files = fs.readdirSync(this.modsDir);
        const match = files.find(f => f.includes(skinName));
        if (match) {
          fs.unlinkSync(path.join(this.modsDir, match));
          return { success: true, message: `Removed: ${match}` };
        }
      }
      return { success: false, message: `Skin not found in installed mods: ${skinName}` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  listInstalled(): string[] {
    if (!fs.existsSync(this.modsDir)) return [];
    return fs.readdirSync(this.modsDir).filter(f => f.endsWith('.fantome'));
  }

  getInstalledDir(): string {
    return this.modsDir;
  }

  getCslolDir(): string {
    return this.cslolDir;
  }
}
