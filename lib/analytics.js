// ── Visitas a las páginas públicas ──
//
// La plataforma no carga ningún analytics de terceros: el mismo dominio sirve
// historia clínica, y un script externo en la landing comparte cookies, CSP y
// reputación con las pantallas donde vive el expediente. Así que el conteo se
// hace aquí, contra nuestra propia base, con lo mínimo imprescindible.
//
// Qué se guarda por visita: la página, el referente (solo el dominio), si venía
// de móvil o de escritorio, y un hash. Qué NO se guarda: la IP, el user-agent
// completo, ni nada que identifique a la persona.
//
// visitor_hash = SHA-256(IP + user-agent + sal + día). La sal incluye el día,
// así que el mismo visitante da el mismo hash dentro de una jornada —lo que
// permite contar personas distintas— y uno diferente mañana. Nadie puede
// recorrer el hash hacia atrás para sacar la IP.

const crypto = require('crypto');
const { query } = require('../db');

// Páginas públicas que se miden. Cualquier otra ruta se ignora: esto cuenta
// tráfico de marketing, no navegación dentro de la aplicación.
const PAGINAS = {
  '/index.html': 'landing',
  '/registro.html': 'registro',
  '/login.html': 'login',
  '/plan.html': 'plan',
  '/mapa': 'mapa',
};

// Rastreadores, monitores de uptime y previsualizadores de enlaces. No son
// personas y meterlos en el conteo hace que la landing parezca más visitada de
// lo que está: se descartan antes de tocar la base.
const ROBOTS = /bot|crawler|crawling|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|discordbot|embedly|quora link|pinterest|redditbot|applebot|petalbot|yandex|ahrefs|semrush|mj12|dotbot|headless|phantomjs|puppeteer|playwright|lighthouse|python-requests|axios|curl|wget|go-http-client|okhttp|monitor|uptime|pingdom|statuscake|betteruptime/i;

function paginaDe(rutaHtml) {
  return PAGINAS[rutaHtml] || null;
}

function ipDe(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.ip || (req.connection && req.connection.remoteAddress) || '';
}

// Solo el dominio del referente. La URL completa puede llevar identificadores de
// campaña o términos de búsqueda, y para saber "de dónde llega la gente" basta
// con el sitio. Las visitas desde nuestro propio dominio no cuentan como
// referente: son navegación interna.
function referenteDe(req) {
  const bruto = String(req.headers.referer || req.headers.referrer || '').trim();
  if (!bruto) return '';
  try {
    const u = new URL(bruto);
    const propio = String(req.headers.host || '').toLowerCase();
    if (u.host.toLowerCase() === propio) return '';
    return u.host.toLowerCase().slice(0, 120);
  } catch {
    return '';
  }
}

function dispositivoDe(ua) {
  if (/ipad|tablet|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobi|android|iphone|ipod/i.test(ua)) return 'movil';
  return 'escritorio';
}

function hashVisitante(req, ua) {
  const dia = new Date().toISOString().slice(0, 10);
  const sal = process.env.ANALYTICS_SALT || process.env.JWT_SECRET || 'sd';
  return crypto
    .createHash('sha256')
    .update(ipDe(req) + '|' + ua + '|' + sal + '|' + dia)
    .digest('hex')
    .slice(0, 32);
}

// ¿Hay sesión abierta? Se mira la cookie en crudo porque esto corre antes de
// cookie-parser. Un usuario con sesión que pasa por la landing no es una visita
// de marketing, y contarlo inflaría el número que se mira para decidir si la
// campaña funciona.
function tieneSesion(req) {
  return /(?:^|;\s*)sd_token=/.test(String(req.headers.cookie || ''));
}

/**
 * Registra una visita. No espera al INSERT ni propaga errores: medir el tráfico
 * jamás puede retrasar —ni tumbar— la carga de una página pública.
 */
