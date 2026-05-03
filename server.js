require('dotenv').config();
const express = require('express');
const path = require('path');
const { initDb } = require('./db');

process.env.TZ = 'America/Chicago'; // Zona horaria local (CST/CDT)

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
