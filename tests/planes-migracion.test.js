// ── Qué desbloquea cada plan ──
//
// Migrar Expedientes dejó de estar en el plan Básico, y ese es exactamente el
// tipo de frontera que se rompe sin que nadie se entere: el día que alguien
// añada un endpoint a /api/migracion y se olvide del middleware, la función más
// cara del catálogo queda gratis, y no hay error ni log que lo diga.
//
// Aquí se comprueban las tres reglas:
//   · Básico   no pasa de la puerta
//   · Avanzado migra por su cuenta, pero no pide migración asistida
//   · Premium  las dos cosas
//
// Y una cuarta que no es de negocio sino de supervivencia: con el cobro
// apagado (desarrollo) y en las clínicas exentas, todo abierto — si no, montar
// el proyecto en local dejaría media app cerrada sin motivo.
//
//     npm test

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-pruebas-suficientemente-largo-123456';
process.env.BILLING_ENFORCEMENT = 'on';

// Estado de la base para el doble. `plan` decide qué contrató la clínica.
const bd = {
  plan: null,          // null = sin suscripción
  peticiones: [],
  correos: [],
  proximoId: 1,
};

const PLANES = {
  basico: { code: 'individual-monthly', features: {} },
  avanzado: { code: 'avanzado-monthly', features: { migracion: true } },
  premium: { code: 'premium-monthly', features: { migracion: true, migracion_asistida: true } },
};

function ejecutar(text, params) {
  const sql = String(text).replace(/\s+/g, ' ').trim();

  // La suscripción de la clínica, con las funciones de su plan.
  if (/FROM subscriptions s/i.test(sql)) {
    if (!bd.plan) return { rows: [], rowCount: 0 };
    const dentroDeUnMes = new Date(Date.now() + 30 * 86400000);
    return {
      rows: [{
        id: 1, clinic_id: 42, status: 'active', provider: 'paypal',
        current_period_end: dentroDeUnMes, amount: 19.99, currency: 'USD',
        plan_code: bd.plan.code, plan_name: bd.plan.code, plan_provider_refs: {},
        plan_features: bd.plan.features, metadata: {},
      }],
      rowCount: 1,
    };
  }

  if (/^SELECT id FROM migration_requests/i.test(sql)) {
    const abierta = bd.peticiones.find((x) => x.clinic_id === params[0] && x.status === 'pendiente');
    return { rows: abierta ? [{ id: abierta.id }] : [], rowCount: abierta ? 1 : 0 };
  }
  if (/^INSERT INTO migration_requests/i.test(sql)) {
    const fila = {
      id: bd.proximoId++, clinic_id: params[0], requested_by: params[1],
      sistema_origen: params[2], volumen: params[3], contacto: params[4], notas: params[5],
      status: 'pendiente', created_at: new Date(),
    };
    bd.peticiones.push(fila);
    return { rows: [{ id: fila.id, created_at: fila.created_at, status: fila.status }], rowCount: 1 };
  }
  if (/^SELECT id, sistema_origen/i.test(sql)) {
    const filas = bd.peticiones.filter((x) => x.clinic_id === params[0]);
    return { rows: filas, rowCount: filas.length };
  }
  if (/FROM clinics c LEFT JOIN users u/i.test(sql)) {
    return { rows: [{ clinica: 'Clínica de Prueba', tel_clinica: '', quien: 'Dra. Ejemplo', email: 'dra@clinica.test' }], rowCount: 1 };
  }
  if (/^SELECT id, name, specialty FROM users/i.test(sql)) {
    return { rows: [{ id: 7, name: 'Dra. Ejemplo', specialty: 'Podología' }], rowCount: 1 };
  }
  if (/^INSERT INTO audit_logs/i.test(sql)) return { rows: [], rowCount: 1 };
  if (/^INSERT INTO migration_batches/i.test(sql)) return { rows: [{ id: 1, created_at: new Date() }], rowCount: 1 };

  throw new Error('SQL no previsto en el doble: ' + sql.slice(0, 120));
}

const resuelta = require.resolve('../db');
require.cache[resuelta] = {
  id: resuelta, filename: resuelta, loaded: true,
  exports: { query: async (t, p) => ejecutar(t, p) },
};

// El correo al equipo no debe salir de verdad, pero sí hay que ver que se pide.
const mailer = require.resolve('../utils/mailer');
require.cache[mailer] = {
  id: mailer, filename: mailer, loaded: true,
  exports: {
    sendMigrationRequest: async (datos) => { bd.correos.push(datos); return true; },
  },
};

const suscripcion = require('../lib/subscription');
const router = require('../routes/migracion');

const DOCTOR = { id: 7, email: 'dra@clinica.test', role: 'doctor', clinic_id: 42 };

async function levantar() {
  const app = express();
  app.use(express.json());
  app.use('/api/migracion', router);
  app.use((err, req, res, _n) => res.status(500).json({ error: err.message }));
  const s = await new Promise((r) => { const x = app.listen(0, () => r(x)); });
  const base = 'http://127.0.0.1:' + s.address().port;
  return {
    async pedir(method, ruta, cuerpo) {
      const res = await fetch(base + ruta, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + jwt.sign(DOCTOR, process.env.JWT_SECRET, { expiresIn: '5m' }),
        },
        body: method === 'GET' ? undefined : JSON.stringify(cuerpo || {}),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    },
    cerrar: () => new Promise((r) => { if (s.closeAllConnections) s.closeAllConnections(); s.close(r); }),
  };
}

