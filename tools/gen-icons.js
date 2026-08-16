#!/usr/bin/env node
/*
 * gen-icons.js — Genera los iconos de la PWA "Salud Digital" a partir del LOGO
 * OFICIAL en mapa de bits: tools/logo-master.png (el icono cuadrado 1254² que
 * entregó el cliente: cruz azul/marino sobre squircle blanco). Usa `sips`
 * (nativo de macOS) para redimensionar — sin dependencias externas.
 *
 * Re-ejecutar tras cambiar el master:  node tools/gen-icons.js
 *
 * Se RECORTA la cruz del master (sips -c) para quitar el squircle + sombra (ese
 * "borde de botón" no debe salir). Luego:
 *  • Iconos de app (home screen / PWA / apple-touch / maskable): la cruz se
 *    aplana sobre el NEGRO de la interfaz (#0a0a0c) con margen alrededor, para
 *    que el icono sea el mismo logo oscuro que se ve al entrar a la plataforma.
 *  • favicon: la cruz llena el marco (la pestaña ya aporta el margen).
 *  • logo-mark.png (marca dentro de la UI): se genera aparte, RECORTADA a la
 *    cruz y con FONDO TRANSPARENTE (ver buildUiMark). Dentro de la app la marca
 *    se apoya sobre sidebar oscuro/claro: un PNG opaco se vería como un recorte
 *    blanco pegado encima.
 *
 * El master es opaco (sin alfa) y de fondo blanco, así que iOS no muestra
 * esquinas negras y no hace falta aplanar transparencias en los iconos de app.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const OUT = path.join(__dirname, '..', 'public', 'icons');
const MASTER = path.join(__dirname, 'logo-master.png');
const TIGHT_CROP = 780;  // recorte central de la cruz dentro del master 1254² (favicons)
fs.mkdirSync(OUT, { recursive: true });

if (!fs.existsSync(MASTER)) {
  console.error('Falta el master:', MASTER);
  process.exit(1);
}

function sips(args) { execFileSync('sips', args, { stdio: 'ignore' }); }

// Redimensiona `src` a size×size en OUT/name; devuelve el buffer PNG resultante.
function emit(src, name, size) {
  const out = path.join(OUT, name);
  sips(['-s', 'format', 'png', '-z', String(size), String(size), src, '--out', out]);
  return fs.readFileSync(out);
}

// favicon.ico = contenedor que envuelve PNGs (un directorio + los PNG crudos).
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
    dir.writeUInt32LE(e.png.length, b + 8);    // tamaño del PNG
    dir.writeUInt32LE(offset, b + 12);         // offset
    offset += e.png.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

/* ── PNG puro (sin dependencias) para la marca de UI ──────────────────────
   sips no sabe recortar el fondo blanco del master, así que la marca con alfa
   se cocina aquí: decodificar → separar la cruz del blanco → recortar a la
   cruz → reescalar → volver a codificar en RGBA. */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

// Decodifica un PNG de 8 bits RGB/RGBA (lo que emite sips) a {w, h, bpp, data}.
function decodePng(file) {
  const buf = fs.readFileSync(file);
  let pos = 8, w = 0, h = 0, depth = 0, ctype = 0;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'IHDR') {
      w = buf.readUInt32BE(pos + 8);
      h = buf.readUInt32BE(pos + 12);
      depth = buf[pos + 16];
      ctype = buf[pos + 17];
      if (buf[pos + 20] !== 0) throw new Error('PNG entrelazado no soportado');
    } else if (type === 'IDAT') {
      idat.push(buf.subarray(pos + 8, pos + 8 + len));
    }
    pos += 12 + len;
  }
  if (depth !== 8 || (ctype !== 2 && ctype !== 6)) {
    throw new Error(`PNG no soportado (depth ${depth}, color type ${ctype})`);
  }
  const bpp = ctype === 2 ? 3 : 4;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const data = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const row = y * stride;
    const prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[p + x];
      const a = x >= bpp ? data[row + x - bpp] : 0;
      const b = y > 0 ? data[prev + x] : 0;
      const c = x >= bpp && y > 0 ? data[prev + x - bpp] : 0;
      let out;
      if (filter === 0) out = v;
      else if (filter === 1) out = v + a;
      else if (filter === 2) out = v + b;
      else if (filter === 3) out = v + ((a + b) >> 1);
      else if (filter === 4) {
        const pr = a + b - c;
        const pa = Math.abs(pr - a), pb = Math.abs(pr - b), pc = Math.abs(pr - c);
        out = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw new Error('Filtro PNG desconocido: ' + filter);
      data[row + x] = out & 0xff;
    }
    p += stride;
  }
  return { w, h, bpp, data };
}

