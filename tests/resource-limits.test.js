// Tests de los límites de recursos — la parte de la seguridad que no va de
// "quién puede ver qué" sino de "cuánto puede gastar".
//
// Todo lo que se comprueba aquí nació de un abuso concreto que el código
// permitía: pedir cien mil consultas de golpe, quitarle el tope a la lista de
// mensajes con un parámetro, saturar el hilo con imágenes gigantes, o gastar
// el presupuesto de otro usuario por compartir salida a internet con él.
//
// Sin base de datos y sin red: se inyectan dobles en require.cache, igual que
// en tests/public-booking.test.js.
//
//     npm test

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-pruebas-suficientemente-largo-123456';
// Cola pequeña para que la prueba del fondo no tarde medio minuto (1,1 s por tarea).
process.env.GEOCODE_MAX_QUEUE = '3';

function inyectar(ruta, exports) {
  const resuelta = require.resolve(ruta);
  require.cache[resuelta] = { id: resuelta, filename: resuelta, loaded: true, exports };
}

// ── Doble de la base de datos que solo apunta lo que se le pide ──
const consultasSql = [];
let hayRelacion = false;
inyectar('../db', {
  query: async (text, params) => {
    consultasSql.push({ sql: String(text).replace(/\s+/g, ' ').trim(), params });
    const sql = String(text);
    // Lo mínimo para que las rutas lleguen hasta la consulta que nos interesa.
    if (/FROM patients WHERE id/i.test(sql)) return { rows: [{ id: 31, clinic_id: 42 }], rowCount: 1 };
    if (/COUNT\(\*\) as count FROM appointments/i.test(sql)) return { rows: [{ count: '1' }], rowCount: 1 };
    if (/COUNT\(\*\) as count FROM consultations/i.test(sql)) return { rows: [{ count: '0' }], rowCount: 1 };
    if (/FROM critical_info/i.test(sql)) return { rows: [{}], rowCount: 1 };
    // La comprobación de relación médico-paciente. `hayRelacion` lo controla
    // cada test: sin filas = sin acceso; con fila = el doctor sí atiende al paciente.
    if (/SELECT 1 FROM patients p/i.test(sql)) {
      return hayRelacion ? { rows: [{ '?column?': 1 }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (/FROM chat_conversations c WHERE c\.id/i.test(sql)) {
      return { rows: [{ id: 3, clinic_id: 42, kind: 'equipo', is_member: true }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  },
  pool: { connect: async () => { throw new Error('no debería conectar'); } },
});

const limites = require('../middleware/rate-limits');
const { COOKIE_NAME } = require('../middleware/auth');

const ADMIN = { id: 9, email: 'adm@clinica.test', role: 'clinic_admin', clinic_id: 42 };
const OTRO_ADMIN = { id: 10, email: 'otro@clinica.test', role: 'clinic_admin', clinic_id: 42 };

function token(usuario) {
  return jwt.sign(usuario, process.env.JWT_SECRET, { expiresIn: '5m' });
}

function levantar(montar) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(require('cookie-parser')());
  montar(app);
  return new Promise((resolve) => {
    const srv = app.listen(0, () => resolve({ srv, url: 'http://127.0.0.1:' + srv.address().port }));
  });
}

async function pedir(url, ruta, { usuario, ip, metodo = 'GET' } = {}) {
  const headers = {};
  if (usuario) headers.Authorization = 'Bearer ' + token(usuario);
  if (ip) headers['X-Forwarded-For'] = ip;
  const res = await fetch(url + ruta, { method: metodo, headers });
  return res.status;
}

function ultimaConsulta(patron) {
  return consultasSql.filter((c) => patron.test(c.sql)).pop();
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. La clave del límite: la cuenta, no la conexión
// ─────────────────────────────────────────────────────────────────────────────

test('el límite se agota por cuenta y devuelve 429', async () => {
  const limitador = limites.crear({ windowMs: 60_000, max: 3, mensaje: 'basta' });
  const { srv, url } = await levantar((app) => {
    app.use('/api/caro', limitador);
    app.get('/api/caro', (req, res) => res.json({ ok: true }));
  });
  try {
    for (let i = 0; i < 3; i++) {
      assert.strictEqual(await pedir(url, '/api/caro', { usuario: ADMIN, ip: '1.1.1.1' }), 200);
    }
    assert.strictEqual(await pedir(url, '/api/caro', { usuario: ADMIN, ip: '1.1.1.1' }), 429);
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

test('cambiar de IP no renueva el presupuesto de una misma cuenta', async () => {
  // Es el punto del diseño: una IP se cambia sola, una cuenta cuesta un alta.
  const limitador = limites.crear({ windowMs: 60_000, max: 2, mensaje: 'basta' });
  const { srv, url } = await levantar((app) => {
    app.use('/api/caro', limitador);
    app.get('/api/caro', (req, res) => res.json({ ok: true }));
  });
  try {
    assert.strictEqual(await pedir(url, '/api/caro', { usuario: ADMIN, ip: '1.1.1.1' }), 200);
    assert.strictEqual(await pedir(url, '/api/caro', { usuario: ADMIN, ip: '2.2.2.2' }), 200);
    assert.strictEqual(await pedir(url, '/api/caro', { usuario: ADMIN, ip: '3.3.3.3' }), 429);
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

test('dos usuarios de la misma clínica no se gastan el presupuesto entre ellos', async () => {
  // Una clínica entera sale por la misma IP: si el límite fuese por IP, la
  // recepción se quedaría fuera por lo que hiciera el consultorio de al lado.
  const limitador = limites.crear({ windowMs: 60_000, max: 2, mensaje: 'basta' });
  const { srv, url } = await levantar((app) => {
    app.use('/api/caro', limitador);
    app.get('/api/caro', (req, res) => res.json({ ok: true }));
  });
  try {
    const misma = '9.9.9.9';
    assert.strictEqual(await pedir(url, '/api/caro', { usuario: ADMIN, ip: misma }), 200);
    assert.strictEqual(await pedir(url, '/api/caro', { usuario: ADMIN, ip: misma }), 200);
    assert.strictEqual(await pedir(url, '/api/caro', { usuario: ADMIN, ip: misma }), 429);
    // El compañero sigue trabajando con normalidad.
    assert.strictEqual(await pedir(url, '/api/caro', { usuario: OTRO_ADMIN, ip: misma }), 200);
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

test('sin sesión se cuenta por IP, y un bloque IPv6 no da direcciones infinitas', async () => {
  // Un /64 de IPv6 son 18 trillones de direcciones: contarlas una a una sería
  // no contar nada.
  const limitador = limites.crear({ windowMs: 60_000, max: 2, mensaje: 'basta' });
  const { srv, url } = await levantar((app) => {
    app.use('/api/abierto', limitador);
    app.get('/api/abierto', (req, res) => res.json({ ok: true }));
  });
  try {
    assert.strictEqual(await pedir(url, '/api/abierto', { ip: '2001:db8:1:2:aaaa::1' }), 200);
    assert.strictEqual(await pedir(url, '/api/abierto', { ip: '2001:db8:1:2:bbbb::2' }), 200);
    assert.strictEqual(await pedir(url, '/api/abierto', { ip: '2001:db8:1:2:cccc::3' }), 429);
    // Otro /64 es otro abonado: presupuesto propio.
    assert.strictEqual(await pedir(url, '/api/abierto', { ip: '2001:db8:1:99:aaaa::1' }), 200);
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

test('soloEscrituras deja pasar las lecturas y cuenta las escrituras', async () => {
  const limitador = limites.soloEscrituras(limites.crear({ windowMs: 60_000, max: 1, mensaje: 'basta' }));
  const { srv, url } = await levantar((app) => {
    app.use('/api/cosa', limitador);
    app.all('/api/cosa', (req, res) => res.json({ ok: true }));
  });
  try {
    const u = { usuario: ADMIN, ip: '4.4.4.4' };
    assert.strictEqual(await pedir(url, '/api/cosa', { ...u, metodo: 'POST' }), 200);
    assert.strictEqual(await pedir(url, '/api/cosa', { ...u, metodo: 'POST' }), 429);
    // Las lecturas nunca entraron en la cuenta.
    for (let i = 0; i < 5; i++) {
      assert.strictEqual(await pedir(url, '/api/cosa', u), 200);
    }
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Consultas acotadas: ninguna respuesta puede crecer sin freno
// ─────────────────────────────────────────────────────────────────────────────

const patientsRouter = require('../routes/patients');

// Recepción y no administración: la ficha del paciente solo adjunta el historial
// cuando quien pregunta NO es clinic_admin (routes/patients.js), y es justo esa
// respuesta con historial la que hay que acotar.
const RECEPCION = { id: 8, email: 'rec@clinica.test', role: 'receptionist', clinic_id: 42 };

// Los tokens van SIN jti a propósito: así `authenticate` no consulta
// user_sessions y la prueba no necesita una base de datos de verdad.
function conPacientes() {
  return levantar((app) => {
    app.use('/api/patients', patientsRouter);
  });
}

function comoRecepcion(url, ruta) {
  return fetch(url + ruta, { headers: { Authorization: 'Bearer ' + token(RECEPCION) } });
}

test('?limit gigante no saca más de 200 consultas', async () => {
  const { srv, url } = await conPacientes();
  try {
    consultasSql.length = 0;
    await comoRecepcion(url, '/api/patients/31/consultations?limit=100000&offset=0');
    const c = ultimaConsulta(/LIMIT \$\d+ OFFSET/i);
    assert.ok(c, 'debería haberse ejecutado la consulta paginada');
    const limitEnviado = c.params[c.params.length - 2];
    assert.strictEqual(limitEnviado, 200, 'el limit debe quedar recortado al tope');
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

test('un offset negativo no llega a Postgres', async () => {
  // OFFSET -1 es un error de Postgres: sin sanear, el atacante convierte un
  // parámetro de la URL en un 500 a voluntad.
  const { srv, url } = await conPacientes();
  try {
    consultasSql.length = 0;
    await comoRecepcion(url, '/api/patients/31/consultations?limit=5&offset=-40');
    const c = ultimaConsulta(/LIMIT \$\d+ OFFSET/i);
    assert.strictEqual(c.params[c.params.length - 1], 0);
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

test('la ficha del paciente ni trae el odontograma ni pide filas sin tope', async () => {
  // odontogram_state lleva las fotos de ortodoncia en base64: incluirlo
  // convertía una ficha en una respuesta de cientos de MB.
  const { srv, url } = await conPacientes();
  try {
    consultasSql.length = 0;
    await comoRecepcion(url, '/api/patients/31');
    const c = ultimaConsulta(/FROM consultations c LEFT JOIN users/i);
    assert.ok(c, 'debería haberse pedido el historial');
    assert.ok(!/odontogram_state/i.test(c.sql), 'el blob de fotos no debe viajar en la ficha');
    assert.ok(/LIMIT \d+/i.test(c.sql), 'la consulta debe llevar LIMIT');
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

test('el índice de fotos acota cuántas consultas parsea', async () => {
  // Cada fila que vuelve pasa por JSON.parse en el único hilo del proceso.
  const { srv, url } = await conPacientes();
  try {
    consultasSql.length = 0;
    await comoRecepcion(url, '/api/patients/31/photo-index');
    const c = ultimaConsulta(/gallery_count/i);
    assert.ok(c, 'debería haberse pedido el índice');
    assert.ok(/LIMIT \d+/i.test(c.sql), 'el índice de fotos debe llevar LIMIT');
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

test('el modo incremental del chat no puede quitarle el tope a la consulta', async () => {
  // `?after=<id>` existe para traer solo lo nuevo. Antes, pasar cualquier valor
  // hacía desaparecer el LIMIT: el mismo endpoint servía para descargar la
  // conversación entera de golpe, tantas veces como se quisiera.
  const messagingRouter = require('../routes/messaging');
  const { srv, url } = await levantar((app) => {
    app.use('/api/messaging', messagingRouter);
  });
  try {
    for (const query of ['', '?after=1']) {
      consultasSql.length = 0;
      await fetch(url + '/api/messaging/conversations/3/messages' + query, {
        headers: { Authorization: 'Bearer ' + token(RECEPCION) },
      });
      const c = ultimaConsulta(/FROM chat_messages msg/i);
      assert.ok(c, 'debería haberse pedido la lista de mensajes' + query);
      assert.ok(/LIMIT \d+/i.test(c.sql), 'la lista de mensajes debe llevar LIMIT' + query);
    }
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 bis. Relación médico-paciente en las escrituras (F-07)
// ─────────────────────────────────────────────────────────────────────────────

const DOCTOR_AJENO = { id: 77, email: 'ajeno@clinica.test', role: 'doctor', clinic_id: 42 };

function comoDoctor(url, ruta, cuerpo) {
  return fetch(url + ruta, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + token(DOCTOR_AJENO),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cuerpo || {}),
  });
}

test('un doctor sin relación no escribe en el expediente de otro paciente', async () => {
  hayRelacion = false;
  // El agujero: la LECTURA sí comprobaba la relación y la ESCRITURA no, así que
  // bastaba cambiar el id de la URL para editar datos, alergias u odontograma
  // de cualquier paciente de la clínica.
  const { srv, url } = await conPacientes();
  try {
    for (const ruta of ['/api/patients/31', '/api/patients/31/critical-info', '/api/patients/31/odontogram']) {
      const r = await comoDoctor(url, ruta, { name: 'x', allergies: 'y', odontogram_state: {} });
      assert.strictEqual(r.status, 403, `PUT ${ruta} debería ser 403 sin relación`);
    }
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

test('el doctor que SÍ atiende al paciente sigue escribiendo con normalidad', async () => {
  // La otra mitad del arreglo, y la que importa para no romper la consulta:
  // cerrar el acceso ajeno no puede cerrar el propio.
  hayRelacion = true;
  const { srv, url } = await conPacientes();
  try {
    for (const ruta of ['/api/patients/31', '/api/patients/31/critical-info', '/api/patients/31/odontogram']) {
      const r = await comoDoctor(url, ruta, { name: 'x', allergies: 'y', odontogram_state: {} });
      assert.strictEqual(r.status, 200, `PUT ${ruta} debería pasar con relación`);
    }
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

test('recepción y administración siguen escribiendo con alcance de clínica', async () => {
  hayRelacion = false; // aunque no haya relación: no aplica a estos roles
  // La comprobación es SOLO para el rol doctor: el resto del personal tiene
  // alcance de clínica por diseño y no puede quedarse fuera.
  const { srv, url } = await conPacientes();
  try {
    const r = await fetch(url + '/api/patients/31', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token(RECEPCION), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ana' }),
    });
    assert.strictEqual(r.status, 200);
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Bomba de imagen: el coste va en píxeles, no en bytes
// ─────────────────────────────────────────────────────────────────────────────

const media = require('../routes/media');

function cabeceraHeic(ancho, alto) {
  const b = Buffer.alloc(64);
  b.write('ispe', 8, 'ascii');
  b.writeUInt32BE(ancho, 16);
  b.writeUInt32BE(alto, 20);
  return b;
}

test('una foto de teléfono normal pasa el control de tamaño', async () => {
  const px = media.pixelesDeclarados(cabeceraHeic(4032, 3024));
  assert.strictEqual(px, 4032 * 3024);
  assert.ok(px < media.MAX_PIXELES);
});

test('un HEIC que declara 30.000 × 30.000 se rechaza sin decodificarlo', async () => {
  // 900 megapíxeles en RGBA son ~3,6 GB de bitmap: el proceso muere antes de
  // terminar. Y el archivo que lo provoca puede pesar unos pocos KB.
  const px = media.pixelesDeclarados(cabeceraHeic(30000, 30000));
  assert.ok(px > media.MAX_PIXELES, 'debe superar el tope y ser rechazado');
});

test('si la cabecera no se entiende, no se inventa un tamaño', async () => {
  assert.strictEqual(media.pixelesDeclarados(Buffer.alloc(64)), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. La cola de geocodificación tiene fondo
// ─────────────────────────────────────────────────────────────────────────────

test('la cola de direcciones rechaza cuando se llena en vez de crecer sin fin', async () => {
  // Cada petición encolada retiene un socket abierto durante toda la espera, y
  // la cola avanza a una por segundo: sin fondo, es un amplificador.
  //
  // El test no sale a la red: se sustituye fetch por un doble. Nominatim es un
  // servicio gratuito de terceros y una suite no tiene por qué golpearlo.
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => [] });

  try {
    const geo = require('../lib/geocoding');
    assert.ok(geo.MAX_EN_COLA > 0, 'debe haber un tope declarado');

    const enVuelo = [];
    for (let i = 0; i < geo.MAX_EN_COLA + 5; i++) {
      enVuelo.push(geo.searchAddress('tegucigalpa centro ' + i).then(
        () => 'ok',
        (err) => (err && err.colaLlena ? 'llena' : 'otro-error'),
      ));
    }
    const resultados = await Promise.all(enVuelo);
    assert.strictEqual(
      resultados.filter((r) => r === 'llena').length, 5,
      'las cinco que exceden el fondo deben rechazarse de inmediato',
    );
    assert.strictEqual(geo.tamanoDeCola(), 0, 'la cola debe quedar vacía al terminar');
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
