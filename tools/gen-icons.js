#!/usr/bin/env node
/*
 * gen-icons.js — Genera todos los iconos de la PWA "Salud Digital" sin
 * dependencias externas (ni ImageMagick, ni sharp, ni red). Dibuja un cruz
 * médica blanca sobre un degradado cian de marca, con anti-aliasing por
 * supersampling, y codifica los PNG a mano (zlib core + CRC32). También
 * emite favicon.ico (multi-tamaño) e icon.svg vectorial.
 *
 * Re-ejecutar tras cambiar la marca:  node tools/gen-icons.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

// ── Paleta de marca (ver public/theme.js / layout.css) ──
const GRAD_TOP = [0x22, 0xd3, 0xee]; // cyan-400
const GRAD_BOT = [0x08, 0x91, 0xb2]; // cyan-600 (primary)
const WHITE    = [0xff, 0xff, 0xff];

// ───────────────────────── PNG encoder ─────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
// rgba: Uint8Array length w*h*4. opaque=true → emite RGB (color type 2, SIN
// canal alfa), requerido por la guía de Apple para apple-touch-icon (iOS no
// debe ver transparencia). El alfa se descarta (los iconos full-bleed ya son
// 100% opacos, alpha=255 en todo píxel).
function encodePng(rgba, w, h, opaque) {
  const channels = opaque ? 3 : 4;
  const colorType = opaque ? 2 : 6;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;          // bit depth
  ihdr[9] = colorType;  // 2 = RGB, 6 = RGBA
  ihdr[10] = 0;         // compression
  ihdr[11] = 0;         // filter
  ihdr[12] = 0;         // interlace
  const stride = w * channels + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0; // filter byte
    for (let x = 0; x < w; x++) {
      const src = (y * w + x) * 4;
      const dst = y * stride + 1 + x * channels;
      raw[dst] = rgba[src];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
      if (!opaque) raw[dst + 3] = rgba[src + 3];
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ───────────────────────── Drawing ─────────────────────────
const SS = 4; // supersampling factor

function inRoundRect(px, py, x0, y0, w, h, r) {
  if (px < x0 || py < y0 || px > x0 + w - 1 || py > y0 + h - 1) return false;
  const rx = px - x0, ry = py - y0;
  if (rx >= r && rx <= w - 1 - r) return true;
  if (ry >= r && ry <= h - 1 - r) return true;
  const cx = rx < r ? r : w - 1 - r;
  const cy = ry < r ? r : h - 1 - r;
  return (rx - cx) ** 2 + (ry - cy) ** 2 <= r * r;
}

/*
 * Renderiza un icono a `size` px.
 *   fullBleed=true  → degradado cubre todo el lienzo (maskable / apple).
 *   fullBleed=false → cuadrado redondeado con esquinas transparentes (any).
 *   plusFrac        → medio-largo del brazo de la cruz como fracción del lado.
 */
function renderIcon(size, { fullBleed, plusFrac }) {
  const big = size * SS;
  const buf = new Uint8Array(big * big * 4); // transparente
  const bgRadius = fullBleed ? 0 : Math.round(big * 0.225); // squircle aprox
  const cx = (big - 1) / 2, cy = (big - 1) / 2;
  const armHalf = plusFrac * big;          // medio-largo del brazo
  const thickHalf = big * 0.115;           // medio-grosor del brazo
  const r = thickHalf;                     // extremos redondeados (cápsula)

  for (let y = 0; y < big; y++) {
    const t = y / (big - 1);
    const gr = Math.round(GRAD_TOP[0] + (GRAD_BOT[0] - GRAD_TOP[0]) * t);
    const gg = Math.round(GRAD_TOP[1] + (GRAD_BOT[1] - GRAD_TOP[1]) * t);
    const gb = Math.round(GRAD_TOP[2] + (GRAD_BOT[2] - GRAD_TOP[2]) * t);
    for (let x = 0; x < big; x++) {
      const inBg = fullBleed
        ? true
        : inRoundRect(x, y, 0, 0, big, big, bgRadius);
      if (!inBg) continue;
      const i = (y * big + x) * 4;
      // fondo degradado
      let R = gr, G = gg, B = gb;
      // cruz blanca (unión de dos cápsulas)
      const inH = inRoundRect(x, y, cx - armHalf, cy - thickHalf, armHalf * 2, thickHalf * 2, r);
      const inV = inRoundRect(x, y, cx - thickHalf, cy - armHalf, thickHalf * 2, armHalf * 2, r);
      if (inH || inV) { R = WHITE[0]; G = WHITE[1]; B = WHITE[2]; }
      buf[i] = R; buf[i + 1] = G; buf[i + 2] = B; buf[i + 3] = 255;
    }
  }

  // downscale SSxSS con promedio premultiplicado (AA correcto sobre transparente)
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let ra = 0, ga = 0, ba = 0, aa = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * big + (x * SS + sx)) * 4;
          const a = buf[i + 3];
          ra += buf[i] * a; ga += buf[i + 1] * a; ba += buf[i + 2] * a; aa += a;
        }
      }
      const o = (y * size + x) * 4;
      const n = SS * SS;
      out[o + 3] = Math.round(aa / n);
      if (aa > 0) {
        out[o]     = Math.round(ra / aa);
        out[o + 1] = Math.round(ga / aa);
        out[o + 2] = Math.round(ba / aa);
      }
    }
  }
  return out;
}

