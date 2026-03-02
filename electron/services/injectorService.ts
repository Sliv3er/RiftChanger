/**
 * InjectorService — matches Rift app injection approach exactly.
 * Uses mod-tools.exe directly: import → mkoverlay → runoverlay
 * installed/ and profiles/ dirs live INSIDE the cslol-tools directory.
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawn, execFile, execFileSync, execSync, ChildProcess } from 'child_process';
import axios from 'axios';

interface AppliedMod {
  name: string;
  type: string;
  profilePath: string;
  championName: string;
  skinName: string;
  appliedAt: string;
  zipPath: string;
}

const CSLOL_LATEST_API = 'https://api.github.com/repos/LeagueToolkit/cslol-manager/releases/latest';
const SEVEN_ZIP = 'C:\\Program Files\\AMD\\AMDInstallManager\\7z.exe';

export class InjectorService {
  private basePath: string;
  private toolsPath = '';
  private modToolsExe = '';
  private installedDir = '';
  private profilesDir = '';
  private gamePath = '';
  private appliedMods = new Map<string, AppliedMod>();
  private overlayProcess: ChildProcess | null = null;
  private overlayWatcher: ReturnType<typeof setInterval> | null = null;
  private mainWindow: any = null;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.autoDetectTools();
  }

  private autoDetectTools(): boolean {
    const candidates = [
      path.join(this.basePath, 'cslol-manager', 'cslol-manager', 'cslol-tools'),
      path.join(this.basePath, 'cslol-manager', 'cslol-tools'),
      path.join(this.basePath, 'cslol-tools'),
    ];
    for (const p of candidates) {
      const mt = path.join(p, 'mod-tools.exe');
      if (fs.existsSync(mt)) {
        this.setToolsPath(p);
        return true;
      }
    }
    return false;
  }

  setToolsPath(p: string) {
    this.toolsPath = p;
    this.modToolsExe = path.join(p, 'mod-tools.exe');
    this.installedDir = path.join(p, 'installed');
    this.profilesDir = path.join(p, 'profiles');
    fs.mkdirSync(this.installedDir, { recursive: true });
    fs.mkdirSync(this.profilesDir, { recursive: true });
  }

  setGamePath(p: string) { this.gamePath = p; }
  setMainWindow(w: any) { this.mainWindow = w; }

  private notifyRenderer(channel: string, data: any) {
    try { this.mainWindow?.webContents?.send(channel, data); } catch {}
  }

  /** Check if League game process is running */
  private isGameRunning(): boolean {
    try {
      const out = execSync('tasklist /FI "IMAGENAME eq League of Legends.exe" /NH', { windowsHide: true, timeout: 5000 }).toString();
      return out.includes('League of Legends.exe');
    } catch { return false; }
  }

  /**
   * Start overlay watcher: polls every 3s for game process.
   * When game detected, runs overlay. When overlay exits (game ends), keeps polling.
   * This ensures the skin is applied whenever a game starts.
   */
  private startOverlayWatcher(profilePath: string) {
    this.stopOverlayWatcher();

    const configPath = profilePath + '.config';
    if (!fs.existsSync(configPath)) fs.writeFileSync(configPath, '');

    let wasGameRunning = false;

    const tryRunOverlay = () => {
      // Don't spawn if overlay already running
      if (this.overlayProcess && this.overlayProcess.exitCode === null) return;

      const gameRunning = this.isGameRunning();

      if (!gameRunning) {
        if (wasGameRunning) {
          console.log('[Injector] Game ended, waiting for next game...');
          wasGameRunning = false;
        }
        return;
      }

      wasGameRunning = true;
      console.log('[Injector] Game detected! Starting overlay...');
      this.notifyRenderer('overlay-status', { msg: 'Game detected — injecting skin overlay...', ok: true });

      this.overlayProcess = spawn(this.modToolsExe, [
        'runoverlay', profilePath, configPath,
        `--game:${this.gamePath}`, '--opts:none'
      ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, detached: false });

      let stdout = '', stderr = '';
      this.overlayProcess.stdout?.on('data', (d: Buffer) => {
        const s = d.toString().trim();
        stdout += s + '\n';
        console.log('[Injector][overlay]', s);
      });
      this.overlayProcess.stderr?.on('data', (d: Buffer) => {
        const s = d.toString().trim();
        stderr += s + '\n';
        console.log('[Injector][overlay err]', s);
      });
      this.overlayProcess.on('close', (code) => {
        console.log('[Injector] Overlay exited code:', code);
        this.overlayProcess = null;
        // Watcher will retry on next tick
      });
    };

    // Run immediately, then poll every 3 seconds
    tryRunOverlay();
    this.overlayWatcher = setInterval(tryRunOverlay, 3000);
  }

  private stopOverlayWatcher() {
    if (this.overlayWatcher) {
      clearInterval(this.overlayWatcher);
      this.overlayWatcher = null;
    }
  }

  isReady(): boolean {
    return !!this.modToolsExe && fs.existsSync(this.modToolsExe);
  }

  checkToolsAvailability(): { 'cslol-manager': boolean; 'lol-skins': boolean; path?: string } {
    const cslol = this.isReady();
    const lolSkins = fs.existsSync(path.join(this.basePath, 'lol-skins'));
    return { 'cslol-manager': cslol, 'lol-skins': lolSkins, path: cslol ? this.toolsPath : undefined };
  }

  getToolsPath(): string { return this.toolsPath; }

  testToolsPath(p: string): boolean {
    const candidates = [p, path.join(p, 'cslol-tools')];
    for (const c of candidates) {
      if (fs.existsSync(path.join(c, 'mod-tools.exe'))) return true;
    }
    return false;
  }

  testLeaguePath(p: string): { success: boolean } {
    return { success: fs.existsSync(path.join(p, 'League of Legends.exe')) };
  }

  async downloadCslol(onProgress?: (data: { progress: number; status: string; repoType: string }) => void): Promise<{ success: boolean; error?: string; suggestedPath?: string }> {
    try {
      onProgress?.({ progress: 5, status: 'starting', repoType: 'cslol-manager' });

      const releaseRes = await axios.get(CSLOL_LATEST_API, {
        headers: { 'User-Agent': 'RiftChanger/1.0' }, timeout: 15000
      });
      const winAsset = releaseRes.data.assets?.find((a: any) => a.name?.includes('windows'));
      if (!winAsset) return { success: false, error: 'No Windows asset in latest release' };

      onProgress?.({ progress: 10, status: 'downloading', repoType: 'cslol-manager' });

      const dlPath = path.join(this.basePath, 'cslol-manager-windows.exe');
      const totalSize = winAsset.size || 0;

      const res = await axios.get(winAsset.browser_download_url, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'RiftChanger/1.0' },
        timeout: 300000,
        maxContentLength: 500 * 1024 * 1024,
        onDownloadProgress: (evt) => {
          if (totalSize > 0 && evt.loaded) {
            const pct = 10 + Math.round((evt.loaded / totalSize) * 60);
            onProgress?.({ progress: Math.min(pct, 70), status: 'downloading', repoType: 'cslol-manager' });
          }
        },
      });

      fs.writeFileSync(dlPath, Buffer.from(res.data));
      onProgress?.({ progress: 75, status: 'extracting', repoType: 'cslol-manager' });

      const destDir = path.join(this.basePath, 'cslol-manager');
      if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true });
      fs.mkdirSync(destDir, { recursive: true });

      if (fs.existsSync(SEVEN_ZIP)) {
        try {
          execFileSync(SEVEN_ZIP, ['x', dlPath, `-o${destDir}`, '-y'], { timeout: 120000, windowsHide: true });
        } catch {}
      }

      try { fs.unlinkSync(dlPath); } catch {}

      onProgress?.({ progress: 90, status: 'organizing', repoType: 'cslol-manager' });

      if (this.autoDetectTools()) {
        onProgress?.({ progress: 100, status: 'completed', repoType: 'cslol-manager' });
        return { success: true, suggestedPath: this.toolsPath };
      }

      return { success: false, error: 'mod-tools.exe not found after extraction' };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** Inject a skin: import → mkoverlay → start watcher that runs overlay when game detected */
  async injectSkin(championName: string, skinName: string, skinPath: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isReady()) return { success: false, error: 'CSLoL Tools not configured. Go to Settings.' };
    if (!this.gamePath) return { success: false, error: 'League game path not configured.' };
    if (!fs.existsSync(skinPath)) return { success: false, error: 'Mod file not found: ' + skinPath };

    // Kill existing overlay
    this.killOverlay();
    await new Promise(r => setTimeout(r, 1000));

    const modName = path.basename(skinPath).replace(/\.(zip|fantome|wad\.client)$/i, '').replace(/[^a-zA-Z0-9_\-. ]/g, '_');
    const modInstallPath = path.join(this.installedDir, modName);

    const stats = fs.statSync(skinPath);
    const sizeMB = stats.size / (1024 * 1024);
    let timeout = 45000;
    if (sizeMB > 100) timeout = 600000;
    else if (sizeMB > 50) timeout = 300000;
    else if (sizeMB > 20) timeout = 120000;

    // Step 1: Import
    try {
      await this.execMod(['import', skinPath, modInstallPath, `--game:${this.gamePath}`, '--noTFT'], timeout);
    } catch (e: any) {
      return { success: false, error: `Import failed: ${e.message}` };
    }

    // Track
    this.appliedMods.set(skinPath, {
      name: modName, type: 'skin', profilePath: modInstallPath,
      championName, skinName, appliedAt: new Date().toISOString(), zipPath: skinPath
    });

    // Step 2: Build overlay
    const allModNames = Array.from(this.appliedMods.values()).map(m => m.name);
    const profilePath = path.join(this.profilesDir, 'RiftChanger_Unified');

    try {
      await this.execMod([
        'mkoverlay', this.installedDir, profilePath,
        `--game:${this.gamePath}`, `--mods:${allModNames.join('/')}`,
        '--noTFT', '--ignoreConflict'
      ], timeout);
    } catch (e: any) {
      this.appliedMods.delete(skinPath);
      return { success: false, error: `Overlay build failed: ${e.message}` };
    }

    // Step 3: Start watcher — it polls for game and runs overlay when detected
    this.startOverlayWatcher(profilePath);

    return { success: true };
  }

  async removeSkin(championName: string): Promise<{ success: boolean }> {
    for (const [key, mod] of this.appliedMods.entries()) {
      if (mod.championName === championName) {
        try { fs.rmSync(mod.profilePath, { recursive: true, force: true }); } catch {}
        this.appliedMods.delete(key);
        break;
      }
    }

    this.killOverlay();
    await new Promise(r => setTimeout(r, 500));

    // Rebuild overlay if remaining mods exist
    if (this.appliedMods.size > 0) {
      const allModNames = Array.from(this.appliedMods.values()).map(m => m.name);
      const profilePath = path.join(this.profilesDir, 'RiftChanger_Unified');
      try {
        await this.execMod([
          'mkoverlay', this.installedDir, profilePath,
          `--game:${this.gamePath}`, `--mods:${allModNames.join('/')}`,
          '--noTFT', '--ignoreConflict'
        ], 60000);

        this.startOverlayWatcher(profilePath);
      } catch {}
    }

    return { success: true };
  }

  async removeAllSkins(): Promise<{ success: boolean }> {
    this.killOverlay();
    for (const [, mod] of this.appliedMods.entries()) {
      try { fs.rmSync(mod.profilePath, { recursive: true, force: true }); } catch {}
    }
    this.appliedMods.clear();
    const profilePath = path.join(this.profilesDir, 'RiftChanger_Unified');
    try { fs.rmSync(profilePath, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(profilePath + '.config', { force: true }); } catch {}
    return { success: true };
  }

  getAppliedMods(): { active: Record<string, { skinName: string; appliedAt: string }> } {
    const active: Record<string, { skinName: string; appliedAt: string }> = {};
    for (const mod of this.appliedMods.values()) {
      active[mod.championName] = { skinName: mod.skinName, appliedAt: mod.appliedAt };
    }
    return { active };
  }

  getAppliedForChampion(championName: string): AppliedMod | undefined {
    for (const mod of this.appliedMods.values()) {
      if (mod.championName === championName) return mod;
    }
    return undefined;
  }

  killOverlay() {
    this.stopOverlayWatcher();
    if (this.overlayProcess) {
      try { this.overlayProcess.kill(); } catch {}
      this.overlayProcess = null;
    }
    try { execSync('taskkill /F /IM mod-tools.exe 2>nul', { windowsHide: true }); } catch {}
  }

  cleanup() {
    this.killOverlay();
    for (const mod of this.appliedMods.values()) {
      try { fs.rmSync(mod.profilePath, { recursive: true, force: true }); } catch {}
    }
    this.appliedMods.clear();
  }

  private execMod(args: string[], timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(this.modToolsExe, args, {
        timeout, killSignal: 'SIGTERM', maxBuffer: 10 * 1024 * 1024,
        windowsHide: true, cwd: this.toolsPath
      }, (err, stdout, stderr) => {
        if (err && !stdout?.includes('Done!')) reject(new Error(stderr || err.message));
        else resolve(stdout || '');
      });
    });
  }
}
