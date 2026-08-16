#!/usr/bin/env node
// ── Verificador de cuentas demo (SOLO LECTURA) ──
//
// Responde una única pregunta: ¿siguen en la base de datos las cuentas que
// sembraba el viejo bloque de db.js, y sus contraseñas de demostración siguen
// sirviendo para entrar?
//
// No modifica NADA: solo hace SELECT. La comprobación de la contraseña se hace
// en local con bcrypt.compare() contra el hash que ya está en la tabla — no se
// intenta ningún inicio de sesión contra el servidor.
//
//     node tools/check-demo-accounts.js
//
// Si alguna línea sale con "CONTRASEÑA DEMO ACTIVA", esa cuenta es una puerta
// abierta y hay que cerrarla hoy.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, pool } = require('../db');

// email → contraseña que le ponía el seed original (db.js, antes de extraerlo)
const SEMBRADAS = {
  'admin@saluddigital.com': 'admin123',
  'admin@clinicanorte.com': 'clinic123',
  'admin@clinicasur.com': 'clinic123',
  'dr.garcia@clinicanorte.com': 'doctor123',
  'dr.carlos.lopez@clinicasur.com': 'doctor123',
  'dr.diego.lopez@clinicanorte.com': 'doctor123',
  'dra.ochoa@clinicanorte.com': 'doctor123',
  'dra.karla.moreno@clinicasur.com': 'doctor123',
  'heysselm@clinicanorte.com': 'doctor123',
  'dr.juan@clinicanorte.com': 'doctor123',
  'dra.piedra@clinicanorte.com': 'doctor123',
  'recepcion@clinicanorte.com': 'receptionist123',
  'recepcion@clinicasur.com': 'receptionist123',
};

(async () => {
  try {
    const emails = Object.keys(SEMBRADAS);
    const r = await query(
      `SELECT id, email, role, clinic_id, password
         FROM users
        WHERE LOWER(email) = ANY($1::text[])
        ORDER BY role, email`,
      [emails.map((e) => e.toLowerCase())]
    );

    if (r.rows.length === 0) {
      console.log('\n✔ Ninguna de las 13 cuentas demo existe en esta base de datos.\n');
      return;
    }

    console.log(`\n⚠ Encontradas ${r.rows.length} de ${emails.length} cuentas demo.\n`);

    let abiertas = 0;
    for (const u of r.rows) {
      // Comparación local contra el hash almacenado. No toca el servidor.
      const activa = await bcrypt.compare(SEMBRADAS[u.email.toLowerCase()], u.password || '');
      if (activa) abiertas++;

      // ¿Tiene historia clínica colgando? Decide entre desactivar o poder borrar.
      const uso = await query(
        `SELECT (SELECT count(*) FROM consultations WHERE doctor_id = $1)::int AS consultas,
                (SELECT count(*) FROM appointments  WHERE doctor_id = $1)::int AS citas,
                (SELECT count(*) FROM user_sessions WHERE user_id = $1 AND revoked_at IS NULL)::int AS sesiones`,
        [u.id]
      );
      const { consultas, citas, sesiones } = uso.rows[0];

      console.log(
        `  id=${String(u.id).padEnd(4)} ${u.email.padEnd(34)} ${String(u.role).padEnd(13)} ` +
        `clinic=${String(u.clinic_id ?? '—').padEnd(5)} ` +
        (activa ? '🔴 CONTRASEÑA DEMO ACTIVA' : '🟡 contraseña ya cambiada')
      );
      console.log(
        `        └─ consultas=${consultas} citas=${citas} sesiones_abiertas=${sesiones}` +
        (consultas + citas === 0 ? '  (sin datos colgando)' : '  (TIENE DATOS: desactivar, no borrar)')
      );
    }

    console.log(
      `\n  ${abiertas} cuenta(s) con la contraseña de demostración todavía válida.\n` +
      (abiertas > 0
        ? '  Son puertas abiertas. Ciérralas hoy.\n'
        : '  Ninguna entra con la contraseña original, pero las cuentas siguen existiendo.\n')
    );
  } catch (err) {
    console.error('\n✖ No se pudo comprobar:', err.message, '\n');
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
})();
