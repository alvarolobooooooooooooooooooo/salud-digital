// Tests del alta pública de doctores (/api/auth/register), de la aprobación
// manual que la plataforma exige antes de dejar entrar a esa cuenta, y del modo
// solo lectura que rige mientras la suscripción no está activa.
//
// Sin BD, sin correo y sin red: los módulos `db`, el control de suscripción y el
// mailer se sustituyen por dobles en require.cache antes de cargar las rutas.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'clave-de-pruebas-suficientemente-larga-1234';

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

// ── Doble de la base de datos ──
// Guarda en memoria lo insertado y responde a las pocas consultas que hace el
// alta. Cualquier SQL no previsto revienta el test a propósito: si mañana el
// endpoint consulta algo nuevo, aquí se entera.
const bd = { clinicas: [], usuarios: [], sesiones: [], aceptaciones: [], eventosLegales: [] };

// Los dos documentos obligatorios publicados, tal como los devolvería la base.
// Las huellas son de pega pero el servidor las compara EXACTAMENTE, así que el
// test tiene que enviarlas idénticas — que es justo lo que se quiere probar.
const HASH_TERMS = 'a'.repeat(64);
const HASH_PRIVACY = 'b'.repeat(64);
const DOCS_LEGALES = [
  {
    id: 1, doc_key: 'terms-doctor', type: 'TERMS', name: 'Términos y Condiciones de Uso',
    description: '', audience: 'doctor', country: '', jurisdiction: '', locale: 'es',
    consent_category: 'mandatory', display_order: 1,
    version_id: 11, version: '1.0', content_hash: HASH_TERMS, content_format: 'markdown',
    summary_of_changes: '', requires_new_acceptance: true,
    published_at: new Date(), effective_at: new Date(),
  },
  {
    id: 2, doc_key: 'privacy', type: 'PRIVACY', name: 'Política de Privacidad',
    description: '', audience: 'doctor', country: '', jurisdiction: '', locale: 'es',
    consent_category: 'mandatory', display_order: 2,
    version_id: 21, version: '1.0', content_hash: HASH_PRIVACY, content_format: 'markdown',
    summary_of_changes: '', requires_new_acceptance: true,
    published_at: new Date(), effective_at: new Date(),
  },
];
const ACEPTACION_VALIDA = [
  { type: 'TERMS', version: '1.0', hash: HASH_TERMS },
  { type: 'PRIVACY', version: '1.0', hash: HASH_PRIVACY },
];

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
    // Ojo con el orden: `chairs` va escrito literal en el SQL (VALUES $1,$2,1,$3…),
    // así que a partir de ahí la posición del parámetro NO coincide con la de la
    // columna. Leerlo corrido hacía que `city` recogiera el correo.
    const fila = {
      id: bd.clinicas.length + 1,
      name: params[0], address: params[1], specialties: params[2],
      phone: params[3], email: params[4], city: params[5],
      latitude: params[6], longitude: params[7],
      // Van al final del INSERT, después de location_source y geocoded_at.
      country: params[12], currency: params[13],
    };
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
      // El estado va literal en el SQL del alta, no como parámetro: se lee de ahí
      // para que el doble no lo dé por bueno si mañana el endpoint deja de ponerlo.
      approval_status: /'pending'/.test(sql) ? 'pending' : 'approved',
      approval_notes: '',
      two_factor_enabled: false,
    };
    bd.usuarios.push(fila);
    return { rows: [{ id: fila.id, email: fila.email, role: fila.role, clinic_id: fila.clinic_id }], rowCount: 1 };
  }
  if (/^SELECT \* FROM users WHERE LOWER\(email\)/i.test(sql)) {
    const u = bd.usuarios.find((x) => x.email.toLowerCase() === String(params[0]).toLowerCase());
    return { rows: u ? [u] : [], rowCount: u ? 1 : 0 };
  }
  if (/^INSERT INTO user_sessions/i.test(sql)) {
    bd.sesiones.push({ jti: params[0], user_id: params[1] });
    return { rows: [], rowCount: 1 };
  }
  // ── Sistema legal ──
  // El alta ya no puede crear una cuenta sin registrar la aceptación de los
  // documentos vigentes, así que el doble tiene que saber cuáles son.
  if (/FROM legal_documents d\s+JOIN legal_document_versions v/i.test(sql)) {
    return { rows: DOCS_LEGALES, rowCount: DOCS_LEGALES.length };
  }
  if (/^INSERT INTO legal_acceptances/i.test(sql)) {
    bd.aceptaciones.push({
      acceptance_uid: params[0], user_id: params[1], clinic_id: params[2],
      document_type: params[6], document_version: params[8], document_hash: params[9],
      ip: params[10], user_agent: params[11], acceptance_method: params[12],
    });
    return { rows: [], rowCount: 1 };
  }
  if (/^INSERT INTO legal_audit_events/i.test(sql)) {
    bd.eventosLegales.push({ event: params[0], user_id: params[3] });
    return { rows: [], rowCount: 1 };
  }
  if (/FROM legal_acceptances/i.test(sql)) {
    const filas = bd.aceptaciones.filter((a) => a.user_id === params[0]);
    return { rows: filas, rowCount: filas.length };
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
  clinicCanWrite: async () => ({ allowed: accesoActivo, reason: accesoActivo ? 'active' : 'none' }),
  invalidate() {},
  invalidateAll() {},
});

