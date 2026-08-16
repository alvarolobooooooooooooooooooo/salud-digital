// Tests del alta pública de doctores (/api/auth/register) y del modo solo
// lectura que rige mientras la suscripción no está activa.
//
// Sin BD y sin red: el módulo `db` y el de control de suscripción se sustituyen
// por dobles en require.cache antes de cargar las rutas.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'clave-de-pruebas-suficientemente-larga-1234';

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const cookieParser = require('cookie-parser');

// ── Doble de la base de datos ──
// Guarda en memoria lo insertado y responde a las pocas consultas que hace el
// alta. Cualquier SQL no previsto revienta el test a propósito: si mañana el
// endpoint consulta algo nuevo, aquí se entera.
const bd = { clinicas: [], usuarios: [], sesiones: [] };

function ejecutar(text, params) {
  const sql = String(text).replace(/\s+/g, ' ').trim();

  if (/^SELECT 1 FROM users WHERE LOWER\(email\)/i.test(sql)) {
    const hay = bd.usuarios.some((u) => u.email.toLowerCase() === String(params[0]).toLowerCase());
    return { rows: hay ? [{ '?column?': 1 }] : [], rowCount: hay ? 1 : 0 };
  }
  if (/^SELECT 1 FROM clinics WHERE LOWER\(name\)/i.test(sql)) {
    const hay = bd.clinicas.some((c) => c.name.toLowerCase() === String(params[0]).toLowerCase());
    return { rows: hay ? [{ '?column?': 1 }] : [], rowCount: hay ? 1 : 0 };
  }
  if (/^INSERT INTO clinics/i.test(sql)) {
    const fila = { id: bd.clinicas.length + 1, name: params[0], specialties: params[1], phone: params[2], email: params[3], city: params[4] };
    bd.clinicas.push(fila);
    return { rows: [{ id: fila.id }], rowCount: 1 };
  }
  if (/^INSERT INTO users/i.test(sql)) {
    if (bd.usuarios.some((u) => u.email.toLowerCase() === String(params[0]).toLowerCase())) {
      const err = new Error('duplicate key value violates unique constraint "users_email_key"');
      err.code = '23505';
      err.constraint = 'users_email_key';
      throw err;
    }
    const fila = {
      id: bd.usuarios.length + 1, email: params[0], password: params[1], role: 'doctor',
      name: params[2], clinic_id: params[3], specialty: params[4], phone: params[5],
    };
    bd.usuarios.push(fila);
    return { rows: [{ id: fila.id, email: fila.email, role: fila.role, clinic_id: fila.clinic_id }], rowCount: 1 };
  }
  if (/^INSERT INTO user_sessions/i.test(sql)) {
    bd.sesiones.push({ jti: params[0], user_id: params[1] });
    return { rows: [], rowCount: 1 };
  }
  if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(sql)) return { rows: [], rowCount: 0 };

  throw new Error('SQL no previsto en el doble: ' + sql);
}

const dobleDb = {
  query: async (text, params) => ejecutar(text, params),
  pool: {
    connect: async () => ({
      query: async (text, params) => ejecutar(text, params),
      release() {},
    }),
  },
};

function inyectar(ruta, exports) {
  const resuelta = require.resolve(ruta);
  require.cache[resuelta] = { id: resuelta, filename: resuelta, loaded: true, exports };
}

inyectar('../db', dobleDb);

// ── Doble del control de suscripción: enforcement siempre encendido y clínica
// sin plan, que es justo el estado de una cuenta recién creada. ──
let accesoActivo = false;
inyectar('../lib/subscription', {
  ENFORCED_ROLES: ['clinic_admin', 'doctor', 'receptionist'],
  enforcementEnabled: () => true,
  isExemptClinic: () => false,
  clinicHasAccess: async () => ({ active: accesoActivo, reason: accesoActivo ? 'active' : 'none' }),
  invalidate() {},
  invalidateAll() {},
});

const authRouter = require('../routes/auth');
const { gate } = require('../middleware/subscription');

// App mínima: el guardián sobre /api y una ruta de pega que representa a
// cualquier router real (pacientes, citas, consultas…).
function crearApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', gate);
  app.use('/api/auth', authRouter);
  app.get('/api/patients', (req, res) => res.json({ ok: true }));
  app.post('/api/patients', (req, res) => res.json({ ok: true }));
  return app;
}

function levantar(app) {
  return new Promise((resolve) => {
    const srv = app.listen(0, () => resolve({ srv, url: 'http://127.0.0.1:' + srv.address().port }));
  });
}

async function pedir(url, ruta, opciones = {}) {
  const res = await fetch(url + ruta, {
    method: opciones.method || 'GET',
    headers: Object.assign(
      opciones.body ? { 'Content-Type': 'application/json' } : {},
      opciones.headers || {},
    ),
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });
  let cuerpo = null;
  try { cuerpo = await res.json(); } catch (_) {}
  return { status: res.status, body: cuerpo, cookies: res.headers.get('set-cookie') || '' };
}

