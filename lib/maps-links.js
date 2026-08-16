// Utilidades para trabajar con enlaces de Google Maps.
//
// El caso real: el doctor abre Google Maps en el teléfono, pone el pin sobre su
// consultorio y comparte el enlace. Ese enlace casi siempre es un acortador
// (maps.app.goo.gl/…) que no lleva coordenadas visibles, así que hay que seguir
// la redirección desde el servidor — el navegador no puede por CORS.
//
// SSRF: `resolveMapsShortLink` solo acepta hosts de Google y no sigue redirecciones
// automáticamente (redirect: 'manual'); va saltando a mano y revalidando el host en
// cada salto, con un tope de saltos. Nunca se devuelve el cuerpo de la respuesta al
// cliente, solo las coordenadas extraídas de la URL final.

const ALLOWED_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'g.co',
  'maps.google.com',
  'www.google.com',
  'google.com',
  'maps.googleapis.com',
]);

const MAX_REDIRECTS = 5;
const RESOLVE_TIMEOUT_MS = 6000;

function isValidLatLng(lat, lng) {
  const a = Number(lat);
  const b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) &&
    a >= -90 && a <= 90 && b >= -180 && b <= 180 &&
    // (0,0) es el "null island": casi siempre un valor perdido, no una clínica.
    !(a === 0 && b === 0);
}

// Extrae lat/lng de las formas de URL que produce Google Maps:
//   .../@15.5,-88.03,17z            → centro del mapa
//   ...!3d15.5!4d-88.03             → el pin real dentro de la ruta (más preciso)
//   ?q=15.5,-88.03  /  ?ll=  /  ?daddr=  /  ?destination=
//   geo:15.5,-88.03
function parseMapsUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  // Coordenadas pegadas a pelo ("15.5041, -88.0250")
  const bare = raw.match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (bare && isValidLatLng(bare[1], bare[2])) {
    return { lat: Number(bare[1]), lng: Number(bare[2]) };
  }

  const geo = raw.match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
  if (geo && isValidLatLng(geo[1], geo[2])) {
    return { lat: Number(geo[1]), lng: Number(geo[2]) };
  }

  // !3d/!4d va primero: es el pin exacto del sitio, mientras que @… es solo el
  // encuadre de la cámara y puede estar desplazado.
  const pin = raw.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pin && isValidLatLng(pin[1], pin[2])) {
    return { lat: Number(pin[1]), lng: Number(pin[2]) };
  }

  const at = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at && isValidLatLng(at[1], at[2])) {
    return { lat: Number(at[1]), lng: Number(at[2]) };
  }

  const param = raw.match(/[?&](?:q|query|ll|sll|daddr|destination|center)=(-?\d+(?:\.\d+)?)(?:,|%2C)(-?\d+(?:\.\d+)?)/i);
  if (param && isValidLatLng(param[1], param[2])) {
    return { lat: Number(param[1]), lng: Number(param[2]) };
  }

  return null;
}

function hostAllowed(urlString) {
  try {
    const u = new URL(urlString);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return ALLOWED_HOSTS.has(u.hostname.toLowerCase());
  } catch (_) {
    return false;
  }
}

// Sigue los saltos de un enlace corto de Google hasta dar con una URL que tenga
// coordenadas. Devuelve { lat, lng, url } o null.
async function resolveMapsShortLink(input) {
  let current = String(input || '').trim();
  if (!hostAllowed(current)) return null;

  // Puede que el enlace ya traiga coordenadas y no haga falta salir a la red.
  const direct = parseMapsUrl(current);
  if (direct) return { ...direct, url: current };

  for (let i = 0; i < MAX_REDIRECTS; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), RESOLVE_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        signal: ctrl.signal,
        headers: {
          // Sin User-Agent de navegador, el acortador devuelve un interstitial
          // sin la URL final.
          'User-Agent': 'Mozilla/5.0 (compatible; SaludDigital/1.0; +https://saluddigital.hn)',
          'Accept': 'text/html',
        },
      });
    } catch (err) {
      return null;
    } finally {
      clearTimeout(timer);
    }

    const location = res.headers.get('location');
    if (!location) {
      // Sin redirección: intentamos leer coordenadas de la URL a la que llegamos.
      return parseMapsUrl(current) ? { ...parseMapsUrl(current), url: current } : null;
    }

    let next;
    try {
      next = new URL(location, current).toString();
    } catch (_) {
      return null;
    }
    if (!hostAllowed(next)) return null;

    const coords = parseMapsUrl(next);
    if (coords) return { ...coords, url: next };
    current = next;
  }
  return null;
}

module.exports = { parseMapsUrl, resolveMapsShortLink, isValidLatLng, hostAllowed };
