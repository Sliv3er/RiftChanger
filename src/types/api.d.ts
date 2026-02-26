export interface ChampionData {
  id: string;
  name: string;
  key: string;
  title: string;
  tags: string[];
  image: { full: string };
}

export interface SkinData {
  id: number;
  num: number;
  name: string;
  chromas: boolean;
}

export interface ScanResult {
  champions: Record<string, { skins: number; chromas: number }>;
  total: { skins: number; chromas: number; champions: number };
}

export interface SkinFile {
  name: string;
  path: string;
}

interface ElectronAPI {
  // Window
  minimize(): void;
  maximize(): void;
  close(): void;

  // Data
  getSkinsPath(): Promise<string>;
  scan(p?: string): Promise<ScanResult>;
  getChampions(): Promise<ChampionData[]>;
  getChampionSkins(id: string): Promise<SkinData[]>;
  getPatch(): Promise<string>;
  detectGame(): Promise<any>;

  // Settings
  getSettings(): Promise<Record<string, string>>;
  updateSetting(key: string, val: string): Promise<any>;
  selectFolder(): Promise<string | null>;

  // Tools
  checkToolsAvailability(): Promise<Record<string, boolean>>;
  testLeaguePath(p: string): Promise<{ success: boolean }>;
  downloadRepository(repoType: string): Promise<{ success: boolean; error?: string }>;

  // Skin files
  findSkinFiles(folder: string, champ: string): Promise<{ success: boolean; skinFiles: SkinFile[] }>;
  findChromaFiles(folder: string, champ: string, skin: string): Promise<{ success: boolean; chromaFiles: SkinFile[] }>;

  // Injection
  injectSkin(champ: string, skin: string, zipPath: string): Promise<{ success: boolean; error?: string }>;
  removeSkin(champ: string): Promise<{ success: boolean }>;
  removeAllSkins(): Promise<{ success: boolean }>;
  getAppliedMods(): Promise<{ active: Record<string, { skinName: string; appliedAt: string }> }>;

  // Generator
  generateChampion(id: string): Promise<any>;
  generateAll(): Promise<any>;
  onGenProgress(cb: (data: any) => void): () => void;
  onGenAllProgress(cb: (data: any) => void): () => void;
  onGenChampionDone(cb: (data: any) => void): () => void;

  // Download
  onDownloadProgress(cb: (data: any) => void): () => void;
}

declare global {
  interface Window { api: ElectronAPI; }
}
