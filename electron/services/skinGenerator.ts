import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { packWadWithHashes, WadEntry } from './wadPacker';

const DDRAGON = 'https://ddragon.leagueoflegends.com';
const CDRAGON = 'https://raw.communitydragon.org/latest';

// Dynamic import for xxhash-wasm (ESM module)
let xxhashInstance: any = null;
async function getXXHash(): Promise<any> {
  if (xxhashInstance) return xxhashInstance;
  const xxhash = require('xxhash-wasm');
  xxhashInstance = await xxhash();
  return xxhashInstance;
}

function pathHashToBuffer(hashStr: string): Buffer {
  // h64 returns bigint as hex string; we need 8-byte LE buffer
  const buf = Buffer.alloc(8);
  const val = BigInt('0x' + hashStr);
  buf.writeBigUInt64LE(val);
  return buf;
}

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

export class SkinGenerator {
  private outputDir: string;
  private patch: string | null = null;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async getCurrentPatch(): Promise<string> {
    if (this.patch) return this.patch;
    const res = await axios.get(`${DDRAGON}/api/versions.json`, { timeout: 10000 });
    this.patch = res.data[0];
    return this.patch!;
  }

  /**
   * Generate a single skin fantome mod.
   * Downloads the skin's bin from CDragon, packs into WAD at skin0 path.
   */
  async generateSkin(
    championId: string,
    skinNum: number,
    skinName: string
  ): Promise<GenerateResult> {
    const champLower = championId.toLowerCase();
    const xxhash = await getXXHash();

    try {
      // Download skin bin from CDragon
      const binUrl = `${CDRAGON}/game/data/characters/${champLower}/skins/skin${skinNum}.bin`;
      let binData: Buffer;

      try {
        const res = await axios.get(binUrl, { responseType: 'arraybuffer', timeout: 30000 });
        binData = Buffer.from(res.data);
      } catch (e: any) {
        if (e.response?.status === 404) {
          return { success: false, message: `Skin ${skinNum} not found on CDragon for ${championId}` };
        }
        throw e;
      }

      // Compute hash for skin0.bin path
      const wadPath = `data/characters/${champLower}/skins/skin0.bin`;
      const hashHex = xxhash.h64(wadPath).toString(16).padStart(16, '0');
      const pathHash = pathHashToBuffer(hashHex);

      const wadEntries: WadEntry[] = [{
        path: wadPath,
        data: binData,
        pathHash,
      }];

      const wadBuffer = packWadWithHashes(wadEntries);

      // Create fantome ZIP
      const zip = new AdmZip();
      zip.addFile('META/info.json', Buffer.from(JSON.stringify({
        Author: 'RiftChanger',
        Description: `${skinName} - Generated for patch ${this.patch || 'unknown'}`,
        Name: skinName,
        Version: '1.0.0',
      }, null, 2)));
      zip.addFile(`WAD/${championId}.wad.client`, wadBuffer);

      // Output path
      const safeChampId = championId.replace(/[<>:"/\\|?*]/g, '_');
      const champDir = path.join(this.outputDir, safeChampId);
      fs.mkdirSync(champDir, { recursive: true });
      const safeName = skinName.replace(/[<>:"/\\|?*]/g, '_');
      const outputPath = path.join(champDir, `${safeName}.zip`);
      zip.writeZip(outputPath);

      return { success: true, message: `Generated: ${skinName}`, outputPath };
    } catch (e: any) {
      return { success: false, message: `Failed ${skinName}: ${e.message}` };
    }
  }

  /**
   * Generate all skins for one champion (base skins + chromas).
   */
  async generateChampion(
    championId: string,
    onProgress?: (msg: string) => void
  ): Promise<{ generated: number; failed: number; errors: string[] }> {
    const patch = await this.getCurrentPatch();
    const champLower = championId.toLowerCase();
    let generated = 0, failed = 0;
    const errors: string[] = [];

    // Get official skins from Data Dragon
    const detailRes = await axios.get(
      `${DDRAGON}/cdn/${patch}/data/en_US/champion/${championId}.json`,
      { timeout: 15000 }
    );
    const champData = detailRes.data.data[championId];
    const officialNums = new Set<number>();

    // Generate base skins
    for (const skin of champData.skins) {
      if (skin.num === 0) continue;
      officialNums.add(skin.num);

      const skinName = skin.name === 'default' ? `${champData.name} Default` : skin.name;
      onProgress?.(`${skinName}`);

      const result = await this.generateSkin(championId, skin.num, skinName);
      if (result.success) generated++;
      else { failed++; errors.push(result.message); }

      await sleep(100);
    }

    // Discover chromas from CDragon (skin numbers not in Data Dragon)
    try {
      const listRes = await axios.get(
        `${CDRAGON}/game/data/characters/${champLower}/skins/`,
        { timeout: 15000 }
      );
      const html = listRes.data as string;
      const allNums: number[] = [];
      for (const m of html.matchAll(/skin(\d+)\.bin/g)) {
        allNums.push(parseInt(m[1]));
      }

      for (const num of allNums) {
        if (num === 0 || officialNums.has(num)) continue;

        // Find parent skin (closest official skin with chromas, num < this)
        const parentSkin = champData.skins
          .filter((s: any) => s.num < num && s.chromas)
          .sort((a: any, b: any) => b.num - a.num)[0];

        const chromaName = parentSkin
          ? `${parentSkin.name} ${num}`
          : `${champData.name} Chroma ${num}`;

        onProgress?.(`Chroma: ${chromaName}`);

        const result = await this.generateSkin(championId, num, chromaName);
        if (result.success && result.outputPath && parentSkin) {
          // Move to chromas subdirectory
          const safeChampId = championId.replace(/[<>:"/\\|?*]/g, '_');
          const safeSkinName = parentSkin.name.replace(/[<>:"/\\|?*]/g, '_');
          const chromaDir = path.join(this.outputDir, safeChampId, 'chromas', safeSkinName);
          fs.mkdirSync(chromaDir, { recursive: true });
          const dest = path.join(chromaDir, path.basename(result.outputPath));
          try {
            fs.renameSync(result.outputPath, dest);
          } catch {
            fs.copyFileSync(result.outputPath, dest);
            fs.unlinkSync(result.outputPath);
          }
          generated++;
        } else if (result.success) {
          generated++;
        } else {
          failed++;
          errors.push(result.message);
        }

        await sleep(50);
      }
    } catch (e: any) {
      errors.push(`Chroma discovery failed for ${championId}: ${e.message}`);
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

      await sleep(200);
    }

    return progress;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
