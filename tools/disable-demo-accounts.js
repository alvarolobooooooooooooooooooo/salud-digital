#!/usr/bin/env node
// ── Desactivador de cuentas demo ──
//
// Cierra las cuentas que sembraba el viejo bloque de db.js y que siguen vivas
// en producción con su contraseña de demostración (ver tools/check-demo-accounts.js).
//
// QUÉ HACE, exactamente:
//   1. Sustituye la contraseña por el hash de 32 bytes aleatorios. Nadie puede
//      entrar con ella, y como no se guarda el original en ninguna parte, no hay
//      nada que filtrar. La cuenta se recupera poniéndole una contraseña nueva.
//   2. Marca approval_status='rejected'. Segunda cerradura: aunque alguien
//      llegara a adivinar la contraseña, el login la rechaza igual.
//   3. Revoca las sesiones abiertas. Sin esto, quien ya estuviera dentro sigue
//      dentro las 24 h que dura el JWT.
//
// QUÉ NO HACE:
//   · No borra ninguna fila. Cinco de estas cuentas tienen consultas y citas
//     colgando; borrar el usuario dejaría esos expedientes sin autor.
//   · No toca NINGUNA cuenta que no esté en la lista de abajo.
//   · No toca la cuenta super_admin: esa la cambia una persona a mano, porque
//     es la que da acceso al panel de administración y dejarse fuera de él
//     sería peor que el problema que se está arreglando.
//
// Es idempotente: correrlo dos veces no hace daño (la segunda vez no encuentra
// nada que cambiar).
//
//     node tools/disable-demo-accounts.js              → simulacro, no escribe
//     node tools/disable-demo-accounts.js --ejecutar   → aplica los cambios

require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, pool } = require('../db');

// Las 12 cuentas de clínica. admin@saluddigital.com (super_admin) NO está aquí
// a propósito: ver la cabecera.
const CUENTAS = [
  'admin@clinicanorte.com',
  'admin@clinicasur.com',
  'dr.garcia@clinicanorte.com',
  'dr.carlos.lopez@clinicasur.com',
  'dr.diego.lopez@clinicanorte.com',
  'dra.ochoa@clinicanorte.com',
  'dra.karla.moreno@clinicasur.com',
  'heysselm@clinicanorte.com',
  'dr.juan@clinicanorte.com',
  'dra.piedra@clinicanorte.com',
  'recepcion@clinicanorte.com',
  'recepcion@clinicasur.com',
];

const NOTA = 'Cuenta de demostración desactivada por seguridad. Los datos asociados se conservan.';
const ejecutar = process.argv.includes('--ejecutar');

(async () => {
  try {
    const r = await query(
      `SELECT id, email, role, clinic_id, approval_status
         FROM users
        WHERE LOWER(email) = ANY($1::text[])
        ORDER BY id`,
      [CUENTAS.map((e) => e.toLowerCase())],
    );

    if (r.rows.length === 0) {
      console.log('\n✔ Ninguna de las cuentas demo existe en esta base. No hay nada que hacer.\n');
      return;
    }

    console.log(`\n${ejecutar ? 'DESACTIVANDO' : 'SIMULACRO (no se escribe nada)'} — ${r.rows.length} cuenta(s)\n`);

    let hechas = 0;
    for (const u of r.rows) {
      // Cinturón: si una de estas direcciones acabara teniendo rol super_admin,
      // el script se detiene en vez de dejar la plataforma sin administrador.
      if (u.role === 'super_admin') {
        console.log(`  id=${u.id}  ${u.email}  ⚠ es super_admin — SE OMITE`);
        continue;
      }

      if (!ejecutar) {
        console.log(`  id=${u.id}  ${u.email.padEnd(34)} ${u.role.padEnd(13)} → se desactivaría`);
        continue;
      }

      const hash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      await query(
        `UPDATE users
            SET password = $1,
                approval_status = 'rejected',
                approval_notes = $2,
                approval_decided_at = CURRENT_TIMESTAMP
          WHERE id = $3 AND role <> 'super_admin'`,
        [hash, NOTA, u.id],
      );
      const ses = await query(
        `UPDATE user_sessions
            SET revoked_at = CURRENT_TIMESTAMP
          WHERE user_id = $1 AND revoked_at IS NULL
          RETURNING id`,
        [u.id],
      );
      hechas++;
      console.log(
        `  id=${u.id}  ${u.email.padEnd(34)} ${u.role.padEnd(13)} ✔ contraseña anulada · ` +
        `${ses.rowCount} sesión(es) revocada(s)`,
      );
    }

    if (ejecutar) {
      // Que quede rastro de quién cerró esto y cuándo.
      await query(
        `INSERT INTO audit_logs (user_id, clinic_id, action, status, reason, created_at)
         VALUES (NULL, NULL, 'DEMO_ACCOUNTS_DISABLED', 'success', $1, NOW())`,
        [`${hechas} cuentas de demostración desactivadas (contraseña anulada y sesiones revocadas)`],
      ).catch((e) => console.warn('  (no se pudo dejar rastro en audit_logs:', e.message + ')'));

      console.log(`\n✔ ${hechas} cuenta(s) desactivada(s). Ninguna fila borrada.`);
      console.log('\n  PENDIENTE Y URGENTE: admin@saluddigital.com (super_admin) sigue con');
      console.log('  la contraseña "admin123". Entra ahora a la app con ella y cámbiala desde');
      console.log('  Configuración → Seguridad. Al cambiarla, el servidor revoca por su cuenta');
      console.log('  todas las demás sesiones de esa cuenta, incluida la que hay abierta.\n');
    } else {
      console.log('\n  Simulacro terminado. Para aplicarlo:');
      console.log('      node tools/disable-demo-accounts.js --ejecutar\n');
    }
  } catch (err) {
    console.error('\n✖ Error:', err.message, '\n');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
