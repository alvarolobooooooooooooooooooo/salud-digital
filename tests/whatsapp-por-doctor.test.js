// Tests del WhatsApp por doctor (routes/reminders.js, routes/confirmations.js
// y lib/whatsapp-config.js).
//
// Sin BD y sin red: el módulo `db` se sustituye por un doble en require.cache
// antes de cargar los routers, y cualquier SQL no previsto revienta el test a
// propósito. Lo que se comprueba es lo que ninguna prueba de unidad ve:
//
//   · Que un DOCTOR pueda guardar su mensaje. Los dos PUT exigían
//     role === 'clinic_admin' y devolvían 403 a los doctores, que sí veían la
//     pantalla y sus botones. En una cuenta del alta por cuenta propia —donde
//     el dueño es `doctor` y NO existe ningún clinic_admin— el mensaje no se
//     podía cambiar nunca.
//   · Que cada uno escriba en SU fila: el doctor en users, el clinic_admin en
//     clinics. Es lo único que impide que un doctor le cambie el mensaje a otro.
//   · Que el texto que sale sea el del doctor DE LA CITA y no el de quien pulsa
//     el botón — de ahí que la respuesta lleve `por_doctor` y la lista lleve
//     `doctor_id`.
//   · Que un doctor que nunca tocó su mensaje siga viendo el de la clínica.
//     Es lo que hace que esta migración no deje a nadie con el texto en blanco.
//   · Que las dos pantallas validen IGUAL. Escribían las mismas columnas
//     opinando distinto: Confirmaciones cortaba el "encendido sin número" y
//     Recordatorios lo dejaba pasar, dejando el interruptor apuntando a ninguna
//     parte.
//
//     npm test

process.env.JWT_SECRET = process.env.JWT_SECRET || 'clave-de-pruebas-suficientemente-larga-1234';

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

// ── Doble de la base ─────────────────────────────────────────────────────────
// Lo que la clínica tiene guardado y lo que tiene el doctor 9. `null` en el
// doctor es lo importante: significa "no lo ha tocado", que es justo el caso
// que debe caer al de la clínica.
const CASA = {
  whatsapp_enabled: true,
  whatsapp_number: '50499990000',
  whatsapp_template: 'Texto de la clínica',
  whatsapp_confirmation_template: 'Confirmación de la clínica',
  confirmation_card_message: '',
  name: 'Clínica Demostración',
};
let doctor = {
  whatsapp_enabled: null,
  whatsapp_number: null,
  whatsapp_template: null,
  whatsapp_confirmation_template: null,
};
let sql = [];

// COALESCE(u.x, c.x) con NULLIF en los textos, resuelto en JavaScript: el doble
// no habla SQL, así que imita la regla en vez de ejecutarla.
function efectiva() {
  const cae = (u, c) => (u === null || u === undefined || u === '' ? c : u);
  return {
    whatsapp_enabled: doctor.whatsapp_enabled === null ? CASA.whatsapp_enabled : doctor.whatsapp_enabled,
    whatsapp_number: cae(doctor.whatsapp_number, CASA.whatsapp_number),
    whatsapp_template: cae(doctor.whatsapp_template, CASA.whatsapp_template),
    whatsapp_confirmation_template: cae(doctor.whatsapp_confirmation_template, CASA.whatsapp_confirmation_template),
  };
}

function ejecutar(text, params) {
  const limpio = String(text).replace(/\s+/g, ' ').trim();
  sql.push({ sql: limpio, params });

  if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(limpio)) return { rows: [], rowCount: 0 };
  if (/SELECT id FROM viva|FROM user_sessions/i.test(limpio)) return { rows: [{ id: 1 }], rowCount: 1 };
  if (/^SELECT to_regclass/i.test(limpio)) return { rows: [{ t: 'public.x' }], rowCount: 1 };

  // La config de la casa (la que ve y edita un rol que no es doctor).
  if (/^SELECT cl?\.whatsapp_enabled.*FROM clinics/i.test(limpio)) {
    return { rows: [Object.assign({}, CASA, { personalizado: false })], rowCount: 1 };
  }
  // La config efectiva de UN doctor.
  if (/FROM users u JOIN clinics cl? ON .* WHERE u\.id = \$1/i.test(limpio)) {
    const fila = Object.assign({}, efectiva(), {
      name: CASA.name,
      confirmation_card_message: CASA.confirmation_card_message,
      personalizado: doctor.whatsapp_template !== null || doctor.whatsapp_confirmation_template !== null,
    });
    return { rows: [fila], rowCount: 1 };
  }
  // La config efectiva de TODOS los doctores de la clínica.
  if (/FROM users u JOIN clinics cl? ON .* WHERE u\.clinic_id = \$1 AND u\.role = 'doctor'/i.test(limpio)) {
    return { rows: [Object.assign({ id: 9 }, efectiva())], rowCount: 1 };
  }
  // El listado de la pantalla.
  if (/^SELECT a\.id AS appointment_id/i.test(limpio)) {
    return { rows: [{ appointment_id: 1, doctor_id: 9, patient_name: 'Ana', phone: '50488887777' }], rowCount: 1 };
  }

  if (/^UPDATE users SET/i.test(limpio)) {
    return { rows: [], rowCount: 1 };
  }
  if (/^UPDATE clinics SET/i.test(limpio)) {
    return { rows: [], rowCount: 1 };
  }

  throw new Error('SQL no previsto en el doble: ' + limpio);
}

