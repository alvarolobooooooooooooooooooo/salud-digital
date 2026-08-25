// ── Quién puede ABRIR la ficha de un paciente ──
//
// Este test nace de un fallo que se vio en pantalla: se migraban expedientes,
// aparecían en la lista del doctor, y al hacer clic salía "No se pudo cargar".
//
// La causa era una asimetría vieja entre dos reglas que deberían ser una:
//
//     la LISTA de un doctor  →  los que dio de alta él, o tienen cita con él
//     ABRIR la ficha         →  SOLO los que tienen cita con él
//
// Con eso, cualquier paciente registrado y todavía sin agendar —el que acabas
// de crear a mano, o los tres mil que acabas de migrar— salía listado y daba
// 403 al abrirlo. Ahora las dos rutas usan `doctorTieneAcceso`.
//
// Lo que este test protege es el par completo: que el dueño entre y que un
// tercero siga fuera. Si alguien vuelve a apretar la regla de lectura, el
// primer test se cae; si alguien la abre de más, se cae el segundo.
//
//     npm test

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-pruebas-suficientemente-largo-123456';

// Un expediente recién migrado: lo creó el doctor 7 y NO tiene ninguna cita.
const PACIENTE = {
  id: 55, name: 'Ana Sofía Martínez', identity_number: 'MIG-2-0001',
  clinic_id: 42, created_by: 7, migration_batch_id: 2,
  age: 24, birth_date: '2001-07-22', gender: 'Femenino',
  phone: '99112233', whatsapp_number: '99112233', odontogram_state: '{}',
};

function ejecutar(text, params) {
  const sql = String(text).replace(/\s+/g, ' ').trim();

  if (/^SELECT \* FROM patients WHERE id/i.test(sql)) {
    const mio = Number(params[0]) === PACIENTE.id && params[1] === PACIENTE.clinic_id;
    return { rows: mio ? [PACIENTE] : [], rowCount: mio ? 1 : 0 };
  }
  // La regla de acceso. El doble reproduce lo único que decide: o lo creó él, o
  // tiene cita — y aquí no hay ninguna cita, a propósito.
  if (/^SELECT 1 FROM patients p/i.test(sql)) {
    const ok = Number(params[0]) === PACIENTE.id
      && params[1] === PACIENTE.clinic_id
      && PACIENTE.created_by === params[2];
    return { rows: ok ? [{ uno: 1 }] : [], rowCount: ok ? 1 : 0 };
  }
  if (/^SELECT \* FROM critical_info/i.test(sql)) {
    return { rows: [{ patient_id: 55, allergies: 'Látex', medications: '', conditions: '' }], rowCount: 1 };
  }
  if (/FROM consultations c LEFT JOIN users/i.test(sql)) {
    return {
      rows: [{
        id: 900, patient_id: 55, notes: '', diagnosis: 'Onicomicosis', treatment: '',
        specialty: 'Podología', cost: '600', payment_status: 'paid', lifestyle: '{}',
        procedures: '', radiography_notes: '', observations: '', doctor_id: 7,
        visit_reason: 'Expediente migrado', created_at: new Date('2024-02-12'),
        clinic_id: 42, doctor_name: 'Dra. Ejemplo',
      }],
      rowCount: 1,
    };
  }
  throw new Error('SQL no previsto en el doble: ' + sql.slice(0, 120));
}

const resuelta = require.resolve('../db');
require.cache[resuelta] = {
  id: resuelta, filename: resuelta, loaded: true,
  exports: { query: async (t, p) => ejecutar(t, p) },
};

const router = require('../routes/patients');

const DUENO = { id: 7, email: 'duena@clinica.test', role: 'doctor', clinic_id: 42 };
const OTRO_DOCTOR = { id: 9, email: 'otro@clinica.test', role: 'doctor', clinic_id: 42 };
const ADMIN = { id: 3, email: 'admin@clinica.test', role: 'clinic_admin', clinic_id: 42 };

async function levantar() {
  const app = express();
  app.use(express.json());
  app.use('/api/patients', router);
  app.use((err, req, res, _next) => res.status(500).json({ error: err.message }));

  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;

  return {
    async abrirFicha(usuario) {
      const res = await fetch(base + '/api/patients/55', {
        headers: { Authorization: 'Bearer ' + jwt.sign(usuario, process.env.JWT_SECRET, { expiresIn: '5m' }) },
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    },
    cerrar: () => new Promise((r) => {
      if (server.closeAllConnections) server.closeAllConnections();
      server.close(r);
    }),
  };
}

test('el doctor que registró el expediente puede abrirlo aunque no haya cita', async () => {
  const app = await levantar();
  try {
    const r = await app.abrirFicha(DUENO);
    assert.strictEqual(r.status, 200, 'esto daba 403 y la ficha salía como "No se pudo cargar"');
    assert.strictEqual(r.body.critical_info.allergies, 'Látex', 'la información crítica viaja con la ficha');
    assert.strictEqual(r.body.consultations.length, 1, 'y la historia migrada también');
  } finally { await app.cerrar(); }
});

test('otro doctor de la misma clínica sigue sin poder abrirlo', async () => {
  const app = await levantar();
  try {
    const r = await app.abrirFicha(OTRO_DOCTOR);
    assert.strictEqual(r.status, 403, 'abrir la lectura no puede abrir el padrón entero');
  } finally { await app.cerrar(); }
});

test('la administración de la clínica sigue teniendo alcance completo', async () => {
  const app = await levantar();
  try {
    const r = await app.abrirFicha(ADMIN);
    assert.strictEqual(r.status, 200);
  } finally { await app.cerrar(); }
});