// ── Doble del mailer ──
// El alta avisa al administrador por correo. Ni el test debe salir a SendGrid ni
// un fallo del proveedor puede tumbar un alta legítima, así que aquí se apunta
// lo enviado y se comprueba después.
const correos = [];
inyectar('../utils/mailer', {
  sendDoctorInvitation: async () => true,
  sendSignupPendingAlert: async (datos) => { correos.push({ tipo: 'aviso', datos }); return true; },
  sendAccountApproved: async (datos) => { correos.push({ tipo: 'aprobada', datos }); return true; },
  sendAccountRejected: async (datos) => { correos.push({ tipo: 'rechazada', datos }); return true; },
});

const authRouter = require('../routes/auth');
const { gate } = require('../middleware/subscription');
const presupuesto = require('../lib/password-budget');

// El presupuesto de hashing (lib/password-budget.js) es un cubo de fichas único
// para todo el proceso, y cada alta o inicio de sesión gasta una. Encadenar
// varios tests lo vacía y el siguiente recibe un 503 que no tiene nada que ver
// con lo que está probando, así que cada uno arranca con el cubo lleno.
test.beforeEach(() => presupuesto._reiniciar());

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
  specialty: 'Podología',
  clinic_name: 'Clínica Podológica Sonrisa',
  // El país es obligatorio desde que la plataforma se abrió a varios países:
  // decide la moneda con la que nace la clínica (ver lib/monedas.js).
  country: 'HN',
  city: 'Tegucigalpa',
  phone: '+504 9999 9999',
  // Sin esto no hay alta: el servidor exige la versión y la huella exactas de
  // los documentos obligatorios vigentes.
  legal_acceptances: ACEPTACION_VALIDA,
};

test('el alta crea clínica y doctor, pero NO abre sesión: queda pendiente de aprobación', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  const r = await pedir(url, '/api/auth/register', { method: 'POST', body: ALTA_VALIDA });

  assert.equal(r.status, 202, '202: la solicitud se acepta, la cuenta todavía no sirve');
  assert.equal(r.body.pending, true);
  assert.ok(r.body.message, 'se explica al doctor qué pasa ahora');
  assert.ok(!r.body.token, 'no se entrega token: la cuenta no puede entrar todavía');
  assert.doesNotMatch(r.cookies, /sd_token=/, 'tampoco se deja la cookie de sesión');
  assert.equal(bd.sesiones.length, 0, 'no se registra ninguna sesión');

  const clinica = bd.clinicas[0];
  const doctor = bd.usuarios[0];
  assert.equal(clinica.name, 'Clínica Podológica Sonrisa');
  assert.equal(clinica.city, 'Tegucigalpa');
  assert.equal(clinica.country, 'HN', 'el país elegido en el alta se guarda');
  assert.equal(clinica.currency, 'HNL', 'y la moneda sale del país, no de un valor fijo');
  assert.equal(doctor.clinic_id, clinica.id);
  assert.equal(doctor.approval_status, 'pending', 'la cuenta nace en espera de aprobación');
  assert.equal(doctor.specialty, 'Podología', 'la especialidad se guarda tal cual: enruta la ficha de consulta');
  assert.notEqual(doctor.password, ALTA_VALIDA.password, 'la contraseña se guarda hasheada');

  const aviso = correos.find((c) => c.tipo === 'aviso');
  assert.ok(aviso, 'se avisa al administrador de que hay una solicitud esperando');
  assert.equal(aviso.datos.email, ALTA_VALIDA.email);
});

