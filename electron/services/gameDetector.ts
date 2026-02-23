import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface GameInfo {
  found: boolean;
  path: string | null;
  version: string | null;
  isRunning: boolean;
}

export class GameDetector {
  private commonPaths = [
    'C:\\Riot Games\\League of Legends',
    'D:\\Riot Games\\League of Legends',
    'C:\\Program Files\\Riot Games\\League of Legends',
    'C:\\Program Files (x86)\\Riot Games\\League of Legends',
  ];

  async detect(): Promise<GameInfo> {
    const info: GameInfo = {
      found: false,
      path: null,
      version: null,
      isRunning: false,
    };

    // Check if game is running
    try {
      const processes = execSync('tasklist /FI "IMAGENAME eq LeagueClient.exe" /NH', {
        encoding: 'utf8',
        windowsHide: true,
      });
      info.isRunning = processes.includes('LeagueClient.exe');
    } catch {}

    // Try Riot Client install path from registry
    try {
      const regResult = execSync(
        'reg query "HKLM\\SOFTWARE\\WOW6432Node\\Riot Games\\RADS" /v "LocalRootFolder"',
        { encoding: 'utf8', windowsHide: true }
      );
      const match = regResult.match(/REG_SZ\s+(.+)/);
      if (match) {
        const riotPath = match[1].trim();
        if (fs.existsSync(riotPath)) {
          info.found = true;
          info.path = riotPath;
        }
      }
    } catch {}

    // Try Riot Client services config
    if (!info.found) {
      const riotServicesPath = path.join(
        process.env.PROGRAMDATA || 'C:\\ProgramData',
        'Riot Games',
        'RiotClientInstalls.json'
      );
      if (fs.existsSync(riotServicesPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(riotServicesPath, 'utf8'));
          if (config.associated_client) {
            for (const [gamePath] of Object.entries(config.associated_client)) {
              const lolPath = path.dirname(gamePath as string);
              if (fs.existsSync(lolPath) && lolPath.toLowerCase().includes('league')) {
                info.found = true;
                info.path = lolPath;
                break;
              }
            }
          }
        } catch {}
      }
    }

    // Try common paths
    if (!info.found) {
      for (const p of this.commonPaths) {
        if (fs.existsSync(p)) {
          info.found = true;
          info.path = p;
          break;
        }
      }
    }

    if (info.found && info.path) {
      info.version = this.readGameVersion(info.path);
    }

    return info;
  }

  async getGamePatch(): Promise<string | null> {
    const info = await this.detect();
    return info.version;
  }

  private readGameVersion(gamePath: string): string | null {
    // Try reading from the game's metadata
    const releaseDir = path.join(gamePath, 'Game');
    if (!fs.existsSync(releaseDir)) return null;

    // Check League of Legends.exe version info from the exe or nearby files
    const solutionFile = path.join(gamePath, 'Game', 'League of Legends.exe');
    if (fs.existsSync(solutionFile)) {
      try {
        const stats = fs.statSync(solutionFile);
        // Can't easily read PE version without native module, return modified date as proxy
        return `detected-${stats.mtime.toISOString().slice(0, 10)}`;
      } catch {}
    }
    return null;
  }
}
