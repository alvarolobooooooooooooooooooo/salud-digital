// Tests del GUARDIÁN de suscripción (middleware/subscription.js).
//
// No tocan la base de datos ni PayPal: se sustituye lib/subscription por un
// doble. Lo que se comprueba aquí es exactamente lo que separa una plataforma
// que cobra de una que se regala — que ninguna escritura pase sin plan, y que
// las rutas que deben seguir vivas (login, pagar, enlaces ya enviados a
// pacientes) sigan pasando.
//
//     npm test

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

// middleware/auth valida el secreto al cargarse, así que se pone antes de nada.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-pruebas-suficientemente-largo-123456';

const subscription = require('../lib/subscription');
const { gate } = require('../middleware/subscription');

// Se guardan las implementaciones reales para poder restaurarlas: el doble
// muta el objeto del módulo, que es el mismo que ve el middleware.
const REAL = {
  enforcementEnabled: subscription.enforcementEnabled,
  clinicCanWrite: subscription.clinicCanWrite,
};

function firmar(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5m' });
}

const DOCTOR = { id: 7, email: 'doc@clinica.test', role: 'doctor', clinic_id: 42 };
const RECEPCION = { id: 8, email: 'rec@clinica.test', role: 'receptionist', clinic_id: 42 };
const ADMIN_CLINICA = { id: 9, email: 'adm@clinica.test', role: 'clinic_admin', clinic_id: 42 };
const SUPER_ADMIN = { id: 1, email: 'root@plataforma.test', role: 'super_admin', clinic_id: null };
const PACIENTE = { id: 2, email: 'ana@paciente.test', role: 'patient', clinic_id: null };

/**
 * Levanta una app con el guardián real delante de un router que responde 200 a
 * todo: así el código que devuelve la petición dice, sin ambigüedad, si el
 * guardián dejó pasar (200) o cortó (402).
 */
