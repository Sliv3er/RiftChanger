import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const DDRAGON = 'https://ddragon.leagueoflegends.com';

export interface GenerateResult {
  success: boolean;
  message: string;
  outputPath?: string;
}

export interface GenerateAllProgress {
  total: number;
  done: number;
  current: string;
  errors: string[];
  generated: number;
}

/**
 * SkinGenerator — extracts skin bins from the game WAD and packs them as
 * skin0.bin replacement mods using cslol-tools (wad-extract + wad-make).
 *
 * Approach (confirmed working): replace skin0.bin with skinN.bin.
 * The bin references existing assets by hash, so the game loads
 * the correct model/textures/particles from the base WAD.
 */
export class SkinGenerator {
  private outputDir: string;
  private patch: string | null = null;
  private gamePath = 'C:\\Riot Games\\League of Legends\\Game';
  private toolsDir = '';
  private wadExtractExe = '';
  private wadMakeExe = '';

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  setToolsDir(toolsDir: string) {
    this.toolsDir = toolsDir;
    this.wadExtractExe = path.join(toolsDir, 'wad-extract.exe');
    this.wadMakeExe = path.join(toolsDir, 'wad-make.exe');
  }

  setGamePath(gamePath: string) { this.gamePath = gamePath; }

  get toolsReady(): boolean {
    return !!this.toolsDir && fs.existsSync(this.wadExtractExe) && fs.existsSync(this.wadMakeExe);
  }

  async getCurrentPatch(): Promise<string> {
    if (this.patch) return this.patch;
    const res = await axios.get(`${DDRAGON}/api/versions.json`, { timeout: 10000 });
    this.patch = res.data[0];
    return this.patch!;
  }

  /**
   * Known companion/follower characters that also need skin0.bin replaced.
   */
  private static COMPANIONS: Record<string, string[]> = {
    bard: ['bardfollower'],
    kindred: ['youmus'],  // Kindred's Wolf
    quinn: ['quinnvalor'], // Quinn's Valor
    nunu: ['willump'],
    // Add more as discovered
  };

