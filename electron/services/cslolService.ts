import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { SkinEntry } from './skinScanner';

const CSLOL_RELEASES_API = 'https://api.github.com/repos/LeagueToolkit/cslol-manager/releases/latest';

export class CslolService {
  private basePath: string;
  private cslolDir: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.cslolDir = path.join(basePath, 'cslol-manager');
  }

  isReady(): boolean {
    const exePath = this.getExePath();
    return exePath !== null && fs.existsSync(exePath);
  }

  private getExePath(): string | null {
    // CSLoL Manager CLI tool
    const candidates = [
      path.join(this.cslolDir, 'cslol-manager.exe'),
      path.join(this.cslolDir, 'mod-tools.exe'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    // Also check for the installed/overlay directory structure
    const toolsDir = path.join(this.cslolDir, 'installed');
    if (!fs.existsSync(toolsDir)) {
      fs.mkdirSync(toolsDir, { recursive: true });
    }
    return candidates[0]; // Default expected path
  }

  async setup(): Promise<{ success: boolean; message: string }> {
    try {
      fs.mkdirSync(this.cslolDir, { recursive: true });

      // Download latest release
      const releaseRes = await axios.get(CSLOL_RELEASES_API, {
        headers: { 'User-Agent': 'RiftChanger/1.0' },
      });

      const assets = releaseRes.data.assets;
      const winAsset = assets.find((a: any) =>
        a.name.toLowerCase().includes('win') && a.name.endsWith('.zip')
      );

      if (!winAsset) {
        return { success: false, message: 'No Windows release found for CSLoL Manager' };
      }

      const zipPath = path.join(this.basePath, 'cslol-download.zip');
      const response = await axios.get(winAsset.browser_download_url, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'RiftChanger/1.0' },
      });

      fs.writeFileSync(zipPath, response.data);

      // Extract
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(this.cslolDir, true);

      // Clean up download
      fs.unlinkSync(zipPath);

      // Create installed directory for mods
      const installedDir = path.join(this.cslolDir, 'installed');
      fs.mkdirSync(installedDir, { recursive: true });

      return {
        success: true,
        message: `CSLoL Manager installed to ${this.cslolDir}`,
      };
    } catch (e: any) {
      return {
        success: false,
        message: `Failed to setup CSLoL Manager: ${e.message}`,
      };
    }
  }

  async applySkins(skins: SkinEntry[]): Promise<{ success: boolean; applied: string[]; errors: string[] }> {
    const applied: string[] = [];
    const errors: string[] = [];

    const installedDir = path.join(this.cslolDir, 'installed');
    fs.mkdirSync(installedDir, { recursive: true });

    for (const skin of skins) {
      try {
        // Copy the fantome zip to CSLoL's installed directory
        const destName = `${skin.championName}_${skin.skinName}.fantome`;
        const destPath = path.join(installedDir, destName);

        fs.copyFileSync(skin.zipPath, destPath);
        applied.push(skin.skinName);
      } catch (e: any) {
        errors.push(`${skin.skinName}: ${e.message}`);
      }
    }

    return { success: errors.length === 0, applied, errors };
  }

  removeAll(): { success: boolean; message: string } {
    try {
      const installedDir = path.join(this.cslolDir, 'installed');
      if (fs.existsSync(installedDir)) {
        const files = fs.readdirSync(installedDir);
        for (const file of files) {
          fs.unlinkSync(path.join(installedDir, file));
        }
      }
      return { success: true, message: 'All skins removed' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  getInstalledDir(): string {
    return path.join(this.cslolDir, 'installed');
  }
}
