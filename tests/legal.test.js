// Tests del sistema legal y de aceptación electrónica.
//
// La lista de comprobaciones no salió del aire: es la que sostiene lo que los
// documentos afirman. Si los términos dicen que hay historial, aquí se prueba
// que el historial sobrevive a una versión nueva; si dicen que se registra la
// versión y su huella, aquí se prueba que ambas quedan escritas; y si dicen que
// nadie reescribe una aceptación, aquí se prueba que no existe camino para ello.
//
// Sin base de datos y sin red: se inyectan dobles en require.cache, igual que en
// tests/registro.test.js. El doble IMITA los triggers de Postgres —revienta ante
// un UPDATE o un DELETE sobre legal_acceptances— para que el test falle si algún
// día alguien escribe esa ruta.
//
//     npm test

process.env.JWT_SECRET = process.env.JWT_SECRET || 'clave-de-pruebas-suficientemente-larga-1234';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

function inyectar(ruta, exports) {
  const resuelta = require.resolve(ruta);
  require.cache[resuelta] = { id: resuelta, filename: resuelta, loaded: true, exports };
}

// ══════════════════════════════════════════════════════════════════
//  Doble de la base de datos
// ══════════════════════════════════════════════════════════════════

const sha = (t) => crypto.createHash('sha256').update(String(t), 'utf8').digest('hex');

const TEXTO_TERMS_1 = '# Términos\n\nVersión uno del contrato. '.padEnd(300, 'x');
const TEXTO_TERMS_2 = '# Términos\n\nVersión dos del contrato, con cambios. '.padEnd(300, 'y');
const TEXTO_PRIVACY = '# Privacidad\n\nCómo tratamos la información. '.padEnd(300, 'z');
const TEXTO_MKT = '# Marketing\n\nConsentimiento opcional. '.padEnd(300, 'w');

const bd = {
  documentos: [
    { id: 1, doc_key: 'terms-doctor', type: 'TERMS', name: 'Términos y Condiciones de Uso', description: '', audience: 'doctor', country: '', jurisdiction: '', locale: 'es', consent_category: 'mandatory', display_order: 1, created_at: new Date(), archived_at: null },
    { id: 2, doc_key: 'privacy', type: 'PRIVACY', name: 'Política de Privacidad', description: '', audience: 'doctor', country: '', jurisdiction: '', locale: 'es', consent_category: 'mandatory', display_order: 2, created_at: new Date(), archived_at: null },
    { id: 3, doc_key: 'marketing', type: 'MARKETING', name: 'Comunicaciones comerciales', description: '', audience: 'doctor', country: '', jurisdiction: '', locale: 'es', consent_category: 'optional', display_order: 3, created_at: new Date(), archived_at: null },
  ],
  versiones: [
    { id: 11, document_id: 1, version: '1.0', content: TEXTO_TERMS_1, content_format: 'markdown', content_hash: sha(TEXTO_TERMS_1), summary_of_changes: 'Primera versión.', requires_new_acceptance: true, status: 'published', created_at: new Date(), published_at: new Date('2026-01-01'), effective_at: new Date('2026-01-01'), archived_at: null },
    { id: 21, document_id: 2, version: '1.0', content: TEXTO_PRIVACY, content_format: 'markdown', content_hash: sha(TEXTO_PRIVACY), summary_of_changes: 'Primera versión.', requires_new_acceptance: true, status: 'published', created_at: new Date(), published_at: new Date('2026-01-01'), effective_at: new Date('2026-01-01'), archived_at: null },
    { id: 31, document_id: 3, version: '1.0', content: TEXTO_MKT, content_format: 'markdown', content_hash: sha(TEXTO_MKT), summary_of_changes: 'Primera versión.', requires_new_acceptance: false, status: 'published', created_at: new Date(), published_at: new Date('2026-01-01'), effective_at: new Date('2026-01-01'), archived_at: null },
  ],
  aceptaciones: [],
  eventos: [],
  cierres: [],
  usuarios: [
    { id: 7, name: 'Dra. Fabiola', email: 'fabiola@clinica.hn', role: 'doctor', clinic_id: 5, created_at: new Date() },
    { id: 9, name: 'Otro Doctor', email: 'otro@clinica.hn', role: 'doctor', clinic_id: 6, created_at: new Date() },
  ],
};

let idAceptacion = 1;
let idVersion = 100;

