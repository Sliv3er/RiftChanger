const fs = require('fs');

function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

const skin35 = fs.readFileSync('C:/Users/n3tgg/.openclaw2/workspace/RiftChanger/test-bard-extract/data/characters/bard/skins/skin35.bin');
const skin0mod = fs.readFileSync('C:/Users/n3tgg/.openclaw2/workspace/RiftChanger/test-t1bard/wad/data/characters/bard/skins/skin0.bin');

console.log('skin35 size:', skin35.length, 'skin0mod size:', skin0mod.length);

// Find all byte-level diff regions
const diffs = [];
let i = 0;
const minLen = Math.min(skin35.length, skin0mod.length);

while (i < minLen) {
  if (skin35[i] !== skin0mod[i]) {
    let start = i;
    while (i < minLen && skin35[i] !== skin0mod[i]) i++;
    diffs.push({offset: start, len: i - start});
  } else {
    i++;
  }
}

console.log('Diff regions:', diffs.length);
console.log();

// Known hashes
const h35skin = fnv1a('characters/bard/skins/skin35');
const h0skin = fnv1a('characters/bard/skins/skin0');
const h35anim = fnv1a('characters/bard/animations/skin35');
const h0anim = fnv1a('characters/bard/animations/skin0');

console.log('Known: skin35=0x' + h35skin.toString(16) + ' skin0=0x' + h0skin.toString(16));
console.log('Known: anim35=0x' + h35anim.toString(16) + ' anim0=0x' + h0anim.toString(16));
console.log();

for (const d of diffs) {
  const from = skin35.subarray(d.offset, d.offset + d.len);
  const to = skin0mod.subarray(d.offset, d.offset + d.len);
  
  let fromHex, toHex;
  if (d.len <= 8) {
    fromHex = Buffer.from(from).toString('hex');
    toHex = Buffer.from(to).toString('hex');
  } else {
    fromHex = Buffer.from(from.subarray(0, 8)).toString('hex') + '...';
    toHex = Buffer.from(to.subarray(0, 8)).toString('hex') + '...';
  }
  
  // Check if it's a uint32 at aligned offset
  let note = '';
  if (d.len === 4) {
    const v35 = skin35.readUInt32LE(d.offset);
    const v0 = skin0mod.readUInt32LE(d.offset);
    if (v35 === h35skin) note = ' [skin hash]';
    else if (v35 === h35anim) note = ' [anim hash]';
    else note = ' [0x' + v35.toString(16) + ' => 0x' + v0.toString(16) + ']';
  }
  
  console.log(`offset ${d.offset} (len ${d.len}): ${fromHex} => ${toHex}${note}`);
}

// Also check PROP header differences
console.log('\n--- PROP Header Analysis ---');
const magic35 = skin35.toString('ascii', 0, 4);
const magic0 = skin0mod.toString('ascii', 0, 4);
console.log('Magic:', magic35, magic0);
const ver35 = skin35.readUInt32LE(4);
const ver0 = skin0mod.readUInt32LE(4);
console.log('Version:', ver35, ver0);
const linked35 = skin35.readUInt32LE(8);
const linked0 = skin0mod.readUInt32LE(8);
console.log('Linked count:', linked35, linked0);

// Parse linked strings
let off35 = 12, off0 = 12;
for (let j = 0; j < linked35; j++) {
  const slen35 = skin35.readUInt16LE(off35);
  const str35 = skin35.toString('ascii', off35 + 2, off35 + 2 + slen35);
  const slen0 = skin0mod.readUInt16LE(off0);
  const str0 = skin0mod.toString('ascii', off0 + 2, off0 + 2 + slen0);
  if (str35 !== str0) {
    console.log(`Linked[${j}]: '${str35}' => '${str0}'`);
  }
  off35 += 2 + slen35;
  off0 += 2 + slen0;
}
console.log('Header end - skin35:', off35, 'skin0mod:', off0);
