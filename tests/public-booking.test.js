// Tests de la reserva pública (/api/public/clinic/:id/booking), en concreto de
// a qué expediente se engancha la cita.
//
// El bug que motiva estos tests: el endpoint reutilizaba el primer paciente que
// tuviera el mismo número de identidad, y "0000-0000-00000" —lo que se escribe
// cuando no se tiene el número a mano— lo comparten cientos de expedientes de la
// misma clínica. Resultado: toda reserva nueva caía en el expediente de otra
// persona, y la clínica veía su nombre y su teléfono en vez de los de quien
// acababa de agendar.
//
// Sin BD y sin red: `db` y los módulos auxiliares se sustituyen por dobles en
// require.cache antes de cargar la ruta.

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');

// ── Doble de la base de datos ──
const bd = { pacientes: [], citas: [] };

function ejecutar(text, params) {
  const sql = String(text).replace(/\s+/g, ' ').trim();

  if (/^SELECT id FROM clinics WHERE id/i.test(sql)) {
    return { rows: [{ id: params[0] }], rowCount: 1 };
  }
  if (/^SELECT id, specialty FROM users WHERE id/i.test(sql)) {
    return { rows: [{ id: params[0], specialty: 'Podología' }], rowCount: 1 };
  }
  if (/^SELECT id FROM appointments WHERE doctor_id/i.test(sql)) {
    return { rows: [], rowCount: 0 };
  }
  if (/^SELECT id FROM patients WHERE identity_number/i.test(sql)) {
    const filas = bd.pacientes
      .filter((p) => p.identity_number === params[0] && p.clinic_id === params[1])
      .sort((a, b) => a.id - b.id)
      .slice(0, 2)
      .map((p) => ({ id: p.id }));
    return { rows: filas, rowCount: filas.length };
  }
  if (/^INSERT INTO patients/i.test(sql)) {
    const fila = {
      id: bd.pacientes.length + 1, name: params[0], identity_number: params[1],
      phone: params[2], clinic_id: params[3], age: params[4],
    };
    bd.pacientes.push(fila);
    return { rows: [{ id: fila.id }], rowCount: 1 };
  }
  if (/^INSERT INTO appointments/i.test(sql)) {
    const fila = { id: bd.citas.length + 1, patient_id: params[0], doctor_id: params[1], clinic_id: params[2],
                   reason: params[7], appointment_type: params[8] };
    bd.citas.push(fila);
    return { rows: [{ id: fila.id }], rowCount: 1 };
  }

  throw new Error('SQL no previsto en el doble: ' + sql);
}

function inyectar(ruta, exports) {
  const resuelta = require.resolve(ruta);
  require.cache[resuelta] = { id: resuelta, filename: resuelta, loaded: true, exports };
}

inyectar('../db', { query: async (text, params) => ejecutar(text, params) });
inyectar('../lib/room-capacity', { checkRoomCapacity: async () => ({ ok: true }) });
inyectar('../lib/availability-blocks', { blockedReason: async () => null, rejectIfBlocked: async () => false });
inyectar('../lib/subscription', { clinicCanWrite: async () => ({ allowed: true, reason: 'active' }) });
inyectar('../lib/geocoding', { searchAddress: async () => [] });
inyectar('../lib/maps-links', { parseMapsUrl: () => null, resolveMapsShortLink: async () => null });

const publicRouter = require('../routes/public-booking');

function levantar() {
  const app = express();
  app.use(express.json());
  app.use('/api/public', publicRouter);
  return new Promise((resolve) => {
    const srv = app.listen(0, () => resolve({ srv, url: 'http://127.0.0.1:' + srv.address().port }));
  });
}

