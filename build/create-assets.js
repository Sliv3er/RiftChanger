// Generate icon.ico (256x256) and installer BMPs for NSIS
// Uses raw pixel manipulation — no dependencies needed

const fs = require('fs');
const path = require('path');

// Create a simple 256x256 RGBA icon: dark bg with gold "RC" shield shape
function createIcon() {
  const size = 256;
  const pixels = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const cx = x - 128, cy = y - 128;
      const dist = Math.sqrt(cx * cx + cy * cy);

      // Shield shape: rounded hexagon
      const angle = Math.atan2(cy, cx);
      const shieldR = 100 + 15 * Math.cos(angle * 6);

      if (dist < shieldR) {
        // Inside shield
        const edge = shieldR - dist;
        if (edge < 4) {
          // Gold border
          pixels[idx] = 200; pixels[idx+1] = 170; pixels[idx+2] = 110; pixels[idx+3] = 255;
        } else {
          // Dark interior with subtle gradient
          const g = Math.floor(10 + (1 - dist/shieldR) * 20);
          pixels[idx] = g; pixels[idx+1] = Math.floor(g * 1.5); pixels[idx+2] = Math.floor(g * 2.2); pixels[idx+3] = 255;
        }
      } else {
        // Transparent
        pixels[idx] = 0; pixels[idx+1] = 0; pixels[idx+2] = 0; pixels[idx+3] = 0;
      }
    }
  }

  // Draw a simple "R" in gold (approximate with rectangles)
  function fillRect(x1, y1, x2, y2, r, g, b) {
    for (let y = y1; y < y2; y++) {
      for (let x = x1; x < x2; x++) {
        if (x >= 0 && x < size && y >= 0 && y < size) {
          const idx = (y * size + x) * 4;
          pixels[idx] = r; pixels[idx+1] = g; pixels[idx+2] = b; pixels[idx+3] = 255;
        }
      }
    }
  }

  // "R" letter - vertical bar
  fillRect(95, 80, 110, 180, 200, 170, 110);
  // Top horizontal
  fillRect(110, 80, 150, 95, 200, 170, 110);
  // Middle horizontal
  fillRect(110, 123, 145, 138, 200, 170, 110);
  // Top right vertical
  fillRect(145, 88, 160, 130, 200, 170, 110);
  // Diagonal leg
  for (let i = 0; i < 45; i++) {
    fillRect(130 + i, 135 + i, 145 + i, 140 + i, 200, 170, 110);
  }

  // Create ICO file
  // ICO format: header + directory entry + PNG data
  // Actually, let's write a BMP-based ICO which is simpler
  const bmpSize = 40 + size * size * 4 + size * Math.ceil(size / 8);  // Not exact but let's use PNG

  // Write as PNG inside ICO — simpler and supported
  // Actually for simplicity, let's write a raw 256x256 BMP ICO
  
  // ICO header
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);  // reserved
  header.writeUInt16LE(1, 2);  // ICO type
  header.writeUInt16LE(1, 4);  // 1 image

  // Directory entry  
  const dirEntry = Buffer.alloc(16);
  dirEntry[0] = 0;  // 256 = 0
  dirEntry[1] = 0;  // 256 = 0
  dirEntry[2] = 0;  // no palette
  dirEntry[3] = 0;  // reserved
  dirEntry.writeUInt16LE(1, 4);  // color planes
  dirEntry.writeUInt16LE(32, 6);  // bits per pixel

  // BMP info header (BITMAPINFOHEADER)
  const biSize = 40;
  const andMaskRowSize = Math.ceil(size / 32) * 4;
  const andMaskSize = andMaskRowSize * size;
  const imageDataSize = biSize + size * size * 4 + andMaskSize;

  dirEntry.writeUInt32LE(imageDataSize, 8);  // size of image data
  dirEntry.writeUInt32LE(22, 12);  // offset from start of file

  // BMP info header
  const bmpHeader = Buffer.alloc(biSize);
  bmpHeader.writeUInt32LE(biSize, 0);
  bmpHeader.writeInt32LE(size, 4);  // width
  bmpHeader.writeInt32LE(size * 2, 8);  // height (doubled for ICO)
  bmpHeader.writeUInt16LE(1, 12);  // planes
  bmpHeader.writeUInt16LE(32, 14);  // bpp
  bmpHeader.writeUInt32LE(0, 16);  // no compression
  bmpHeader.writeUInt32LE(size * size * 4 + andMaskSize, 20);

  // Pixel data (bottom-up, BGRA)
  const bmpPixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const srcIdx = ((size - 1 - y) * size + x) * 4;  // flip vertically
      const dstIdx = (y * size + x) * 4;
      bmpPixels[dstIdx] = pixels[srcIdx + 2];  // B
      bmpPixels[dstIdx + 1] = pixels[srcIdx + 1];  // G
      bmpPixels[dstIdx + 2] = pixels[srcIdx];  // R
      bmpPixels[dstIdx + 3] = pixels[srcIdx + 3];  // A
    }
  }

  // AND mask (all zeros = fully opaque where alpha says so)
  const andMask = Buffer.alloc(andMaskSize, 0);

  const ico = Buffer.concat([header, dirEntry, bmpHeader, bmpPixels, andMask]);
  fs.writeFileSync(path.join(__dirname, 'icon.ico'), ico);
  console.log('Created icon.ico');
}

// Create installer BMP headers (150x57 for header, 164x314 for sidebar)
function createBMP(width, height, filename) {
  const rowSize = Math.ceil(width * 3 / 4) * 4;
  const pixelDataSize = rowSize * height;
  const fileSize = 54 + pixelDataSize;

  const buf = Buffer.alloc(fileSize);
  // BMP header
  buf[0] = 0x42; buf[1] = 0x4D;  // "BM"
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10);  // pixel data offset

  // DIB header
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);  // planes
  buf.writeUInt16LE(24, 28);  // 24bpp
  buf.writeUInt32LE(pixelDataSize, 34);

  // Fill with dark League-style gradient
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = 54 + (height - 1 - y) * rowSize + x * 3;
      const t = y / height;
      // Dark blue to darker
      buf[idx] = Math.floor(19 + t * 5);     // B
      buf[idx+1] = Math.floor(10 + t * 10);  // G
      buf[idx+2] = Math.floor(1 + t * 8);    // R
    }
  }

  fs.writeFileSync(path.join(__dirname, filename), buf);
  console.log(`Created ${filename}`);
}

createIcon();
createBMP(150, 57, 'installerHeader.bmp');
createBMP(164, 314, 'installerSidebar.bmp');
console.log('All assets created!');