const dobleDb = {
  query: async (t, p) => ejecutar(t, p),
  pool: { connect: async () => ({ query: async (t, p) => ejecutar(t, p), release() {} }) },
};

function inyectar(ruta, exports) {
  const resuelta = require.resolve(ruta);
  require.cache[resuelta] = { id: resuelta, filename: resuelta, loaded: true, exports };
}
inyectar('../db', dobleDb);

const remindersRouter = require('../routes/reminders');
const confirmationsRouter = require('../routes/confirmations');

function app() {
  const a = express();
  a.use(express.json());
  a.use(cookieParser());
  a.use('/api/reminders', remindersRouter);
  a.use('/api/confirmations', confirmationsRouter);
  return a;
}

function levantar(a) {
  return new Promise((r) => {
    const srv = a.listen(0, () => r({ srv, url: 'http://127.0.0.1:' + srv.address().port }));
  });
}

function token(rol) {
  return jwt.sign(
    { id: 9, email: 'ana@clinica.hn', role: rol, clinic_id: 5, jti: 'jti-de-prueba' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );
}

async function pedir(url, ruta, { method = 'GET', body, rol = 'doctor' } = {}) {
  const res = await fetch(url + ruta, {
    method,
    headers: Object.assign(
      { Authorization: 'Bearer ' + token(rol) },
      body ? { 'Content-Type': 'application/json' } : {},
    ),
    body: body ? JSON.stringify(body) : undefined,
  });
  let cuerpo = null;
  try { cuerpo = await res.json(); } catch (_) {}
  return { status: res.status, body: cuerpo };
}

const ultimoUpdate = () => sql.filter((s) => /^UPDATE/i.test(s.sql)).pop();

test.beforeEach(() => {
  doctor = {
    whatsapp_enabled: null,
    whatsapp_number: null,
    whatsapp_template: null,
    whatsapp_confirmation_template: null,
  };
  sql = [];
});

// ── El bug que se reportó ────────────────────────────────────────────────────

for (const pantalla of ['reminders', 'confirmations']) {
  test(`${pantalla}: un doctor puede guardar su mensaje (antes era 403)`, async (t) => {
    const { srv, url } = await levantar(app());
    t.after(() => srv.close());

    const campo = pantalla === 'reminders' ? 'whatsapp_template' : 'whatsapp_confirmation_template';
    const r = await pedir(url, `/api/${pantalla}/whatsapp-config`, {
      method: 'PUT',
      rol: 'doctor',
      body: { [campo]: 'Mi propio mensaje' },
    });

    assert.equal(r.status, 200);
    assert.equal(r.body.scope, 'doctor');
  });

  test(`${pantalla}: lo del doctor se escribe en SU fila, no en la de la clínica`, async (t) => {
    const { srv, url } = await levantar(app());
    t.after(() => srv.close());

    const campo = pantalla === 'reminders' ? 'whatsapp_template' : 'whatsapp_confirmation_template';
    await pedir(url, `/api/${pantalla}/whatsapp-config`, {
      method: 'PUT',
      rol: 'doctor',
      body: { [campo]: 'Mi propio mensaje' },
    });

    const u = ultimoUpdate();
    assert.match(u.sql, /^UPDATE users SET/, 'el doctor tiene que escribir en users');
    // El WHERE apunta a su id (9), no al de la clínica (5): un doctor no puede
    // alcanzar la fila de otro ni la de la casa.
    assert.equal(u.params[u.params.length - 1], 9);
    assert.ok(u.params.includes('Mi propio mensaje'));
  });

  test(`${pantalla}: el clinic_admin sigue guardando el de la casa`, async (t) => {
    const { srv, url } = await levantar(app());
    t.after(() => srv.close());

    const campo = pantalla === 'reminders' ? 'whatsapp_template' : 'whatsapp_confirmation_template';
    const r = await pedir(url, `/api/${pantalla}/whatsapp-config`, {
      method: 'PUT',
      rol: 'clinic_admin',
      body: { [campo]: 'Texto nuevo de la casa' },
    });

    assert.equal(r.status, 200);
    assert.equal(r.body.scope, 'clinic');
    const u = ultimoUpdate();
    assert.match(u.sql, /^UPDATE clinics SET/);
    assert.equal(u.params[u.params.length - 1], 5, 'el WHERE va contra la clínica del token');
  });

  test(`${pantalla}: la recepcionista no decide qué dicen los mensajes`, async (t) => {
    const { srv, url } = await levantar(app());
    t.after(() => srv.close());

    const r = await pedir(url, `/api/${pantalla}/whatsapp-config`, {
      method: 'PUT',
      rol: 'receptionist',
      body: { whatsapp_template: 'lo que sea' },
    });

    assert.equal(r.status, 403);
    assert.equal(ultimoUpdate(), undefined, 'no debe escribir nada');
  });

  // La unificación: las dos pantallas escriben las mismas columnas, así que
  // tenían que dejar de validar distinto.
  test(`${pantalla}: encender WhatsApp sin número se corta con 400`, async (t) => {
    const { srv, url } = await levantar(app());
    t.after(() => srv.close());

    const r = await pedir(url, `/api/${pantalla}/whatsapp-config`, {
      method: 'PUT',
      rol: 'doctor',
      body: { whatsapp_enabled: true, whatsapp_number: '' },
    });

    assert.equal(r.status, 400);
    assert.equal(ultimoUpdate(), undefined);
  });

  test(`${pantalla}: un número que no se puede marcar se corta con 400`, async (t) => {
    const { srv, url } = await levantar(app());
    t.after(() => srv.close());

    const r = await pedir(url, `/api/${pantalla}/whatsapp-config`, {
      method: 'PUT',
      rol: 'doctor',
      body: { whatsapp_enabled: true, whatsapp_number: '123' },
    });

    assert.equal(r.status, 400);
    assert.equal(ultimoUpdate(), undefined);
  });

  // Un cuerpo sin el interruptor no debe apagarlo: la pantalla lo manda siempre,
  // pero una llamada vieja no.
  test(`${pantalla}: lo que no viene en el cuerpo no se toca`, async (t) => {
    const { srv, url } = await levantar(app());
    t.after(() => srv.close());

    const campo = pantalla === 'reminders' ? 'whatsapp_template' : 'whatsapp_confirmation_template';
    await pedir(url, `/api/${pantalla}/whatsapp-config`, {
      method: 'PUT',
      rol: 'doctor',
      body: { [campo]: 'Solo el texto' },
    });

    const u = ultimoUpdate();
    assert.doesNotMatch(u.sql, /whatsapp_enabled/, 'no debe apagar WhatsApp sin que nadie se lo pida');
    assert.doesNotMatch(u.sql, /whatsapp_number/);
  });
}

// ── La herencia: nadie se queda sin texto ────────────────────────────────────

test('un doctor que nunca tocó su mensaje ve el de la clínica', async (t) => {
  const { srv, url } = await levantar(app());
  t.after(() => srv.close());

  const r = await pedir(url, '/api/reminders/whatsapp-config', { rol: 'doctor' });

  assert.equal(r.status, 200);
  assert.equal(r.body.whatsapp_template, 'Texto de la clínica');
  assert.equal(r.body.scope, 'doctor');
  assert.equal(r.body.personalizado, false, 'todavía no es suyo: la pantalla lo dice');
});

test('cuando lo personaliza, gana el suyo', async (t) => {
  const { srv, url } = await levantar(app());
  t.after(() => srv.close());

  doctor.whatsapp_template = 'El mío';
  const r = await pedir(url, '/api/reminders/whatsapp-config', { rol: 'doctor' });

  assert.equal(r.body.whatsapp_template, 'El mío');
  assert.equal(r.body.personalizado, true);
});

test('la consulta resuelve el texto contra la clínica, no lo lee a secas', async (t) => {
  const { srv, url } = await levantar(app());
  t.after(() => srv.close());

  await pedir(url, '/api/reminders/whatsapp-config', { rol: 'doctor' });

  const select = sql.find((s) => /FROM users u JOIN clinics/i.test(s.sql));
  assert.match(select.sql, /COALESCE\(NULLIF\(u\.whatsapp_template, ''\), c\.whatsapp_template\)/);
  // El interruptor NO lleva NULLIF: un `false` del doctor es una decisión suya
  // y tiene que ganarle al `true` de la clínica.
  assert.match(select.sql, /COALESCE\(u\.whatsapp_enabled, c\.whatsapp_enabled\)/);
});

// ── El mensaje es del doctor de la cita, no del que pulsa ────────────────────

test('la respuesta trae la config de cada doctor para pintar la lista', async (t) => {
  const { srv, url } = await levantar(app());
  t.after(() => srv.close());

  const r = await pedir(url, '/api/reminders/whatsapp-config', { rol: 'receptionist' });

  assert.ok(r.body.por_doctor, 'sin esto la recepción manda su texto firmado por otros');
  assert.equal(r.body.por_doctor['9'].whatsapp_template, 'Texto de la clínica');
});

test('la recepción solo ve la config de la casa como suya', async (t) => {
  const { srv, url } = await levantar(app());
  t.after(() => srv.close());

  const r = await pedir(url, '/api/reminders/whatsapp-config', { rol: 'receptionist' });
  assert.equal(r.body.scope, 'clinic');
});

test('el listado dice de qué doctor es cada cita', async (t) => {
  const { srv, url } = await levantar(app());
  t.after(() => srv.close());

  const r = await pedir(url, '/api/reminders', { rol: 'clinic_admin' });
  assert.equal(r.status, 200);
  assert.equal(r.body[0].doctor_id, 9, 'la pantalla lo necesita para elegir la plantilla');
});
