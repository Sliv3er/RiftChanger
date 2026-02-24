import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

/**
 * WAD packer that uses cslol-tools' wad-make for correct WAD v3.4 output with zstd compression.
 * Falls back to manual packing if wad-make is not available.
 */

export interface WadEntry {
  path: string;      // e.g., "data/characters/ahri/skins/skin0.bin"
  data: Buffer;
  pathHash?: Buffer;  // Only needed for manual fallback
}

/**
 * Find wad-make.exe in cslol-tools directory.
 */
function findWadMake(basePath: string): string | null {
  const candidates = [
    path.join(basePath, 'cslol-manager', 'cslol-manager', 'cslol-tools', 'wad-make.exe'),
    path.join(basePath, 'cslol-manager', 'cslol-tools', 'wad-make.exe'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // Recursive search
  const cslolDir = path.join(basePath, 'cslol-manager');
  if (!fs.existsSync(cslolDir)) return null;
  const walk = (dir: string, d: number): string | null => {
    if (d > 4) return null;
    try {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isFile() && e.name === 'wad-make.exe') return path.join(dir, e.name);
        if (e.isDirectory()) { const r = walk(path.join(dir, e.name), d + 1); if (r) return r; }
      }
    } catch {} return null;
  };
  return walk(cslolDir, 0);
}

let _wadMakePath: string | null | undefined;
let _gamePath = 'C:\\Riot Games\\League of Legends\\Game';

export function setWadMakeConfig(userDataPath: string, gamePath?: string) {
  _wadMakePath = findWadMake(userDataPath);
  if (gamePath) _gamePath = gamePath;
}

/**
 * Pack entries into a WAD using cslol's wad-make (produces correct v3.4 + zstd).
 * Creates a temporary RAW directory, runs wad-make, returns the WAD buffer.
 */
export function packWadWithHashes(entries: WadEntry[]): Buffer {
  if (!_wadMakePath || !fs.existsSync(_wadMakePath)) {
    // Fallback to manual v3.4 uncompressed packing
    return packManual(entries);
  }

  // Create temp RAW directory with files at their paths
  const tmpDir = path.join(require('os').tmpdir(), `riftchanger-wad-${Date.now()}`);
  const rawDir = path.join(tmpDir, 'RAW');
  const outWad = path.join(tmpDir, 'out.wad.client');

  try {
    for (const e of entries) {
      const filePath = path.join(rawDir, e.path.replace(/\//g, path.sep));
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, e.data);
    }

    execFileSync(_wadMakePath, [rawDir, outWad, `--game:${_gamePath}`], {
      timeout: 30000,
      windowsHide: true,
    });

    const wadBuffer = fs.readFileSync(outWad);
    return wadBuffer;
  } finally {
    // Cleanup
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

/**
 * Manual WAD v3.4 packer (uncompressed, type=0). Used as fallback.
 */
function packManual(entries: WadEntry[]): Buffer {
  const crypto = require('crypto');
  const HEADER_SIZE = 272;
  const ENTRY_SIZE = 32;
  const dataStart = HEADER_SIZE + entries.length * ENTRY_SIZE;

  let totalDataSize = 0;
  for (const e of entries) totalDataSize += e.data.length;

  const buf = Buffer.alloc(dataStart + totalDataSize);

  // Header: RW v3.4
  buf.write('RW', 0, 'ascii');
  buf.writeUInt8(3, 2);  // major
  buf.writeUInt8(4, 3);  // minor (was 0, now 4!)
  buf.writeUInt32LE(entries.length, 268);

  let dataOffset = dataStart;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const off = HEADER_SIZE + i * ENTRY_SIZE;

    if (!e.pathHash || e.pathHash.length !== 8) {
      throw new Error(`Entry "${e.path}" missing pathHash`);
    }

    const sha = crypto.createHash('sha256').update(e.data).digest();

    e.pathHash.copy(buf, off);
    buf.writeUInt32LE(dataOffset, off + 8);
    buf.writeUInt32LE(e.data.length, off + 12);  // compressed = uncompressed
    buf.writeUInt32LE(e.data.length, off + 16);
    buf.writeUInt8(0, off + 20);                  // type=0 uncompressed
    buf.writeUInt8(0, off + 21);
    buf.writeUInt16LE(0, off + 22);
    sha.subarray(0, 8).copy(buf, off + 24);

    e.data.copy(buf, dataOffset);
    dataOffset += e.data.length;
  }

  return buf;
}