// Una fecha futura estable, con el formato que manda agendar.html.
function manana(hora = '10:00') {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${iso}T${hora}:00`;
}

async function reservar(url, datos) {
  const res = await fetch(url + '/api/public/clinic/5/booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ doctor_id: 7, scheduled_at: manana(), reason: 'dolor' }, datos)),
  });
  let cuerpo = null;
  try { cuerpo = await res.json(); } catch (_) {}
  return { status: res.status, body: cuerpo };
}

function reiniciar() {
  bd.pacientes.length = 0;
  bd.citas.length = 0;
}

function pacienteDeLaCita(n = 0) {
  return bd.pacientes.find((p) => p.id === bd.citas[n].patient_id);
}

test('un DNI de relleno no engancha la cita al expediente de otro paciente', async (t) => {
  reiniciar();
  const { srv, url } = await levantar();
  t.after(() => srv.close());

  // La clínica ya tiene expedientes con el DNI de relleno, dados de alta a mano.
  bd.pacientes.push({ id: 1, name: 'Dagoberto Pineda', identity_number: '0000-0000-00000', phone: '31707720', clinic_id: 5 });
  bd.pacientes.push({ id: 2, name: 'Marcela Mondragón', identity_number: '0000-0000-00000', phone: '98571136', clinic_id: 5 });

  const r = await reservar(url, {
    patient_name: 'Lucía Ramírez', patient_identity: '0000-0000-00000', patient_phone: '99887766',
  });

  assert.strictEqual(r.status, 200);
  const p = pacienteDeLaCita();
  assert.strictEqual(p.name, 'Lucía Ramírez');
  assert.strictEqual(p.phone, '99887766');
});

test('el DNI con menos ceros ("0000-0000-0000") también cuenta como relleno', async (t) => {
  reiniciar();
  const { srv, url } = await levantar();
  t.after(() => srv.close());

  bd.pacientes.push({ id: 1, name: 'Guillermo Aguilar', identity_number: '0000-0000-0000', phone: '99906095', clinic_id: 5 });

  const r = await reservar(url, {
    patient_name: 'Nadia Ávila', patient_identity: '0000-0000-0000', patient_phone: '98974157',
  });

  assert.strictEqual(r.status, 200);
  assert.strictEqual(pacienteDeLaCita().name, 'Nadia Ávila');
});

test('un DNI repetido en la clínica tampoco identifica: se abre expediente nuevo', async (t) => {
  reiniciar();
  const { srv, url } = await levantar();
  t.after(() => srv.close());

  bd.pacientes.push({ id: 1, name: 'Álvaro Lobo', identity_number: '0801-2004-20128', phone: '31515887', clinic_id: 5 });
  bd.pacientes.push({ id: 2, name: 'Gabriel Núñez', identity_number: '0801-2004-20128', phone: '31515887', clinic_id: 5 });

  const r = await reservar(url, {
    patient_name: 'Andrea Guardado', patient_identity: '0801-2004-20128', patient_phone: '31571589',
  });

  assert.strictEqual(r.status, 200);
  assert.strictEqual(pacienteDeLaCita().name, 'Andrea Guardado');
});

test('un DNI real y único sí reutiliza el expediente, sin pisar nombre ni teléfono', async (t) => {
  reiniciar();
  const { srv, url } = await levantar();
  t.after(() => srv.close());

  bd.pacientes.push({ id: 1, name: 'Daisy Marina Flores', identity_number: '0801-1945-01809', phone: '95202023', clinic_id: 5 });

  // Alguien reserva con ese DNI pero escribiendo otro nombre: la cita va al
  // expediente existente y los datos del titular quedan intactos (si no, un DNI
  // conocido bastaría para reescribir la PII de un paciente real).
  const r = await reservar(url, {
    patient_name: 'Nombre Distinto', patient_identity: '0801-1945-01809', patient_phone: '99999999',
  });

  assert.strictEqual(r.status, 200);
  assert.strictEqual(bd.pacientes.length, 1);
  assert.strictEqual(bd.citas[0].patient_id, 1);
  assert.strictEqual(bd.pacientes[0].name, 'Daisy Marina Flores');
  assert.strictEqual(bd.pacientes[0].phone, '95202023');
});

// ── Tipo de consulta ──
// El enlace público ofrece los mismos tipos que el modal de nueva cita de la
// agenda, filtrados por la especialidad del doctor. Antes no se guardaba: se
// pegaba al principio de la razón en texto ("[Primera vez] dolor") y la cita
// llegaba a la clínica con el tipo por defecto.

test('el tipo de consulta elegido en el enlace público se guarda en la cita', async (t) => {
  reiniciar();
  const { srv, url } = await levantar();
  t.after(() => srv.close());

  const r = await reservar(url, {
    patient_name: 'Rosa Elena Cruz', patient_identity: '0801-1990-11223', patient_phone: '99112233',
    appointment_type: 'nuevo_paciente',
  });

  assert.strictEqual(r.status, 200);
  assert.strictEqual(bd.citas[0].appointment_type, 'nuevo_paciente');
  // La razón ya no lleva el tipo pegado delante.
  assert.strictEqual(bd.citas[0].reason, 'dolor');
});

test('sin tipo de consulta la cita queda como seguimiento', async (t) => {
  reiniciar();
  const { srv, url } = await levantar();
  t.after(() => srv.close());

  const r = await reservar(url, {
    patient_name: 'Hilda Zelaya', patient_identity: '0801-1988-33445', patient_phone: '99334455',
  });

  assert.strictEqual(r.status, 200);
  assert.strictEqual(bd.citas[0].appointment_type, 'seguimiento');
});

test('un tipo exclusivo de Podología vale si el doctor es podólogo', async (t) => {
  reiniciar();
  const { srv, url } = await levantar();
  t.after(() => srv.close());

  // El doble devuelve specialty: 'Podología' para cualquier doctor.
  const r = await reservar(url, {
    patient_name: 'Mario Lanza', patient_identity: '0801-1975-55667', patient_phone: '99556677',
    appointment_type: 'pedicure_spa',
  });

  assert.strictEqual(r.status, 200);
  assert.strictEqual(bd.citas[0].appointment_type, 'pedicure_spa');
});

test('un tipo que la especialidad no ofrece se rechaza (Podología no usa "control")', async (t) => {
  reiniciar();
  const { srv, url } = await levantar();
  t.after(() => srv.close());

  const r = await reservar(url, {
    patient_name: 'Ilsa Portillo', patient_identity: '0801-1992-77889', patient_phone: '99778899',
    appointment_type: 'control',
  });

  assert.strictEqual(r.status, 400);
  assert.strictEqual(bd.citas.length, 0);
});

test('un tipo inventado se rechaza', async (t) => {
  reiniciar();
  const { srv, url } = await levantar();
  t.after(() => srv.close());

  const r = await reservar(url, {
    patient_name: 'Óscar Padilla', patient_identity: '0801-1980-99001', patient_phone: '99990011',
    appointment_type: 'consulta_gratis',
  });

  assert.strictEqual(r.status, 400);
  assert.strictEqual(bd.citas.length, 0);
});