test('una cuenta pendiente no puede iniciar sesión, aunque la contraseña sea correcta', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  const email = 'espera@clinica.hn';
  await pedir(url, '/api/auth/register', {
    method: 'POST', body: Object.assign({}, ALTA_VALIDA, { email }),
  });

  const r = await pedir(url, '/api/auth/login', {
    method: 'POST', body: { email, password: ALTA_VALIDA.password },
  });

  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'approval_pending');
  assert.doesNotMatch(r.cookies, /sd_token=/, 'no se abre sesión ni por error');
  assert.equal(bd.sesiones.length, 0);
});

test('aprobada la cuenta, el mismo correo y contraseña ya entran', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  const email = 'aprobada@clinica.hn';
  await pedir(url, '/api/auth/register', {
    method: 'POST', body: Object.assign({}, ALTA_VALIDA, { email }),
  });

  // Lo que hace el panel al pulsar "Aprobar" (ver routes/admin.js).
  bd.usuarios.find((u) => u.email === email).approval_status = 'approved';

  const r = await pedir(url, '/api/auth/login', {
    method: 'POST', body: { email, password: ALTA_VALIDA.password },
  });

  assert.equal(r.status, 200);
  assert.equal(r.body.role, 'doctor');
  assert.match(r.cookies, /sd_token=/, 'ahora sí se abre la sesión');
});

test('una cuenta rechazada recibe el motivo, no un "contraseña incorrecta"', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  const email = 'rechazada@clinica.hn';
  await pedir(url, '/api/auth/register', {
    method: 'POST', body: Object.assign({}, ALTA_VALIDA, { email }),
  });
  const u = bd.usuarios.find((x) => x.email === email);
  u.approval_status = 'rejected';
  u.approval_notes = 'No pudimos verificar la colegiación.';

  const r = await pedir(url, '/api/auth/login', {
    method: 'POST', body: { email, password: ALTA_VALIDA.password },
  });

  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'approval_rejected');
  assert.match(r.body.error, /colegiaci/i, 'el motivo escrito por el administrador llega al doctor');
});

test('el estado de la cuenta solo se revela con la contraseña correcta', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  const email = 'sigilo@clinica.hn';
  await pedir(url, '/api/auth/register', {
    method: 'POST', body: Object.assign({}, ALTA_VALIDA, { email }),
  });

  // Sin la contraseña, la respuesta es la de siempre: quien no es dueño del
  // correo no puede averiguar si hay una solicitud abierta con él.
  const r = await pedir(url, '/api/auth/login', {
    method: 'POST', body: { email, password: 'contrasena-equivocada' },
  });

  assert.equal(r.status, 401);
  assert.ok(!r.body.code, 'no se filtra approval_pending a quien falla la contraseña');
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

  assert.equal(r.status, 202);
  assert.equal(bd.clinicas[1].name, 'Clínica Podológica Sonrisa (2)');
});

test('el alta rechaza datos incompletos antes de tocar la BD', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  const casos = [
    [{ name: 'A' }, 'nombre demasiado corto'],
    [{ email: 'no-es-correo' }, 'correo inválido'],
    [{ password: 'corta' }, 'contraseña de menos de 8'],
    [{ specialty: 'Astrología' }, 'especialidad fuera de la lista'],
    [{ specialty: 'Odontología' }, 'el alta por cuenta propia es solo para podología'],
    [{ clinic_name: '' }, 'clínica sin nombre'],
    [{ country: '' }, 'sin país no se sabe en qué moneda cobra'],
    // Ojo al elegir el ejemplo: aquí ponía 'AR' hasta que Argentina entró en la
    // lista. Que sea un país que no vayamos a vender.
    [{ country: 'BR' }, 'país fuera de los habilitados'],
    [{ country: 'Honduras' }, 'el país viaja como código ISO, no como nombre'],
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

// El alta ya no devuelve token —la cuenta nace pendiente—, así que para probar
// el guardián de suscripción se firma uno a mano. Es exactamente lo que tendría
// un doctor ya aprobado: el guardián solo lee el rol y la clínica del JWT.
function tokenDeDoctor(clinicId) {
  return jwt.sign(
    { id: 1, email: 'doctor@clinica.hn', role: 'doctor', clinic_id: clinicId, jti: 'jti-de-prueba' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );
}

test('sin suscripción: se puede leer, no escribir', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  const cabecera = { Authorization: 'Bearer ' + tokenDeDoctor(7) };

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

  accesoActivo = true;
  t.after(() => { accesoActivo = false; });

  const escritura = await pedir(url, '/api/patients', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tokenDeDoctor(7) },
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
  assert.equal(r.status, 202);
});
