const express = require('express');
const router = express.Router();
const multer = require('multer');
const convert = require('heic-convert');
const { authenticate } = require('../middleware/auth');

// HEIC/HEIF (formato por defecto del iPhone) no lo decodifican los navegadores
// basados en Chromium/Firefox. Lo convertimos a JPEG en el servidor con
// heic-convert (JS puro, sin dependencias nativas) para que funcione igual en
// cualquier navegador y en producción.
//
// ── Por qué esta ruta está tan vigilada ──
// heic-convert es JavaScript puro, así que decodifica EN EL HILO PRINCIPAL. No
// hay otro: mientras dura la conversión, este proceso no atiende ni un login ni
// una cita ni un expediente. Y el coste no lo marca el peso del archivo sino el
// número de píxeles, que va aparte: un HEIC de pocos MB puede declarar una
// imagen de 30.000 × 30.000 y reventar la memoria del proceso al expandirla
// (una "bomba de imagen"). De ahí las tres defensas, en este orden:
//
//   1. Filtro de tipo    — solo entra lo que de verdad es HEIC/HEIF.
//   2. Tope de píxeles   — se leen las dimensiones DECLARADAS en la cabecera,
//                          sin decodificar nada, y se rechaza lo desproporcionado.
//   3. Una a la vez      — las conversiones se serializan y la cola tiene fondo,
//                          para que el hilo nunca quede secuestrado por una tanda.
//
// El límite por cuenta vive en server.js (middleware/rate-limits.js).

// Un HEIC de iPhone ronda 1-5 MB; los de 48 MP no llegan a 10. 20 MB deja
// margen de sobra para cualquier foto real y recorta a la mitad el peor caso.
const MAX_BYTES = 20 * 1024 * 1024;

// 60 megapíxeles. Por encima de eso no hay cámara de teléfono, solo un archivo
// hecho para que el servidor se quede sin memoria al expandirlo (60 MP en RGBA
// ya son ~240 MB de bitmap).
const MAX_PIXELES = 60_000_000;

// Conversiones simultáneas y fondo de la cola. Con 2 en vuelo el hilo alterna y
// la app sigue respondiendo; sin fondo, una tanda de subidas dejaría peticiones
// esperando su turno para siempre.
const MAX_SIMULTANEAS = 2;
const MAX_EN_COLA = 8;

const MIMES_HEIC = new Set([
  'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence',
]);

// Rechazo de tipo de archivo con un código propio. Sin él, multer entrega un
// Error pelado y el manejador global lo trata como fallo del servidor: el
// usuario veía "Internal server error" al subir un PDF donde iba una foto.
function tipoNoPermitido(mensaje) {
  const err = new Error(mensaje);
  err.code = 'INVALID_FILE_TYPE';
  return err;
}

const heicUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 4 },
  fileFilter: (req, file, cb) => {
    // Mismo criterio que usa el cliente (ortodoncia-design/views.jsx): iOS a
    // veces manda el archivo sin tipo o como octet-stream, y entonces lo único
    // que queda es la extensión.
    const tipo = String(file.mimetype || '').toLowerCase();
    const nombre = String(file.originalname || '');
    if (MIMES_HEIC.has(tipo) || /\.(heic|heif)$/i.test(nombre)) return cb(null, true);
    cb(tipoNoPermitido('Este endpoint solo convierte imágenes HEIC/HEIF.'));
  },
});

/**
 * Lee el tamaño declarado en la cabecera del contenedor sin decodificar píxeles.
 *
 * En ISOBMFF (el contenedor de HEIC) las dimensiones viven en la caja `ispe`:
 *   [tamaño u32]['ispe'][versión u8][flags u24][ancho u32][alto u32]
 * Puede haber varias (la miniatura tiene la suya), así que nos quedamos con la
 * mayor. Si no se encuentra ninguna devolvemos null y dejamos que decida el
 * decodificador: preferimos no rechazar un archivo legítimo por no entender su
 * cabecera.
 */
function pixelesDeclarados(buffer) {
  let mayor = 0;
  let i = 0;
  // Las cajas de metadatos van al principio; no hace falta recorrer el archivo
  // entero (ni conviene: son megabytes de datos comprimidos).
  const hasta = Math.min(buffer.length - 16, 512 * 1024);
  while (i >= 0 && i < hasta) {
    i = buffer.indexOf('ispe', i, 'ascii');
    if (i < 0 || i + 16 > buffer.length) break;
    const ancho = buffer.readUInt32BE(i + 8);
    const alto = buffer.readUInt32BE(i + 12);
    // Descarta coincidencias casuales de las letras dentro de datos binarios.
    if (ancho > 0 && alto > 0 && ancho < 100_000 && alto < 100_000) {
      mayor = Math.max(mayor, ancho * alto);
    }
    i += 4;
  }
  return mayor > 0 ? mayor : null;
}

// ── Cola de conversiones ──
let enVuelo = 0;
const esperando = [];

function turno() {
  return new Promise((resolve, reject) => {
    if (enVuelo < MAX_SIMULTANEAS) {
      enVuelo++;
      return resolve();
    }
    if (esperando.length >= MAX_EN_COLA) {
      const e = new Error('cola_llena');
      e.colaLlena = true;
      return reject(e);
    }
    esperando.push(resolve);
  });
}

function liberar() {
  const siguiente = esperando.shift();
  if (siguiente) return siguiente();
  enVuelo--;
}

router.post('/heic-to-jpeg', authenticate, heicUpload.single('file'), async (req, res) => {
  if (!req.file || !req.file.buffer || !req.file.buffer.length) {
    return res.status(400).json({ error: 'No se recibió ningún archivo' });
  }

  const pixeles = pixelesDeclarados(req.file.buffer);
  if (pixeles && pixeles > MAX_PIXELES) {
    return res.status(413).json({
      error: 'La imagen es demasiado grande para convertirla. Redúcela e intenta de nuevo.',
      code: 'image_too_large',
    });
  }

  try {
    await turno();
  } catch (e) {
    if (e && e.colaLlena) {
      return res.status(503).json({
        error: 'Hay demasiadas imágenes convirtiéndose ahora mismo. Intenta de nuevo en unos segundos.',
        code: 'busy',
      });
    }
    throw e;
  }

  try {
    const jpeg = await convert({ buffer: req.file.buffer, format: 'JPEG', quality: 0.92 });
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'no-store');
    return res.send(Buffer.from(jpeg));
  } catch (e) {
    console.error('[media/heic-to-jpeg] conversion failed:', e && e.message);
    return res.status(422).json({ error: 'No se pudo convertir la imagen HEIC' });
  } finally {
    liberar();
  }
});

// El router es la exportación principal (así lo monta server.js). Los ayudantes
// van colgados de él para poder probarlos sin levantar el servidor.
module.exports = router;
module.exports.pixelesDeclarados = pixelesDeclarados;
module.exports.MAX_PIXELES = MAX_PIXELES;
module.exports.MAX_BYTES = MAX_BYTES;