function conPlan(nombre) {
  bd.plan = nombre ? PLANES[nombre] : null;
  bd.peticiones.length = 0;
  bd.correos.length = 0;
  suscripcion.invalidateAll();
}

test('el plan Básico no llega a la migración', async () => {
  conPlan('basico');
  const app = await levantar();
  try {
    for (const ruta of ['/api/migracion/doctores', '/api/migracion/lotes']) {
      const r = await app.pedir('GET', ruta);
      assert.strictEqual(r.status, 402, `${ruta} debería estar cerrado`);
      assert.strictEqual(r.body.code, 'plan_upgrade_required');
      assert.strictEqual(r.body.feature, 'migracion');
    }
    // Y tampoco escribiendo.
    const w = await app.pedir('POST', '/api/migracion/lotes', { total_rows: 5 });
    assert.strictEqual(w.status, 402);
  } finally { await app.cerrar(); }
});

test('el error de plan NO se confunde con el de suscripción vencida', async () => {
  // Son dos conversaciones distintas: "esto cuesta más" y "me debes el mes".
  // Con el mismo código, la pantalla mandaba al doctor a pagar una deuda que no
  // tenía.
  conPlan('basico');
  const app = await levantar();
  try {
    const r = await app.pedir('GET', '/api/migracion/doctores');
    assert.notStrictEqual(r.body.code, 'subscription_required');
    assert.strictEqual(r.body.code, 'plan_upgrade_required');
  } finally { await app.cerrar(); }
});

test('el catálogo de campos sigue abierto: explica lo que el plan no incluye', async () => {
  conPlan('basico');
  const app = await levantar();
  try {
    const r = await app.pedir('GET', '/api/migracion/campos');
    assert.strictEqual(r.status, 200);
    assert.ok(r.body.campos.length > 0);
  } finally { await app.cerrar(); }
});

test('el plan Avanzado migra, pero no pide migración asistida', async () => {
  conPlan('avanzado');
  const app = await levantar();
  try {
    assert.strictEqual((await app.pedir('GET', '/api/migracion/doctores')).status, 200);

    const r = await app.pedir('POST', '/api/migracion/asistida', { contacto: '9988-7766' });
    assert.strictEqual(r.status, 402);
    assert.strictEqual(r.body.feature, 'migracion_asistida');
    assert.strictEqual(bd.peticiones.length, 0);
  } finally { await app.cerrar(); }
});

test('el plan Premium pide su migración, queda guardada y se avisa al equipo', async () => {
  conPlan('premium');
  const app = await levantar();
  try {
    const r = await app.pedir('POST', '/api/migracion/asistida', {
      sistema_origen: 'Medilink', volumen: '2.000', contacto: '9988-7766',
      notas: 'El sistema viejo ya no abre',
    });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(bd.peticiones.length, 1, 'la petición se guarda');
    assert.strictEqual(bd.correos.length, 1, 'y el equipo se entera');
    assert.strictEqual(bd.correos[0].sistema, 'Medilink');
    assert.strictEqual(bd.correos[0].clinica, 'Clínica de Prueba');
    assert.strictEqual(r.body.correo_enviado, true);
  } finally { await app.cerrar(); }
});

test('sin contacto no se acepta la petición: no habría por dónde responder', async () => {
  conPlan('premium');
  const app = await levantar();
  try {
    const r = await app.pedir('POST', '/api/migracion/asistida', { sistema_origen: 'Excel' });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(bd.peticiones.length, 0);
  } finally { await app.cerrar(); }
});

test('pulsar dos veces no abre dos peticiones', async () => {
  conPlan('premium');
  const app = await levantar();
  try {
    await app.pedir('POST', '/api/migracion/asistida', { contacto: '9988-7766' });
    const segunda = await app.pedir('POST', '/api/migracion/asistida', { contacto: '9988-7766' });
    assert.strictEqual(segunda.status, 409);
    assert.strictEqual(segunda.body.code, 'peticion_abierta');
    assert.strictEqual(bd.peticiones.length, 1);
    assert.strictEqual(bd.correos.length, 1, 'ni dos correos al equipo');
  } finally { await app.cerrar(); }
});

test('sin suscripción no hay funciones de plan que valgan', async () => {
  conPlan(null);
  const app = await levantar();
  try {
    assert.strictEqual((await app.pedir('GET', '/api/migracion/doctores')).status, 402);
  } finally { await app.cerrar(); }
});

test('una clínica exenta y el cobro apagado lo abren todo', async () => {
  conPlan('basico');
  process.env.BILLING_EXEMPT_CLINIC_IDS = '42';
  suscripcion.invalidateAll();
  const app = await levantar();
  try {
    assert.strictEqual((await app.pedir('GET', '/api/migracion/doctores')).status, 200,
      'una clínica exenta lo tiene todo pagado por definición');
  } finally {
    delete process.env.BILLING_EXEMPT_CLINIC_IDS;
    await app.cerrar();
  }

  process.env.BILLING_ENFORCEMENT = 'off';
  suscripcion.invalidateAll();
  const app2 = await levantar();
  try {
    assert.strictEqual((await app2.pedir('GET', '/api/migracion/doctores')).status, 200,
      'con el cobro apagado no hay planes que respetar');
  } finally {
    process.env.BILLING_ENFORCEMENT = 'on';
    suscripcion.invalidateAll();
    await app2.cerrar();
  }
});
