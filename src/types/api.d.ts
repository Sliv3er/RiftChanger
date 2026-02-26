export interface ChampionData {
  id: string; key: string; name: string; title: string; tags: string[]; iconUrl: string;
}
export interface SkinData {
  id: number; num: number; name: string; chromas: boolean; splashUrl: string; loadingUrl: string;
}
export interface SkinEntry {
  championName: string; skinName: string; type: 'skin' | 'chroma' | 'form' | 'exalted';
  chromaId?: string; zipPath: string; valid: boolean; validationErrors: string[];
  meta: any; wadFile: string | null;
}
export interface ScanResult {
  champions: string[]; totalSkins: number; totalChromas: number;
  totalForms: number; totalExalted: number; skins: SkinEntry[]; errors: string[];
}

declare global {
  interface Window {
    api: {
      minimize(): void; maximize(): void; close(): void;
      getSkinsPath(): Promise<string>;
      scan(p?: string): Promise<ScanResult>;
      getChampions(): Promise<ChampionData[]>;
      getChampionSkins(id: string): Promise<SkinData[]>;
      getPatch(): Promise<string>;
      detectGame(): Promise<any>;
      injectorReady(): Promise<boolean>;
      injectorSetup(force?: boolean): Promise<{ success: boolean; message: string }>;
      injectorSetupFromPath(p: string): Promise<{ success: boolean; message: string }>;
      importMod(zip: string, name: string): Promise<{ success: boolean; message: string }>;
      applyMods(names?: string[]): Promise<{ success: boolean; message: string }>;
      stopOverlay(): Promise<any>;
      listMods(): Promise<string[]>;
      removeMod(name: string): Promise<boolean>;
      removeAllMods(): Promise<boolean>;
      overlayStatus(): Promise<{ running: boolean; log: string }>;
      generateChampion(id: string): Promise<{ generated: number; failed: number; errors: string[] }>;
      generateAll(): Promise<any>;
      onGenProgress(cb: (m: string) => void): void;
      onGenAllProgress(cb: (p: any) => void): void;
      onGenChampionDone(cb: (r: any) => void): void;
      selectFolder(): Promise<string | null>;
    };
  }
}
