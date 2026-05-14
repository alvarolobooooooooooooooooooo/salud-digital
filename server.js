require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const { initDb } = require('./db');

process.env.TZ = 'America/Chicago'; // Zona horaria local (CST/CDT)

const app = express();

// Cache-busting: every deploy changes ASSET_VERSION, which gets appended as ?v=…
// to every local <script src> and <link href>. Browsers then fetch fresh copies
// without users needing a hard refresh. Render exposes RENDER_GIT_COMMIT per deploy.
const ASSET_VERSION =
  (process.env.RENDER_GIT_COMMIT || '').slice(0, 8) || String(Date.now());

const PUBLIC_DIR = path.join(__dirname, 'public');

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

app.use(express.json());

// Static files: hint browsers to cache JS/CSS for a day, HTML always revalidated
const ONE_DAY = 24 * 60 * 60;
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  maxAge: 0,
  setHeaders(res, filePath) {
    if (/\.(?:js|css|svg|woff2?|ttf|otf|png|jpe?g|webp|gif|ico)$/i.test(filePath)) {
      // Static assets: cache for a day, browser revalidates with etag after that
      res.setHeader('Cache-Control', 'public, max-age=' + ONE_DAY + ', stale-while-revalidate=' + ONE_DAY);
    } else if (/\.html$/i.test(filePath)) {
      // HTML: always revalidate so deploys are picked up immediately
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
  etag: true,
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

app.get('*', (req, res) => {
  serveHtmlWithVersion(path.join(PUBLIC_DIR, 'index.html'), res);
});

// Global error handler — ensures async route failures return JSON
// instead of leaving the connection hanging (which surfaces as Safari's
// generic "Load failed" on the client).
app.use((err, req, res, next) => {
  console.error('Unhandled route error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`\nSaludDigital running → http://localhost:${PORT}\n`);
      console.log('Demo accounts:');
      console.log('  Super Admin       : admin@saluddigital.com          / admin123');
      console.log('  Clinic Norte      : admin@clinicanorte.com          / clinic123');
      console.log('  Clinic Sur        : admin@clinicasur.com            / clinic123');
      console.log('  Doctor (General)  : dr.garcia@clinicanorte.com      / doctor123');
      console.log('  Doctor (Podología): dra.piedra@clinicanorte.com     / doctor123');
      console.log('  Doctor Sur        : dr.lopez@clinicasur.com         / doctor123\n');
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();