const ALTA_VALIDA = {
  name: 'Ana Martínez',
  email: 'ana@clinica.hn',
  password: 'contrasena-larga',
  specialty: 'Odontología',
  clinic_name: 'Clínica Dental Sonrisa',
  city: 'Tegucigalpa',
  phone: '+504 9999 9999',
};

test('el alta crea clínica y doctor, y deja la sesión abierta', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  const r = await pedir(url, '/api/auth/register', { method: 'POST', body: ALTA_VALIDA });

  assert.equal(r.status, 201);
  assert.equal(r.body.role, 'doctor', 'el dueño se registra como doctor: es el único rol que atiende consultas');
  assert.ok(r.body.token, 'debe devolver el token para el frontend legacy');
  assert.match(r.cookies, /sd_token=/, 'la cookie HttpOnly es la fuente de verdad de la sesión');
  assert.equal(bd.sesiones.length, 1, 'la sesión queda registrada en user_sessions');

  const clinica = bd.clinicas[0];
  const doctor = bd.usuarios[0];
  assert.equal(clinica.name, 'Clínica Dental Sonrisa');
  assert.equal(clinica.city, 'Tegucigalpa');
  assert.equal(doctor.clinic_id, clinica.id);
  assert.equal(doctor.specialty, 'Odontología', 'la especialidad se guarda tal cual: enruta la ficha de consulta');
  assert.notEqual(doctor.password, ALTA_VALIDA.password, 'la contraseña se guarda hasheada');
});

test('un correo ya registrado no crea nada y se avisa con 409', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  const antes = bd.clinicas.length;
  const r = await pedir(url, '/api/auth/register', { method: 'POST', body: ALTA_VALIDA });

  assert.equal(r.status, 409);
  assert.match(r.body.error, /correo/i, 'el aviso debe señalar el correo, no la clínica');
  assert.equal(bd.clinicas.length, antes, 'no debe quedar una clínica huérfana');
});

test('dos consultorios pueden llamarse igual: el repetido se numera', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  const r = await pedir(url, '/api/auth/register', {
    method: 'POST',
    body: Object.assign({}, ALTA_VALIDA, { email: 'otro@clinica.hn' }),
  });

  assert.equal(r.status, 201);
  assert.equal(bd.clinicas[1].name, 'Clínica Dental Sonrisa (2)');
});

test('el alta rechaza datos incompletos antes de tocar la BD', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  const casos = [
    [{ name: 'A' }, 'nombre demasiado corto'],
    [{ email: 'no-es-correo' }, 'correo inválido'],
    [{ password: 'corta' }, 'contraseña de menos de 8'],
    [{ specialty: 'Astrología' }, 'especialidad fuera de la lista'],
    [{ clinic_name: '' }, 'clínica sin nombre'],
  ];

  const antes = bd.usuarios.length;
  for (const [parche, motivo] of casos) {
    const r = await pedir(url, '/api/auth/register', {
      method: 'POST',
      body: Object.assign({}, ALTA_VALIDA, { email: 'nuevo@clinica.hn' }, parche),
    });
    assert.equal(r.status, 400, motivo);
    assert.ok(r.body.error, 'el error se explica en castellano: ' + motivo);
  }
  assert.equal(bd.usuarios.length, antes, 'ningún caso inválido llega a insertar');
});

test('sin suscripción: se puede leer, no escribir', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  const alta = await pedir(url, '/api/auth/register', {
    method: 'POST',
    body: Object.assign({}, ALTA_VALIDA, { email: 'lectura@clinica.hn' }),
  });
  const cabecera = { Authorization: 'Bearer ' + alta.body.token };

  const lectura = await pedir(url, '/api/patients', { headers: cabecera });
  assert.equal(lectura.status, 200, 'recorrer la plataforma sigue permitido');

  const escritura = await pedir(url, '/api/patients', {
    method: 'POST', headers: cabecera, body: { name: 'Paciente' },
  });
  assert.equal(escritura.status, 402);
  assert.equal(escritura.body.code, 'subscription_required');
});

test('con la suscripción activa se vuelve a escribir', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  const alta = await pedir(url, '/api/auth/register', {
    method: 'POST',
    body: Object.assign({}, ALTA_VALIDA, { email: 'pagada@clinica.hn' }),
  });

  accesoActivo = true;
  t.after(() => { accesoActivo = false; });

  const escritura = await pedir(url, '/api/patients', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + alta.body.token },
    body: { name: 'Paciente' },
  });
  assert.equal(escritura.status, 200);
});

test('el propio registro y el pago nunca quedan bloqueados por el guardián', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  // /auth y /billing están exentos: sin esto, quien no ha pagado no podría ni
  // crear la cuenta ni contratar el plan que lo desbloquea.
  const r = await pedir(url, '/api/auth/register', {
    method: 'POST',
    body: Object.assign({}, ALTA_VALIDA, { email: 'exenta@clinica.hn' }),
  });
  assert.equal(r.status, 201);
});
