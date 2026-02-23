import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

export interface BackupEntry {
  id: string;
  date: string;
  gamePath: string;
  size: number;
}

export class BackupService {
  private backupDir: string;

  constructor(backupDir: string) {
    this.backupDir = backupDir;
    fs.mkdirSync(backupDir, { recursive: true });
  }

  async create(gamePath: string): Promise<{ success: boolean; backupId: string; message: string }> {
    const id = `backup_${Date.now()}`;
    const backupPath = path.join(this.backupDir, `${id}.zip`);

    try {
      const modOverlayDir = path.join(gamePath, 'Game', 'Mods');
      if (!fs.existsSync(modOverlayDir)) {
        // Nothing to backup, game is clean
        const meta = {
          id,
          date: new Date().toISOString(),
          gamePath,
          clean: true,
        };
        fs.writeFileSync(
          path.join(this.backupDir, `${id}.json`),
          JSON.stringify(meta, null, 2)
        );
        return { success: true, backupId: id, message: 'Game is clean, metadata saved' };
      }

      const zip = new AdmZip();
      this.addDirToZip(zip, modOverlayDir, 'Mods');
      zip.writeZip(backupPath);

      const meta = {
        id,
        date: new Date().toISOString(),
        gamePath,
        clean: false,
        size: fs.statSync(backupPath).size,
      };
      fs.writeFileSync(
        path.join(this.backupDir, `${id}.json`),
        JSON.stringify(meta, null, 2)
      );

      return { success: true, backupId: id, message: `Backup created: ${id}` };
    } catch (e: any) {
      return { success: false, backupId: '', message: `Backup failed: ${e.message}` };
    }
  }

  async restore(backupId: string, gamePath: string): Promise<{ success: boolean; message: string }> {
    try {
      const metaPath = path.join(this.backupDir, `${backupId}.json`);
      if (!fs.existsSync(metaPath)) {
        return { success: false, message: `Backup not found: ${backupId}` };
      }

      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

      if (meta.clean) {
        // Remove mods directory
        const modsDir = path.join(gamePath, 'Game', 'Mods');
        if (fs.existsSync(modsDir)) {
          fs.rmSync(modsDir, { recursive: true, force: true });
        }
        return { success: true, message: 'Restored to clean state' };
      }

      const backupPath = path.join(this.backupDir, `${backupId}.zip`);
      if (!fs.existsSync(backupPath)) {
        return { success: false, message: 'Backup archive missing' };
      }

      const gameDir = path.join(gamePath, 'Game');
      const zip = new AdmZip(backupPath);
      zip.extractAllTo(gameDir, true);

      return { success: true, message: `Restored backup: ${backupId}` };
    } catch (e: any) {
      return { success: false, message: `Restore failed: ${e.message}` };
    }
  }

  list(): BackupEntry[] {
    const entries: BackupEntry[] = [];
    if (!fs.existsSync(this.backupDir)) return entries;

    const files = fs.readdirSync(this.backupDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(this.backupDir, file), 'utf8'));
        entries.push({
          id: meta.id,
          date: meta.date,
          gamePath: meta.gamePath,
          size: meta.size || 0,
        });
      } catch {}
    }

    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }

  private addDirToZip(zip: AdmZip, dirPath: string, zipDir: string) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const zipPath = path.join(zipDir, entry.name);
      if (entry.isDirectory()) {
        this.addDirToZip(zip, fullPath, zipPath);
      } else {
        zip.addLocalFile(fullPath, path.dirname(zipPath));
      }
    }
  }
}
