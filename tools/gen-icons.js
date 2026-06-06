#!/usr/bin/env node
/*
 * gen-icons.js — Genera los iconos de la PWA "Salud Digital" a partir del LOGO
 * OFICIAL en mapa de bits: tools/logo-master.png (el icono cuadrado 1254² que
 * entregó el cliente: cruz azul/marino sobre squircle blanco). Usa `sips`
 * (nativo de macOS) para redimensionar — sin dependencias externas.
 *
 * Re-ejecutar tras cambiar el master:  node tools/gen-icons.js
 *
 *  • Iconos de app (home screen iOS / PWA / apple-touch / maskable): master
 *    COMPLETO, con el margen del diseño tal cual se entregó.
 *  • favicon + logo-mark (UI: sidebar / login / mapa): recorte AJUSTADO a la
 *    cruz, para que se lea bien en tamaños pequeños.
 *
 * El master es opaco (sin alfa) y de fondo blanco, así que iOS no muestra
 * esquinas negras y no hace falta aplanar transparencias.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const OUT = path.join(__dirname, '..', 'public', 'icons');
const MASTER = path.join(__dirname, 'logo-master.png');
const TIGHT_CROP = 780; // recorte central de la cruz dentro del master 1254²
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

console.log('Generando iconos desde', MASTER);

// ── Iconos de app: master completo (con el margen del diseño) ──
const padded = [
  ['icon-144.png', 144], ['icon-192.png', 192], ['icon-256.png', 256],
  ['icon-384.png', 384], ['icon-512.png', 512],
  ['maskable-192.png', 192], ['maskable-512.png', 512],
  ['apple-touch-icon.png', 180], ['apple-touch-icon-167.png', 167], ['apple-touch-icon-152.png', 152],
];
for (const [n, s] of padded) emit(MASTER, n, s);

// ── Recorte ajustado a la cruz para UI + favicons ──
const TIGHT = path.join(os.tmpdir(), 'sd-logo-tight.png');
sips(['-c', String(TIGHT_CROP), String(TIGHT_CROP), MASTER, '--out', TIGHT]);
emit(TIGHT, 'logo-mark.png', 256);          // usado en sidebar / login / mapa
const fav32 = emit(TIGHT, 'favicon-32.png', 32);
const fav16 = emit(TIGHT, 'favicon-16.png', 16);
fs.writeFileSync(path.join(OUT, 'favicon.ico'),
  buildIco([{ size: 32, png: fav32 }, { size: 16, png: fav16 }]));

console.log('Listo:', fs.readdirSync(OUT).sort().join(', '));