function ejecutar(text, params = []) {
  const sql = String(text).replace(/\s+/g, ' ').trim();

  // ── Guardianes append-only (lo que hacen los triggers en Postgres) ──
  if (/^(UPDATE|DELETE)\b[\s\S]*legal_acceptances/i.test(sql)) {
    throw new Error('legal_acceptances: registro histórico de solo escritura');
  }
  if (/^(UPDATE|DELETE)\b[\s\S]*legal_audit_events/i.test(sql)) {
    throw new Error('legal_audit_events: registro histórico de solo escritura');
  }

  // ── Catálogo vigente ──
  if (/DISTINCT ON \(d\.id\)/i.test(sql)) {
    const filas = bd.documentos
      .filter((d) => !d.archived_at)
      .map((d) => {
        const vs = bd.versiones
          .filter((v) => v.document_id === d.id && v.status === 'published' &&
            (!v.effective_at || v.effective_at <= new Date()))
          .sort((a, b) => b.published_at - a.published_at);
        if (vs.length === 0) return null;
        const v = vs[0];
        return {
          ...d,
          version_id: v.id, version: v.version, content_hash: v.content_hash,
          content_format: v.content_format, summary_of_changes: v.summary_of_changes,
          requires_new_acceptance: v.requires_new_acceptance,
          published_at: v.published_at, effective_at: v.effective_at,
        };
      })
      .filter(Boolean);
    return { rows: filas, rowCount: filas.length };
  }

  // ── Contenido de una versión ──
  if (/^SELECT content FROM legal_document_versions WHERE id/i.test(sql)) {
    const v = bd.versiones.find((x) => x.id === params[0]);
    return { rows: v ? [{ content: v.content }] : [], rowCount: v ? 1 : 0 };
  }
  if (/^SELECT id, content, content_hash FROM legal_document_versions WHERE id = ANY/i.test(sql)) {
    const filas = bd.versiones.filter((v) => (params[0] || []).includes(v.id));
    return { rows: filas, rowCount: filas.length };
  }

  // ── Lista de versiones de un documento ──
  if (/^SELECT v\.id AS version_id/i.test(sql)) {
    const doc = bd.documentos.find((d) => d.type === params[0]);
    const filas = doc
      ? bd.versiones.filter((v) => v.document_id === doc.id && v.status !== 'draft')
          .map((v) => ({ ...v, version_id: v.id }))
      : [];
    return { rows: filas, rowCount: filas.length };
  }

  // ── Una versión concreta (incluidas las archivadas) ──
  if (/FROM legal_documents d JOIN legal_document_versions v/i.test(sql) && params.length === 2) {
    const doc = bd.documentos.find((d) => d.type === params[0]);
    const v = doc && bd.versiones.find(
      (x) => x.document_id === doc.id && x.version === params[1] && x.status !== 'draft');
    return v
      ? { rows: [{ ...doc, ...v, version_id: v.id, id: doc.id }], rowCount: 1 }
      : { rows: [], rowCount: 0 };
  }

  // ── Aceptaciones ──
  // Dos formas del mismo INSERT: la de otorgar lleva subject_type y método como
  // parámetros; la de retirar los trae literales en el SQL, así que las
  // posiciones se corren. Se distinguen por el literal 'withdrawn'.
  if (/^INSERT INTO legal_acceptances/i.test(sql)) {
    const retirada = /'withdrawn'/.test(sql);
    bd.aceptaciones.push(retirada ? {
      id: idAceptacion++, acceptance_uid: params[0], user_id: params[1], clinic_id: params[2],
      subject_type: 'user', document_id: params[3], document_version_id: params[4],
      document_type: params[5], document_name: params[6], document_version: params[7],
      document_hash: params[8], action: 'withdrawn', accepted_at: new Date(),
      ip: params[9], user_agent: params[10], acceptance_method: 'settings_toggle',
      locale: params[11], evidence: JSON.parse(params[12]),
    } : {
      id: idAceptacion++, acceptance_uid: params[0], user_id: params[1], clinic_id: params[2],
      subject_type: params[3], document_id: params[4], document_version_id: params[5],
      document_type: params[6], document_name: params[7], document_version: params[8],
      document_hash: params[9], action: 'accepted', accepted_at: new Date(),
      ip: params[10], user_agent: params[11], acceptance_method: params[12],
      locale: params[13], evidence: JSON.parse(params[14]),
    });
    return { rows: [], rowCount: 1 };
  }
  if (/^SELECT document_id, document_version_id, document_version, accepted_at, action FROM legal_acceptances/i.test(sql)) {
    const filas = bd.aceptaciones
      .filter((a) => a.user_id === params[0] && a.action === 'accepted')
      .sort((a, b) => b.accepted_at - a.accepted_at);
    return { rows: filas, rowCount: filas.length };
  }
  if (/FROM legal_acceptances a LEFT JOIN legal_documents d/i.test(sql)) {
    const filas = bd.aceptaciones
      .filter((a) => a.user_id === params[0])
      .sort((a, b) => b.accepted_at - a.accepted_at || b.id - a.id)
      .map((a) => ({ ...a, doc_key: (bd.documentos.find((d) => d.id === a.document_id) || {}).doc_key,
        consent_category: (bd.documentos.find((d) => d.id === a.document_id) || {}).consent_category }));
    return { rows: filas, rowCount: filas.length };
  }
  if (/FROM legal_acceptances a LEFT JOIN users u/i.test(sql)) {
    const filas = bd.aceptaciones.slice().reverse()
      .map((a) => ({ ...a, user_name: (bd.usuarios.find((u) => u.id === a.user_id) || {}).name }));
    return { rows: filas, rowCount: filas.length };
  }

  // ── Bitácora ──
  if (/^INSERT INTO legal_audit_events/i.test(sql)) {
    bd.eventos.push({
      id: bd.eventos.length + 1, event: params[0], actor_user_id: params[1],
      actor_role: params[2], subject_user_id: params[3], clinic_id: params[4],
      document_id: params[5], document_version_id: params[6], document_type: params[7],
      document_version: params[8], document_hash: params[9], acceptance_uid: params[10],
      ip: params[11], user_agent: params[12], metadata: JSON.parse(params[13]),
      created_at: new Date(),
    });
    return { rows: [], rowCount: 1 };
  }
  if (/FROM legal_audit_events e/i.test(sql)) {
    return { rows: bd.eventos.slice().reverse(), rowCount: bd.eventos.length };
  }

  // ── Versiones para el panel de administración ──
  if (/^SELECT id, doc_key, type, name/i.test(sql)) {
    return { rows: bd.documentos, rowCount: bd.documentos.length };
  }
  if (/^SELECT v\.id, v\.document_id, v\.version/i.test(sql)) {
    const filas = bd.versiones.map((v) => ({
      ...v,
      aceptaciones: String(bd.aceptaciones.filter((a) => a.document_version_id === v.id && a.action === 'accepted').length),
    }));
    return { rows: filas, rowCount: filas.length };
  }
  if (/^INSERT INTO legal_document_versions/i.test(sql)) {
    const fila = {
      id: ++idVersion, document_id: params[0], version: params[1], content: params[2],
      content_format: params[3], content_hash: params[4], summary_of_changes: params[5],
      requires_new_acceptance: params[6], status: 'draft', created_at: new Date(),
      published_at: null, effective_at: params[7], archived_at: null, created_by: params[8],
    };
    if (bd.versiones.some((v) => v.document_id === fila.document_id && v.version === fila.version)) {
      const err = new Error('duplicate key'); err.code = '23505'; throw err;
    }
    bd.versiones.push(fila);
    return { rows: [fila], rowCount: 1 };
  }
  if (/^SELECT id, type, name FROM legal_documents WHERE id/i.test(sql)) {
    const d = bd.documentos.find((x) => x.id === params[0]);
    return { rows: d ? [d] : [], rowCount: d ? 1 : 0 };
  }
  if (/^SELECT v\.\*, d\.type FROM legal_document_versions v/i.test(sql)) {
    const v = bd.versiones.find((x) => x.id === params[0]);
    if (!v) return { rows: [], rowCount: 0 };
    const d = bd.documentos.find((x) => x.id === v.document_id);
    return { rows: [{ ...v, type: d.type }], rowCount: 1 };
  }
  if (/^UPDATE legal_document_versions SET status = 'published'/i.test(sql)) {
    const v = bd.versiones.find((x) => x.id === params[0] && x.status === 'draft');
    if (!v) return { rows: [], rowCount: 0 };
    v.status = 'published';
    v.published_at = new Date();
    v.effective_at = params[2] || v.effective_at || new Date();
    v.published_by = params[1];
    return { rows: [v], rowCount: 1 };
  }
  if (/^UPDATE legal_document_versions SET status = 'archived'/i.test(sql)) {
    let n = 0;
    bd.versiones.forEach((v) => {
      if (v.document_id === params[0] && v.id !== params[1] && v.status === 'published') {
        v.status = 'archived'; v.archived_at = new Date(); n++;
      }
    });
    return { rows: [], rowCount: n };
  }

  // ── Usuario para la evidencia ──
  if (/FROM users u LEFT JOIN clinics c/i.test(sql)) {
    const u = bd.usuarios.find((x) => x.id === params[0]);
    return u
      ? { rows: [{ ...u, clinic_name: 'Clínica de prueba' }], rowCount: 1 }
      : { rows: [], rowCount: 0 };
  }

  // ── Cancelación de cuenta ──
  if (/^SELECT id FROM account_closure_requests/i.test(sql)) {
    const filas = bd.cierres.filter((c) => c.user_id === params[0] &&
      ['requested', 'export_ready', 'retention_hold'].includes(c.status));
    return { rows: filas, rowCount: filas.length };
  }
  if (/^INSERT INTO account_closure_requests/i.test(sql)) {
    const fila = { id: bd.cierres.length + 1, user_id: params[0], clinic_id: params[1],
      reason: params[2], notes: params[3], status: 'requested', requested_at: new Date() };
    bd.cierres.push(fila);
    return { rows: [fila], rowCount: 1 };
  }
  if (/FROM account_closure_requests/i.test(sql)) {
    const filas = bd.cierres.filter((c) => !params.length || c.user_id === params[0]);
    return { rows: filas, rowCount: filas.length };
  }

  throw new Error('SQL no previsto en el doble: ' + sql.slice(0, 160));
}

