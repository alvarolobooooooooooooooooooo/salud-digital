// Tests de los endpoints de país (routes/clinics.js).
//
// Sin BD y sin red: el módulo `db` se sustituye por un doble en require.cache
// antes de cargar el router, y cualquier SQL no previsto revienta el test a
// propósito. Lo que se comprueba es lo que ninguna prueba de unidad ve:
//
//   · Que un DOCTOR pueda corregir el país de su propio consultorio. El alta por
//     cuenta propia crea doctores, no clinic_admin; con el país colgando del PUT
//     general (que es solo de administradores) el podólogo que se registró solo
//     no podía tocarlo — justo el caso que esto viene a resolver.
//   · Que el país quede FIJO en cuanto la clínica tiene cobros registrados. Ese
//     candado es lo único que impide reetiquetar como dólares un histórico que
//     está en lempiras, porque no hay conversión: la plataforma no se inventa
//     tasas de cambio (ver la cabecera de lib/monedas.js).
//   · Que el PUT general de la clínica no escriba la columna `currency`.
//     Mientras viajaba en ese formulario, guardar el teléfono con un valor viejo
//     en el estado cambiaba el símbolo de todo el histórico.
//
//     npm test

process.env.JWT_SECRET = process.env.JWT_SECRET || 'clave-de-pruebas-suficientemente-larga-1234';

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

// ── Doble de la base ─────────────────────────────────────────────────────────
const bd = { clinica: { id: 5, currency: 'HNL', country: 'HN' } };
let sql = [];
let hayImportes = false;   // ¿la clínica ya tiene cobros guardados?

