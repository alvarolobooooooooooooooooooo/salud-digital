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

// ── Paleta del logo oficial "Salud Digital" ──
// La marca es una cruz "molinillo" de 4 cápsulas: 3 azul medio (azure) + 1 azul
// marino (el brazo izquierdo / oeste), sobre un tile claro casi blanco.
const AZURE    = [0x1c, 0x8e, 0xc9]; // azul medio de los 3 brazos
const NAVY     = [0x0e, 0x2c, 0x57]; // azul marino del brazo izquierdo + wordmark
const TILE_TOP = [0xff, 0xff, 0xff]; // fondo del icono (blanco → gris muy claro)
const TILE_BOT = [0xee, 0xf2, 0xf7];
const WHITE    = [0xff, 0xff, 0xff];

// Hex helper para los SVG vectoriales
const hex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

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
 * Geometría compartida de la cruz "molinillo": una cápsula base que apunta al
 * norte (desfasada en +x) y se rota 90° cuatro veces. El brazo oeste (k=3) es
 * marino; el resto azul medio. Devuelve el color [r,g,b] del brazo que cubre el
 * punto local (lx,ly) dentro de una caja de marca de lado M, o null.
 */
function markColorAt(lx, ly, M) {
  const c = M / 2;
  const HALF = 0.155 * M;  // medio-grosor de cápsula
  const OFF  = 0.035 * M;  // desfase molinillo sutil (perpendicular al brazo)
  const bx = c - HALF + OFF, by = 0.065 * M; // origen de la cápsula base (norte)
  const bw = HALF * 2, bh = 0.45 * M, rr = HALF;
  const dx = lx - c, dy = ly - c;
  for (let k = 0; k < 4; k++) {
    // rotar el punto -k*90° alrededor del centro (inversa del brazo = base+k*90°)
    let rx, ry;
    if (k === 0)      { rx = c + dx; ry = c + dy; }
    else if (k === 1) { rx = c + dy; ry = c - dx; }
    else if (k === 2) { rx = c - dx; ry = c - dy; }
    else              { rx = c - dy; ry = c + dx; }
    if (inRoundRect(rx, ry, bx, by, bw, bh, rr)) return k === 3 ? NAVY : AZURE;
  }
  return null;
}

/*
 * Renderiza un icono de marca a `size` px.
 *   fullBleed=true  → tile claro cubre todo el lienzo (maskable / apple, opaco).
 *   fullBleed=false → squircle de esquinas transparentes (any / favicon).
 *   markScale       → lado de la marca como fracción del lienzo (zona segura).
 */
