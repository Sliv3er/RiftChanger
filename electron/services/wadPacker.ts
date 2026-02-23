import * as crypto from 'crypto';

/**
 * Minimal WAD v3 packer for creating CSLoL-compatible overlay WADs.
 *
 * WAD format:
 * - Header: "RW" + major(3) + minor(0) + signature(256 zeros) + checksum(8 zeros) + entry_count(u32)
 * - Entries: path_hash(u64) + offset(u32) + compressed_size(u32) + uncompressed_size(u32) + type(u8) + duplicate(u8) + pad(u16) + sha256_first8(u64)
 * - Data: concatenated file data
 */

export interface WadEntry {
  path: string;      // e.g., "data/characters/ahri/skins/skin0.bin"
  data: Buffer;
  pathHash?: Buffer;  // Pre-computed 8-byte LE hash (if available)
}

/**
 * Pack entries into WAD v3 format. Entries must have pathHash set.
 */
export function packWadWithHashes(entries: WadEntry[]): Buffer {
  const HEADER_SIZE = 272; // 2+1+1+256+8+4
  const ENTRY_SIZE = 32;
  const entriesStart = HEADER_SIZE;
  const dataStart = entriesStart + entries.length * ENTRY_SIZE;

  let totalDataSize = 0;
  for (const e of entries) totalDataSize += e.data.length;

  const buf = Buffer.alloc(dataStart + totalDataSize);

  // Header
  buf.write('RW', 0, 'ascii');
  buf.writeUInt8(3, 2);  // major
  buf.writeUInt8(0, 3);  // minor
  // signature(256) + checksum(8) = zeros (already)
  buf.writeUInt32LE(entries.length, 268);

  let dataOffset = dataStart;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const off = entriesStart + i * ENTRY_SIZE;

    if (!e.pathHash || e.pathHash.length !== 8) {
      throw new Error(`Entry "${e.path}" missing pathHash`);
    }

    const sha = crypto.createHash('sha256').update(e.data).digest();

    e.pathHash.copy(buf, off);                         // path_hash (8B)
    buf.writeUInt32LE(dataOffset, off + 8);            // offset
    buf.writeUInt32LE(e.data.length, off + 12);        // compressed_size
    buf.writeUInt32LE(e.data.length, off + 16);        // uncompressed_size
    buf.writeUInt8(0, off + 20);                       // type=uncompressed
    buf.writeUInt8(0, off + 21);                       // duplicate
    buf.writeUInt16LE(0, off + 22);                    // pad
    sha.subarray(0, 8).copy(buf, off + 24);            // sha256 first 8

    e.data.copy(buf, dataOffset);
    dataOffset += e.data.length;
  }

  return buf;
}
