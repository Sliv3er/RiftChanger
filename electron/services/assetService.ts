import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com';
const CDRAGON_BASE = 'https://raw.communitydragon.org/latest';

export interface ChampionData {
  id: string;
  key: string;
  name: string;
  title: string;
  tags: string[];
  iconUrl: string;
}

export interface SkinData {
  id: number;
  num: number;
  name: string;
  chromas: boolean;
  splashUrl: string;
  loadingUrl: string;
}

export class AssetService {
  private cachePath: string;
  private patch: string | null = null;
  private championsCache: Map<string, ChampionData> = new Map();

  constructor(cachePath: string) {
    this.cachePath = cachePath;
    fs.mkdirSync(cachePath, { recursive: true });
  }

  async getCurrentPatch(): Promise<string> {
    if (this.patch) return this.patch;
    try {
      const res = await axios.get(`${DDRAGON_BASE}/api/versions.json`);
      this.patch = res.data[0];
      return this.patch!;
    } catch {
      return 'unknown';
    }
  }

  async getChampions(): Promise<ChampionData[]> {
    if (this.championsCache.size > 0) {
      return Array.from(this.championsCache.values());
    }

    const patch = await this.getCurrentPatch();
    const cacheFile = path.join(this.cachePath, `champions_${patch}.json`);

    if (fs.existsSync(cacheFile)) {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      for (const champ of data) this.championsCache.set(champ.id, champ);
      return data;
    }

    try {
      const res = await axios.get(
        `${DDRAGON_BASE}/cdn/${patch}/data/en_US/champion.json`
      );
      const champions: ChampionData[] = Object.values(res.data.data).map((c: any) => ({
        id: c.id,
        key: c.key,
        name: c.name,
        title: c.title,
        tags: c.tags,
        iconUrl: `${DDRAGON_BASE}/cdn/${patch}/img/champion/${c.id}.png`,
      }));

      champions.sort((a, b) => a.name.localeCompare(b.name));
      fs.writeFileSync(cacheFile, JSON.stringify(champions, null, 2));
      for (const champ of champions) this.championsCache.set(champ.id, champ);
      return champions;
    } catch (e: any) {
      throw new Error(`Failed to fetch champions: ${e.message}`);
    }
  }

  async getChampionSkins(championId: string): Promise<SkinData[]> {
    const patch = await this.getCurrentPatch();
    const cacheFile = path.join(this.cachePath, `skins_${championId}_${patch}.json`);

    if (fs.existsSync(cacheFile)) {
      return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }

    try {
      const res = await axios.get(
        `${DDRAGON_BASE}/cdn/${patch}/data/en_US/champion/${championId}.json`
      );
      const champData = res.data.data[championId];
      const skins: SkinData[] = champData.skins.map((s: any) => ({
        id: s.id,
        num: s.num,
        name: s.name === 'default' ? `${champData.name} Default` : s.name,
        chromas: s.chromas || false,
        splashUrl: `${DDRAGON_BASE}/cdn/img/champion/splash/${championId}_${s.num}.jpg`,
        loadingUrl: `${DDRAGON_BASE}/cdn/img/champion/loading/${championId}_${s.num}.jpg`,
      }));

      fs.writeFileSync(cacheFile, JSON.stringify(skins, null, 2));
      return skins;
    } catch (e: any) {
      throw new Error(`Failed to fetch skins for ${championId}: ${e.message}`);
    }
  }

  getSplashUrl(championId: string, skinNum: number): string {
    return `${DDRAGON_BASE}/cdn/img/champion/splash/${championId}_${skinNum}.jpg`;
  }

  getChampionIconUrl(championId: string): string {
    return `${DDRAGON_BASE}/cdn/${this.patch || 'latest'}/img/champion/${championId}.png`;
  }

  getChromaImageUrl(championKey: string, chromaId: string): string {
    return `${CDRAGON_BASE}/plugins/rcp-be-lol-game-data/global/default/v1/champion-chroma-images/${championKey}/${chromaId}.png`;
  }
}
