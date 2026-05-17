const crypto = require('crypto');

// Cifrado simétrico para columnas sensibles (secretos TOTP, firmas de pacientes, etc.).
// Formato del blob: "v1:<iv_b64>:<tag_b64>:<ct_b64>". El prefijo de versión permite
// rotar el algoritmo en el futuro sin migración masiva inmediata.
const PREFIX = 'v1:';
const ALGO = 'aes-256-gcm';

function getKey() {
  const raw = process.env.SECRET_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('SECRET_ENCRYPTION_KEY no configurado. Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error('SECRET_ENCRYPTION_KEY debe decodificarse a 32 bytes (256 bits) en base64.');
  }
  return buf;
}

// Cifra un string. Si el valor ya viene cifrado (prefijo v1:) lo devuelve tal cual
// para que llamadas idempotentes no creen capas de cifrado anidadas.
function encrypt(plaintext) {
  if (plaintext == null) return null;
  const str = String(plaintext);
  if (str.startsWith(PREFIX)) return str;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + iv.toString('base64') + ':' + tag.toString('base64') + ':' + ct.toString('base64');
}

// Descifra un blob. Si el valor no tiene prefijo v1: se considera "legacy plaintext"
// y se devuelve sin cambios — esto permite leer secretos previos a la migración
// mientras los reescribimos al cifrado real durante el próximo write.
function decrypt(blob) {
  if (blob == null) return null;
  const str = String(blob);
  if (!str.startsWith(PREFIX)) return str; // plaintext heredado
  try {
    const [, ivB, tagB, ctB] = str.split(':');
    const key = getKey();
    const iv = Buffer.from(ivB, 'base64');
    const tag = Buffer.from(tagB, 'base64');
    const ct = Buffer.from(ctB, 'base64');
    const dec = crypto.createDecipheriv(ALGO, key, iv);
    dec.setAuthTag(tag);
    const pt = Buffer.concat([dec.update(ct), dec.final()]);
    return pt.toString('utf8');
  } catch (err) {
    throw new Error('No se pudo descifrar el secreto (¿clave SECRET_ENCRYPTION_KEY cambiada?).');
  }
}

function isAvailable() {
  return Boolean(process.env.SECRET_ENCRYPTION_KEY);
}

module.exports = { encrypt, decrypt, isAvailable };