  /**
   * Generate a skin mod: extract skinN.bin from game WAD → pack as skin0.bin.
   */
  async generateSkin(
    championId: string,
    skinNum: number,
    skinName: string
  ): Promise<GenerateResult> {
    if (!this.toolsReady) {
      return { success: false, message: 'cslol-tools not found. Run Setup first.' };
    }

    const champLower = championId.toLowerCase();
    const tmpDir = path.join(require('os').tmpdir(), `rc-gen-${champLower}-${skinNum}-${Date.now()}`);

    try {
      fs.mkdirSync(tmpDir, { recursive: true });

      // 1. Find champion WAD
      const gameWad = path.join(this.gamePath, 'DATA', 'FINAL', 'Champions', `${championId}.wad.client`);
      if (!fs.existsSync(gameWad)) {
        return { success: false, message: `Game WAD not found: ${championId}.wad.client` };
      }

      // 2. Extract game WAD
      const extractDir = path.join(tmpDir, 'extract');
      await execFileAsync(this.wadExtractExe, [gameWad, extractDir], {
        timeout: 120000, windowsHide: true, cwd: this.toolsDir,
      });

      // 3. Check skinN.bin exists
      const skinBin = path.join(extractDir, 'data', 'characters', champLower, 'skins', `skin${skinNum}.bin`);
      if (!fs.existsSync(skinBin)) {
        return { success: false, message: `skin${skinNum}.bin not found for ${championId}` };
      }

      // 4. Build RAW directory: skinN.bin → skin0.bin
      const rawDir = path.join(tmpDir, 'raw');
      const skin0Dir = path.join(rawDir, 'data', 'characters', champLower, 'skins');
      fs.mkdirSync(skin0Dir, { recursive: true });
      fs.copyFileSync(skinBin, path.join(skin0Dir, 'skin0.bin'));

      // 5. Also handle companion characters (e.g., Bard → bardfollower)
      const companions = SkinGenerator.COMPANIONS[champLower] || [];
      for (const comp of companions) {
        const compBin = path.join(extractDir, 'data', 'characters', comp, 'skins', `skin${skinNum}.bin`);
        if (fs.existsSync(compBin)) {
          const compDir = path.join(rawDir, 'data', 'characters', comp, 'skins');
          fs.mkdirSync(compDir, { recursive: true });
          fs.copyFileSync(compBin, path.join(compDir, 'skin0.bin'));
        }
      }

      // 6. Pack WAD using wad-make (correct v3.4 + zstd)
      const wadDir = path.join(tmpDir, 'wad');
      fs.mkdirSync(wadDir, { recursive: true });
      const wadFile = path.join(wadDir, `${championId}.wad.client`);
      await execFileAsync(this.wadMakeExe, [rawDir, wadFile, `--game:${this.gamePath}`], {
        timeout: 60000, windowsHide: true, cwd: this.toolsDir,
      });

      // 7. Create fantome ZIP
      const zip = new AdmZip();
      zip.addFile('META/info.json', Buffer.from(JSON.stringify({
        Author: 'RiftChanger',
        Description: `${skinName} as default skin`,
        Name: skinName,
        Version: '1.0.0',
      }, null, 2)));
      zip.addLocalFile(wadFile, 'WAD');

      const safeChampId = championId.replace(/[<>:"/\\|?*]/g, '_');
      const champDir = path.join(this.outputDir, safeChampId);
      fs.mkdirSync(champDir, { recursive: true });
      const safeName = skinName.replace(/[<>:"/\\|?*]/g, '_');
      const outputPath = path.join(champDir, `${safeName}.zip`);
      zip.writeZip(outputPath);

      return { success: true, message: `Generated: ${skinName}`, outputPath };
    } catch (e: any) {
      return { success: false, message: `Failed ${skinName}: ${e.message}` };
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  }

  /**
   * Generate all skins for one champion.
   */
  async generateChampion(
    championId: string,
    onProgress?: (msg: string) => void
  ): Promise<{ generated: number; failed: number; errors: string[] }> {
    const patch = await this.getCurrentPatch();
    let generated = 0, failed = 0;
    const errors: string[] = [];

    const detailRes = await axios.get(
      `${DDRAGON}/cdn/${patch}/data/en_US/champion/${championId}.json`,
      { timeout: 15000 }
    );
    const champData = detailRes.data.data[championId];

    // Generate base skins
    for (const skin of champData.skins) {
      if (skin.num === 0) continue;
      const skinName = skin.name === 'default' ? `${champData.name} Default` : skin.name;
      onProgress?.(`${skinName}`);

      const result = await this.generateSkin(championId, skin.num, skinName);
      if (result.success) generated++;
      else { failed++; errors.push(result.message); }
    }

    // Chromas: find extra skin numbers in game WAD not in DataDragon
    const officialNums = new Set(champData.skins.map((s: any) => s.num));
    const gameWad = path.join(this.gamePath, 'DATA', 'FINAL', 'Champions', `${championId}.wad.client`);

    if (fs.existsSync(gameWad)) {
      try {
        const tmpExtract = path.join(require('os').tmpdir(), `rc-chroma-${championId}-${Date.now()}`);
        await execFileAsync(this.wadExtractExe, [gameWad, tmpExtract], {
          timeout: 120000, windowsHide: true, cwd: this.toolsDir,
        });

        const skinsDir = path.join(tmpExtract, 'data', 'characters', championId.toLowerCase(), 'skins');
        if (fs.existsSync(skinsDir)) {
          const skinBins = fs.readdirSync(skinsDir).filter(f => /^skin\d+\.bin$/.test(f));
          for (const bin of skinBins) {
            const num = parseInt(bin.match(/skin(\d+)\.bin/)![1]);
            if (num === 0 || officialNums.has(num)) continue;

            const parentSkin = champData.skins
              .filter((s: any) => s.num < num && s.chromas)
              .sort((a: any, b: any) => b.num - a.num)[0];

            const chromaName = parentSkin
              ? `${parentSkin.name} ${num}`
              : `${champData.name} Chroma ${num}`;

            onProgress?.(`Chroma: ${chromaName}`);

            const result = await this.generateSkin(championId, num, chromaName);
            if (result.success && result.outputPath && parentSkin) {
              const safeChampId = championId.replace(/[<>:"/\\|?*]/g, '_');
              const safeSkinName = parentSkin.name.replace(/[<>:"/\\|?*]/g, '_');
              const chromaDir = path.join(this.outputDir, safeChampId, 'chromas', safeSkinName);
              fs.mkdirSync(chromaDir, { recursive: true });
              const dest = path.join(chromaDir, path.basename(result.outputPath));
              try { fs.renameSync(result.outputPath, dest); }
              catch { fs.copyFileSync(result.outputPath, dest); fs.unlinkSync(result.outputPath); }
              generated++;
            } else if (result.success) {
              generated++;
            } else {
              failed++; errors.push(result.message);
            }
          }
        }
        try { fs.rmSync(tmpExtract, { recursive: true, force: true }); } catch {}
      } catch (e: any) {
        errors.push(`Chroma scan failed: ${e.message}`);
      }
    }

    return { generated, failed, errors };
  }

  /**
   * Generate ALL skins for ALL champions.
   */
  async generateAll(
    onProgress?: (progress: GenerateAllProgress) => void
  ): Promise<GenerateAllProgress> {
    const patch = await this.getCurrentPatch();
    const champRes = await axios.get(
      `${DDRAGON}/cdn/${patch}/data/en_US/champion.json`,
      { timeout: 15000 }
    );
    const champions = Object.keys(champRes.data.data).sort();

    const progress: GenerateAllProgress = {
      total: champions.length, done: 0, current: '', errors: [], generated: 0,
    };

    for (const champId of champions) {
      progress.current = champId;
      onProgress?.({ ...progress });

      const result = await this.generateChampion(champId, (msg) => {
        progress.current = `${champId}: ${msg}`;
        onProgress?.({ ...progress });
      });

      progress.generated += result.generated;
      progress.errors.push(...result.errors);
      progress.done++;
      onProgress?.({ ...progress });
    }

    return progress;
  }
}

