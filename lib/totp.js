const crypto = require('crypto');

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0, value = 0, output = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(str) {
  const cleaned = String(str).replace(/=+$/, '').toUpperCase().replace(/\s+/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32.indexOf(cleaned[i]);
    if (idx === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function totp(secret, timestamp = Math.floor(Date.now() / 1000), step = 30, digits = 6) {
  const counter = Math.floor(timestamp / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const key = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24)
             | ((hmac[offset + 1] & 0xff) << 16)
             | ((hmac[offset + 2] & 0xff) << 8)
             | (hmac[offset + 3] & 0xff);
  return String(code % (10 ** digits)).padStart(digits, '0');
}

function verifyTotp(token, secret, window = 1) {
  if (!token || !secret) return false;
  const cleaned = String(token).replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;
  const now = Math.floor(Date.now() / 1000);
  for (let i = -window; i <= window; i++) {
    try {
      if (totp(secret, now + i * 30) === cleaned) return true;
    } catch { return false; }
  }
  return false;
}

function otpauthUrl({ secret, label, issuer }) {
  const enc = encodeURIComponent;
  const fullLabel = issuer ? `${enc(issuer)}:${enc(label)}` : enc(label);
  const params = new URLSearchParams({
    secret,
    issuer: issuer || '',
    algorithm: 'SHA1',
    digits: '6',
    period: '30'
  });
  return `otpauth://totp/${fullLabel}?${params.toString()}`;
}

module.exports = { generateSecret, totp, verifyTotp, otpauthUrl };