function renderIcon(size, { fullBleed, markScale }) {
  const big = size * SS;
  const buf = new Uint8Array(big * big * 4); // transparente
  const bgRadius = fullBleed ? 0 : Math.round(big * 0.225); // squircle aprox
  const M = big * markScale;          // lado de la caja de la marca
  const m0 = (big - M) / 2;           // origen (centrada)

  for (let y = 0; y < big; y++) {
    const t = y / (big - 1);
    const tr = Math.round(TILE_TOP[0] + (TILE_BOT[0] - TILE_TOP[0]) * t);
    const tg = Math.round(TILE_TOP[1] + (TILE_BOT[1] - TILE_TOP[1]) * t);
    const tb = Math.round(TILE_TOP[2] + (TILE_BOT[2] - TILE_TOP[2]) * t);
    for (let x = 0; x < big; x++) {
      const inBg = fullBleed
        ? true
        : inRoundRect(x, y, 0, 0, big, big, bgRadius);
      if (!inBg) continue;
      const i = (y * big + x) * 4;
      let R = tr, G = tg, B = tb; // tile claro de fondo (los huecos quedan blancos)
      const col = markColorAt(x - m0, y - m0, M);
      if (col) { R = col[0]; G = col[1]; B = col[2]; }
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
// Grupo de la cruz "molinillo" en coordenadas locales 0..100 (centro 50,50).
// Cápsula base norte (HALF=15, OFF=8.5) rotada 90°×4; oeste (rotate 270) marino.
function crossGroup() {
  const a = hex(AZURE), n = hex(NAVY);
  const cap = (fill, rot) =>
    `<rect x="38.5" y="6.5" width="31" height="45" rx="15.5" ry="15.5" fill="${fill}"${rot ? ` transform="rotate(${rot} 50 50)"` : ''}/>`;
  return `<g>${cap(a, 0)}${cap(a, 90)}${cap(a, 180)}${cap(n, 270)}</g>`;
}

// Marca sola, fondo transparente (uso en UI dentro de un chip claro).
function buildMarkSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" role="img" aria-label="Salud Digital">
  ${crossGroup()}
</svg>
`;
}

// Icono "any" del manifest: tile claro squircle + cruz centrada (markScale 0.72).
function buildSvg() {
  const top = hex(TILE_TOP), bot = hex(TILE_BOT);
  const M = 512 * 0.72, m0 = (512 - M) / 2, s = M / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Salud Digital">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/>
      <stop offset="1" stop-color="${bot}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="115" ry="115" fill="url(#tile)"/>
  <g transform="translate(${m0.toFixed(2)} ${m0.toFixed(2)}) scale(${s.toFixed(4)})">${crossGroup()}</g>
</svg>
`;
}

// Lockup horizontal: marca + wordmark "Salud Digital" + divisor + tagline.
// Texto en vivo con una pila de fuentes redondeada (Poppins → system-ui).
function buildLockupSvg() {
  const n = hex(NAVY), gray = '#6e747c';
  const FONT = "'Poppins','Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 150" role="img" aria-label="Salud Digital — Tecnología que conecta salud y personas">
  <g transform="translate(10 27) scale(0.96)">${crossGroup()}</g>
  <g font-family="${FONT}" fill="${n}" font-weight="800" font-size="46" letter-spacing="-1">
    <text x="128" y="68">Salud</text>
    <text x="128" y="118">Digital</text>
  </g>
  <line x1="320" y1="38" x2="320" y2="112" stroke="${n}" stroke-width="3" stroke-linecap="round"/>
  <g font-family="${FONT}" fill="${gray}" font-weight="500" font-size="25">
    <text x="344" y="56">Tecnología que</text>
    <text x="344" y="88">conecta salud</text>
    <text x="344" y="120">y personas</text>
  </g>
</svg>
`;
}

// ───────────────────────── Generar todo ─────────────────────────
console.log('Generando iconos en', OUT);

// Maskable (full-bleed opaco; marca dentro de la zona segura ~80%)
writePng('maskable-512.png', 512, { fullBleed: true, markScale: 0.58 });
writePng('maskable-192.png', 192, { fullBleed: true, markScale: 0.58 });

// "any" (squircle, esquinas transparentes, marca más grande)
writePng('icon-512.png', 512, { fullBleed: false, markScale: 0.72 });
writePng('icon-192.png', 192, { fullBleed: false, markScale: 0.72 });
writePng('icon-384.png', 384, { fullBleed: false, markScale: 0.72 });
writePng('icon-256.png', 256, { fullBleed: false, markScale: 0.72 });
writePng('icon-144.png', 144, { fullBleed: false, markScale: 0.72 });

// Apple touch icon: full-bleed opaco (iOS redondea solo, no quiere transparencia)
writePng('apple-touch-icon.png', 180, { fullBleed: true, markScale: 0.64 });
writePng('apple-touch-icon-167.png', 167, { fullBleed: true, markScale: 0.64 });
writePng('apple-touch-icon-152.png', 152, { fullBleed: true, markScale: 0.64 });

// Favicons PNG + ICO (marca grande para legibilidad en miniatura)
const fav32 = writePng('favicon-32.png', 32, { fullBleed: false, markScale: 0.82 });
const fav16 = writePng('favicon-16.png', 16, { fullBleed: false, markScale: 0.86 });
fs.writeFileSync(path.join(OUT, 'favicon.ico'),
  buildIco([{ size: 32, png: fav32 }, { size: 16, png: fav16 }]));

// SVG vectoriales
fs.writeFileSync(path.join(OUT, 'icon.svg'), buildSvg());
fs.writeFileSync(path.join(OUT, 'logo-mark.svg'), buildMarkSvg());
fs.writeFileSync(path.join(OUT, 'logo-lockup.svg'), buildLockupSvg());

const files = fs.readdirSync(OUT).sort();
console.log('Listo:', files.join(', '));
