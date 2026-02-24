import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { execFileSync } from 'child_process';

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
 * SkinGenerator — extracts actual skin assets from the game WAD using cslol-tools,
 * remaps skinN files to skin0 paths, and packs into a fantome mod.
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

  /**
   * Must be called before generating — sets paths to cslol-tools.
   */
  setToolsDir(toolsDir: string) {
    this.toolsDir = toolsDir;
    this.wadExtractExe = path.join(toolsDir, 'wad-extract.exe');
    this.wadMakeExe = path.join(toolsDir, 'wad-make.exe');
  }

  setGamePath(gamePath: string) {
    this.gamePath = gamePath;
  }

  private get toolsReady(): boolean {
    return !!this.toolsDir && fs.existsSync(this.wadExtractExe) && fs.existsSync(this.wadMakeExe);
  }

  async getCurrentPatch(): Promise<string> {
    if (this.patch) return this.patch;
    const res = await axios.get(`${DDRAGON}/api/versions.json`, { timeout: 10000 });
    this.patch = res.data[0];
    return this.patch!;
  }

  /**
   * Generate a skin mod by extracting real game assets and remapping skinN → skin0.
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
    const skinStr = `skin${skinNum}`;
    const tmpDir = path.join(require('os').tmpdir(), `rc-gen-${champLower}-${skinNum}-${Date.now()}`);
    const extractDir = path.join(tmpDir, 'extract');
    const rawDir = path.join(tmpDir, 'raw');
    const wadDir = path.join(tmpDir, 'wad');
    const metaDir = path.join(tmpDir, 'meta');

    try {
      fs.mkdirSync(tmpDir, { recursive: true });

      // 1. Find the champion WAD in game files
      const gameWad = path.join(this.gamePath, 'DATA', 'FINAL', 'Champions', `${championId}.wad.client`);
      if (!fs.existsSync(gameWad)) {
        return { success: false, message: `Game WAD not found: ${gameWad}` };
      }

      // 2. Extract the game WAD
      execFileSync(this.wadExtractExe, [gameWad, extractDir], {
        timeout: 120000,
        windowsHide: true,
        cwd: this.toolsDir,
      });

      // 3. Find all files belonging to this skin
      const skinFiles: { srcPath: string; relPath: string }[] = [];
      const walkDir = (dir: string, relBase: string) => {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            walkDir(full, rel);
          } else if (entry.isFile()) {
            skinFiles.push({ srcPath: full, relPath: rel });
          }
        }
      };

      // Collect files from skinN directories + skin bin + animation bin
      const skinAssetDir = path.join(extractDir, 'assets', 'characters', champLower, 'skins', skinStr);
      const skinBin = path.join(extractDir, 'data', 'characters', champLower, 'skins', `${skinStr}.bin`);
      const animBin = path.join(extractDir, 'data', 'characters', champLower, 'animations', `${skinStr}.bin`);
      const soundDir = path.join(extractDir, 'assets', 'sounds', 'wwise2016', 'sfx', 'characters', champLower, 'skins', skinStr);

      // Asset files (models, textures, particles, animations)
      if (fs.existsSync(skinAssetDir)) {
        const prefix = `assets/characters/${champLower}/skins/`;
        walkDir(skinAssetDir, '');
        for (const f of skinFiles) {
          // Remap: skinN/* → skin0/*
          f.relPath = `${prefix}skin0/${f.relPath}`;
        }
      }

      const remappedFiles: { srcPath: string; destPath: string }[] = skinFiles.map(f => ({
        srcPath: f.srcPath,
        destPath: f.relPath,
      }));

      // Skin definition bin → remap to skin0.bin
      if (fs.existsSync(skinBin)) {
        remappedFiles.push({
          srcPath: skinBin,
          destPath: `data/characters/${champLower}/skins/skin0.bin`,
        });
      } else {
        return { success: false, message: `Skin bin not found for ${skinStr}` };
      }

      // Animation bin → remap to skin0 animation bin
      if (fs.existsSync(animBin)) {
        remappedFiles.push({
          srcPath: animBin,
          destPath: `data/characters/${champLower}/animations/skin0.bin`,
        });
      }

      // Sound files
      if (fs.existsSync(soundDir)) {
        const soundFiles: { srcPath: string; relPath: string }[] = [];
        const soundPrefix = `assets/sounds/wwise2016/sfx/characters/${champLower}/skins/`;
        const walkSounds = (dir: string, rel: string) => {
          for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            const r = rel ? `${rel}/${e.name}` : e.name;
            if (e.isDirectory()) walkSounds(full, r);
            else soundFiles.push({ srcPath: full, relPath: r });
          }
        };
        walkSounds(soundDir, '');
        for (const f of soundFiles) {
          remappedFiles.push({
            srcPath: f.srcPath,
            destPath: `${soundPrefix}skin0/${f.relPath}`,
          });
        }
      }

      if (remappedFiles.length < 2) {
        return { success: false, message: `Too few files for ${skinName} (${remappedFiles.length})` };
      }

      // 4. Write remapped files to RAW directory
      for (const f of remappedFiles) {
        const dest = path.join(rawDir, f.destPath.replace(/\//g, path.sep));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(f.srcPath, dest);
      }

      // 5. Use wad-make to build the WAD (correct v3.4 + zstd)
      fs.mkdirSync(wadDir, { recursive: true });
      const wadFile = path.join(wadDir, `${championId}.wad.client`);
      execFileSync(this.wadMakeExe, [rawDir, wadFile, `--game:${this.gamePath}`], {
        timeout: 60000,
        windowsHide: true,
        cwd: this.toolsDir,
      });

      // 6. Create META/info.json
      fs.mkdirSync(metaDir, { recursive: true });
      fs.writeFileSync(path.join(metaDir, 'info.json'), JSON.stringify({
        Author: 'RiftChanger',
        Description: `${skinName} as default skin`,
        Name: skinName,
        Version: '1.0.0',
      }, null, 2));

      // 7. Pack as fantome ZIP
      const zip = new AdmZip();
      zip.addLocalFile(path.join(metaDir, 'info.json'), 'META');
      zip.addLocalFile(wadFile, 'WAD');

      const safeChampId = championId.replace(/[<>:"/\\|?*]/g, '_');
      const champDir = path.join(this.outputDir, safeChampId);
      fs.mkdirSync(champDir, { recursive: true });
      const safeName = skinName.replace(/[<>:"/\\|?*]/g, '_');
      const outputPath = path.join(champDir, `${safeName}.zip`);
      zip.writeZip(outputPath);

      return { success: true, message: `Generated: ${skinName} (${remappedFiles.length} files)`, outputPath };
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

    for (const skin of champData.skins) {
      if (skin.num === 0) continue;
      const skinName = skin.name === 'default' ? `${champData.name} Default` : skin.name;
      onProgress?.(`${skinName}`);

      const result = await this.generateSkin(championId, skin.num, skinName);
      if (result.success) generated++;
      else { failed++; errors.push(result.message); }
    }

    // Chromas: find skin numbers in the game WAD that aren't in DataDragon
    const officialNums = new Set(champData.skins.map((s: any) => s.num));
    const gameWad = path.join(this.gamePath, 'DATA', 'FINAL', 'Champions', `${championId}.wad.client`);
    if (fs.existsSync(gameWad)) {
      try {
        const tmpExtract = path.join(require('os').tmpdir(), `rc-chroma-scan-${championId}-${Date.now()}`);
        execFileSync(this.wadExtractExe, [gameWad, tmpExtract], {
          timeout: 120000, windowsHide: true, cwd: this.toolsDir,
        });
        const skinsDir = path.join(tmpExtract, 'data', 'characters', championId.toLowerCase(), 'skins');
        if (fs.existsSync(skinsDir)) {
          const skinBins = fs.readdirSync(skinsDir).filter(f => f.match(/^skin\d+\.bin$/));
          for (const bin of skinBins) {
            const num = parseInt(bin.match(/skin(\d+)\.bin/)![1]);
            if (num === 0 || officialNums.has(num)) continue;

            // Find parent skin
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
              try { fs.renameSync(result.outputPath, dest); } catch {
                fs.copyFileSync(result.outputPath, dest);
                fs.unlinkSync(result.outputPath);
              }
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
      total: champions.length,
      done: 0,
      current: '',
      errors: [],
      generated: 0,
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
