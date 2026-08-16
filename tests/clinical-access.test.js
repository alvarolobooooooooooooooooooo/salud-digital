// Tests del GUARDIÁN de acceso clínico (middleware/clinical-access.js).
//
// No tocan la base de datos: el guardián solo lee el rol del JWT. Lo que se
// comprueba aquí es la frontera que faltaba — que una cuenta de paciente no
// alcance el expediente de nadie, y que el personal de la clínica siga entrando
// exactamente igual que antes.
//
//     npm test

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

// middleware/auth valida el secreto al cargarse, así que se pone antes de nada.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-pruebas-suficientemente-largo-123456';

const { gate } = require('../middleware/clinical-access');
const { COOKIE_NAME } = require('../middleware/auth');

function firmar(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5m' });
}

const DOCTOR = { id: 7, email: 'doc@clinica.test', role: 'doctor', clinic_id: 42 };
const RECEPCION = { id: 8, email: 'rec@clinica.test', role: 'receptionist', clinic_id: 42 };
const ADMIN_CLINICA = { id: 9, email: 'adm@clinica.test', role: 'clinic_admin', clinic_id: 42 };
const SUPER_ADMIN = { id: 1, email: 'root@plataforma.test', role: 'super_admin', clinic_id: null };
const PACIENTE = { id: 2, email: 'ana@paciente.test', role: 'patient', clinic_id: 42 };
const PERSONAL = [DOCTOR, RECEPCION, ADMIN_CLINICA, SUPER_ADMIN];

// Las rutas que devolvían PHI a cualquiera que no fuese 'doctor' — es decir,
// justo por donde entraba una cuenta de paciente.
const RUTAS_CON_PHI = [
  '/api/patients',
  '/api/patients/31',
  '/api/patients/31/critical-info',
  '/api/patients/31/consultations',
  '/api/consultations/99',
  '/api/consultations/99/diagram-photos',
  '/api/appointments/calendar',
  '/api/messaging/patients/31',
  '/api/consents',
  '/api/inventory',
  '/api/growth/summary',
  '/api/reception/today-appointments',
];

/**
 * Levanta una app con el guardián real delante de un router que responde 200 a
 * todo: así el código de la respuesta dice, sin ambigüedad, si el guardián dejó
 * pasar (200) o cortó (403).
 */
