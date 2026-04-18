const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'salud_digital.db');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('Base de datos eliminada');
}

require('./db.js');
console.log('Base de datos reinicializada con datos de prueba');
console.log('\nCuentas disponibles:');
console.log('  Super Admin      : admin@saluddigital.com              / admin123');
console.log('  Clinic Norte     : admin@clinicanorte.com              / clinic123');
console.log('  Clinic Sur       : admin@clinicasur.com                / clinic123');
console.log('  Doctor 1 (Álvaro): dr.garcia@clinicanorte.com          / doctor123');
console.log('  Doctor 2 (Juan)  : dr.juan@clinicanorte.com            / doctor123');
console.log('  Doctor 3 (Carlos): dr.carlos.lopez@clinicasur.com      / doctor123\n');
