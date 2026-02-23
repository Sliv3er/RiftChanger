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
  available: boolean;
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

export interface GeneratorProgress {
  total: number;
  done: number;
  current: string;
  errors: string[];
  generated: number;
}

// Legacy types kept for backward compat
export interface SkinEntry {
  championName: string;
  skinName: string;
  type: 'skin' | 'chroma' | 'form' | 'exalted';
  chromaId?: string;
  zipPath: string;
  valid: boolean;
  validationErrors: string[];
  meta: { author: string; description: string; name: string; version: string } | null;
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
  id: string; key: string; name: string; title: string; tags: string[]; iconUrl: string;
}

export interface SkinData {
  id: number; num: number; name: string; chromas: boolean; splashUrl: string; loadingUrl: string;
}

export interface GameInfo {
  found: boolean; path: string | null; version: string | null; isRunning: boolean;
}

export interface BackupEntry {
  id: string; date: string; gamePath: string; size: number;
}

declare global {
  interface Window {
    api: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;

      // Library
      getLibraryIndex: () => Promise<LibChampion[] | null>;
      buildLibraryIndex: () => Promise<LibChampion[]>;
      setLibraryPath: (p: string) => Promise<boolean>;
      getLibraryPath: () => Promise<string>;
      onIndexProgress: (cb: (msg: string) => void) => void;

      // Apply
      applySkin: (zipPath: string, skinName: string, champName: string) => Promise<{ success: boolean; message: string }>;

      // Legacy
      scanSkins: (path: string) => Promise<ScanResult>;
      validateSkin: (path: string) => Promise<SkinEntry>;
      updateSkins: (path: string) => Promise<{ success: boolean; message: string; updated: number }>;
      isGitRepo: (path: string) => Promise<boolean>;
      getLastUpdate: (path: string) => Promise<string | null>;
      cloneSkins: (targetDir: string) => Promise<{ success: boolean; message: string }>;

      // Assets
      getChampions: () => Promise<ChampionData[]>;
      getChampionSkins: (id: string) => Promise<SkinData[]>;
      getSplashUrl: (id: string, num: number) => Promise<string>;
      getIconUrl: (id: string) => Promise<string>;
      getCurrentPatch: () => Promise<string>;

      // Game
      detectGame: () => Promise<GameInfo>;
      getGamePatch: () => Promise<string | null>;

      // CSLoL
      setupCslol: () => Promise<{ success: boolean; message: string; exePath?: string }>;
      isCslolReady: () => Promise<boolean>;
      applySkins: (skins: SkinEntry[]) => Promise<{ success: boolean; applied: string[]; errors: string[]; launchCslol: boolean }>;
      removeSkins: () => Promise<{ success: boolean; removed: number; message: string }>;
      removeSkin: (name: string) => Promise<{ success: boolean; message: string }>;
      listInstalledMods: () => Promise<string[]>;
      launchCslol: () => Promise<{ success: boolean; message: string }>;

      // Backup
      createBackup: (path: string) => Promise<{ success: boolean; backupId: string; message: string }>;
      restoreBackup: (id: string, path: string) => Promise<{ success: boolean; message: string }>;
      listBackups: () => Promise<BackupEntry[]>;

      // Generator
      generateSkin: (champId: string, skinNum: number, skinName: string) => Promise<{ success: boolean; message: string; outputPath?: string }>;
      generateChampion: (champId: string) => Promise<{ generated: number; failed: number; errors: string[] }>;
      generateAll: (outputDir?: string) => Promise<GeneratorProgress>;
      onGeneratorProgress: (cb: (msg: string) => void) => void;
      onGeneratorAllProgress: (cb: (progress: GeneratorProgress) => void) => void;

      // Dialog
      selectFolder: () => Promise<string | null>;
      openExternal: (url: string) => void;
    };
  }
}
