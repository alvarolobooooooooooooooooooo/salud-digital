require('dotenv').config();
const express = require('express');
const path = require('path');
const compression = require('compression');
const { initDb } = require('./db');

process.env.TZ = 'America/Chicago'; // Zona horaria local (CST/CDT)

const app = express();

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
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
