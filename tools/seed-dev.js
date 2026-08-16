#!/usr/bin/env node
// ── Datos de demostración para DESARROLLO ──
//
// Esto vivía dentro de `initDb()` en db.js, es decir, se ejecutaba solo con
// arrancar el servidor. En el primer despliegue de producción se disparó y dejó
// en la base de datos real un `super_admin` con la contraseña 'admin123', dos
// clínicas de mentira y siete pacientes ficticios. (El bloque además reventaba a
// media faena con un ReferenceError sobre `d1`, así que sembró usuarios y
// pacientes pero no citas ni salas, y el proceso moría; al reiniciar ya no
// volvía a entrar porque la tabla `patients` había dejado de estar vacía.)
//
// Ahora es un script aparte que hay que invocar a mano y que se niega a correr
// si huele a producción. Nada de esto se ejecuta al arrancar el servidor.
//
//     SEED_DEMO_DATA=true node tools/seed-dev.js
//
// La contraseña ya no está escrita en el código: se toma de SEED_PASSWORD o se
// genera una al azar y se imprime una sola vez.

require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query, pool } = require('../db');

function abortar(motivo) {
  console.error('\n✖ seed-dev abortado: ' + motivo + '\n');
  process.exit(1);
}

async function comprobarQueEsSeguro() {
  if (process.env.SEED_DEMO_DATA !== 'true') {
    abortar('falta SEED_DEMO_DATA=true (confirmación explícita).');
  }
  if (process.env.NODE_ENV === 'production') {
    abortar('NODE_ENV=production.');
  }

  // El .env de desarrollo ha apuntado históricamente al Postgres de Render, así
  // que no basta con mirar NODE_ENV: se comprueba el host de la conexión.
  const url = String(process.env.DATABASE_URL || '');
  let host = '';
  try { host = new URL(url).hostname; } catch (_) { abortar('DATABASE_URL ilegible.'); }
  const esLocal = ['localhost', '127.0.0.1', '::1', 'postgres', 'db'].includes(host);
  if (!esLocal && process.env.SEED_ALLOW_REMOTE !== 'true') {
    abortar(
      `DATABASE_URL apunta a "${host}", que no es local.\n` +
      '  Si de verdad quieres sembrar ahí, repite con SEED_ALLOW_REMOTE=true.\n' +
      '  NUNCA lo hagas contra la base de datos de producción.'
    );
  }

  // Último cortafuegos: si ya hay pacientes, aquí trabaja alguien.
  const r = await query('SELECT COUNT(*)::int AS n FROM patients');
  if (r.rows[0].n > 0) {
    abortar(`la base de datos ya tiene ${r.rows[0].n} paciente(s). Este script solo siembra bases vacías.`);
  }
}