function encodePng(w, h, rgba) {
  const chunk = (type, payload) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), payload]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crc]);
  };
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filtro None: el deflate ya comprime bien planos
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* Marca de UI: cruz sobre fondo transparente, centrada y cuadrada.
 *
 * El master pinta la cruz OPACA sobre blanco, así que cada píxel es
 * C = α·F + (1-α)·255. Como la cruz es muy saturada (cian y marino tienen un
 * canal casi a 0) se usa "cuánto se aleja del blanco" como medida de α:
 * los píxeles llenos quedan α=255, los del antialias se despegan del blanco
 * recuperando el color sólido vecino — sin halo blanco sobre fondo oscuro.
 *
 * Con `bg` (terna RGB) el resultado sale OPACO: la cruz se aplana sobre ese
 * color en vez de quedar transparente. Es lo que usan los iconos de app, que en
 * iOS no pueden llevar alfa (las zonas transparentes salen negras). */
function buildUiMark(src, dest, size, padRatio = 0.06, bg = null) {
  const { w, h, bpp, data } = decodePng(src);
  const at = (x, y) => (y * w + x) * bpp;
  const contrast = (x, y) => {
    const i = at(x, y);
    return 255 - Math.min(data[i], data[i + 1], data[i + 2]);
  };
  const SOLID = 170; // por encima → píxel lleno de tinta (cian ≈237, marino ≈251)
  const PAPER = 14;  // por debajo → fondo blanco del master (tiene un leve degradado)

  // 1) Caja de la cruz a partir de los píxeles llenos (la sombra del squircle
  //    es gris clarísimo y no llega a SOLID, así que no ensancha la caja).
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (contrast(x, y) >= SOLID) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error('No se encontró la cruz en el master');

  // 2) Marco cuadrado centrado en la cruz + un poco de aire.
  const side = Math.max(x1 - x0, y1 - y0) + 1;
  const box = Math.round(side * (1 + padRatio * 2));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const left = cx - box / 2, top = cy - box / 2;

  // 3) Muestreo por área (box filter) sobre color premultiplicado: reescalar
  //    con el color ya multiplicado por alfa es lo que evita bordes sucios.
  const scale = box / size;
  const rgba = Buffer.alloc(size * size * 4);
  for (let oy = 0; oy < size; oy++) {
    const sy0 = Math.floor(top + oy * scale), sy1 = Math.floor(top + (oy + 1) * scale);
    for (let ox = 0; ox < size; ox++) {
      const sx0 = Math.floor(left + ox * scale), sx1 = Math.floor(left + (ox + 1) * scale);
      let ar = 0, ag = 0, ab = 0, aa = 0, n = 0;
      for (let sy = sy0; sy <= sy1; sy++) {
        for (let sx = sx0; sx <= sx1; sx++) {
          n++;
          if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue; // fuera → transparente
          const k = contrast(sx, sy);
          if (k <= PAPER) continue;                              // papel blanco → nada
          const i = at(sx, sy);
          let r = data[i], g = data[i + 1], b = data[i + 2], alpha = 1;
          if (k < SOLID) {
            // Borde antialiasado: recupera el color lleno más cercano y deduce α.
            let ref = -1;
            for (let rad = 1; rad <= 4 && ref < 0; rad++) {
              for (let dy = -rad; dy <= rad && ref < 0; dy++) {
                for (let dx = -rad; dx <= rad && ref < 0; dx++) {
                  const nx = sx + dx, ny = sy + dy;
                  if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                  if (contrast(nx, ny) >= SOLID) ref = at(nx, ny);
                }
              }
            }
            if (ref >= 0) {
              const refK = 255 - Math.min(data[ref], data[ref + 1], data[ref + 2]);
              alpha = Math.min(1, k / refK);
              r = data[ref]; g = data[ref + 1]; b = data[ref + 2];
            } else {
              alpha = k / 255; // sin referencia cerca: sombra suelta, casi invisible
            }
          }
          ar += r * alpha; ag += g * alpha; ab += b * alpha; aa += alpha;
        }
      }
      const o = (oy * size + ox) * 4;
      let r = 0, g = 0, b = 0, a = 0;
      if (aa > 0) {
        r = ar / aa;                          // color sin premultiplicar
        g = ag / aa;
        b = ab / aa;
        a = aa / n;
      }
      if (bg) {
        // Aplanado sobre el fondo: el borde antialiasado se funde con él en vez
        // de arrastrar el blanco del master.
        rgba[o] = Math.round(r * a + bg[0] * (1 - a));
        rgba[o + 1] = Math.round(g * a + bg[1] * (1 - a));
        rgba[o + 2] = Math.round(b * a + bg[2] * (1 - a));
        rgba[o + 3] = 255;
      } else if (aa > 0) {
        rgba[o] = Math.round(r);
        rgba[o + 1] = Math.round(g);
        rgba[o + 2] = Math.round(b);
        rgba[o + 3] = Math.round(a * 255);
      }
    }
  }
  fs.writeFileSync(dest, encodePng(size, size, rgba));
  return dest;
}