inyectar('../db', {
  query: async (t, p) => ejecutar(t, p),
  pool: { connect: async () => ({ query: async (t, p) => ejecutar(t, p), release() {} }) },
});

const legal = require('../lib/legal/service');
const legalRouter = require('../routes/legal');
const { gate } = require('../middleware/legal');

// ══════════════════════════════════════════════════════════════════
//  Utilidades del test
// ══════════════════════════════════════════════════════════════════

function crearApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', gate);
  app.use('/api/legal', legalRouter);
  // Un router cualquiera con PHI, para comprobar que el guardián lo cubre.
  app.post('/api/patients', (req, res) => res.json({ ok: true }));
  app.get('/api/patients', (req, res) => res.json({ ok: true }));
  app.use((err, req, res, _next) => res.status(500).json({ error: err.message }));
  return app;
}

function token(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, clinic_id: user.clinic_id },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );
}

function levantar(app) {
  return new Promise((resolve) => {
    const srv = app.listen(0, () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}` }));
  });
}

async function pedir(url, ruta, opciones = {}) {
  const cabeceras = { 'Content-Type': 'application/json', ...(opciones.headers || {}) };
  if (opciones.comoUsuario) cabeceras.Cookie = `sd_token=${token(opciones.comoUsuario)}`;
  const res = await fetch(url + ruta, {
    method: opciones.method || 'GET',
    headers: cabeceras,
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });
  const texto = await res.text();
  let cuerpo = null;
  try { cuerpo = JSON.parse(texto); } catch (_) { cuerpo = texto; }
  return { status: res.status, body: cuerpo, headers: res.headers };
}

const DOCTORA = bd.usuarios[0];
const OTRO = bd.usuarios[1];

function limpiarEstado() {
  bd.aceptaciones.length = 0;
  bd.eventos.length = 0;
  bd.cierres.length = 0;
  // Volver al estado inicial de versiones: los tests de "versión nueva" publican
  // la 2.0 y archivan la 1.0, y eso no puede filtrarse al siguiente test.
  const INICIALES = [11, 21, 31];
  bd.versiones = bd.versiones.filter((v) => INICIALES.includes(v.id));
  bd.versiones.forEach((v) => { v.status = 'published'; v.archived_at = null; });
  legal.invalidarCatalogo();
}

test.beforeEach(limpiarEstado);

// ══════════════════════════════════════════════════════════════════
//  1 · Un usuario nuevo tiene que aceptar antes de escribir
// ══════════════════════════════════════════════════════════════════

test('un usuario nuevo tiene pendientes los dos documentos obligatorios', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  const r = await pedir(url, '/api/legal/pending', { comoUsuario: DOCTORA });
  assert.equal(r.status, 200);
  assert.equal(r.body.count, 2);
  const tipos = r.body.pending.map((p) => p.type).sort();
  assert.deepEqual(tipos, ['PRIVACY', 'TERMS']);
  assert.ok(r.body.pending.every((p) => p.motivo === 'nuevo'));
  // El consentimiento opcional NO aparece: no se mezcla con lo obligatorio.
  assert.ok(!tipos.includes('MARKETING'));
});

test('sin aceptar, toda escritura responde 451 y las lecturas siguen pasando', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  const escritura = await pedir(url, '/api/patients', {
    method: 'POST', comoUsuario: DOCTORA, body: { name: 'Paciente' },
  });
  assert.equal(escritura.status, 451);
  assert.equal(escritura.body.code, 'legal_acceptance_required');
  assert.equal(escritura.body.pending.length, 2);

  // Leer sí: hay que poder entrar a ver qué se pide aceptar.
  const lectura = await pedir(url, '/api/patients', { comoUsuario: DOCTORA });
  assert.equal(lectura.status, 200);
});

test('no hay bypass llamando a la API directamente sin pasar por la pantalla', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  // Sin cuerpo.
  const vacio = await pedir(url, '/api/legal/accept', { method: 'POST', comoUsuario: DOCTORA, body: {} });
  assert.equal(vacio.status, 400);
  assert.equal(vacio.body.code, 'empty_selection');

  // Con un documento inventado.
  const falso = await pedir(url, '/api/legal/accept', {
    method: 'POST', comoUsuario: DOCTORA,
    body: { acceptances: [{ type: 'ALGO', version: '9.9', hash: 'f'.repeat(64) }] },
  });
  assert.equal(falso.status, 400);
  assert.equal(falso.body.code, 'unknown_document');

  // Y la escritura sigue bloqueada: nada de lo anterior registró nada.
  assert.equal(bd.aceptaciones.length, 0);
  const escritura = await pedir(url, '/api/patients', {
    method: 'POST', comoUsuario: DOCTORA, body: {},
  });
  assert.equal(escritura.status, 451);
});

// ══════════════════════════════════════════════════════════════════
//  2 · Aceptar y lo que queda registrado
// ══════════════════════════════════════════════════════════════════

async function aceptarTodo(url, usuario = DOCTORA) {
  const cat = await pedir(url, '/api/legal/documents');
  const obligatorios = cat.body.documents.filter((d) => d.consent_category === 'mandatory');
  return pedir(url, '/api/legal/accept', {
    method: 'POST', comoUsuario: usuario,
    headers: { 'User-Agent': 'NavegadorDePrueba/1.0', 'X-Forwarded-For': '200.10.20.30' },
    body: {
      acceptances: obligatorios.map((d) => ({ type: d.type, version: d.version, hash: d.content_hash })),
      method: 'signup_checkbox',
    },
  });
}

test('el usuario acepta y la escritura se desbloquea', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  const r = await aceptarTodo(url);
  assert.equal(r.status, 201);
  assert.equal(r.body.accepted.length, 2);
  assert.equal(r.body.pending.length, 0);

  const escritura = await pedir(url, '/api/patients', {
    method: 'POST', comoUsuario: DOCTORA, body: {},
  });
  assert.equal(escritura.status, 200);
});

test('la aceptación guarda versión, hash, IP, navegador, método e identificador único', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  await aceptarTodo(url);

  const terms = bd.aceptaciones.find((a) => a.document_type === 'TERMS');
  assert.ok(terms, 'la aceptación de los términos quedó registrada');
  assert.equal(terms.user_id, DOCTORA.id);
  assert.equal(terms.clinic_id, DOCTORA.clinic_id);
  assert.equal(terms.document_version, '1.0', 'la versión queda registrada');
  assert.equal(terms.document_hash, sha(TEXTO_TERMS_1), 'el hash es el del contenido exacto');
  assert.equal(terms.ip, '200.10.20.30', 'la IP queda registrada');
  assert.match(terms.user_agent, /NavegadorDePrueba/, 'el user-agent queda registrado');
  assert.equal(terms.acceptance_method, 'signup_checkbox');
  assert.equal(terms.action, 'accepted');
  assert.match(terms.acceptance_uid, /^[0-9a-f-]{36}$/i, 'identificador único de aceptación');
  assert.ok(terms.accepted_at instanceof Date, 'la fecha y hora quedan registradas');
  // La evidencia guarda ADEMÁS lo que se le mostró al usuario.
  assert.equal(terms.evidence.documento_mostrado.version, '1.0');
  assert.equal(terms.evidence.documento_mostrado.hash, sha(TEXTO_TERMS_1));
});

test('la bitácora legal registra los eventos con el nombre que exige el contrato', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  await aceptarTodo(url);
  const eventos = bd.eventos.map((e) => e.event);
  assert.ok(eventos.includes('USER_ACCEPTED_TERMS'));
  assert.ok(eventos.includes('USER_ACCEPTED_PRIVACY'));

  const ev = bd.eventos.find((e) => e.event === 'USER_ACCEPTED_TERMS');
  assert.equal(ev.subject_user_id, DOCTORA.id);
  assert.equal(ev.document_version, '1.0');
  assert.equal(ev.document_hash, sha(TEXTO_TERMS_1));
  assert.ok(ev.acceptance_uid, 'el evento apunta a la aceptación concreta');
});

// ══════════════════════════════════════════════════════════════════
//  3 · No se acepta una versión distinta de la mostrada
// ══════════════════════════════════════════════════════════════════

test('no se puede aceptar con un hash que no es el del documento publicado', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  const r = await pedir(url, '/api/legal/accept', {
    method: 'POST', comoUsuario: DOCTORA,
    body: { acceptances: [{ type: 'TERMS', version: '1.0', hash: 'd'.repeat(64) }] },
  });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'version_mismatch');
  assert.equal(bd.aceptaciones.length, 0, 'no se registra nada a medias');
});

test('no se puede aceptar una versión que no es la vigente', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  const r = await pedir(url, '/api/legal/accept', {
    method: 'POST', comoUsuario: DOCTORA,
    body: { acceptances: [{ type: 'TERMS', version: '0.9', hash: sha(TEXTO_TERMS_1) }] },
  });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'version_mismatch');
  assert.equal(bd.aceptaciones.length, 0);
});

test('el usuario no puede fabricar una aceptación a nombre de otro', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  const cat = await pedir(url, '/api/legal/documents');
  const terms = cat.body.documents.find((d) => d.type === 'TERMS');

  // Manda user_id en el cuerpo: el servidor lo ignora y usa el del token.
  await pedir(url, '/api/legal/accept', {
    method: 'POST', comoUsuario: DOCTORA,
    body: {
      user_id: OTRO.id, subject_type: 'user', accepted_at: '1999-01-01',
      ip: '1.2.3.4', acceptance_uid: 'falso',
      acceptances: [{ type: terms.type, version: terms.version, hash: terms.content_hash }],
    },
  });

  assert.equal(bd.aceptaciones.length, 1);
  const a = bd.aceptaciones[0];
  assert.equal(a.user_id, DOCTORA.id, 'el usuario sale del token, no del cuerpo');
  assert.notEqual(a.acceptance_uid, 'falso', 'el identificador lo genera el servidor');
  assert.notEqual(a.ip, '1.2.3.4', 'la IP la observa el servidor, no la declara el cliente');
  assert.ok(a.accepted_at > new Date('2020-01-01'), 'la fecha la pone el servidor');
});

// ══════════════════════════════════════════════════════════════════
//  4 · Versión nueva → nueva aceptación, sin borrar la anterior
// ══════════════════════════════════════════════════════════════════

function publicarTerms2({ exigeAceptacion = true } = {}) {
  bd.versiones.filter((v) => v.document_id === 1 && v.status === 'published')
    .forEach((v) => { v.status = 'archived'; v.archived_at = new Date(); });
  bd.versiones.push({
    id: 12, document_id: 1, version: '2.0', content: TEXTO_TERMS_2, content_format: 'markdown',
    content_hash: sha(TEXTO_TERMS_2), summary_of_changes: 'Nueva sección de responsabilidad.',
    requires_new_acceptance: exigeAceptacion, status: 'published', created_at: new Date(),
    published_at: new Date(), effective_at: new Date(), archived_at: null,
  });
  legal.invalidarCatalogo();
}

test('una versión nueva vuelve a pedir aceptación y conserva la anterior', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  await aceptarTodo(url);
  assert.equal(bd.aceptaciones.length, 2);

  publicarTerms2();

  const pend = await pedir(url, '/api/legal/pending', { comoUsuario: DOCTORA });
  assert.equal(pend.body.count, 1, 'solo vuelve a pedirse el documento que cambió');
  assert.equal(pend.body.pending[0].type, 'TERMS');
  assert.equal(pend.body.pending[0].version, '2.0');
  assert.equal(pend.body.pending[0].motivo, 'actualizado');
  assert.equal(pend.body.pending[0].version_anterior, '1.0');
  assert.match(pend.body.pending[0].summary_of_changes, /responsabilidad/i, 'se dice qué cambió');

  // Y la escritura vuelve a estar bloqueada hasta aceptar.
  const bloqueada = await pedir(url, '/api/patients', {
    method: 'POST', comoUsuario: DOCTORA, body: {},
  });
  assert.equal(bloqueada.status, 451);

  // Aceptar la 2.0 AÑADE una fila; la de la 1.0 sigue exactamente donde estaba.
  const r = await pedir(url, '/api/legal/accept', {
    method: 'POST', comoUsuario: DOCTORA,
    body: { acceptances: [{ type: 'TERMS', version: '2.0', hash: sha(TEXTO_TERMS_2) }] },
  });
  assert.equal(r.status, 201);

  const deTerms = bd.aceptaciones.filter((a) => a.document_type === 'TERMS');
  assert.equal(deTerms.length, 2, 'las dos aceptaciones conviven');
  assert.deepEqual(deTerms.map((a) => a.document_version).sort(), ['1.0', '2.0']);
  assert.ok(deTerms.find((a) => a.document_hash === sha(TEXTO_TERMS_1)), 'la v1.0 conserva su hash');
});

test('una versión que no exige nueva aceptación no frena a quien ya aceptó', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  await aceptarTodo(url);
  publicarTerms2({ exigeAceptacion: false });

  const pend = await pedir(url, '/api/legal/pending', { comoUsuario: DOCTORA });
  assert.equal(pend.body.count, 0, 'una corrección de erratas no bloquea a nadie');

  const escritura = await pedir(url, '/api/patients', {
    method: 'POST', comoUsuario: DOCTORA, body: {},
  });
  assert.equal(escritura.status, 200);
});

// ══════════════════════════════════════════════════════════════════
//  5 · Inmutabilidad
// ══════════════════════════════════════════════════════════════════

test('no existe ninguna ruta que modifique o borre una aceptación', () => {
  const rutas = fs.readdirSync(path.join(__dirname, '..', 'routes'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => fs.readFileSync(path.join(__dirname, '..', 'routes', f), 'utf8'))
    .join('\n');

  assert.ok(!/UPDATE\s+legal_acceptances/i.test(rutas), 'ninguna ruta actualiza aceptaciones');
  assert.ok(!/DELETE\s+FROM\s+legal_acceptances/i.test(rutas), 'ninguna ruta borra aceptaciones');
  assert.ok(!/UPDATE\s+legal_audit_events/i.test(rutas), 'ninguna ruta actualiza la bitácora legal');
  assert.ok(!/DELETE\s+FROM\s+legal_audit_events/i.test(rutas), 'ninguna ruta borra la bitácora legal');
});

test('la base rechaza modificar o borrar una aceptación aunque se intente', async () => {
  await legal.registrarAceptaciones({
    userId: DOCTORA.id, clinicId: DOCTORA.clinic_id,
    seleccion: [{ type: 'TERMS', version: '1.0', hash: sha(TEXTO_TERMS_1) }],
    exigirObligatorios: false,
  });
  assert.equal(bd.aceptaciones.length, 1);

  const { query } = require('../db');
  await assert.rejects(
    () => query('UPDATE legal_acceptances SET ip = $1 WHERE id = $2', ['9.9.9.9', 1]),
    /solo escritura/i,
    'un UPDATE directo revienta (lo impone el trigger, no la aplicación)',
  );
  await assert.rejects(
    () => query('DELETE FROM legal_acceptances WHERE id = $1', [1]),
    /solo escritura/i,
  );
  assert.equal(bd.aceptaciones[0].ip, '', 'la fila quedó intacta');
});

test('el esquema instala los guardianes de inmutabilidad en la base', () => {
  const { GUARDIANES, TABLAS } = require('../lib/legal/schema');
  assert.match(GUARDIANES, /CREATE TRIGGER legal_acceptances_guard_trg/);
  assert.match(GUARDIANES, /BEFORE UPDATE OR DELETE ON legal_acceptances/);
  assert.match(GUARDIANES, /CREATE TRIGGER legal_audit_guard_trg/);
  assert.match(GUARDIANES, /BEFORE UPDATE OR DELETE ON legal_audit_events/);
  assert.match(GUARDIANES, /el contenido de una versión publicada es inmutable/);
  // La bitácora legal no se purga: no puede estar en la lista de retención.
  const retention = fs.readFileSync(path.join(__dirname, '..', 'lib', 'retention.js'), 'utf8');
  assert.ok(!/DELETE FROM legal_/i.test(retention), 'la purga no toca las tablas legales');
  assert.match(TABLAS, /legal_audit_events/);
});

// ══════════════════════════════════════════════════════════════════
//  6 · Evidencia
// ══════════════════════════════════════════════════════════════════

test('la exportación de evidencia trae todo lo necesario para demostrar la aceptación', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  await aceptarTodo(url);
  const r = await pedir(url, '/api/legal/me/evidence?full=1', { comoUsuario: DOCTORA });

  assert.equal(r.status, 200);
  assert.equal(r.body.usuario.id, DOCTORA.id);
  assert.equal(r.body.total_registros, 2);

  const terms = r.body.registros.find((x) => x.documento.tipo === 'TERMS');
  assert.equal(terms.version, '1.0');
  assert.equal(terms.hash_sha256, sha(TEXTO_TERMS_1));
  assert.ok(terms.acceptance_uid, 'identificador único');
  assert.ok(terms.fecha_hora_utc, 'fecha y hora');
  assert.equal(terms.ip, '200.10.20.30');
  assert.match(terms.user_agent, /NavegadorDePrueba/);
  assert.ok(terms.referencia_verificable.includes('doc=TERMS'), 'referencia verificable del documento');
  assert.equal(terms.contenido, TEXTO_TERMS_1, 'el contenido íntegro que se aceptó');
  assert.equal(terms.verificacion.coincide, true, 'la huella recalculada cuadra');
});

test('la exportación en PDF responde un PDF de verdad', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  await aceptarTodo(url);
  const res = await fetch(url + '/api/legal/me/evidence?format=pdf', {
    headers: { Cookie: `sd_token=${token(DOCTORA)}` },
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(buf.slice(0, 4).toString(), '%PDF', 'la respuesta empieza por la firma de un PDF');
  assert.ok(buf.length > 800, 'el PDF tiene contenido');
});

test('exportar evidencia queda registrado en la bitácora', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  await aceptarTodo(url);
  bd.eventos.length = 0;
  await pedir(url, '/api/legal/me/evidence', { comoUsuario: DOCTORA });
  assert.ok(bd.eventos.some((e) => e.event === 'LEGAL_EVIDENCE_EXPORTED'));
});

// ══════════════════════════════════════════════════════════════════
//  7 · Documentos archivados y consentimiento opcional
// ══════════════════════════════════════════════════════════════════

test('una versión archivada sigue siendo consultable como evidencia histórica', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  await aceptarTodo(url);
  publicarTerms2();

  // La vigente es la 2.0…
  const vigente = await pedir(url, '/api/legal/documents/TERMS');
  assert.equal(vigente.body.version, '2.0');

  // …y la 1.0, ya archivada, sigue devolviendo su texto exacto y su huella.
  const vieja = await pedir(url, '/api/legal/documents/TERMS/versions/1.0');
  assert.equal(vieja.status, 200);
  assert.equal(vieja.body.status, 'archived');
  assert.equal(vieja.body.content, TEXTO_TERMS_1);
  assert.equal(vieja.body.content_hash, sha(TEXTO_TERMS_1));

  // Y aparece en el historial de versiones.
  const lista = await pedir(url, '/api/legal/documents/TERMS/versions');
  assert.equal(lista.body.versions.length, 2);
});

test('el consentimiento opcional se otorga y se retira, y ambos hechos quedan', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  const otorga = await pedir(url, '/api/legal/accept', {
    method: 'POST', comoUsuario: DOCTORA,
    body: {
      acceptances: [{ type: 'MARKETING', version: '1.0', hash: sha(TEXTO_MKT) }],
      method: 'settings_toggle',
    },
  });
  assert.equal(otorga.status, 201);

  const retira = await pedir(url, '/api/legal/consents/MARKETING/withdraw', {
    method: 'POST', comoUsuario: DOCTORA,
  });
  assert.equal(retira.status, 200);
  assert.equal(retira.body.action, 'withdrawn');

  const deMkt = bd.aceptaciones.filter((a) => a.document_type === 'MARKETING');
  assert.equal(deMkt.length, 2, 'la retirada añade fila, no borra el otorgamiento');
  assert.deepEqual(deMkt.map((a) => a.action), ['accepted', 'withdrawn']);
  assert.ok(bd.eventos.some((e) => e.event === 'USER_WITHDREW_CONSENT'));

  // Y nunca fue obligatorio: no aparece en pendientes.
  const pend = await pedir(url, '/api/legal/pending', { comoUsuario: DOCTORA });
  assert.ok(!pend.body.pending.some((p) => p.type === 'MARKETING'));
});

test('el estado de la pantalla de ajustes refleja aceptado y retirado', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  await aceptarTodo(url);
  const r = await pedir(url, '/api/legal/me', { comoUsuario: DOCTORA });

  const terms = r.body.documentos.find((d) => d.type === 'TERMS');
  assert.equal(terms.aceptado, true);
  assert.ok(terms.aceptado_el);
  assert.ok(terms.acceptance_uid);

  const mkt = r.body.documentos.find((d) => d.type === 'MARKETING');
  assert.equal(mkt.activo, false, 'el opcional no se da por otorgado solo');
  assert.equal(r.body.historial.length, 2);
});

// ══════════════════════════════════════════════════════════════════
//  8 · Cancelación de cuenta
// ══════════════════════════════════════════════════════════════════

test('la cancelación de cuenta abre una solicitud y no borra nada', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  await aceptarTodo(url);
  const r = await pedir(url, '/api/legal/account-closure', {
    method: 'POST', comoUsuario: DOCTORA, body: { reason: 'Cierro la consulta' },
  });

  assert.equal(r.status, 201);
  assert.equal(r.body.request.status, 'requested');
  assert.match(r.body.message, /no se elimina de forma autom/i);
  assert.equal(bd.cierres.length, 1);
  assert.match(bd.cierres[0].notes, /REQUIERE REVISIÓN LEGAL/);
  assert.ok(bd.eventos.some((e) => e.event === 'ACCOUNT_CLOSURE_REQUESTED'));

  // Dos veces no.
  const otra = await pedir(url, '/api/legal/account-closure', {
    method: 'POST', comoUsuario: DOCTORA, body: {},
  });
  assert.equal(otra.status, 409);
});

// ══════════════════════════════════════════════════════════════════
//  9 · Permisos
// ══════════════════════════════════════════════════════════════════

test('las rutas de administración exigen super_admin', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  for (const ruta of ['/api/legal/admin/documents', '/api/legal/admin/acceptances',
                      '/api/legal/admin/audit', '/api/legal/admin/evidence/9']) {
    const r = await pedir(url, ruta, { comoUsuario: DOCTORA });
    assert.equal(r.status, 403, ruta + ' no puede abrirse con rol doctor');
  }
});

test('los documentos se leen sin sesión: hay que poder revisarlos antes de tener cuenta', async (t) => {
  const { srv, url } = await levantar(crearApp());
  t.after(() => srv.close());

  const cat = await pedir(url, '/api/legal/documents');
  assert.equal(cat.status, 200);
  assert.equal(cat.body.documents.length, 3);

  const doc = await pedir(url, '/api/legal/documents/TERMS');
  assert.equal(doc.status, 200);
  assert.equal(doc.body.content, TEXTO_TERMS_1);
  assert.equal(doc.body.content_hash, sha(TEXTO_TERMS_1));
});

// ══════════════════════════════════════════════════════════════════
//  10 · La pantalla: casillas desmarcadas
// ══════════════════════════════════════════════════════════════════

test('ninguna casilla de aceptación viene preseleccionada', () => {
  const registro = fs.readFileSync(path.join(__dirname, '..', 'public', 'registro.html'), 'utf8');
  const modulo = fs.readFileSync(path.join(__dirname, '..', 'public', 'legal-consent.js'), 'utf8');

  // Las casillas se generan por JS en los dos sitios: ninguna lleva `checked`.
  const casillas = (registro + modulo).match(/<input type="checkbox"[^>]*>/g) || [];
  assert.ok(casillas.length >= 2, 'hay casillas de aceptación generadas');
  casillas.forEach((c) => {
    assert.ok(!/\bchecked\b/.test(c), 'casilla preseleccionada encontrada: ' + c);
  });

  // Y el botón nace deshabilitado en el modal de re-aceptación.
  assert.match(modulo, /id="sdlAccept"[^>]*disabled/);
});

test('el documento de términos publicado no afirma cumplimiento normativo', () => {
  const dir = path.join(__dirname, '..', 'lib', 'legal', 'documents');
  const textos = fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');

  // Nada de sellos de cumplimiento sin evaluación: es una regla del proyecto.
  assert.ok(!/HIPAA[- ]compliant/i.test(textos));
  assert.ok(!/cumplimos con (el )?(RGPD|GDPR|HIPAA)/i.test(textos));
  assert.ok(!/certificad[oa]s? (en|con) (HIPAA|RGPD|GDPR)/i.test(textos));
  // Y sí las marcas explícitas de lo que falta por revisar.
  assert.match(textos, /REQUIERE REVISIÓN LEGAL/);
  assert.match(textos, /en la máxima medida permitida por la legislación aplicable/i);
});
