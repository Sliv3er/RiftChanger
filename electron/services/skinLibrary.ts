/**
 * SkinLibrary — manages the local RiftChanger skin library.
 * Structure:
 *   <libPath>/
 *     champions.json          — cached champion + skin metadata
 *     <ChampionId>/
 *       <SkinName>.zip        — fantome skin mod
 *       chromas/
 *         <SkinName>/
 *           <ChromaName>.zip  — fantome chroma mod
 */
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

const DDRAGON = 'https://ddragon.leagueoflegends.com';
const CDRAGON = 'https://raw.communitydragon.org/latest';

export interface LibChampion {
  id: string;
  key: string;
  name: string;
  title: string;
  tags: string[];
  iconUrl: string;
  skins: LibSkin[];
}

export interface LibSkin {
  id: number;
  num: number;
  name: string;
  hasChromas: boolean;
  splashUrl: string;
  loadingUrl: string;
  available: boolean;     // has .zip in library
  zipPath: string | null;
  chromas: LibChroma[];
}

export interface LibChroma {
  num: number;
  name: string;
  available: boolean;
  zipPath: string | null;
  imageUrl: string;
}

export class SkinLibrary {
  private libPath: string;
  private patch: string | null = null;

  constructor(libPath: string) {
    this.libPath = libPath;
    fs.mkdirSync(libPath, { recursive: true });
  }

  getLibPath(): string { return this.libPath; }

  async getPatch(): Promise<string> {
    if (this.patch) return this.patch;
    const res = await axios.get(`${DDRAGON}/api/versions.json`, { timeout: 10000 });
    this.patch = res.data[0];
    return this.patch!;
  }

  /**
   * Build full library index: fetches champion+skin data from DDragon,
   * discovers chromas from CDragon, and checks local file availability.
   */
  async buildIndex(onProgress?: (msg: string) => void): Promise<LibChampion[]> {
    const patch = await this.getPatch();
    onProgress?.('Fetching champion list...');

    const res = await axios.get(`${DDRAGON}/cdn/${patch}/data/en_US/champion.json`, { timeout: 15000 });
    const champIds = Object.keys(res.data.data).sort();
    const champions: LibChampion[] = [];

    for (let i = 0; i < champIds.length; i++) {
      const cid = champIds[i];
      const cdata = res.data.data[cid];
      onProgress?.(`[${i + 1}/${champIds.length}] ${cdata.name}`);

      try {
        const champ = await this.buildChampionIndex(cid, patch);
        champions.push(champ);
      } catch (e: any) {
        onProgress?.(`Error indexing ${cid}: ${e.message}`);
      }
    }

    // Cache to disk
    const cacheFile = path.join(this.libPath, 'champions.json');
    fs.writeFileSync(cacheFile, JSON.stringify(champions, null, 2));

    return champions;
  }

  /**
   * Load cached index (fast) or return null if not cached.
   */
  loadCachedIndex(): LibChampion[] | null {
    const cacheFile = path.join(this.libPath, 'champions.json');
    if (!fs.existsSync(cacheFile)) return null;
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      // Re-check file availability
      for (const champ of data) {
        for (const skin of champ.skins) {
          skin.available = skin.zipPath ? fs.existsSync(skin.zipPath) : false;
          for (const chroma of skin.chromas) {
            chroma.available = chroma.zipPath ? fs.existsSync(chroma.zipPath) : false;
          }
        }
      }
      return data;
    } catch {
      return null;
    }
  }

  private async buildChampionIndex(champId: string, patch: string): Promise<LibChampion> {
    // Fetch detailed champion data
    const detailRes = await axios.get(
      `${DDRAGON}/cdn/${patch}/data/en_US/champion/${champId}.json`,
      { timeout: 15000 }
    );
    const cdata = detailRes.data.data[champId];
    const champLower = champId.toLowerCase();

    // Discover all skin nums from CDragon
    let cdragonNums: number[] = [];
    try {
      const listRes = await axios.get(
        `${CDRAGON}/game/data/characters/${champLower}/skins/`,
        { timeout: 10000 }
      );
      for (const m of (listRes.data as string).matchAll(/skin(\d+)\.bin/g)) {
        cdragonNums.push(parseInt(m[1]));
      }
    } catch {}

    const officialNums = new Set(cdata.skins.map((s: any) => s.num as number));
    const chromaNums = cdragonNums.filter(n => n !== 0 && !officialNums.has(n));

    const skins: LibSkin[] = [];
    for (const s of cdata.skins) {
      if (s.num === 0) continue;
      const skinName = s.name === 'default' ? `${cdata.name} Default` : s.name;
      const safeName = skinName.replace(/[<>:"/\\|?*]/g, '_');
      const zipPath = path.join(this.libPath, champId, `${safeName}.zip`);

      // Find chromas for this skin
      const skinChromas: LibChroma[] = [];
      if (s.chromas) {
        // Chromas are nums > this skin's num and < next skin's num
        const sortedOfficial = cdata.skins.map((x: any) => x.num).sort((a: number, b: number) => a - b);
        const idx = sortedOfficial.indexOf(s.num);
        const nextNum = idx < sortedOfficial.length - 1 ? sortedOfficial[idx + 1] : Infinity;

        for (const cn of chromaNums) {
          if (cn > s.num && cn < nextNum) {
            const chromaName = `${safeName} ${cn}`;
            const chromaZipPath = path.join(this.libPath, champId, 'chromas', safeName, `${chromaName}.zip`);
            skinChromas.push({
              num: cn,
              name: chromaName,
              available: fs.existsSync(chromaZipPath),
              zipPath: chromaZipPath,
              imageUrl: `${CDRAGON}/plugins/rcp-be-lol-game-data/global/default/v1/champion-chroma-images/${cdata.key}/${cn}.png`,
            });
          }
        }
      }

      skins.push({
        id: s.id,
        num: s.num,
        name: skinName,
        hasChromas: s.chromas || false,
        splashUrl: `${DDRAGON}/cdn/img/champion/splash/${champId}_${s.num}.jpg`,
        loadingUrl: `${DDRAGON}/cdn/img/champion/loading/${champId}_${s.num}.jpg`,
        available: fs.existsSync(zipPath),
        zipPath,
        chromas: skinChromas,
      });
    }

    return {
      id: champId,
      key: cdata.key,
      name: cdata.name,
      title: cdata.title,
      tags: cdata.tags,
      iconUrl: `${DDRAGON}/cdn/${patch}/img/champion/${champId}.png`,
      skins,
    };
  }
}
