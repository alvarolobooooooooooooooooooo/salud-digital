require('dotenv').config();
const express = require('express');
const path = require('path');
const { initDb } = require('./db');

process.env.TZ = 'America/Chicago'; // Zona horaria local (CST/CDT)

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/invitations', require('./routes/invitations'));
app.use('/api/clinics', require('./routes/clinics'));
app.use('/api/users', require('./routes/users'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/consultations', require('./routes/consultations'));
app.use('/api/appointments', require('./routes/appointments'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`\nSaludDigital running → http://localhost:${PORT}\n`);
      console.log('Demo accounts:');
      console.log('  Super Admin  : admin@saluddigital.com     / admin123');
      console.log('  Clinic Norte : admin@clinicanorte.com     / clinic123');
      console.log('  Clinic Sur   : admin@clinicasur.com       / clinic123');
      console.log('  Doctor Norte : dr.garcia@clinicanorte.com / doctor123');
      console.log('  Doctor Sur   : dr.lopez@clinicasur.com    / doctor123\n');
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();
