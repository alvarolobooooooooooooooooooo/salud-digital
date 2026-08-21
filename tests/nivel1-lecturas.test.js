// Tests del "Nivel 1": las lecturas y escrituras cuyo coste crecía con el uso.
//
// Tres cosas distintas, mismo síntoma — la plataforma se hace más lenta cada mes
// aunque no entre ni un doctor nuevo:
//
//   1. CADA petición autenticada escribía `last_seen` en user_sessions. Una sola
//      pantalla de recepción son ~51 peticiones/min, así que se escribía tanto
//      como se leía.
//   2. `GET /api/appointments` devolvía el historial ENTERO del doctor, y las
//      siete páginas de consulta lo pedían solo para localizar UNA cita.
//   3. Los filtros de Finanzas envolvían `created_at` en un cast `::date`, que
//      deja la columna fuera del índice.
//
// Estos tests fijan lo que no debe volver. Ojo con el alcance: aquí la base de
// datos es un doble que apunta el SQL, así que lo que se comprueba es la FORMA de
// la consulta (que no envuelva la columna, que acote el rango, que no escriba
// siempre). Que Postgres elija el índice es cosa de un EXPLAIN contra la base
// real, no de esta suite.
//
//     npm test

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-pruebas-suficientemente-largo-123456';

function inyectar(ruta, exports) {
  const resuelta = require.resolve(ruta);
  require.cache[resuelta] = { id: resuelta, filename: resuelta, loaded: true, exports };
}