async function conGuardian({ enforcement = true, permiso = { allowed: false, reason: 'none' } } = {}) {
  subscription.enforcementEnabled = () => enforcement;
  subscription.clinicCanWrite = async () => permiso;

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', gate);
  app.all('/api/*', (req, res) => res.json({ paso: true }));

  const server = await new Promise((r) => {
    const s = app.listen(0, () => r(s));
  });
  const base = 'http://127.0.0.1:' + server.address().port;

  return {
    async pedir(method, path, usuario) {
      const res = await fetch(base + path, {
        method,
        headers: Object.assign(
          { 'Content-Type': 'application/json' },
          usuario ? { Authorization: 'Bearer ' + firmar(usuario) } : {},
        ),
        body: ['GET', 'HEAD'].includes(method) ? undefined : '{}',
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    },
    cerrar: () => new Promise((r) => server.close(r)),
  };
}

test.after(() => {
  subscription.enforcementEnabled = REAL.enforcementEnabled;
  subscription.clinicCanWrite = REAL.clinicCanWrite;
});

test('sin plan, toda escritura responde 402', async () => {
  const g = await conGuardian();
  try {
    for (const metodo of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const r = await g.pedir(metodo, '/api/patients', DOCTOR);
      assert.strictEqual(r.status, 402, `${metodo} debería quedar bloqueado`);
      assert.strictEqual(r.body.code, 'subscription_required');
    }
  } finally {
    await g.cerrar();
  }
});

test('sin plan, las lecturas siguen pasando (la app se recorre entera)', async () => {
  const g = await conGuardian();
  try {
    for (const metodo of ['GET', 'HEAD']) {
      const r = await g.pedir(metodo, '/api/patients', DOCTOR);
      assert.strictEqual(r.status, 200, `${metodo} no debería bloquearse`);
    }
  } finally {
    await g.cerrar();
  }
});

test('el bloqueo alcanza a los tres roles que consumen la plataforma', async () => {
  const g = await conGuardian();
  try {
    for (const usuario of [DOCTOR, RECEPCION, ADMIN_CLINICA]) {
      const r = await g.pedir('POST', '/api/patients', usuario);
      assert.strictEqual(r.status, 402, `${usuario.role} debería quedar bloqueado`);
    }
  } finally {
    await g.cerrar();
  }
});

test('super_admin y paciente nunca se bloquean', async () => {
  const g = await conGuardian();
  try {
    for (const usuario of [SUPER_ADMIN, PACIENTE]) {
      const r = await g.pedir('POST', '/api/patients', usuario);
      assert.strictEqual(r.status, 200, `${usuario.role} no debería bloquearse`);
    }
  } finally {
    await g.cerrar();
  }
});

test('las rutas exentas siguen vivas sin plan (o no se podría ni entrar ni pagar)', async () => {
  const g = await conGuardian();
  try {
    const exentas = [
      '/api/auth/login',
      '/api/billing/subscribe',
      '/api/billing/webhook',
      '/api/public/clinic/1/booking',
      '/api/confirmations/public/abc',
    ];
    for (const ruta of exentas) {
      const r = await g.pedir('POST', ruta, DOCTOR);
      assert.strictEqual(r.status, 200, `${ruta} debería estar exenta`);
    }
  } finally {
    await g.cerrar();
  }
});

test('una ruta que solo EMPIEZA como una exenta no se cuela', async () => {
  const g = await conGuardian();
  try {
    // '/authorizations' empieza por '/auth' pero no es '/auth' ni '/auth/…'.
    const r = await g.pedir('POST', '/api/authorizations', DOCTOR);
    assert.strictEqual(r.status, 402);
  } finally {
    await g.cerrar();
  }
});

test('sin token el guardián no opina: contesta el 401 del router', async () => {
  const g = await conGuardian();
  try {
    const r = await g.pedir('POST', '/api/patients', null);
    assert.strictEqual(r.status, 200); // el router de pruebas; en la app real, 401
  } finally {
    await g.cerrar();
  }
});

test('un token forjado no compra privilegios: lo tumba authenticate', async () => {
  subscription.enforcementEnabled = () => true;
  subscription.clinicCanWrite = async () => ({ allowed: false, reason: 'none' });

  // Aquí sí se monta el `authenticate` real detrás del guardián, que es el
  // orden que tiene la aplicación: un token que el guardián no puede verificar
  // pasa de largo, y es authenticate quien devuelve el 401.
  const { authenticate } = require('../middleware/auth');
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', gate);
  app.all('/api/*', authenticate, (req, res) => res.json({ paso: true }));

  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  try {
    // Firmado con otro secreto y reclamando ser super_admin (rol no cobrable).
    const forjado = jwt.sign({ ...DOCTOR, role: 'super_admin' }, 'otro-secreto-que-no-es-el-bueno-aaaaaaa');
    const res = await fetch('http://127.0.0.1:' + server.address().port + '/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + forjado },
      body: '{}',
    });
    assert.strictEqual(res.status, 401);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('con plan activo, las escrituras pasan', async () => {
  const g = await conGuardian({ permiso: { allowed: true, reason: 'active' } });
  try {
    const r = await g.pedir('POST', '/api/patients', DOCTOR);
    assert.strictEqual(r.status, 200);
  } finally {
    await g.cerrar();
  }
});

test('con el cobro desactivado no se bloquea nada', async () => {
  const g = await conGuardian({ enforcement: false });
  try {
    const r = await g.pedir('POST', '/api/patients', DOCTOR);
    assert.strictEqual(r.status, 200);
  } finally {
    await g.cerrar();
  }
});

test('BILLING_ENFORCEMENT: on fuerza el cobro aunque no haya procesador', () => {
  subscription.enforcementEnabled = REAL.enforcementEnabled;
  const previo = {
    palanca: process.env.BILLING_ENFORCEMENT,
    id: process.env.PAYPAL_CLIENT_ID,
    secreto: process.env.PAYPAL_CLIENT_SECRET,
  };
  try {
    // Sin credenciales: es justo el caso en el que el sistema se apagaba solo.
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;

    process.env.BILLING_ENFORCEMENT = 'on';
    assert.strictEqual(subscription.enforcementEnabled(), true, '"on" debe forzar el cobro');

    process.env.BILLING_ENFORCEMENT = 'off';
    assert.strictEqual(subscription.enforcementEnabled(), false, '"off" debe desactivarlo');

    process.env.BILLING_ENFORCEMENT = '';
    assert.strictEqual(subscription.enforcementEnabled(), false, 'sin procesador y sin palanca, no se bloquea');
  } finally {
    if (previo.palanca === undefined) delete process.env.BILLING_ENFORCEMENT;
    else process.env.BILLING_ENFORCEMENT = previo.palanca;
    if (previo.id !== undefined) process.env.PAYPAL_CLIENT_ID = previo.id;
    if (previo.secreto !== undefined) process.env.PAYPAL_CLIENT_SECRET = previo.secreto;
  }
});

test('las clínicas exentas se leen de BILLING_EXEMPT_CLINIC_IDS', () => {
  const previo = process.env.BILLING_EXEMPT_CLINIC_IDS;
  try {
    process.env.BILLING_EXEMPT_CLINIC_IDS = '5, 12 ,x,';
    assert.strictEqual(subscription.isExemptClinic(5), true);
    assert.strictEqual(subscription.isExemptClinic('5'), true, 'el id llega como texto desde el JWT');
    assert.strictEqual(subscription.isExemptClinic(12), true);
    assert.strictEqual(subscription.isExemptClinic(1), false);

    process.env.BILLING_EXEMPT_CLINIC_IDS = '';
    assert.strictEqual(subscription.isExemptClinic(5), false);
  } finally {
    if (previo === undefined) delete process.env.BILLING_EXEMPT_CLINIC_IDS;
    else process.env.BILLING_EXEMPT_CLINIC_IDS = previo;
  }
});
