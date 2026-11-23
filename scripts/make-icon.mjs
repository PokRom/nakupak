// Vygeneruje PNG ikonu (zelený čtverec s bílým košíkem) bez externích knihoven.
// Použití: node scripts/make-icon.mjs <velikost> <výstup.png>
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const size = parseInt(process.argv[2] || '180', 10);
const out = process.argv[3] || 'public/apple-touch-icon.png';

const BG = [46, 125, 79];
const FG = [255, 255, 255];

const basket = [[0.27, 0.34], [0.82, 0.34], [0.74, 0.60], [0.35, 0.60]];
const handle = [[[0.14, 0.26], [0.25, 0.26]], [[0.25, 0.26], [0.35, 0.60]], [[0.35, 0.60], [0.76, 0.60]]];
const wheels = [[0.41, 0.72], [0.70, 0.72]];
const STROKE = 0.032;
const WHEEL_R = 0.058;

function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distSeg(x, y, [[ax, ay], [bx, by]]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

function isFg(x, y) {
  if (inPoly(x, y, basket)) return true;
  if (handle.some((s) => distSeg(x, y, s) < STROKE)) return true;
  return wheels.some(([cx, cy]) => Math.hypot(x - cx, y - cy) < WHEEL_R);
}

// 4×4 supersampling kvůli vyhlazeným hranám.
const SS = 4;
const raw = Buffer.alloc((size * 3 + 1) * size);
for (let py = 0; py < size; py++) {
  raw[py * (size * 3 + 1)] = 0;
  for (let px = 0; px < size; px++) {
    let hits = 0;
    for (let sy = 0; sy < SS; sy++)
      for (let sx = 0; sx < SS; sx++)
        if (isFg((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size)) hits++;
    const a = hits / (SS * SS);
    const o = py * (size * 3 + 1) + 1 + px * 3;
    for (let c = 0; c < 3; c++) raw[o + c] = Math.round(BG[c] * (1 - a) + FG[c] * a);
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8; ihdr[9] = 2; // 8 bitů, RGB

writeFileSync(out, Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]));
console.log(`OK ${out} (${size}×${size})`);