// ── Doble de la base: apunta cada consulta y deja elegir qué devuelve ──
const ejecutadas = [];
let sesionViva = true;
inyectar('../db', {
  query: async (text, params) => {
    const sql = String(text).replace(/\s+/g, ' ').trim();
    ejecutadas.push({ sql, params });
    if (/FROM viva/i.test(sql)) {
      return sesionViva ? { rows: [{ id: 1 }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (/FROM appointments a .* WHERE a\.id = \$1/i.test(sql)) {
      return { rows: [{ id: 77, patient_id: 31, patient_name: 'Ana' }], rowCount: 1 };
    }
    // Los agregados de Finanzas leen rows[0] sin comprobar: si el doble devuelve
    // cero filas el handler revienta y el test mediría un 500, no el SQL.
    // Solo los agregados de UNA fila (sin GROUP BY): los que agrupan por día
    // devuelven un arreglo que el handler recorre, y una fila falsa sin `date`
    // lo rompería.
    if (/COALESCE\(SUM|COUNT\(/i.test(sql) && !/GROUP BY/i.test(sql)) {
      return { rows: [{ total: 0, count: 0 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  },
  pool: { connect: async () => { throw new Error('no debería conectar'); } },
});

const DOCTOR = { id: 7, role: 'doctor', clinic_id: 42 };
const ADMIN = { id: 9, role: 'clinic_admin', clinic_id: 42 };

const token = (u) => jwt.sign(u, process.env.JWT_SECRET, { expiresIn: '5m' });

const { capturar } = require('../middleware/async-errors');

function levantar(montar) {
  const app = express();
  app.use(express.json());
  montar(app);
  // Igual que server.js: sin esto, un throw dentro de un handler async deja la
  // petición sin responder y el test se queda colgado en vez de fallar.
  app.use((err, req, res, _next) => res.status(500).json({ error: String(err && err.message) }));
  return new Promise((r) => {
    const srv = app.listen(0, () => r({ srv, url: 'http://127.0.0.1:' + srv.address().port }));
  });
}
const pedir = (url, ruta, usuario = DOCTOR) =>
  fetch(url + ruta, {
    headers: { Authorization: 'Bearer ' + token(usuario) },
    signal: AbortSignal.timeout(5000),
  });
const ultima = (patron) => ejecutadas.filter((c) => patron.test(c.sql)).pop();

// ─────────────────────────────────────────────────────────────────────────────
// 1. La escritura en cada petición
// ─────────────────────────────────────────────────────────────────────────────

test('la sesión se comprueba sin escribir en cada petición', async () => {
  const { authenticate } = require('../middleware/auth');
  const { srv, url } = await levantar((app) => {
    app.get('/algo', authenticate, (req, res) => res.json({ ok: true }));
  });
  try {
    ejecutadas.length = 0;
    sesionViva = true;
    const r = await fetch(url + '/algo', {
      headers: { Authorization: 'Bearer ' + jwt.sign({ ...DOCTOR, jti: 'abc' }, process.env.JWT_SECRET, { expiresIn: '5m' }) },
    });
    assert.strictEqual(r.status, 200);

    const c = ejecutadas.pop();
    assert.ok(c, 'debería comprobar la sesión');

    // Lo que NO debe volver: un UPDATE incondicional de last_seen.
    assert.ok(
      !/^UPDATE user_sessions SET last_seen = CURRENT_TIMESTAMP WHERE jti/i.test(c.sql),
      'volvió el UPDATE incondicional en cada petición:\n' + c.sql,
    );
    // Sigue comprobando la revocación (cerrar sesión tiene que surtir efecto ya).
    assert.match(c.sql, /revoked_at IS NULL/i);
    // Y solo refresca la marca si está vieja.
    assert.match(c.sql, /last_seen < CURRENT_TIMESTAMP - \(\$2 \|\| ' seconds'\)::interval/i);
    assert.strictEqual(c.params[1], 60, 'el freno por defecto son 60 s');
  } finally { srv.close(); }
});

test('el freno queda por debajo de la ventana de presencia del chat', () => {
  // routes/messaging.js marca "online" con last_seen en los últimos 5 minutos.
  // Si el freno fuese >= 5 min, los doctores parpadearían entre conectado y no.
  const messaging = require('fs').readFileSync(require.resolve('../routes/messaging.js'), 'utf8');
  const m = messaging.match(/interval '(\d+) minutes'/);
  assert.ok(m, 'ya no se ve la ventana de presencia en messaging.js: revisar este test');
  const ventanaSegundos = Number(m[1]) * 60;
  const freno = 60; // el defecto de SESSION_TOUCH_SECONDS
  assert.ok(freno < ventanaSegundos, `el freno (${freno}s) debe ser menor que la ventana de presencia (${ventanaSegundos}s)`);
});

test('una sesión revocada sigue cortando con 401', async () => {
  const { authenticate } = require('../middleware/auth');
  const { srv, url } = await levantar((app) => {
    app.get('/algo', authenticate, (req, res) => res.json({ ok: true }));
  });
  try {
    sesionViva = false;
    const r = await fetch(url + '/algo', {
      headers: { Authorization: 'Bearer ' + jwt.sign({ ...DOCTOR, jti: 'abc' }, process.env.JWT_SECRET, { expiresIn: '5m' }) },
    });
    assert.strictEqual(r.status, 401);
    sesionViva = true;
  } finally { srv.close(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. La agenda: ventana de fechas y una cita suelta
// ─────────────────────────────────────────────────────────────────────────────

function conAgenda() {
  return levantar((app) => app.use('/api/appointments', capturar(require('../routes/appointments'))));
}

test('sin parámetros, la agenda responde como siempre (no rompe un deploy a medias)', async () => {
  const { srv, url } = await conAgenda();
  try {
    ejecutadas.length = 0;
    await pedir(url, '/api/appointments');
    const c = ultima(/FROM appointments a/i);
    assert.ok(!/scheduled_at >=/i.test(c.sql), 'sin ?from no debe acotar por fecha');
  } finally { srv.close(); }
});

test('con ?from y ?to la agenda acota por rango, sin envolver la columna', async () => {
  const { srv, url } = await conAgenda();
  try {
    ejecutadas.length = 0;
    await pedir(url, '/api/appointments?from=2026-08-01&to=2026-08-31');
    const c = ultima(/FROM appointments a/i);
    assert.match(c.sql, /a\.scheduled_at >= \$\d/, 'debe filtrar por rango');
    assert.match(c.sql, /a\.scheduled_at < \$\d/, 'el tope debe ser exclusivo');
    assert.ok(
      !/DATE\(|::date/i.test(c.sql),
      'la columna no puede ir envuelta en un cast, o el índice no se usa:\n' + c.sql,
    );
    assert.ok(c.params.includes('2026-08-01'), 'el inicio va tal cual');
    assert.ok(
      c.params.includes('2026-09-01'),
      'el tope debe avanzar un día para que el 31 entre entero; params: ' + JSON.stringify(c.params),
    );
  } finally { srv.close(); }
});

test('un rango invertido se rechaza con 400', async () => {
  const { srv, url } = await conAgenda();
  try {
    const r = await pedir(url, '/api/appointments?from=2026-08-31&to=2026-08-01');
    assert.strictEqual(r.status, 400);
  } finally { srv.close(); }
});

test('una cita se pide por id, no descargando el historial entero', async () => {
  const { srv, url } = await conAgenda();
  try {
    ejecutadas.length = 0;
    const r = await pedir(url, '/api/appointments/77');
    assert.strictEqual(r.status, 200);
    const c = ultima(/FROM appointments a/i);
    assert.match(c.sql, /WHERE a\.id = \$1/, 'debe filtrar por id en la base');
    assert.match(c.sql, /a\.doctor_id = \$3/, 'un doctor solo ve sus citas');
    assert.deepStrictEqual((await r.json()).id, 77);
  } finally { srv.close(); }
});

test('/today y /calendar no se los come la ruta de :id', async () => {
  const { srv, url } = await conAgenda();
  try {
    for (const [ruta, marca] of [['/api/appointments/today', /scheduled_at >= \$2 AND a\.scheduled_at < \$3/i],
                                 ['/api/appointments/calendar', /scheduled_at >= \$2 AND a\.scheduled_at < \$3/i]]) {
      ejecutadas.length = 0;
      const r = await pedir(url, ruta);
      assert.strictEqual(r.status, 200, ruta + ' debería seguir respondiendo 200');
      const c = ultima(/FROM appointments a/i);
      assert.ok(!/WHERE a\.id = \$1/.test(c.sql), ruta + ' cayó en la ruta de :id');
      assert.match(c.sql, marca);
    }
  } finally { srv.close(); }
});

test('un id no numérico no llega a la consulta de una cita', async () => {
  const { srv, url } = await conAgenda();
  try {
    const r = await pedir(url, '/api/appointments/no-soy-un-numero');
    assert.strictEqual(r.status, 404, 'debería ser un 404 de ruta, no una consulta');
  } finally { srv.close(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Finanzas: filtros que no envuelvan created_at
// ─────────────────────────────────────────────────────────────────────────────

test('ningún filtro de Finanzas envuelve created_at en un cast', async () => {
  const { srv, url } = await levantar((app) =>
    app.use('/api/consultations', capturar(require('../routes/consultations'))));
  try {
    const rutas = [
      ['/api/consultations/finances/summary', DOCTOR],
      ['/api/consultations/finances/weekly?range=7d', DOCTOR],
      ['/api/consultations/finances/paid?startDate=2026-08-01&endDate=2026-08-31', DOCTOR],
      ['/api/consultations/finances/by-doctor?startDate=2026-08-01&endDate=2026-08-31', ADMIN],
    ];
    for (const [ruta, quien] of rutas) {
      ejecutadas.length = 0;
      const r = await pedir(url, ruta, quien);
      assert.strictEqual(r.status, 200, ruta);
      const conFecha = ejecutadas.filter((c) => /created_at/i.test(c.sql));
      assert.ok(conFecha.length, ruta + ': no se vio ninguna consulta con created_at');
      for (const c of conFecha) {
        // El cast puede seguir en el SELECT/GROUP BY (agrupar por día es una
        // proyección); lo que no puede es aparecer en una comparación.
        assert.ok(
          !/created_at::date\s*(>=|<=|<|>|=)/i.test(c.sql),
          ruta + ': volvió el cast en el filtro:\n' + c.sql,
        );
      }
    }
  } finally { srv.close(); }
});

test('el tope de Finanzas avanza un día para que el último día entre entero', async () => {
  const { srv, url } = await levantar((app) =>
    app.use('/api/consultations', capturar(require('../routes/consultations'))));
  try {
    ejecutadas.length = 0;
    await pedir(url, '/api/consultations/finances/paid?startDate=2026-08-01&endDate=2026-08-31', DOCTOR);
    const c = ultima(/FROM consultations c/i);
    assert.ok(
      c.params.includes('2026-09-01'),
      'sin avanzar el día, las consultas del 31 quedarían fuera; params: ' + JSON.stringify(c.params),
    );
  } finally { srv.close(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Pacientes: sin DISTINCT inútil, con búsqueda y conteo en servidor
// ─────────────────────────────────────────────────────────────────────────────

function conPacientes() {
  return levantar((app) => app.use('/api/patients', capturar(require('../routes/patients'))));
}

test('el listado de pacientes ya no arrastra un DISTINCT que no quita nada', async () => {
  const { srv, url } = await conPacientes();
  try {
    ejecutadas.length = 0;
    await pedir(url, '/api/patients');
    const c = ultima(/FROM patients p/i);
    // Se selecciona de UNA tabla, sin joins, e incluye `id`, que es única: no hay
    // dos filas que puedan colapsar. El DISTINCT solo forzaba ordenar el
    // resultado entero para no descartar nada.
    assert.ok(!/SELECT DISTINCT/i.test(c.sql), 'volvió el DISTINCT:\n' + c.sql);
    // Y sigue siendo la lista del doctor, no la de toda la clínica.
    assert.match(c.sql, /p\.created_by = \$\d/);
    assert.match(c.sql, /FROM appointments WHERE doctor_id = \$\d/);
  } finally { srv.close(); }
});

test('sin limit, el listado responde entero como siempre', async () => {
  const { srv, url } = await conPacientes();
  try {
    ejecutadas.length = 0;
    await pedir(url, '/api/patients');
    const c = ultima(/FROM patients p/i);
    assert.ok(!/LIMIT/i.test(c.sql), 'sin ?limit no debe acotar');
  } finally { srv.close(); }
});

test('con limit y offset, el listado pagina en la base', async () => {
  const { srv, url } = await conPacientes();
  try {
    ejecutadas.length = 0;
    await pedir(url, '/api/patients?limit=50&offset=100');
    const c = ultima(/FROM patients p/i);
    assert.match(c.sql, /LIMIT \$\d+ OFFSET \$\d+/);
    assert.ok(c.params.includes(50) && c.params.includes(100), JSON.stringify(c.params));
  } finally { srv.close(); }
});

test('el limit se topa para que nadie pida diez mil de golpe', async () => {
  const { srv, url } = await conPacientes();
  try {
    ejecutadas.length = 0;
    await pedir(url, '/api/patients?limit=99999');
    const c = ultima(/FROM patients p/i);
    assert.ok(c.params.includes(200), 'debería quedarse en 200; params: ' + JSON.stringify(c.params));
  } finally { srv.close(); }
});

test('un limit inválido se rechaza con 400', async () => {
  const { srv, url } = await conPacientes();
  try {
    const r = await pedir(url, '/api/patients?limit=0');
    assert.strictEqual(r.status, 400);
  } finally { srv.close(); }
});

test('la búsqueda viaja a la base, no se filtra en el navegador', async () => {
  const { srv, url } = await conPacientes();
  try {
    ejecutadas.length = 0;
    await pedir(url, '/api/patients?search=Ana');
    const c = ultima(/FROM patients p/i);
    assert.match(c.sql, /p\.name ILIKE/i);
    assert.match(c.sql, /p\.identity_number ILIKE/i);
    assert.match(c.sql, /p\.phone ILIKE/i);
    assert.ok(c.params.includes('%Ana%'), JSON.stringify(c.params));
  } finally { srv.close(); }
});

test('/count cuenta en la base y no cae en la ruta de :id', async () => {
  const { srv, url } = await conPacientes();
  try {
    ejecutadas.length = 0;
    const r = await pedir(url, '/api/patients/count');
    assert.strictEqual(r.status, 200);
    const c = ultima(/FROM patients p/i);
    assert.match(c.sql, /SELECT COUNT\(\*\) AS total/i);
    assert.ok(!/WHERE p\.id = /i.test(c.sql), 'cayó en la ruta de :id');
    assert.deepStrictEqual(await r.json(), { total: 0 });
  } finally { srv.close(); }
});