function ejecutar(text, params) {
  const limpio = String(text).replace(/\s+/g, ' ').trim();
  sql.push({ sql: limpio, params });

  if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(limpio)) return { rows: [], rowCount: 0 };
  if (/SELECT id FROM viva|FROM user_sessions/i.test(limpio)) return { rows: [{ id: 1 }], rowCount: 1 };
  if (/^SELECT to_regclass/i.test(limpio)) return { rows: [{ t: 'public.x' }], rowCount: 1 };
  // La sonda de "¿hay dinero aquí?": una fila si la clínica ya cobró algo.
  if (/^SELECT 1 FROM \w+ WHERE clinic_id = \$1 AND \(/i.test(limpio)) {
    return hayImportes ? { rows: [{ '?column?': 1 }], rowCount: 1 } : { rows: [], rowCount: 0 };
  }
  if (/^SELECT currency, country FROM clinics/i.test(limpio)) {
    return { rows: [{ currency: bd.clinica.currency, country: bd.clinica.country }], rowCount: 1 };
  }
  if (/^SELECT country, currency FROM clinics/i.test(limpio)) {
    return { rows: [{ country: bd.clinica.country, currency: bd.clinica.currency }], rowCount: 1 };
  }
  if (/^SELECT address, city, location_source FROM clinics/i.test(limpio)) {
    return { rows: [{ address: '', city: '', location_source: 'manual' }], rowCount: 1 };
  }
  if (/^UPDATE clinics SET country = \$2, currency = \$3/i.test(limpio)) {
    bd.clinica.country = params[1];
    bd.clinica.currency = params[2];
    return { rows: [], rowCount: 1 };
  }
  if (/^UPDATE/i.test(limpio)) return { rows: [], rowCount: 1 };

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
// La geocodificación sale a Nominatim; el PUT general de la clínica la dispara.
inyectar('../lib/geocoding', { geocodeAndStore: async () => {}, searchAddress: async () => [] });

const clinicsRouter = require('../routes/clinics');
const monedas = require('../lib/monedas');

function app() {
  const a = express();
  a.use(express.json());
  a.use(cookieParser());
  a.use('/api/clinics', clinicsRouter);
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

test.beforeEach(() => {
  bd.clinica = { id: 5, currency: 'HNL', country: 'HN' };
  sql = [];
  hayImportes = false;
});

test('el estado trae el país, la moneda y el catálogo para pintar la pantalla', async (t) => {
  const { srv, url } = await levantar(app());
  t.after(() => srv.close());

  const r = await pedir(url, '/api/clinics/me/currency');
  assert.equal(r.status, 200);
  assert.equal(r.body.currency, 'HNL');
  assert.equal(r.body.country, 'HN');
  assert.equal(r.body.paises.length, monedas.PAISES.length);
  assert.equal(r.body.puede_cambiar, true, 'sin cobros guardados, el país todavía se corrige');
});

test('con cobros ya registrados, la pantalla recibe el país como fijo', async (t) => {
  const { srv, url } = await levantar(app());
  t.after(() => srv.close());

  hayImportes = true;
  const r = await pedir(url, '/api/clinics/me/currency');
  assert.equal(r.status, 200);
  assert.equal(r.body.puede_cambiar, false);
});

test('un DOCTOR corrige el país de su propio consultorio, y la moneda lo sigue', async (t) => {
  // El alta por cuenta propia crea doctores dueños de su clínica. Si esto pidiera
  // clinic_admin, el podólogo que se registró solo no podría corregir su país.
  const { srv, url } = await levantar(app());
  t.after(() => srv.close());

  const r = await pedir(url, '/api/clinics/me/country', {
    method: 'PUT', rol: 'doctor', body: { country: 'CO' },
  });

  assert.equal(r.status, 200);
  assert.equal(r.body.country, 'CO');
  assert.equal(r.body.currency, 'COP', 'la moneda sale del país, no se elige aparte');
  assert.equal(bd.clinica.country, 'CO');
  assert.equal(bd.clinica.currency, 'COP');
});

test('con cobros registrados, cambiar de país se rechaza en el servidor', async (t) => {
  // El candado de verdad. La pantalla ya deshabilita el desplegable, pero esto
  // es lo que impide que una petición directa reetiquete como pesos un
  // histórico que está en lempiras — no hay conversión que lo arregle después.
  const { srv, url } = await levantar(app());
  t.after(() => srv.close());

  hayImportes = true;
  const r = await pedir(url, '/api/clinics/me/country', {
    method: 'PUT', body: { country: 'MX' },
  });

  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'clinica_con_importes');
  assert.match(r.body.error, /Lempira/, 'el mensaje dice en qué moneda están los cobros');
  assert.equal(bd.clinica.country, 'HN', 'no se tocó nada');
  assert.equal(bd.clinica.currency, 'HNL');
});

test('repetir el mismo país no se bloquea aunque haya cobros', async (t) => {
  // Guardar el formulario de Configuración sin haber tocado el desplegable manda
  // el país que ya estaba: eso no puede devolver un 409 y romper el guardado.
  const { srv, url } = await levantar(app());
  t.after(() => srv.close());

  hayImportes = true;
  const r = await pedir(url, '/api/clinics/me/country', {
    method: 'PUT', body: { country: 'HN' },
  });

  assert.equal(r.status, 200);
  assert.equal(r.body.sin_cambio, true);
  assert.equal(r.body.currency, 'HNL');
});

test('recepción no toca el país de la clínica', async (t) => {
  const { srv, url } = await levantar(app());
  t.after(() => srv.close());

  const r = await pedir(url, '/api/clinics/me/country', {
    method: 'PUT', rol: 'receptionist', body: { country: 'MX' },
  });
  assert.equal(r.status, 403);
  assert.equal(bd.clinica.country, 'HN');
});

test('un país fuera de la lista se rechaza', async (t) => {
  const { srv, url } = await levantar(app());
  t.after(() => srv.close());

  // 'AR' estuvo aquí como ejemplo de país no soportado hasta que Argentina entró
  // en la lista: al elegir los ejemplos, que no sean países que vayamos a vender.
  for (const country of ['BR', 'Honduras', '', null]) {
    const r = await pedir(url, '/api/clinics/me/country', {
      method: 'PUT', body: { country },
    });
    assert.equal(r.status, 400, `${JSON.stringify(country)} no debería aceptarse`);
  }
  assert.equal(bd.clinica.country, 'HN');
});

test('el PUT general de la clínica no puede cambiar la moneda', async (t) => {
  // Este es el fallo que el endpoint aparte viene a cerrar: mientras `currency`
  // viajaba en este formulario, guardar el teléfono con un valor viejo en el
  // estado cambiaba el símbolo de todo el histórico de cobros.
  const { srv, url } = await levantar(app());
  t.after(() => srv.close());

  const r = await pedir(url, '/api/clinics/me', {
    method: 'PUT', rol: 'clinic_admin',
    body: { name: 'Clínica Norte', phone: '+504 2222 0000', currency: 'USD' },
  });

  assert.equal(r.status, 200, 'el resto del formulario se guarda igual');
  assert.equal(bd.clinica.currency, 'HNL', 'la moneda se quedó donde estaba');
  const update = sql.find((q) => /^UPDATE clinics SET name/i.test(q.sql));
  assert.ok(update, 'no se guardó la clínica');
  assert.ok(
    !/currency/i.test(update.sql),
    'el UPDATE general sigue escribiendo la columna currency',
  );
});

test('no queda ningún endpoint que convierta importes', async (t) => {
  // Se quitó a propósito: convertir exige una tasa de cambio, y la plataforma no
  // se inventa tasas. Si alguien reintroduce la ruta, este test lo dice.
  const { srv, url } = await levantar(app());
  t.after(() => srv.close());

  const r = await pedir(url, '/api/clinics/me/currency', {
    method: 'PUT', body: { currency: 'USD', rate: 0.038 },
  });
  assert.equal(r.status, 404);
  assert.equal(bd.clinica.currency, 'HNL');
});