function registrarVisita(req, pagina, rutaHtml) {
  const ua = String(req.headers['user-agent'] || '');
  if (!ua || ROBOTS.test(ua)) return;
  if (tieneSesion(req)) return;

  query(
    `INSERT INTO landing_visits (page, path, referrer, visitor_hash, device)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      pagina,
      String(rutaHtml || '').slice(0, 200),
      referenteDe(req),
      hashVisitante(req, ua),
      dispositivoDe(ua),
    ],
  ).catch((err) => {
    // La tabla puede no existir todavía en un despliegue a medio migrar.
    if (!/relation "landing_visits" does not exist/i.test(err.message)) {
      console.warn('[analytics] visita no registrada:', err.message);
    }
  });
}

function enteroSeguro(valor, porDefecto, maximo) {
  const n = parseInt(valor, 10);
  if (!Number.isFinite(n) || n <= 0) return porDefecto;
  return Math.min(n, maximo);
}

/**
 * Todo lo que pinta la pestaña de Visitas del panel: los totales de siempre, la
 * serie por día para la gráfica, de dónde llega la gente y con qué dispositivo.
 *
 * "Personas" son visitantes distintos (visitor_hash únicos); "visitas" son
 * cargas de página. La diferencia entre ambos números es la que dice si la
 * gente vuelve.
 */
async function resumen(opciones = {}) {
  const dias = enteroSeguro(opciones.dias, 30, 365);

  const [totales, serie, referentes, dispositivos, porPagina] = await Promise.all([
    query(
      `SELECT
         COUNT(*) FILTER (WHERE page = 'landing')                                            AS landing_total,
         COUNT(DISTINCT visitor_hash) FILTER (WHERE page = 'landing')                        AS landing_personas,
         COUNT(*) FILTER (WHERE page = 'landing' AND created_at >= CURRENT_DATE)             AS landing_hoy,
         COUNT(*) FILTER (WHERE page = 'landing' AND created_at >= NOW() - INTERVAL '7 days')  AS landing_7d,
         COUNT(*) FILTER (WHERE page = 'landing' AND created_at >= NOW() - INTERVAL '30 days') AS landing_30d,
         COUNT(DISTINCT visitor_hash) FILTER (WHERE page = 'landing' AND created_at >= NOW() - INTERVAL '30 days') AS personas_30d,
         COUNT(*) FILTER (WHERE page = 'registro')                                           AS registro_total,
         COUNT(*) FILTER (WHERE page = 'registro' AND created_at >= NOW() - INTERVAL '30 days') AS registro_30d
       FROM landing_visits`,
    ),
    // La serie sale de generate_series y no de un GROUP BY a secas: un día sin
    // visitas debe aparecer con un cero, no desaparecer de la gráfica. Las dos
    // fechas se castean a timestamp de forma explícita para no dejar que la
    // resolución de tipos elija por nosotros entre las dos variantes de
    // generate_series (timestamp y timestamptz).
    query(
      `SELECT to_char(g.dia, 'YYYY-MM-DD')  AS dia,
              COALESCE(v.visitas, 0)::int   AS visitas,
              COALESCE(v.personas, 0)::int  AS personas
         FROM generate_series(
                (CURRENT_DATE - ($1::int - 1))::timestamp,
                CURRENT_DATE::timestamp,
                INTERVAL '1 day') AS g(dia)
         LEFT JOIN (
           SELECT created_at::date AS d,
                  COUNT(*) AS visitas,
                  COUNT(DISTINCT visitor_hash) AS personas
             FROM landing_visits
            WHERE page = 'landing' AND created_at >= CURRENT_DATE - ($1::int - 1)
            GROUP BY 1
         ) v ON v.d = g.dia::date
        ORDER BY g.dia`,
      [dias],
    ),
    query(
      `SELECT COALESCE(NULLIF(referrer, ''), 'directo') AS origen, COUNT(*)::int AS visitas
         FROM landing_visits
        WHERE page = 'landing' AND created_at >= NOW() - ($1 || ' days')::interval
        GROUP BY 1 ORDER BY visitas DESC LIMIT 8`,
      [String(dias)],
    ),
    query(
      `SELECT COALESCE(NULLIF(device, ''), 'escritorio') AS dispositivo, COUNT(*)::int AS visitas
         FROM landing_visits
        WHERE page = 'landing' AND created_at >= NOW() - ($1 || ' days')::interval
        GROUP BY 1 ORDER BY visitas DESC`,
      [String(dias)],
    ),
    query(
      `SELECT page, COUNT(*)::int AS visitas, COUNT(DISTINCT visitor_hash)::int AS personas
         FROM landing_visits
        WHERE created_at >= NOW() - ($1 || ' days')::interval
        GROUP BY 1 ORDER BY visitas DESC`,
      [String(dias)],
    ),
  ]);

  const t = totales.rows[0] || {};
  const n = (v) => parseInt(v, 10) || 0;

  return {
    dias,
    landing: {
      total: n(t.landing_total),
      personas: n(t.landing_personas),
      hoy: n(t.landing_hoy),
      ultimos_7: n(t.landing_7d),
      ultimos_30: n(t.landing_30d),
      personas_30: n(t.personas_30d),
    },
    registro: { total: n(t.registro_total), ultimos_30: n(t.registro_30d) },
    serie: serie.rows,
    referentes: referentes.rows,
    dispositivos: dispositivos.rows,
    por_pagina: porPagina.rows,
  };
}

module.exports = { registrarVisita, resumen, paginaDe, PAGINAS };