async function sembrar() {
  const clave = process.env.SEED_PASSWORD || crypto.randomBytes(12).toString('base64url');
  const hash = bcrypt.hashSync(clave, 10);

  await query(
    'INSERT INTO users (email, password, role, name, clinic_id) VALUES ($1, $2, $3, $4, $5)',
    ['admin@example.test', hash, 'super_admin', 'Super Admin', null]
  );

  const c1 = await query('INSERT INTO clinics (name) VALUES ($1) RETURNING id', ['Clínica Demo Norte']);
  const c2 = await query('INSERT INTO clinics (name) VALUES ($1) RETURNING id', ['Clínica Demo Sur']);
  const clinic1Id = c1.rows[0].id;
  const clinic2Id = c2.rows[0].id;

  const usuario = (email, role, name, clinicId, specialty = '', phone = '') =>
    query(
      `INSERT INTO users (email, password, role, name, clinic_id, specialty, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [email, hash, role, name, clinicId, specialty, phone]
    );

  await usuario('clinic-admin-a@example.test', 'clinic_admin', 'Admin Norte', clinic1Id);
  await usuario('clinic-admin-b@example.test', 'clinic_admin', 'Admin Sur', clinic2Id);

  // d1 y d2 se guardan de verdad: es el bug que rompía el bloque original.
  const d1 = await usuario('doctor-a@example.test', 'doctor', 'Dra. Ana Demo', clinic1Id, 'Medicina General', '31500001');
  const d2 = await usuario('doctor-b@example.test', 'doctor', 'Dr. Beto Demo', clinic2Id, 'Odontología', '31500002');
  await usuario('doctor-c@example.test', 'doctor', 'Dra. Carla Demo', clinic1Id, 'Podología', '31500003');

  await usuario('recepcion-a@example.test', 'receptionist', 'Recepción Norte', clinic1Id);
  await usuario('recepcion-b@example.test', 'receptionist', 'Recepción Sur', clinic2Id);

  // Cuenta de paciente: existe para poder verificar el guardián de acceso
  // clínico (middleware/clinical-access.js) — debe recibir 403 en todo /api que
  // no sea su propia sesión.
  await usuario('patient-a@example.test', 'patient', 'Paciente Demo', clinic1Id);

  const paciente = async (name, id, age, dob, gender, phone, clinicId) => {
    const res = await query(
      `INSERT INTO patients (name, identity_number, age, birth_date, gender, phone, clinic_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [name, id, age, dob, gender, phone, clinicId]
    );
    return res.rows[0].id;
  };

  // Datos completamente ficticios. Los DNI usan el prefijo 9999 justamente para
  // que no puedan colisionar con una identidad hondureña real.
  const p1 = await paciente('Paciente Uno',    '9999-0001-00001', 45, '1981-03-15', 'Femenino',  '31500101', clinic1Id);
  const p2 = await paciente('Paciente Dos',    '9999-0002-00002', 62, '1964-07-22', 'Masculino', '31500102', clinic1Id);
  const p3 = await paciente('Paciente Tres',   '9999-0003-00003', 38, '1988-11-05', 'Femenino',  '31500103', clinic2Id);
  const p4 = await paciente('Paciente Cuatro', '9999-0004-00004', 34, '1992-06-18', 'Masculino', '31500104', clinic1Id);

  await query(
    'INSERT INTO critical_info (patient_id, allergies, medications, conditions) VALUES ($1, $2, $3, $4)',
    [p1, 'Penicilina', 'Metformina 500mg', 'Diabetes Tipo 2']
  );
  for (const p of [p2, p3, p4]) {
    await query(
      'INSERT INTO critical_info (patient_id, allergies, medications, conditions) VALUES ($1, $2, $3, $4)',
      [p, '', '', '']
    );
  }

  await query(
    'INSERT INTO consultations (patient_id, notes, diagnosis, treatment, clinic_id, doctor_id) VALUES ($1, $2, $3, $4, $5, $6)',
    [p1, 'Control rutinario', 'Diabetes bajo control', 'Continuar con Metformina', clinic1Id, d1.rows[0].id]
  );

  const hoy = new Date().toISOString().split('T')[0];
  const d1Id = d1.rows[0].id;
  const d2Id = d2.rows[0].id;
  await query(
    'INSERT INTO appointments (patient_id, doctor_id, clinic_id, specialty, scheduled_at, status) VALUES ($1, $2, $3, $4, $5, $6)',
    [p1, d1Id, clinic1Id, 'Medicina General', `${hoy}T10:00:00`, 'waiting']
  );
  await query(
    'INSERT INTO appointments (patient_id, doctor_id, clinic_id, specialty, scheduled_at, status) VALUES ($1, $2, $3, $4, $5, $6)',
    [p2, d1Id, clinic1Id, 'Medicina General', `${hoy}T11:00:00`, 'pending']
  );
  await query(
    'INSERT INTO appointments (patient_id, doctor_id, clinic_id, specialty, scheduled_at, status) VALUES ($1, $2, $3, $4, $5, $6)',
    [p3, d2Id, clinic2Id, 'Odontología', `${hoy}T09:30:00`, 'waiting']
  );

  for (const cId of [clinic1Id, clinic2Id]) {
    for (let i = 1; i <= 4; i++) {
      await query(
        'INSERT INTO clinic_rooms (clinic_id, name, status) VALUES ($1, $2, $3)',
        [cId, `Sala ${i}`, 'free']
      );
    }
  }

  return clave;
}

(async () => {
  try {
    await comprobarQueEsSeguro();
    const clave = await sembrar();
    console.log('\n✔ Datos de demostración insertados.\n');
    console.log('  Cuentas: admin@example.test (super_admin), clinic-admin-a@example.test,');
    console.log('           doctor-a@example.test, doctor-b@example.test, doctor-c@example.test,');
    console.log('           recepcion-a@example.test, patient-a@example.test');
    console.log(`\n  Contraseña (todas): ${clave}`);
    console.log('  Se muestra una sola vez. Solo para desarrollo local.\n');
  } catch (err) {
    console.error('\n✖ seed-dev falló:', err.message, '\n');
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
})();
