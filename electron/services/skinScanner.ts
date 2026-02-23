import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

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

export class SkinScanner {
  scan(skinsPath: string): ScanResult {
    const result: ScanResult = {
      champions: [],
      totalSkins: 0,
      totalChromas: 0,
      totalForms: 0,
      totalExalted: 0,
      skins: [],
      errors: [],
    };

    if (!fs.existsSync(skinsPath)) {
      result.errors.push(`Skins path not found: ${skinsPath}`);
      return result;
    }

    const champDirs = fs.readdirSync(skinsPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    result.champions = champDirs;

    for (const champ of champDirs) {
      const champPath = path.join(skinsPath, champ);
      this.scanChampion(champPath, champ, result);
    }

    return result;
  }

  private scanChampion(champPath: string, champName: string, result: ScanResult) {
    const entries = fs.readdirSync(champPath, { withFileTypes: true });

    // Base skins (zip files in root)
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.zip')) {
        const skin = this.parseSkinZip(
          path.join(champPath, entry.name),
          champName,
          'skin'
        );
        result.skins.push(skin);
        result.totalSkins++;
      }
    }

    // Chromas
    const chromasPath = path.join(champPath, 'chromas');
    if (fs.existsSync(chromasPath)) {
      const chromaDirs = fs.readdirSync(chromasPath, { withFileTypes: true })
        .filter(d => d.isDirectory());

      for (const chromaDir of chromaDirs) {
        const chromaDirPath = path.join(chromasPath, chromaDir.name);
        const chromaZips = fs.readdirSync(chromaDirPath)
          .filter(f => f.endsWith('.zip'));

        for (const zip of chromaZips) {
          const skin = this.parseSkinZip(
            path.join(chromaDirPath, zip),
            champName,
            'chroma'
          );
          // Extract chroma ID from filename (e.g., "Arcana Ahri 103067.zip" -> "103067")
          const match = zip.match(/(\d+)\.zip$/);
          if (match) skin.chromaId = match[1];
          result.skins.push(skin);
          result.totalChromas++;
        }
      }
    }

    // Forms (e.g., Elementalist Lux forms)
    const formsPath = path.join(champPath, 'forms');
    if (fs.existsSync(formsPath)) {
      this.scanSubdir(formsPath, champName, 'form', result);
    }

    // Exalted variants
    const exaltedPath = path.join(champPath, 'Exalted');
    if (fs.existsSync(exaltedPath)) {
      this.scanSubdir(exaltedPath, champName, 'exalted', result);
    }
  }

  private scanSubdir(dirPath: string, champName: string, type: 'form' | 'exalted', result: ScanResult) {
    const walkDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.zip')) {
          const skin = this.parseSkinZip(path.join(dir, entry.name), champName, type);
          result.skins.push(skin);
          if (type === 'form') result.totalForms++;
          if (type === 'exalted') result.totalExalted++;
        } else if (entry.isDirectory()) {
          walkDir(path.join(dir, entry.name));
        }
      }
    };
    walkDir(dirPath);
  }

  parseSkinZip(zipPath: string, champName: string, type: SkinEntry['type']): SkinEntry {
    const entry: SkinEntry = {
      championName: champName,
      skinName: path.basename(zipPath, '.zip'),
      type,
      zipPath,
      valid: false,
      validationErrors: [],
      meta: null,
      wadFile: null,
    };

    try {
      const zip = new AdmZip(zipPath);
      const zipEntries = zip.getEntries();

      // Check META/info.json
      const infoEntry = zipEntries.find(e => e.entryName === 'META/info.json');
      if (!infoEntry) {
        entry.validationErrors.push('Missing META/info.json');
      } else {
        try {
          entry.meta = JSON.parse(infoEntry.getData().toString('utf8'));
        } catch {
          entry.validationErrors.push('Invalid META/info.json');
        }
      }

      // Check WAD file
      const wadEntry = zipEntries.find(e => e.entryName.startsWith('WAD/') && e.entryName.endsWith('.wad.client'));
      if (!wadEntry) {
        entry.validationErrors.push('Missing WAD/*.wad.client');
      } else {
        entry.wadFile = wadEntry.entryName;

        // Validate WAD filename matches champion
        const wadName = path.basename(wadEntry.entryName, '.wad.client');
        const normalizedChamp = champName.replace(/[^a-zA-Z]/g, '');
        const normalizedWad = wadName.replace(/[^a-zA-Z]/g, '');
        if (normalizedWad.toLowerCase() !== normalizedChamp.toLowerCase()) {
          // Some champions have different WAD names (e.g., "Nunu & Willump" -> "Nunu")
          // Don't flag as error, just note it
        }
      }

      // Check for extra unexpected files
      const expectedPrefixes = ['META/', 'WAD/'];
      for (const ze of zipEntries) {
        if (!expectedPrefixes.some(p => ze.entryName.startsWith(p))) {
          entry.validationErrors.push(`Unexpected file: ${ze.entryName}`);
        }
      }

      entry.valid = entry.validationErrors.length === 0;
    } catch (e: any) {
      entry.validationErrors.push(`Failed to read zip: ${e.message}`);
    }

    return entry;
  }

  validateSkin(zipPath: string): SkinEntry {
    const champName = path.basename(path.dirname(zipPath));
    return this.parseSkinZip(zipPath, champName, 'skin');
  }
}
