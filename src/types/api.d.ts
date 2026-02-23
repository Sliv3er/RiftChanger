export interface ChampionData {
  id: string; key: string; name: string; title: string; tags: string[]; iconUrl: string;
}

export interface SkinData {
  id: number; num: number; name: string; chromas: boolean; splashUrl: string; loadingUrl: string;
}

export interface SkinEntry {
  championName: string; skinName: string; type: 'skin' | 'chroma' | 'form' | 'exalted';
  chromaId?: string; zipPath: string; valid: boolean; validationErrors: string[];
  meta: { author: string; description: string; name: string; version: string } | null;
  wadFile: string | null;
}

export interface ScanResult {
  champions: string[]; totalSkins: number; totalChromas: number;
  totalForms: number; totalExalted: number; skins: SkinEntry[]; errors: string[];
}

export interface GenProgress {
  total: number; done: number; current: string; errors: string[]; generated: number;
}

declare global {
  interface Window {
    api: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      getSkinsPath: () => Promise<string>;
      scan: (path?: string) => Promise<ScanResult>;
      apply: (zipPath: string, skinName: string, champName: string) => Promise<{ success: boolean; message: string }>;
      getChampions: () => Promise<ChampionData[]>;
      getChampionSkins: (id: string) => Promise<SkinData[]>;
      getCurrentPatch: () => Promise<string>;
      detectGame: () => Promise<any>;
      setupCslol: () => Promise<{ success: boolean; message: string }>;
      isCslolReady: () => Promise<boolean>;
      launchCslol: () => Promise<{ success: boolean; message: string }>;
      listMods: () => Promise<string[]>;
      removeAllMods: () => Promise<any>;
      removeMod: (name: string) => Promise<any>;
      generateChampion: (id: string) => Promise<{ generated: number; failed: number; errors: string[] }>;
      generateAll: () => Promise<GenProgress>;
      onGenProgress: (cb: (msg: string) => void) => void;
      onGenAllProgress: (cb: (p: GenProgress) => void) => void;
      createBackup: (path: string) => Promise<any>;
      restoreBackup: (id: string, path: string) => Promise<any>;
      listBackups: () => Promise<any[]>;
      selectFolder: () => Promise<string | null>;
      openExternal: (url: string) => void;
    };
  }
}
