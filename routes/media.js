const express = require('express');
const router = express.Router();
const multer = require('multer');
const convert = require('heic-convert');
const { authenticate } = require('../middleware/auth');

// HEIC/HEIF (formato por defecto del iPhone) no lo decodifican los navegadores
// basados en Chromium/Firefox. Lo convertimos a JPEG en el servidor con
// heic-convert (JS puro, sin dependencias nativas) para que funcione igual en
// cualquier navegador y en producción.
const heicUpload = multer({
  storage: multer.memoryStorage(),
  // Las fotos HEIC de iPhone rondan 1-5 MB; dejamos margen amplio.
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post('/heic-to-jpeg', authenticate, heicUpload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer || !req.file.buffer.length) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }
    const jpeg = await convert({ buffer: req.file.buffer, format: 'JPEG', quality: 0.92 });
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'no-store');
    return res.send(Buffer.from(jpeg));
  } catch (e) {
    console.error('[media/heic-to-jpeg] conversion failed:', e && e.message);
    return res.status(422).json({ error: 'No se pudo convertir la imagen HEIC' });
  }
});

module.exports = router;