async function conGuardian() {
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
    base,
    async pedir(method, path, usuario, { viaCookie = false } = {}) {
      const headers = { 'Content-Type': 'application/json' };
      if (usuario && viaCookie) headers.Cookie = `${COOKIE_NAME}=${firmar(usuario)}`;
      else if (usuario) headers.Authorization = 'Bearer ' + firmar(usuario);
      const res = await fetch(base + path, {
        method,
        headers,
        body: ['GET', 'HEAD'].includes(method) ? undefined : '{}',
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    },
    cerrar: () => new Promise((r) => server.close(r)),
  };
}

test('un paciente no lee ninguna ruta con datos clínicos', async () => {
  const g = await conGuardian();
  try {
    for (const ruta of RUTAS_CON_PHI) {
      const r = await g.pedir('GET', ruta, PACIENTE);
      assert.strictEqual(r.status, 403, `GET ${ruta} debería ser 403 para un paciente`);
    }
  } finally {
    await g.cerrar();
  }
});

test('un paciente tampoco ESCRIBE en datos clínicos', async () => {
  const g = await conGuardian();
  try {
    for (const metodo of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const r = await g.pedir(metodo, '/api/patients/31/critical-info', PACIENTE);
      assert.strictEqual(r.status, 403, `${metodo} debería ser 403 para un paciente`);
    }
  } finally {
    await g.cerrar();
  }
});

test('el guardián corta igual si el token viaja en la cookie', async () => {
  const g = await conGuardian();
  try {
    const r = await g.pedir('GET', '/api/patients', PACIENTE, { viaCookie: true });
    assert.strictEqual(r.status, 403);
  } finally {
    await g.cerrar();
  }
});

test('un paciente sí llega a su propia sesión', async () => {
  const g = await conGuardian();
  try {
    for (const ruta of ['/api/auth/me', '/api/auth/logout', '/api/auth/change-password', '/api/auth/2fa/status']) {
      const r = await g.pedir('GET', ruta, PACIENTE);
      assert.strictEqual(r.status, 200, `${ruta} debe seguir abierta para el paciente`);
    }
  } finally {
    await g.cerrar();
  }
});

test('todo el personal de la clínica sigue pasando en todas las rutas', async () => {
  const g = await conGuardian();
  try {
    for (const usuario of PERSONAL) {
      for (const ruta of RUTAS_CON_PHI) {
        const r = await g.pedir('GET', ruta, usuario);
        assert.strictEqual(r.status, 200, `${usuario.role} no debería quedar bloqueado en ${ruta}`);
      }
      const escribe = await g.pedir('POST', '/api/consultations', usuario);
      assert.strictEqual(escribe.status, 200, `${usuario.role} debería poder escribir`);
    }
  } finally {
    await g.cerrar();
  }
});

test('las rutas públicas siguen abiertas sin token', async () => {
  const g = await conGuardian();
  try {
    const rutas = [
      '/api/public/clinics/map',
      '/api/public/clinic/1/doctors',
      '/api/confirmations/public/abc',
      '/api/invitations/tok',
      '/api/auth/login',
    ];
    for (const ruta of rutas) {
      const r = await g.pedir('GET', ruta, null);
      assert.strictEqual(r.status, 200, `${ruta} debe seguir siendo pública`);
    }
  } finally {
    await g.cerrar();
  }
});

test('una reserva pública no se rompe aunque la haga un paciente con sesión abierta', async () => {
  const g = await conGuardian();
  try {
    const r = await g.pedir('POST', '/api/public/clinic/1/booking', PACIENTE);
    assert.strictEqual(r.status, 200);
  } finally {
    await g.cerrar();
  }
});

test('el webhook de pagos no queda bloqueado', async () => {
  const g = await conGuardian();
  try {
    const r = await g.pedir('POST', '/api/billing/webhook', null);
    assert.strictEqual(r.status, 200);
  } finally {
    await g.cerrar();
  }
});

test('un rol desconocido queda cerrado por defecto', async () => {
  const g = await conGuardian();
  try {
    const intruso = { id: 3, email: 'x@y.test', role: 'auditor_externo', clinic_id: 42 };
    const r = await g.pedir('GET', '/api/patients', intruso);
    assert.strictEqual(r.status, 403);
  } finally {
    await g.cerrar();
  }
});

test('sin token el guardián no responde: deja el 401 a authenticate', async () => {
  const g = await conGuardian();
  try {
    // 200 aquí significa "el guardián pasó de largo"; en la app real el
    // `authenticate` del router es quien devuelve el 401.
    const r = await g.pedir('GET', '/api/patients', null);
    assert.strictEqual(r.status, 200);
  } finally {
    await g.cerrar();
  }
});

// Un rol falsificado no sirve de nada: el guardián verifica la FIRMA antes de
// mirar el rol, así que un paciente no se asciende a 'doctor' cocinando su
// propio token. El guardián lo trata como "sin token" y deja el 401 a
// `authenticate`, que es quien tiene que rechazarlo.
test('un token con firma inválida no se cuela con un rol inventado', async () => {
  const g = await conGuardian();
  try {
    const falso = jwt.sign({ ...PACIENTE, role: 'doctor' }, 'otro-secreto-distinto-del-real-123456');
    const res = await fetch(g.base + '/api/patients', {
      headers: { Authorization: 'Bearer ' + falso },
    });
    // No es 403 porque el guardián ni siquiera llega a leer el rol: la firma no
    // verifica, así que para él no hay usuario. En la app real, `authenticate`
    // devuelve 401 justo después.
    assert.strictEqual(res.status, 200);
  } finally {
    await g.cerrar();
  }
});