function writePng(name, size, opts) {
  const rgba = renderIcon(size, opts);
  // Full-bleed (maskable / apple-touch) → PNG opaco sin alfa; el resto conserva
  // transparencia para esquinas redondeadas / favicon.
  const png = encodePng(rgba, size, size, !!opts.fullBleed);
  fs.writeFileSync(path.join(OUT, name), png);
  return png;
}

// ───────────────────────── ICO (envuelve PNGs) ─────────────────────────
function buildIco(entries /* [{size, png}] */) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);            // reserved
  header.writeUInt16LE(1, 2);            // type = icon
  header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + 16 * entries.length;
  entries.forEach((e, idx) => {
    const b = idx * 16;
    dir[b] = e.size >= 256 ? 0 : e.size;       // width
    dir[b + 1] = e.size >= 256 ? 0 : e.size;   // height
    dir[b + 2] = 0;                            // palette
    dir[b + 3] = 0;                            // reserved
    dir.writeUInt16LE(1, b + 4);               // color planes
    dir.writeUInt16LE(32, b + 6);              // bits per pixel
    dir.writeUInt32LE(e.png.length, b + 8);    // size of PNG
    dir.writeUInt32LE(offset, b + 12);         // offset
    offset += e.png.length;
  });
  return Buffer.concat([header, dir, ...entries.map(e => e.png)]);
}

// ───────────────────────── SVG vectorial ─────────────────────────
function buildSvg() {
  const top = `#${GRAD_TOP.map(c => c.toString(16).padStart(2, '0')).join('')}`;
  const bot = `#${GRAD_BOT.map(c => c.toString(16).padStart(2, '0')).join('')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Salud Digital">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/>
      <stop offset="1" stop-color="${bot}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="115" ry="115" fill="url(#g)"/>
  <g fill="#fff">
    <rect x="208" y="118" width="96" height="276" rx="48"/>
    <rect x="118" y="208" width="276" height="96" rx="48"/>
  </g>
</svg>
`;
}

// ───────────────────────── Generar todo ─────────────────────────
console.log('Generando iconos en', OUT);

// Maskable (full-bleed, cruz dentro de la zona segura ~ plusFrac 0.30)
writePng('maskable-512.png', 512, { fullBleed: true, plusFrac: 0.30 });
writePng('maskable-192.png', 192, { fullBleed: true, plusFrac: 0.30 });

// "any" (cuadrado redondeado, esquinas transparentes, cruz más grande)
writePng('icon-512.png', 512, { fullBleed: false, plusFrac: 0.34 });
writePng('icon-192.png', 192, { fullBleed: false, plusFrac: 0.34 });
writePng('icon-384.png', 384, { fullBleed: false, plusFrac: 0.34 });
writePng('icon-256.png', 256, { fullBleed: false, plusFrac: 0.34 });
writePng('icon-144.png', 144, { fullBleed: false, plusFrac: 0.34 });

// Apple touch icon: full-bleed opaco (iOS redondea solo, no quiere transparencia)
writePng('apple-touch-icon.png', 180, { fullBleed: true, plusFrac: 0.32 });
writePng('apple-touch-icon-167.png', 167, { fullBleed: true, plusFrac: 0.32 });
writePng('apple-touch-icon-152.png', 152, { fullBleed: true, plusFrac: 0.32 });

// Favicons PNG + ICO
const fav32 = writePng('favicon-32.png', 32, { fullBleed: false, plusFrac: 0.34 });
const fav16 = writePng('favicon-16.png', 16, { fullBleed: false, plusFrac: 0.36 });
fs.writeFileSync(path.join(OUT, 'favicon.ico'),
  buildIco([{ size: 32, png: fav32 }, { size: 16, png: fav16 }]));

// SVG vectorial
fs.writeFileSync(path.join(OUT, 'icon.svg'), buildSvg());

const files = fs.readdirSync(OUT).sort();
console.log('Listo:', files.join(', '));
