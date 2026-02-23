export interface SkinEntry {
  championName: string;
  skinName: string;
  type: 'skin' | 'chroma' | 'form' | 'exalted';
  chromaId?: string;
  zipPath: string;
  valid: boolean;
  validationErrors: string[];
  meta: {
    author: string;
    description: string;
    name: string;
    version: string;
  } | null;
  wadFile: string | null;
}

export interface ScanResult {
  champions: string[];
  totalSkins: number;
  totalChromas: number;
  totalForms: number;
  totalExalted: number;
  skins: SkinEntry[];
  errors: string[];
}

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

export interface GameInfo {
  found: boolean;
  path: string | null;
  version: string | null;
  isRunning: boolean;
}

export interface BackupEntry {
  id: string;
  date: string;
  gamePath: string;
  size: number;
}

declare global {
  interface Window {
    api: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      scanSkins: (path: string) => Promise<ScanResult>;
      validateSkin: (path: string) => Promise<SkinEntry>;
      getChampions: () => Promise<ChampionData[]>;
      getChampionSkins: (id: string) => Promise<SkinData[]>;
      getSplashUrl: (id: string, num: number) => Promise<string>;
      getIconUrl: (id: string) => Promise<string>;
      getCurrentPatch: () => Promise<string>;
      detectGame: () => Promise<GameInfo>;
      getGamePatch: () => Promise<string | null>;
      setupCslol: () => Promise<{ success: boolean; message: string }>;
      isCslolReady: () => Promise<boolean>;
      applySkins: (skins: SkinEntry[]) => Promise<{ success: boolean; applied: string[]; errors: string[] }>;
      removeSkins: () => Promise<{ success: boolean; message: string }>;
      createBackup: (path: string) => Promise<{ success: boolean; backupId: string; message: string }>;
      restoreBackup: (id: string, path: string) => Promise<{ success: boolean; message: string }>;
      listBackups: () => Promise<BackupEntry[]>;
      selectFolder: () => Promise<string | null>;
      openExternal: (url: string) => void;
    };
  }
}
