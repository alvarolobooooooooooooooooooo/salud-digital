// Geocoding helper para resolver lat/lng a partir de address/city via Nominatim (OSM).
// Nominatim es gratis pero la ToS exige: User-Agent identificable, máximo 1 req/s,
// nada de uso bulk masivo. Por eso usamos una cola serializada que respeta el throttle
// global del proceso. Si la cola crece mucho (>500 clínicas), evaluar self-hosted Nominatim.

const { query } = require('../db');

const USER_AGENT = 'SaludDigital/1.0 (saluddigitalhn@gmail.com)';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const REQUEST_INTERVAL_MS = 1100;
const REQUEST_TIMEOUT_MS = 8000;

let chain = Promise.resolve();
let lastCallAt = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Ejecuta `task` después de que la cola esté libre y de respetar el intervalo mínimo
// entre requests. Devuelve el resultado de `task` (o lo que sea que tire).
function enqueue(task) {
  const run = async () => {
    const wait = REQUEST_INTERVAL_MS - (Date.now() - lastCallAt);
    if (wait > 0) await sleep(wait);
    try {
      return await task();
    } finally {
      lastCallAt = Date.now();
    }
  };
  // Encadenamos sin propagar errores al siguiente eslabón (cada caller maneja los suyos).
  const next = chain.then(run, run);
  chain = next.catch(() => {});
  return next;
}

async function geocodeAddress({ address = '', city = '', country = 'Honduras' } = {}) {
  const parts = [address, city, country].map(s => String(s || '').trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const q = parts.join(', ');

  return enqueue(async () => {
    const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=hn&q=${encodeURIComponent(q)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
        signal: ctrl.signal,
      });
      if (!res.ok) {
        console.warn('[geocode] HTTP', res.status, 'for', q);
        return null;
      }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    } catch (err) {
      console.warn('[geocode] error for', q, err && err.message ? err.message : err);
      return null;
    } finally {
      clearTimeout(timer);
    }
  });
}

// Busca varias coincidencias para un texto libre y devuelve candidatos con etiqueta
// legible. Alimenta el buscador del selector de mapa (Configuración › Ubicación y
// el paso de ubicación del alta). Pasa por la MISMA cola que geocodeAddress, así
// que un usuario tecleando no revienta el límite de 1 req/s de Nominatim.
async function searchAddress(text, limit = 6) {
  const q = String(text || '').trim();
  if (q.length < 3) return [];
  const max = Math.min(Math.max(parseInt(limit, 10) || 6, 1), 10);

  return enqueue(async () => {
    const url = `${NOMINATIM_URL}?format=jsonv2&addressdetails=1&limit=${max}` +
      `&countrycodes=hn&q=${encodeURIComponent(q)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
        signal: ctrl.signal,
      });
      if (!res.ok) {
        console.warn('[geocode-search] HTTP', res.status, 'for', q);
        return [];
      }
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .map(r => ({
          label: String(r.display_name || '').slice(0, 220),
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
        }))
        .filter(r => r.label && Number.isFinite(r.lat) && Number.isFinite(r.lng));
    } catch (err) {
      console.warn('[geocode-search] error for', q, err && err.message ? err.message : err);
      return [];
    } finally {
      clearTimeout(timer);
    }
  });
}

// Geocodifica y persiste el resultado en clinics. Stampea geocoded_at=NOW() incluso
// si falla, para que `backfillMissing` no reintente cada vez (la próxima vez que el
// admin edite la dirección, el PUT en routes/clinics.js limpia geocoded_at y se vuelve
// a intentar).
// El WHERE excluye location_source='manual': si alguien marcó el pin a mano en el
// mapa, ese punto manda sobre lo que adivine Nominatim a partir del texto.
async function geocodeAndStore(clinicId, { address, city } = {}) {
  if (!clinicId) return null;
  const coords = await geocodeAddress({ address, city });
  try {
    if (coords) {
      await query(
        `UPDATE clinics SET latitude = $1, longitude = $2, geocoded_at = NOW(),
                            location_source = 'geocode'
          WHERE id = $3 AND COALESCE(location_source, '') <> 'manual'`,
        [coords.lat, coords.lng, clinicId]
      );
    } else {
      await query(
        "UPDATE clinics SET geocoded_at = NOW() WHERE id = $1 AND COALESCE(location_source, '') <> 'manual'",
        [clinicId]
      );
    }
  } catch (err) {
    console.warn('[geocode] db update failed for clinic', clinicId, err.message);
  }
  return coords;
}

async function backfillMissing(limit = 200) {
  let rows;
  try {
    const res = await query(
      `SELECT id, address, city FROM clinics
       WHERE latitude IS NULL
         AND geocoded_at IS NULL
         AND COALESCE(location_source, '') <> 'manual'
         AND (COALESCE(address, '') <> '' OR COALESCE(city, '') <> '')
       LIMIT $1`,
      [limit]
    );
    rows = res.rows;
  } catch (err) {
    console.warn('[geocode-backfill] select failed', err.message);
    return;
  }
  if (!rows.length) return;
  console.log(`[geocode-backfill] geocoding ${rows.length} clinic(s)`);
  for (const r of rows) {
    await geocodeAndStore(r.id, { address: r.address, city: r.city });
  }
}

module.exports = { geocodeAddress, searchAddress, geocodeAndStore, backfillMissing };
