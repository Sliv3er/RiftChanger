const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// 1. Extract our generated mod's skin0.bin
const zipPath = 'C:/Users/n3tgg/Desktop/Dreadnova_Darius_RESOURCES_PATCH.zip';
const zip = new AdmZip(zipPath);
const entries = zip.getEntries();
console.log('ZIP entries:');
entries.forEach(e => console.log(' ', e.entryName));

// Find the WAD inside
const wadEntry = entries.find(e => e.entryName.endsWith('.wad.client'));
if (!wadEntry) { console.log('No WAD found'); process.exit(1); }

// Extract WAD to temp
const tmpDir = 'C:/Users/n3tgg/.openclaw2/workspace/RiftChanger/test-our-output';
fs.mkdirSync(tmpDir, { recursive: true });
const wadPath = path.join(tmpDir, 'Darius.wad.client');
fs.writeFileSync(wadPath, wadEntry.getData());

// Use wad-extract to unpack
const { execFileSync } = require('child_process');
const cslol = 'C:/Users/n3tgg/AppData/Roaming/riftchanger/cslol-manager/cslol-manager/cslol-tools';
const outDir = path.join(tmpDir, 'extracted');
fs.mkdirSync(outDir, { recursive: true });
execFileSync(path.join(cslol, 'wad-extract.exe'), [wadPath, outDir]);

// Find all .bin files in our output
function findBins(dir) {
  const results = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, f.name);
    if (f.isDirectory()) results.push(...findBins(fp));
    else if (f.name.endsWith('.bin')) results.push(fp);
  }
  return results;
}
const ourBins = findBins(outDir);
console.log('\nOur mod bins:', ourBins.map(b => b.replace(outDir, '')));

// 2. Load original skin14.bin
const origBin = fs.readFileSync('C:/Users/n3tgg/.openclaw2/workspace/RiftChanger/test-darius-extract/data/characters/darius/skins/skin14.bin');
const ourBin = fs.readFileSync(ourBins.find(b => b.includes('darius') && b.includes('skin0.bin')));

console.log('\nOriginal skin14.bin size:', origBin.length);
console.log('Our skin0.bin size:', ourBin.length);

if (origBin.length !== ourBin.length) {
  console.log('SIZE MISMATCH - header was rebuilt with different string lengths');
}

// 3. Find all uint32 values in original that contain skinN patterns
const skinNum = 14;
const chars = ['darius']; // check for sub-chars
const dariusCharsDir = 'C:/Users/n3tgg/.openclaw2/workspace/RiftChanger/test-darius-extract/data/characters';
if (fs.existsSync(dariusCharsDir)) {
  const subChars = fs.readdirSync(dariusCharsDir);
  console.log('\nWAD characters:', subChars);
}

// Build all possible skin14 hashes
const hashesToPatch = new Map();
for (const c of ['darius']) {
  const patterns = [
    `characters/${c}/skins/skin${skinNum}`,
    `characters/${c}/skins/skin0`,
    `characters/${c}/animations/skin${skinNum}`,
    `characters/${c}/animations/skin0`,
    `characters/${c}/skins/skin${skinNum}/resources`,
    `characters/${c}/skins/skin0/resources`,
  ];
  for (const p of patterns) {
    console.log(`  fnv1a('${p}') = 0x${fnv1a(p).toString(16)}`);
  }
}

// 4. Byte-level diff
let diffCount = 0;
const minLen = Math.min(origBin.length, ourBin.length);
const diffs = [];
let i = 0;
while (i < minLen) {
  if (origBin[i] !== ourBin[i]) {
    let start = i;
    while (i < minLen && origBin[i] !== ourBin[i]) i++;
    diffs.push({ offset: start, len: i - start });
    diffCount++;
  } else {
    i++;
  }
}

console.log('\nDiff regions:', diffs.length);
for (const d of diffs) {
  const origBytes = origBin.subarray(d.offset, d.offset + Math.min(d.len, 16));
  const ourBytes = ourBin.subarray(d.offset, d.offset + Math.min(d.len, 16));
  let note = '';
  if (d.len === 4) {
    const vOrig = origBin.readUInt32LE(d.offset);
    const vOur = ourBin.readUInt32LE(d.offset);
    note = ` [0x${vOrig.toString(16)} => 0x${vOur.toString(16)}]`;
  } else if (d.len > 4) {
    // Show as string if printable
    const s1 = origBin.toString('ascii', d.offset, d.offset + Math.min(d.len, 40));
    const s2 = ourBin.toString('ascii', d.offset, d.offset + Math.min(d.len, 40));
    if (/^[\x20-\x7e]+$/.test(s1)) note = ` STR: '${s1}' => '${s2}'`;
  }
  console.log(`  offset ${d.offset} (len ${d.len}):${note}`);
}

// 5. Now scan original for ALL fnv1a hashes that match skinN patterns
console.log('\n--- Scanning original for remaining skin14 references ---');
const skin14hash = fnv1a('characters/darius/skins/skin14');
const skin14anim = fnv1a('characters/darius/animations/skin14');
const skin14res = fnv1a('characters/darius/skins/skin14/resources');

for (let j = 0; j <= origBin.length - 4; j++) {
  const v = origBin.readUInt32LE(j);
  if (v === skin14hash) console.log(`  skin14 hash at offset ${j}`);
  if (v === skin14anim) console.log(`  anim14 hash at offset ${j}`);
  if (v === skin14res) console.log(`  resources14 hash at offset ${j}`);
}

// Check our output for remaining skin14 references
console.log('\n--- Scanning OUR output for remaining skin14 references ---');
for (let j = 0; j <= ourBin.length - 4; j++) {
  const v = ourBin.readUInt32LE(j);
  if (v === skin14hash) console.log(`  UNPACHED skin14 hash at offset ${j}`);
  if (v === skin14anim) console.log(`  UNPATCHED anim14 hash at offset ${j}`);
  if (v === skin14res) console.log(`  UNPATCHED resources14 hash at offset ${j}`);
}

// Also check PROP header linked strings
console.log('\n--- PROP Header Strings ---');
for (const [label, buf] of [['ORIG', origBin], ['OURS', ourBin]]) {
  if (buf.toString('ascii', 0, 4) !== 'PROP') continue;
  const ver = buf.readUInt32LE(4);
  const cnt = buf.readUInt32LE(8);
  let off = 12;
  console.log(`${label}: version=${ver}, linkedCount=${cnt}`);
  for (let k = 0; k < cnt; k++) {
    const slen = buf.readUInt16LE(off);
    const str = buf.toString('ascii', off + 2, off + 2 + slen);
    console.log(`  [${k}] '${str}'`);
    off += 2 + slen;
  }
  console.log(`  Header ends at: ${off}`);
}
