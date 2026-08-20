// Tests de las lecturas que crecían con el historial de la clínica.
//
// El problema no era el tamaño de las tablas —doce mil filas no son nada para
// Postgres— sino que las pantallas de recepción se refrescan solas cada 3-8
// segundos y cada refresco recorría TODAS las citas de la clínica: filtrar con
// `DATE(a.scheduled_at) = $2` envuelve la columna en una función y anula el
// índice. Coste creciente dentro de un bucle.
//
// Estos tests fijan las dos cosas que no deben volver: que un filtro por fecha
// envuelva la columna, y que "hoy" se calcule en UTC en un país que no está en
// UTC.
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

// ── Doble de la base: apunta cada consulta con sus parámetros ──
const ejecutadas = [];
inyectar('../db', {
  query: async (text, params) => {
    ejecutadas.push({ sql: String(text).replace(/\s+/g, ' ').trim(), params });
    const sql = String(text);
    if (/FROM patients WHERE id/i.test(sql)) return { rows: [{ id: 31, clinic_id: 42 }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  },
  pool: { connect: async () => { throw new Error('no debería conectar'); } },
});

const { fechaLocal, rangoDelDia, rangoDelMinuto, normalizarFechaHora } = require('../lib/dia-local');

const RECEPCION = { id: 8, role: 'receptionist', clinic_id: 42 };

function token(u) {
  return jwt.sign(u, process.env.JWT_SECRET, { expiresIn: '5m' });
}

function levantar(montar) {
  const app = express();
  app.use(express.json());
  montar(app);
  return new Promise((r) => {
    const srv = app.listen(0, () => r({ srv, url: 'http://127.0.0.1:' + srv.address().port }));
  });
}

function pedir(url, ruta, usuario = RECEPCION) {
  return fetch(url + ruta, { headers: { Authorization: 'Bearer ' + token(usuario) } });
}

function ultima(patron) {
  return ejecutadas.filter((c) => patron.test(c.sql)).pop();
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. La zona horaria: el fallo que vaciaba la agenda cada tarde
// ─────────────────────────────────────────────────────────────────────────────

test('a las 18:30 en Honduras, "hoy" sigue siendo hoy', () => {
  // `toISOString()` da la fecha UTC. Honduras es UTC−6, así que a partir de las
  // 18:00 la fecha UTC ya es la de mañana y la agenda del día se vaciaba sola.
  const tarde = new Date('2026-08-20T18:30:00-06:00');
  assert.strictEqual(
    tarde.toISOString().split('T')[0], '2026-08-21',
    'esto es lo que hacía el código viejo: se adelanta un día',
  );
  assert.strictEqual(fechaLocal(tarde), '2026-08-20', 'la fecha local es la correcta');
});

test('el rango del día cubre de medianoche a medianoche', () => {
  assert.deepStrictEqual(rangoDelDia('2026-08-20'), { desde: '2026-08-20', hasta: '2026-08-21' });
  assert.deepStrictEqual(rangoDelDia('2026-08-31'), { desde: '2026-08-31', hasta: '2026-09-01' });
  assert.deepStrictEqual(rangoDelDia('2026-12-31'), { desde: '2026-12-31', hasta: '2027-01-01' });
  // Año bisiesto: 2028 lo es.
  assert.deepStrictEqual(rangoDelDia('2028-02-28'), { desde: '2028-02-28', hasta: '2028-02-29' });
});

test('una cita a cualquier hora del día cae dentro de su rango', () => {
  const { desde, hasta } = rangoDelDia('2026-08-20');
  for (const hora of ['00:00', '07:30', '12:00', '18:45', '23:59']) {
    const fila = `2026-08-20T${hora}:00`;
    assert.ok(fila >= desde && fila < hasta, `${fila} debería estar dentro del día`);
  }
  assert.ok(!(`2026-08-21T00:00:00` < hasta), 'el día siguiente queda fuera');
  assert.ok(!(`2026-08-19T23:59:59` >= desde), 'el día anterior queda fuera');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Los filtros tienen que poder usar el índice
// ─────────────────────────────────────────────────────────────────────────────

const receptionRouter = require('../routes/reception');

const RUTAS_DE_RECEPCION = [
  '/api/reception/today-appointments',
  '/api/reception/waiting-queue',
  '/api/reception/stats-today',
  '/api/reception/payments-today',
];

test('ninguna consulta de recepción envuelve la columna que filtra', async () => {
  // Es LA regresión a evitar: `DATE(col) = $x` o `col::date = $x` anulan el
  // índice y convierten un sondeo de cada 3 segundos en un recorrido completo.
  const { srv, url } = await levantar((app) => app.use('/api/reception', receptionRouter));
  try {
    for (const ruta of RUTAS_DE_RECEPCION) {
      ejecutadas.length = 0;
      await pedir(url, ruta);
      assert.ok(ejecutadas.length > 0, `${ruta} debería consultar algo`);
      for (const c of ejecutadas) {
        assert.ok(
          !/DATE\s*\(\s*[a-z_.]*(scheduled_at|paid_at)/i.test(c.sql),
          `${ruta} no debe envolver la columna en DATE(): ${c.sql.slice(0, 120)}`,
        );
        assert.ok(
          !/(scheduled_at|paid_at)\s*::\s*date/i.test(c.sql),
          `${ruta} no debe castear la columna con ::date: ${c.sql.slice(0, 120)}`,
        );
      }
    }
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

test('las consultas de recepción filtran por rango, con los dos extremos', async () => {
  const { srv, url } = await levantar((app) => app.use('/api/reception', receptionRouter));
  try {
    for (const ruta of RUTAS_DE_RECEPCION) {
      ejecutadas.length = 0;
      await pedir(url, ruta);
      const conRango = ejecutadas.filter((c) => />=\s*\$\d/.test(c.sql) && /<\s*\$\d/.test(c.sql));
      assert.ok(conRango.length > 0, `${ruta} debería filtrar por rango`);
      // Y los extremos han de ser el día local, no la fecha UTC.
      const { desde, hasta } = rangoDelDia();
      const params = conRango[0].params.map(String);
      assert.ok(params.includes(desde), `${ruta} debe usar el día local como inicio`);
      assert.ok(params.includes(hasta), `${ruta} debe usar el día siguiente como fin`);
    }
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Normalizar al escribir, sin mover la hora
// ─────────────────────────────────────────────────────────────────────────────

test('una hora con zona explícita se convierte, no se recorta', () => {
  // `reception.html` manda toISOString(): una cita de las 10:00 en Honduras
  // llega como 16:00Z. Quedarse con el "16:00" la movería seis horas.
  assert.strictEqual(normalizarFechaHora('2026-08-20T16:00:00.000Z'), '2026-08-20T10:00:00');
  assert.strictEqual(normalizarFechaHora('2026-08-20T10:00:00-06:00'), '2026-08-20T10:00:00');
  // Y una de madrugada UTC pertenece al día anterior en Honduras.
  assert.strictEqual(normalizarFechaHora('2026-08-21T01:00:00.000Z'), '2026-08-20T19:00:00');
});

test('una hora sin zona es hora de pared y se respeta', () => {
  assert.strictEqual(normalizarFechaHora('2026-08-20T10:00'), '2026-08-20T10:00:00');
  assert.strictEqual(normalizarFechaHora('2026-08-20 10:00:00'), '2026-08-20T10:00:00');
});

test('una fecha imposible se rechaza en vez de guardarse', () => {
  for (const malo of ['2026-13-45T10:00', 'no soy fecha', '', null, undefined]) {
    assert.strictEqual(normalizarFechaHora(malo), null, `${malo} debería rechazarse`);
  }
});

test('el rango del minuto reconoce la misma hora escrita de varias formas', () => {
  // La comprobación de choque comparaba cadenas exactas, así que '…T10:00' y
  // '…T10:00:00' se daban por horarios distintos y las citas se solapaban.
  const r = rangoDelMinuto('2026-08-20T10:00:00');
  for (const fila of ['2026-08-20T10:00', '2026-08-20T10:00:00', '2026-08-20T10:00:45']) {
    assert.ok(fila >= r.desde && fila < r.hasta, `${fila} es el mismo minuto`);
  }
  for (const fila of ['2026-08-20T10:01:00', '2026-08-20T09:59:59']) {
    assert.ok(!(fila >= r.desde && fila < r.hasta), `${fila} es otro minuto`);
  }
});

test('los extremos del rango del minuto terminan en dígito', () => {
  // No pueden llevar un centinela de puntuación ('…T10:00~'): la comparación de
  // texto en Postgres usa la intercalación de la base, y en las habituales la
  // puntuación puede ignorarse al comparar. Terminando en dígito, el orden es el
  // mismo en cualquier intercalación.
  const r = rangoDelMinuto('2026-08-20T23:59:00');
  assert.match(r.desde, /\d$/);
  assert.match(r.hasta, /\d$/);
  assert.strictEqual(r.hasta, '2026-08-21T00:00', 'cruza bien la medianoche');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. No traer lo que no se pinta
// ─────────────────────────────────────────────────────────────────────────────

const patientsRouter = require('../routes/patients');
const appointmentsRouter = require('../routes/appointments');

test('el listado de pacientes no arrastra el odontograma', async () => {
  // `SELECT *` traía el diagrama dental completo de TODOS los pacientes para
  // pintar una tabla de nombres y teléfonos: ~34 MB por carga a los dos años.
  const { srv, url } = await levantar((app) => app.use('/api/patients', patientsRouter));
  try {
    ejecutadas.length = 0;
    await pedir(url, '/api/patients');
    const c = ultima(/FROM patients/i);
    assert.ok(c, 'debería consultar los pacientes');
    assert.ok(!/SELECT \*|p\.\*/i.test(c.sql), 'el listado debe declarar sus columnas');
    assert.ok(!/odontogram_state/i.test(c.sql), 'el odontograma no debe viajar en el listado');
    assert.ok(/\bname\b/i.test(c.sql) && /\bphone\b/i.test(c.sql), 'sí debe traer lo que se pinta');
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

test('el calendario lleva ventana de fechas por defecto', async () => {
  // Antes devolvía todas las citas de la historia de la clínica con tres joins.
  const { srv, url } = await levantar((app) => app.use('/api/appointments', appointmentsRouter));
  try {
    ejecutadas.length = 0;
    await pedir(url, '/api/appointments/calendar');
    const c = ultima(/FROM appointments a/i);
    assert.ok(c, 'debería consultar el calendario');
    assert.ok(/>=\s*\$2/.test(c.sql) && /<\s*\$3/.test(c.sql), 'debe filtrar por rango');
    assert.match(String(c.params[1]), /^\d{4}-\d{2}-\d{2}$/);
    assert.match(String(c.params[2]), /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(String(c.params[1]) < String(c.params[2]), 'el rango debe ir hacia adelante');
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

test('el calendario respeta ?from= y ?to=, con el último día incluido', async () => {
  const { srv, url } = await levantar((app) => app.use('/api/appointments', appointmentsRouter));
  try {
    ejecutadas.length = 0;
    await pedir(url, '/api/appointments/calendar?from=2026-08-01&to=2026-08-31');
    const c = ultima(/FROM appointments a/i);
    assert.strictEqual(String(c.params[1]), '2026-08-01');
    // El tope de la consulta es exclusivo: para incluir el 31 hay que pedir el 1.
    assert.strictEqual(String(c.params[2]), '2026-09-01');
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

test('un rango invertido se rechaza', async () => {
  const { srv, url } = await levantar((app) => app.use('/api/appointments', appointmentsRouter));
  try {
    const r = await pedir(url, '/api/appointments/calendar?from=2026-12-01&to=2026-01-01');
    assert.strictEqual(r.status, 400);
  } finally {
    await new Promise((r) => srv.close(r));
  }
});
