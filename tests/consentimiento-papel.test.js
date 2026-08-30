// Consentimiento firmado en PAPEL — /api/consents/paper
//
// La clínica que no firma en pantalla fotografía la hoja firmada y esa foto es
// la única prueba de que el paciente consintió. De ahí lo que se comprueba:
//
//   · la foto se puede subir SIN plantilla cargada en la app (el caso que esto
//     viene a resolver: clínica de papel, biblioteca de consentimientos vacía);
//   · subir una segunda foto reemplaza la del mismo consentimiento en vez de
//     dejar dos consentimientos donde hubo uno;
//   · un paciente de otra clínica no cuela, y se rechaza ANTES de subir nada;
//   · solo entran imágenes y PDF.
//
// Sin base de datos y sin red: se inyectan dobles en require.cache, igual que
// en tests/resource-limits.test.js.
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

// ── Doble de la base: un almacén en memoria de patient_consents ──
const CLINICA = 42;
const consentimientos = new Map();
let siguienteId = 500;

inyectar('../db', {
  query: async (text, params = []) => {
    const sql = String(text).replace(/\s+/g, ' ').trim();

    if (/SELECT id FROM patients WHERE id = \$1 AND clinic_id = \$2/i.test(sql)) {
      const [id, clinic] = params;
      return (Number(id) === 31 && Number(clinic) === CLINICA)
        ? { rows: [{ id: 31 }], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    if (/SELECT id FROM consent_templates WHERE id = \$1 AND clinic_id = \$2/i.test(sql)) {
      const [id, clinic] = params;
      return (Number(id) === 7 && Number(clinic) === CLINICA)
        ? { rows: [{ id: 7 }], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    if (/SELECT name FROM users WHERE id/i.test(sql)) {
      return { rows: [{ name: 'Dra. Fabiola Zelaya' }], rowCount: 1 };
    }
    if (/SELECT \* FROM patient_consents WHERE id = \$1 AND clinic_id = \$2 AND patient_id = \$3/i.test(sql)) {
      const fila = consentimientos.get(Number(params[0]));
      const vale = fila && fila.clinic_id === Number(params[1]) && fila.patient_id === Number(params[2]);
      // Copia, no la fila viva: Postgres devuelve datos, no referencias, y una
      // referencia compartida escondería justo los errores de orden que buscamos.
      return vale ? { rows: [{ ...fila }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (/SELECT \* FROM patient_consents WHERE id = \$1 AND clinic_id = \$2/i.test(sql)) {
      const fila = consentimientos.get(Number(params[0]));
      const vale = fila && fila.clinic_id === Number(params[1]);
      return vale ? { rows: [{ ...fila }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (/^INSERT INTO patient_consents/i.test(sql)) {
      const [patient_id, template_id, clinic_id, signed_by, document_url, document_name, document_public_id] = params;
      const fila = {
        id: siguienteId++,
        patient_id: Number(patient_id),
        template_id: template_id == null ? null : Number(template_id),
        clinic_id: Number(clinic_id),
        signed_by, status: 'signed',
        document_url, document_name, document_public_id,
        document_uploaded_at: new Date().toISOString(),
      };
      consentimientos.set(fila.id, fila);
      return { rows: [{ ...fila }], rowCount: 1 };
    }
    if (/^UPDATE patient_consents SET document_url = \$1/i.test(sql)) {
      const [url, nombre, publicId, firmadoPor, templateId, id, clinic] = params;
      const fila = consentimientos.get(Number(id));
      if (!fila || fila.clinic_id !== Number(clinic)) return { rows: [], rowCount: 0 };
      Object.assign(fila, {
        document_url: url, document_name: nombre, document_public_id: publicId,
        document_uploaded_at: new Date().toISOString(), status: 'signed',
        signed_by: firmadoPor || fila.signed_by,
        template_id: templateId == null ? fila.template_id : Number(templateId),
      });
      return { rows: [{ ...fila }], rowCount: 1 };
    }
    if (/^UPDATE patient_consents SET document_url = NULL/i.test(sql)) {
      const fila = consentimientos.get(Number(params[0]));
      if (fila) {
        Object.assign(fila, {
          document_url: null, document_name: null,
          document_public_id: null, document_uploaded_at: null,
        });
      }
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  },
  pool: { connect: async () => { throw new Error('no debería conectar'); } },
});

// ── Doble de Cloudinary: apunta lo que sube y lo que borra ──
const subidas = [];
const borrados = [];
inyectar('cloudinary', {
  v2: {
    config: () => {},
    uploader: {
      upload_stream: (opciones, cb) => ({
        end: (buffer) => {
          const publicId = `${opciones.folder}/${opciones.public_id}`;
          subidas.push({ folder: opciones.folder, bytes: buffer.length, public_id: publicId });
          cb(null, { secure_url: `https://res.cloudinary.com/x/${publicId}.jpg`, public_id: publicId });
        },
      }),
      destroy: async (publicId) => { borrados.push(publicId); return { result: 'ok' }; },
    },
  },
});

const { COOKIE_NAME } = require('../middleware/auth');
const DOCTORA = { id: 9, email: 'doc@clinica.test', role: 'doctor', clinic_id: CLINICA };

function token(usuario) {
  return jwt.sign(usuario, process.env.JWT_SECRET, { expiresIn: '5m' });
}

function levantar() {
  const app = express();
  app.use(express.json());
  app.use(require('cookie-parser')());
  app.use('/api/consents', require('../routes/consents'));
  // Mismo tratamiento de errores de subida que server.js.
  app.use((err, req, res, next) => {
    if (err && err.code === 'INVALID_FILE_TYPE') {
      return res.status(415).json({ error: err.message, code: 'invalid_file_type' });
    }
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'El archivo es demasiado grande.' });
    }
    console.error(err);
    res.status(500).json({ error: 'boom' });
  });
  return new Promise((resolve) => {
    const srv = app.listen(0, () => resolve({ srv, url: 'http://127.0.0.1:' + srv.address().port }));
  });
}

function formulario({ patientId = 31, templateId, consentId, nombre = 'consentimiento.jpg', tipo = 'image/jpeg' } = {}) {
  const fd = new FormData();
  fd.append('document', new Blob([Buffer.from('foto-de-la-hoja-firmada')], { type: tipo }), nombre);
  fd.append('patient_id', String(patientId));
  if (templateId) fd.append('template_id', String(templateId));
  if (consentId) fd.append('consent_id', String(consentId));
  return fd;
}

async function subir(url, opciones) {
  return fetch(url + '/api/consents/paper', {
    method: 'POST',
    headers: { cookie: `${COOKIE_NAME}=${token(DOCTORA)}` },
    body: formulario(opciones),
  });
}

test('la clínica de papel sube la foto sin tener plantilla cargada', async (t) => {
  const { srv, url } = await levantar();
  t.after(() => srv.close());
  subidas.length = 0;

  const res = await subir(url);
  assert.strictEqual(res.status, 200);
  const consent = await res.json();

  assert.strictEqual(consent.template_id, null, 'no se exige plantilla');
  assert.strictEqual(consent.status, 'signed');
  assert.strictEqual(consent.patient_id, 31);
  assert.match(consent.document_url, /^https:\/\/res\.cloudinary\.com\//);
  assert.strictEqual(consent.document_name, 'consentimiento.jpg');
  assert.ok(consent.document_uploaded_at, 'queda la fecha en que se archivó');
  // Sin signed_by en el cuerpo, se rellena con el nombre del profesional.
  assert.strictEqual(consent.signed_by, 'Dra. Fabiola Zelaya');
  assert.strictEqual(subidas.length, 1);
  assert.strictEqual(subidas[0].folder, `consents/${CLINICA}/31`);
});

test('subir otra foto reemplaza la del mismo consentimiento, no crea uno nuevo', async (t) => {
  const { srv, url } = await levantar();
  t.after(() => srv.close());
  borrados.length = 0;

  const primera = await (await subir(url, { templateId: 7 })).json();
  const antes = consentimientos.size;

  const segunda = await (await subir(url, { consentId: primera.id, nombre: 'mejor-foto.jpg' })).json();

  assert.strictEqual(segunda.id, primera.id, 'sigue siendo el mismo consentimiento');
  assert.strictEqual(consentimientos.size, antes, 'no se duplicó la fila');
  assert.strictEqual(segunda.document_name, 'mejor-foto.jpg');
  assert.notStrictEqual(segunda.document_url, primera.document_url);
  assert.strictEqual(segunda.template_id, 7, 'la plantilla anterior no se pierde');
  assert.deepStrictEqual(borrados, [primera.document_public_id], 'la foto vieja se borra de Cloudinary');
});

test('un paciente de otra clínica no cuela, y no se sube nada', async (t) => {
  const { srv, url } = await levantar();
  t.after(() => srv.close());
  subidas.length = 0;

  const res = await subir(url, { patientId: 999 });
  assert.strictEqual(res.status, 404);
  assert.strictEqual(subidas.length, 0, 'se valida antes de gastar la subida');
});

test('una plantilla de otra clínica tampoco', async (t) => {
  const { srv, url } = await levantar();
  t.after(() => srv.close());
  subidas.length = 0;

  const res = await subir(url, { templateId: 4321 });
  assert.strictEqual(res.status, 404);
  assert.strictEqual(subidas.length, 0);
});

test('solo entran imágenes y PDF', async (t) => {
  const { srv, url } = await levantar();
  t.after(() => srv.close());
  subidas.length = 0;

  const res = await subir(url, { nombre: 'notas.txt', tipo: 'text/plain' });
  assert.strictEqual(res.status, 415, 'un tipo no permitido no puede acabar en 500');
  assert.strictEqual(subidas.length, 0);
});

test('quitar el documento deja el consentimiento y borra el archivo', async (t) => {
  const { srv, url } = await levantar();
  t.after(() => srv.close());
  borrados.length = 0;

  const consent = await (await subir(url)).json();
  const res = await fetch(`${url}/api/consents/${consent.id}/document`, {
    method: 'DELETE',
    headers: { cookie: `${COOKIE_NAME}=${token(DOCTORA)}` },
  });
  assert.strictEqual(res.status, 200);

  const fila = consentimientos.get(consent.id);
  assert.ok(fila, 'el consentimiento sigue existiendo');
  assert.strictEqual(fila.document_url, null);
  assert.deepStrictEqual(borrados, [consent.document_public_id]);
});

test('quitar el documento de otra clínica devuelve 404', async (t) => {
  const { srv, url } = await levantar();
  t.after(() => srv.close());

  const consent = await (await subir(url)).json();
  const ajeno = jwt.sign({ id: 1, email: 'x@y.test', role: 'doctor', clinic_id: 777 },
    process.env.JWT_SECRET, { expiresIn: '5m' });
  const res = await fetch(`${url}/api/consents/${consent.id}/document`, {
    method: 'DELETE',
    headers: { cookie: `${COOKIE_NAME}=${ajeno}` },
  });
  assert.strictEqual(res.status, 404);
});