console.log('Generando iconos desde', MASTER);

// 1) Recorte central a la cruz: quita el squircle + sombra del master (el
//    "borde de botón"). La cruz queda a sangre sobre blanco.
const CLEAN = path.join(os.tmpdir(), 'sd-logo-clean.png');
sips(['-c', String(TIGHT_CROP), String(TIGHT_CROP), MASTER, '--out', CLEAN]);

// 2) Maestro de los iconos de app: la MISMA cruz que se ve dentro de la
//    plataforma, aplanada sobre el negro de la app en vez de sobre blanco. Antes
//    se re-enmarcaba el recorte con `sips -p --padColor FFFFFF`, pero eso solo
//    añade margen: el fondo blanco venía dentro del propio master, así que la
//    baldosa salía blanca sí o sí.
//    padRatio 1/3 deja la cruz ≈60% del marco, el aire que tienen las demás apps
//    del iPhone y dentro de la zona segura del recorte maskable de Android.
const APP_BG = [10, 10, 12]; // #0a0a0c, el negro de la interfaz oscura
const APP_MASTER = path.join(os.tmpdir(), 'sd-app-icon.png');
buildUiMark(MASTER, APP_MASTER, 1024, 1 / 3, APP_BG);

// Iconos de app (home screen iOS / PWA / apple-touch / maskable): opacos.
const appIcons = [
  ['icon-144.png', 144], ['icon-192.png', 192], ['icon-256.png', 256],
  ['icon-384.png', 384], ['icon-512.png', 512],
  ['maskable-192.png', 192], ['maskable-512.png', 512],
  ['apple-touch-icon.png', 180], ['apple-touch-icon-167.png', 167], ['apple-touch-icon-152.png', 152],
];
for (const [n, s] of appIcons) emit(APP_MASTER, n, s);

// Marca dentro de la app: cruz completa (sin recortar por el marco), fondo
// TRANSPARENTE y 512² para que se vea nítida en pantallas @2x/@3x aunque se
// pinte a 28-46 px. Va sobre el sidebar (claro u oscuro), no sobre blanco.
buildUiMark(MASTER, path.join(OUT, 'logo-mark.png'), 512);

// Favicons: la cruz llena el marco (la pestaña ya aporta el margen).
const fav32 = emit(CLEAN, 'favicon-32.png', 32);
const fav16 = emit(CLEAN, 'favicon-16.png', 16);
fs.writeFileSync(path.join(OUT, 'favicon.ico'),
  buildIco([{ size: 32, png: fav32 }, { size: 16, png: fav16 }]));

console.log('Listo:', fs.readdirSync(OUT).sort().join(', '));
