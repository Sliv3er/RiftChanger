function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

const target = 0xCB8C5DFE;
const target2 = 0x4FB04DB2;

// Try all possible "skinN" patterns in various contexts
const chars = ['bard', 'bardchime', 'bardmeep', 'bardfollower', 'bardbase', 'bardpet'];

for (const c of chars) {
  for (let n = 0; n <= 50; n++) {
    const patterns = [
      `characters/${c}/skins/skin${n}`,
      `Characters/${c}/Skins/Skin${n}`,
      `characters/${c}/skins/Skin${n}`,
      `characters/${c}/animations/skin${n}`,
      `characters/${c}/animations/Skin${n}`,
      // Resource resolver paths
      `characters/${c}/skins/skin${n}/resources`,
      `characters/${c}/skins/skin${n}/root`,
      `characters/${c}/skins/skin${n}/main`,
      // Particle system paths  
      `Characters/${c}/Skins/Skin${n}/${c}`,
      `characters/${c}/skins/skin${n}/${c}`,
      // Lowercase with uppercase skin
      `Skin${n}`,
      `skin${n}`,
    ];
    for (const p of patterns) {
      const h = fnv1a(p);
      if (h === target) console.log('FOUND target:', p);
      if (h === target2) console.log('FOUND target2:', p);
    }
  }
}

// Maybe it's the hash of a property name or type?
// Try common LoL bin property names
const propNames = [
  'skinMeshProperties', 'mSkinMeshProperties', 'mName', 'mSkin', 'mCharacterName',
  'mSkinIndex', 'mSkinId', 'skinId', 'mSkinName', 'mAnimations', 'mSkins',
  'mMaterial', 'mParticleSystem', 'mSpellName', 'resourceResolver',
  'mResourceResolver', 'skinCharacterDataProperties', 'SkinCharacterDataProperties',
  'mSkinScale', 'mSkinAnimations', 'mOverrideAnimations',
  'BardSkin35', 'BardSkin0', 'Bard_Skin35', 'Bard_Skin0',
  'bard_skin35', 'bard_skin0',
];

for (const p of propNames) {
  const h = fnv1a(p);
  if (h === target) console.log('FOUND prop target:', p);
  if (h === target2) console.log('FOUND prop target2:', p);
}

// Let's also check what the context around offset 6922 looks like more carefully
const fs = require('fs');
const skin35 = fs.readFileSync('C:/Users/n3tgg/.openclaw2/workspace/RiftChanger/test-bard-extract/data/characters/bard/skins/skin35.bin');

// The PROP header ends, then entries start. Let's parse entry count and entry hashes
let off = 1051; // header end
const entryCount = skin35.readUInt32LE(off);
off += 4;
console.log('\nEntry count:', entryCount);

// Read entry name hashes
const entries = [];
for (let i = 0; i < entryCount; i++) {
  entries.push(skin35.readUInt32LE(off));
  off += 4;
}
console.log('Entry name table ends at offset:', off);

// Now parse entry data to find which entry contains offset 6922
let dataOff = off;
for (let i = 0; i < entryCount; i++) {
  const size = skin35.readUInt32LE(dataOff);
  const nameHash = skin35.readUInt32LE(dataOff + 4);
  const entryStart = dataOff;
  const entryEnd = dataOff + 4 + size;
  
  if (6922 >= entryStart && 6922 < entryEnd) {
    console.log(`\nOffset 6922 is in entry ${i}: nameHash=0x${nameHash.toString(16)}, start=${entryStart}, end=${entryEnd}, size=${size}`);
    console.log(`Entry ${i} name hash from table: 0x${entries[i].toString(16)}`);
    
    // Show bytes around the mystery hash within this entry
    const relOff = 6922 - entryStart;
    console.log('Relative offset within entry data:', relOff);
    
    // Show surrounding uint32s
    for (let j = 6922 - 16; j <= 6922 + 16; j += 4) {
      const v = skin35.readUInt32LE(j);
      const marker = j === 6922 ? ' <-- MYSTERY' : '';
      console.log(`  off ${j} (entry+${j-entryStart}): 0x${v.toString(16).padStart(8,'0')}${marker}`);
    }
  }
  
  if (138763 >= entryStart && 138763 < entryEnd) {
    console.log(`\nOffset 138763 is in entry ${i}: nameHash=0x${nameHash.toString(16)}, start=${entryStart}, end=${entryEnd}, size=${size}`);
    const relOff = 138763 - entryStart;
    console.log('Relative offset within entry data:', relOff);
  }
  
  dataOff = entryEnd;
}

console.log('\nDone');
