// ── Servicio legal: documentos, versiones, aceptaciones y evidencia ──
//
// Todo lo que la plataforma promete en sus términos pasa por aquí. Las reglas
// que no se negocian:
//
//   1. El contenido aceptado se identifica por su HASH, no por su nombre. Se
//      guarda el SHA-256 del texto exacto que el usuario tuvo delante.
//   2. Nadie acepta una versión distinta de la que se le mostró: el cliente
//      manda versión + hash y el servidor los compara contra la vigente. Si no
//      cuadran, la aceptación se rechaza (409) en vez de registrarse "lo que
//      sea que hubiera".
//   3. Aceptar nunca sobrescribe: cada aceptación es una fila nueva.
//   4. Los archivos .md del repositorio son la SEMILLA. Una vez publicada la
//      versión, la fila de la base manda. Si el archivo cambia sin subir el
//      número de versión, no se toca nada y se avisa a gritos en los logs: eso
//      es exactamente el escenario en el que alguien podría estar reescribiendo
//      un contrato ya aceptado.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { query } = require('../../db');

const DIR_DOCS = path.join(__dirname, 'documents');

// Roles a los que se les exige la aceptación. El operador de la plataforma
// (super_admin) queda fuera: es quien publica los documentos, no quien los firma.
const ROLES_EXIGIDOS = ['clinic_admin', 'doctor', 'receptionist'];

const EVENTOS = {
  ACEPTO_TERMINOS: 'USER_ACCEPTED_TERMS',
  ACEPTO_PRIVACIDAD: 'USER_ACCEPTED_PRIVACY',
  ACEPTO_DOCUMENTO: 'USER_ACCEPTED_DOCUMENT',
  RETIRO_CONSENTIMIENTO: 'USER_WITHDREW_CONSENT',
  DOC_CREADO: 'LEGAL_DOCUMENT_CREATED',
  DOC_ACTUALIZADO: 'LEGAL_DOCUMENT_UPDATED',
  DOC_PUBLICADO: 'LEGAL_DOCUMENT_PUBLISHED',
  VERSION_CREADA: 'LEGAL_DOCUMENT_VERSION_CREATED',
  DOC_ARCHIVADO: 'LEGAL_DOCUMENT_ARCHIVED',
  EVIDENCIA_EXPORTADA: 'LEGAL_EVIDENCE_EXPORTED',
  CIERRE_SOLICITADO: 'ACCOUNT_CLOSURE_REQUESTED',
  CIERRE_CANCELADO: 'ACCOUNT_CLOSURE_CANCELLED',
};

// Qué evento corresponde a cada tipo de documento, para que la bitácora hable
// el idioma que pide el contrato (USER_ACCEPTED_TERMS y no un genérico).
const EVENTO_POR_TIPO = {
  TERMS: EVENTOS.ACEPTO_TERMINOS,
  PRIVACY: EVENTOS.ACEPTO_PRIVACIDAD,
};

// ── Semillas ──
// El catálogo inicial. Añadir una versión nueva = añadir una entrada aquí con
// su archivo .md; el arranque la publica sola. Para una versión que NO deba
// exigir nueva aceptación (erratas), poner requiere_aceptacion: false.
const SEMILLAS = [
  {
    doc_key: 'terms-doctor',
    type: 'TERMS',
    name: 'Términos y Condiciones de Uso',
    description: 'El contrato entre Portal Salud Digital y el profesional que usa la plataforma.',
    audience: 'doctor',
    consent_category: 'mandatory',
    display_order: 1,
    versiones: [
      {
        version: '1.0',
        archivo: 'terms-doctor-v1.0.md',
        requiere_aceptacion: true,
        cambios: 'Primera versión publicada.',
      },
    ],
  },
  {
    doc_key: 'privacy',
    type: 'PRIVACY',
    name: 'Política de Privacidad',
    description: 'Qué información trata la plataforma, para qué, con quién y durante cuánto tiempo.',
    audience: 'doctor',
    consent_category: 'mandatory',
    display_order: 2,
    versiones: [
      {
        version: '1.0',
        archivo: 'privacy-v1.0.md',
        requiere_aceptacion: true,
        cambios: 'Primera versión publicada.',
      },
    ],
  },
  {
    doc_key: 'marketing',
    type: 'MARKETING',
    name: 'Comunicaciones comerciales',
    description: 'Consentimiento opcional y revocable para recibir novedades y promociones.',
    audience: 'doctor',
    consent_category: 'optional',
    display_order: 3,
    versiones: [
      {
        version: '1.0',
        archivo: 'marketing-v1.0.md',
        requiere_aceptacion: false,
        cambios: 'Primera versión publicada.',
      },
    ],
  },
];

// ══════════════════════════════════════════════════════════════════
//  Utilidades
// ══════════════════════════════════════════════════════════════════

/** SHA-256 en hexadecimal del texto exacto. Es la huella que se guarda y compara. */
function hashDe(contenido) {
  return crypto.createHash('sha256').update(String(contenido), 'utf8').digest('hex');
}

/**
 * Los datos de la petición que forman parte de la evidencia. La IP se toma del
 * mismo modo que en el resto de la app (Render va detrás de un proxy).
 */
function datosDePeticion(req) {
  const fwd = req && req.headers && req.headers['x-forwarded-for'];
  const ip = fwd
    ? String(fwd).split(',')[0].trim()
    : String((req && (req.ip || (req.connection && req.connection.remoteAddress))) || '');
  return {
    ip: ip.slice(0, 80),
    user_agent: String((req && req.headers && req.headers['user-agent']) || '').slice(0, 400),
    locale: idiomaDe(req),
  };
}

function idiomaDe(req) {
  const cabecera = String((req && req.headers && req.headers['accept-language']) || '');
  const primero = cabecera.split(',')[0].trim();
  return (primero || 'es').slice(0, 12);
}

function enforcementActivo() {
  return String(process.env.LEGAL_ENFORCEMENT || 'on').toLowerCase() !== 'off';
}

const TTL_CACHE = (() => {
  const v = parseInt(process.env.LEGAL_CACHE_TTL_MS || '', 10);
  return Number.isFinite(v) && v >= 0 ? v : 60_000;
})();

// ══════════════════════════════════════════════════════════════════
//  Siembra desde los archivos del repositorio
// ══════════════════════════════════════════════════════════════════

async function sembrar() {
  const resultado = { documentos: 0, versiones: 0, desviaciones: [] };

  for (const semilla of SEMILLAS) {
    // El documento (metadatos). El contenido NO vive aquí, así que actualizar
    // el nombre o el orden no toca nada contractual.
    const doc = await query(
      `INSERT INTO legal_documents (doc_key, type, name, description, audience,
                                    consent_category, display_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (doc_key) DO UPDATE
              SET name = EXCLUDED.name,
                  description = EXCLUDED.description,
                  display_order = EXCLUDED.display_order
        RETURNING id, type, name`,
      [
        semilla.doc_key, semilla.type, semilla.name, semilla.description,
        semilla.audience, semilla.consent_category, semilla.display_order,
      ],
    );
    const documentId = doc.rows[0].id;
    resultado.documentos++;

    for (const v of semilla.versiones) {
      const ruta = path.join(DIR_DOCS, v.archivo);
      let contenido;
      try {
        contenido = fs.readFileSync(ruta, 'utf8');
      } catch (err) {
        console.error(`[legal] falta el documento ${v.archivo}: ${err.message}`);
        continue;
      }
      const hash = hashDe(contenido);

      const existente = await query(
        'SELECT id, content_hash, status FROM legal_document_versions WHERE document_id = $1 AND version = $2',
        [documentId, v.version],
      );

      if (existente.rowCount > 0) {
        const fila = existente.rows[0];
        if (fila.content_hash !== hash) {
          // El archivo del repositorio cambió sin subir el número de versión.
          // La base NO se toca: lo que la gente aceptó es lo que hay guardado.
          const aviso =
            `${semilla.doc_key} v${v.version}: el archivo del repositorio ya no coincide con ` +
            `la versión publicada (repo ${hash.slice(0, 12)}… vs publicado ${fila.content_hash.slice(0, 12)}…). ` +
            'Se conserva la publicada. Para cambiar el texto hay que publicar una versión nueva.';
          resultado.desviaciones.push(aviso);
          console.error('[legal] AVISO: ' + aviso);
        }
        continue;
      }

      await query(
        `INSERT INTO legal_document_versions
           (document_id, version, content, content_format, content_hash,
            summary_of_changes, requires_new_acceptance, status, published_at, effective_at)
         VALUES ($1, $2, $3, 'markdown', $4, $5, $6, 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [documentId, v.version, contenido, hash, v.cambios || '', v.requiere_aceptacion !== false],
      );
      resultado.versiones++;

      await registrarEvento({
        event: EVENTOS.VERSION_CREADA,
        document_id: documentId,
        document_type: semilla.type,
        document_version: v.version,
        document_hash: hash,
        metadata: { origen: 'semilla', archivo: v.archivo },
      });
      await registrarEvento({
        event: EVENTOS.DOC_PUBLICADO,
        document_id: documentId,
        document_type: semilla.type,
        document_version: v.version,
        document_hash: hash,
        metadata: { origen: 'semilla' },
      });
    }
  }

  invalidarCatalogo();
  return resultado;
}

// ══════════════════════════════════════════════════════════════════
//  Catálogo vigente (con caché en proceso)
// ══════════════════════════════════════════════════════════════════

let cacheCatalogo = null;      // { at, docs, huella }
const cacheUsuarios = new Map(); // userId → { at, pendientes }

function invalidarCatalogo() {
  cacheCatalogo = null;
  cacheUsuarios.clear();
}
function invalidarUsuario(userId) {
  cacheUsuarios.delete(Number(userId));
}

/**
 * La versión vigente de cada documento no archivado: la publicada más reciente
 * cuya fecha de entrada en vigor ya llegó. Una versión publicada con fecha
 * futura queda visible pero todavía no se exige.
 *
 * El país entra en la selección: si existe una versión para el país del usuario
 * se usa esa; si no, la global (country = ''). Hoy solo hay globales, pero la
 * consulta ya está preparada para cuando haya específicas por jurisdicción.
 */
async function catalogo() {
  if (cacheCatalogo && TTL_CACHE > 0 && Date.now() - cacheCatalogo.at < TTL_CACHE) {
    return cacheCatalogo;
  }
  const r = await query(`
    SELECT DISTINCT ON (d.id)
           d.id, d.doc_key, d.type, d.name, d.description, d.audience,
           d.country, d.jurisdiction, d.locale, d.consent_category, d.display_order,
           v.id AS version_id, v.version, v.content_hash, v.content_format,
           v.summary_of_changes, v.requires_new_acceptance,
           v.published_at, v.effective_at
      FROM legal_documents d
      JOIN legal_document_versions v ON v.document_id = d.id
     WHERE d.archived_at IS NULL
       AND v.status = 'published'
       AND (v.effective_at IS NULL OR v.effective_at <= CURRENT_TIMESTAMP)
     ORDER BY d.id, v.effective_at DESC NULLS LAST, v.published_at DESC, v.id DESC
  `);
  const docs = r.rows.sort((a, b) => a.display_order - b.display_order || a.id - b.id);
  cacheCatalogo = {
    at: Date.now(),
    docs,
    huella: docs.map((d) => `${d.id}:${d.version_id}`).join('|'),
  };
  // Si cambió el catálogo, lo que cada usuario tenía pendiente ya no vale.
  cacheUsuarios.clear();
  return cacheCatalogo;
}

/** Los documentos cuya aceptación es obligatoria para usar la plataforma. */
async function requisitos() {
  const c = await catalogo();
  return c.docs.filter((d) => d.consent_category === 'mandatory' && d.audience === 'doctor');
}

/** Los consentimientos opcionales (marketing y similares). */
async function opcionales() {
  const c = await catalogo();
  return c.docs.filter((d) => d.consent_category === 'optional' && d.audience === 'doctor');
}

/** Vista pública del catálogo: sin contenido, para pintar la lista de documentos. */
async function catalogoPublico() {
  const c = await catalogo();
  return c.docs.map(resumenDeDocumento);
}

function resumenDeDocumento(d) {
  return {
    id: d.id,
    doc_key: d.doc_key,
    type: d.type,
    name: d.name,
    description: d.description,
    audience: d.audience,
    country: d.country || null,
    locale: d.locale,
    consent_category: d.consent_category,
    version: d.version,
    version_id: d.version_id,
    content_hash: d.content_hash,
    requires_new_acceptance: d.requires_new_acceptance,
    summary_of_changes: d.summary_of_changes,
    published_at: d.published_at,
    effective_at: d.effective_at,
  };
}

// ══════════════════════════════════════════════════════════════════
//  Lectura de documentos
// ══════════════════════════════════════════════════════════════════

/** El documento vigente de un tipo, con su contenido. */
async function documentoVigente(tipo) {
  const c = await catalogo();
  const d = c.docs.find((x) => x.type === String(tipo || '').toUpperCase());
  if (!d) return null;
  const r = await query(
    'SELECT content FROM legal_document_versions WHERE id = $1',
    [d.version_id],
  );
  return { ...resumenDeDocumento(d), content: r.rows[0] ? r.rows[0].content : '' };
}

/**
 * Una versión concreta, esté publicada o archivada. Las archivadas SIGUEN
 * siendo accesibles a propósito: si alguien aceptó la v1.0 hace dos años, tiene
 * que poder leer exactamente lo que aceptó.
 */
async function versionEspecifica(tipo, version) {
  const r = await query(
    `SELECT d.id, d.doc_key, d.type, d.name, d.description, d.audience, d.country,
            d.locale, d.consent_category,
            v.id AS version_id, v.version, v.content, v.content_format, v.content_hash,
            v.summary_of_changes, v.requires_new_acceptance, v.status,
            v.published_at, v.effective_at, v.archived_at
       FROM legal_documents d
       JOIN legal_document_versions v ON v.document_id = d.id
      WHERE d.type = $1 AND v.version = $2 AND v.status <> 'draft'
      ORDER BY v.id DESC
      LIMIT 1`,
    [String(tipo || '').toUpperCase(), String(version || '')],
  );
  return r.rows[0] || null;
}

/** Todas las versiones no borrador de un documento, para el selector de versiones. */
async function versionesDe(tipo) {
  const r = await query(
    `SELECT v.id AS version_id, v.version, v.content_hash, v.status,
            v.summary_of_changes, v.published_at, v.effective_at, v.archived_at,
            v.requires_new_acceptance
       FROM legal_documents d
       JOIN legal_document_versions v ON v.document_id = d.id
      WHERE d.type = $1 AND v.status <> 'draft'
      ORDER BY v.published_at DESC NULLS LAST, v.id DESC`,
    [String(tipo || '').toUpperCase()],
  );
  return r.rows;
}

// ══════════════════════════════════════════════════════════════════
//  Estado de un usuario
// ══════════════════════════════════════════════════════════════════

/**
 * Qué le falta por aceptar a un usuario. Devuelve una entrada por documento
 * obligatorio no cubierto, indicando si es la primera vez que lo ve ('nuevo') o
 * si ya aceptó una versión anterior ('actualizado') — de eso depende el texto
 * que se le muestra.
 */
async function pendientesDe(userId) {
  const reqs = await requisitos();
  if (reqs.length === 0) return [];

  const r = await query(
    `SELECT document_id, document_version_id, document_version, accepted_at, action
       FROM legal_acceptances
      WHERE user_id = $1 AND action = 'accepted'
      ORDER BY accepted_at DESC`,
    [userId],
  );
  const aceptadas = r.rows;

  const pendientes = [];
  for (const d of reqs) {
    const estaVersion = aceptadas.some((a) => a.document_version_id === d.version_id);
    if (estaVersion) continue;

    const anterior = aceptadas.find((a) => a.document_id === d.id);
    // Una versión que no exige nueva aceptación (erratas, redacción) no frena a
    // quien ya aceptó una anterior del mismo documento.
    if (anterior && !d.requires_new_acceptance) continue;

    pendientes.push({
      ...resumenDeDocumento(d),
      motivo: anterior ? 'actualizado' : 'nuevo',
      version_anterior: anterior ? anterior.document_version : null,
      aceptado_antes_el: anterior ? anterior.accepted_at : null,
    });
  }
  return pendientes;
}

/**
 * Lo que usa el guardián en cada escritura. Cachea 60 s por usuario: sin esto
 * cada POST de la app pagaría una consulta extra.
 */
async function cumpleRequisitos(userId) {
  if (!enforcementActivo()) return { ok: true, pendientes: [], motivo: 'enforcement_off' };
  const clave = Number(userId);
  const hit = cacheUsuarios.get(clave);
  if (hit && TTL_CACHE > 0 && Date.now() - hit.at < TTL_CACHE) {
    return { ok: hit.pendientes.length === 0, pendientes: hit.pendientes };
  }
  const pendientes = await pendientesDe(userId);
  cacheUsuarios.set(clave, { at: Date.now(), pendientes });
  return { ok: pendientes.length === 0, pendientes };
}

/** El historial completo de aceptaciones de un usuario, más reciente primero. */
async function historialDe(userId) {
  const r = await query(
    `SELECT a.acceptance_uid, a.document_id, a.document_version_id, a.document_type,
            a.document_name, a.document_version, a.document_hash, a.action,
            a.accepted_at, a.ip, a.user_agent, a.acceptance_method, a.locale,
            a.evidence, d.doc_key, d.consent_category
       FROM legal_acceptances a
       LEFT JOIN legal_documents d ON d.id = a.document_id
      WHERE a.user_id = $1
      ORDER BY a.accepted_at DESC, a.id DESC`,
    [userId],
  );
  return r.rows;
}

/**
 * El estado que pinta la pantalla de "Legal y privacidad": qué tiene aceptado
 * hoy, qué le falta y en qué situación están los consentimientos opcionales.
 */
async function estadoDe(userId) {
  const [reqs, opt, historial, pendientes] = await Promise.all([
    requisitos(), opcionales(), historialDe(userId), pendientesDe(userId),
  ]);

  const vigentes = [...reqs, ...opt].map((d) => {
    // La última acción sobre ESTE documento (no sobre esta versión): sirve para
    // saber si un consentimiento opcional está otorgado o retirado ahora mismo.
    const ultima = historial.find((h) => h.document_id === d.id);
    const deEstaVersion = historial.find(
      (h) => h.document_version_id === d.version_id && h.action === 'accepted',
    );
    return {
      ...resumenDeDocumento(d),
      aceptado: !!deEstaVersion,
      activo: !!(ultima && ultima.action === 'accepted'),
      aceptado_el: deEstaVersion ? deEstaVersion.accepted_at : null,
      acceptance_uid: deEstaVersion ? deEstaVersion.acceptance_uid : null,
      version_aceptada: ultima ? ultima.document_version : null,
      ultima_accion: ultima ? ultima.action : null,
      ultima_accion_el: ultima ? ultima.accepted_at : null,
    };
  });

  return { documentos: vigentes, pendientes, historial };
}

// ══════════════════════════════════════════════════════════════════
//  Registro de aceptaciones
// ══════════════════════════════════════════════════════════════════

class ErrorLegal extends Error {
  constructor(codigo, mensaje, extra) {
    super(mensaje);
    this.codigo = codigo;
    this.extra = extra || {};
  }
}

function ejecutorDe(client) {
  return client ? (t, p) => client.query(t, p) : query;
}

/**
 * Registra una o varias aceptaciones. Es el único camino por el que una fila
 * entra en legal_acceptances.
 *
 * `seleccion` es lo que el cliente dice haber aceptado: [{ type, version, hash }].
 * Se comprueba una por una contra la versión vigente. No se acepta "lo que haya":
 * si la versión o el hash no coinciden con lo publicado, se rechaza entera. Ese
 * es el control que impide aceptar un texto distinto del que se mostró y también
 * el que impide que una pestaña vieja acepte una versión ya sustituida.
 *
 * `exigirObligatorios` hace que falten documentos sea un error: así lo usa el
 * alta de cuenta, donde no se puede crear la cuenta a medias.
 */
async function validarSeleccion(seleccion, { exigirObligatorios = true } = {}) {
  const reqs = await requisitos();
  const opt = await opcionales();
  const porTipo = new Map([...reqs, ...opt].map((d) => [d.type, d]));

  const normalizada = (Array.isArray(seleccion) ? seleccion : []).map((s) => ({
    type: String((s && (s.type || s.document_type)) || '').toUpperCase().slice(0, 40),
    version: String((s && s.version) || '').slice(0, 20),
    hash: String((s && (s.hash || s.content_hash)) || '').toLowerCase().slice(0, 64),
  }));

  // 1 · Que exista y que sea EXACTAMENTE la vigente. Aquí es donde se cierra el
  // hueco de "aceptar una versión distinta de la mostrada": si el cliente manda
  // una versión vieja, un hash inventado o nada en absoluto, no pasa.
  const validadas = [];
  for (const s of normalizada) {
    const d = porTipo.get(s.type);
    if (!d) {
      throw new ErrorLegal('unknown_document', `Documento desconocido: ${s.type || '(vacío)'}.`);
    }
    if (s.version !== d.version || s.hash !== d.content_hash) {
      throw new ErrorLegal(
        'version_mismatch',
        'El documento cambió mientras lo revisabas. Vuelve a cargarlo y acéptalo de nuevo.',
        { type: d.type, expected_version: d.version, expected_hash: d.content_hash },
      );
    }
    if (!validadas.some((v) => v.id === d.id)) validadas.push(d);
  }

  // 2 · Que no falte ninguno obligatorio.
  if (exigirObligatorios) {
    const faltan = reqs.filter((d) => !validadas.some((v) => v.id === d.id));
    if (faltan.length > 0) {
      throw new ErrorLegal(
        'missing_required',
        'Debes aceptar los Términos y Condiciones y confirmar la lectura de la Política de Privacidad.',
        { missing: faltan.map((d) => ({ type: d.type, name: d.name, version: d.version })) },
      );
    }
  }

  return validadas;
}

async function registrarAceptaciones({
  userId,
  clinicId = null,
  seleccion = [],
  metodo = 'checkbox',
  req = null,
  client = null,
  exigirObligatorios = true,
  subjectType = 'user',
  contexto = {},
  actorRole = '',
}) {
  const ejecutar = ejecutorDe(client);
  const meta = datosDePeticion(req);
  const validadas = await validarSeleccion(seleccion, { exigirObligatorios });

  // Una fila por documento. Nunca un UPDATE.
  const creadas = [];
  for (const d of validadas) {
    const uid = crypto.randomUUID();
    const evidencia = {
      ...contexto,
      documento_mostrado: { nombre: d.name, version: d.version, hash: d.content_hash },
      catalogo_version_id: d.version_id,
      registrado_por: 'legal-service',
    };
    await ejecutar(
      `INSERT INTO legal_acceptances
         (acceptance_uid, user_id, clinic_id, subject_type, document_id, document_version_id,
          document_type, document_name, document_version, document_hash, action,
          ip, user_agent, acceptance_method, locale, evidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'accepted', $11, $12, $13, $14, $15)`,
      [
        uid, userId, clinicId, subjectType, d.id, d.version_id,
        d.type, d.name, d.version, d.content_hash,
        meta.ip, meta.user_agent, String(metodo).slice(0, 40), meta.locale,
        JSON.stringify(evidencia),
      ],
    );
    creadas.push({
      acceptance_uid: uid,
      document_type: d.type,
      document_name: d.name,
      document_version: d.version,
      document_hash: d.content_hash,
    });

    await registrarEvento({
      event: EVENTO_POR_TIPO[d.type] || EVENTOS.ACEPTO_DOCUMENTO,
      actor_user_id: userId,
      actor_role: actorRole,
      subject_user_id: userId,
      clinic_id: clinicId,
      document_id: d.id,
      document_version_id: d.version_id,
      document_type: d.type,
      document_version: d.version,
      document_hash: d.content_hash,
      acceptance_uid: uid,
      ip: meta.ip,
      user_agent: meta.user_agent,
      metadata: { metodo, ...contexto },
      client,
    });
  }

  invalidarUsuario(userId);
  return creadas;
}

/**
 * Retira un consentimiento opcional. También es un INSERT: la retirada se
 * fecha, y la constancia de haberlo otorgado antes se queda donde estaba.
 */
async function retirarConsentimiento({ userId, clinicId = null, tipo, req = null, actorRole = '' }) {
  const opt = await opcionales();
  const d = opt.find((x) => x.type === String(tipo || '').toUpperCase());
  if (!d) throw new ErrorLegal('not_optional', 'Ese consentimiento no es opcional o no existe.');

  const meta = datosDePeticion(req);
  const uid = crypto.randomUUID();
  await query(
    `INSERT INTO legal_acceptances
       (acceptance_uid, user_id, clinic_id, subject_type, document_id, document_version_id,
        document_type, document_name, document_version, document_hash, action,
        ip, user_agent, acceptance_method, locale, evidence)
     VALUES ($1, $2, $3, 'user', $4, $5, $6, $7, $8, $9, 'withdrawn', $10, $11, 'settings_toggle', $12, $13)`,
    [
      uid, userId, clinicId, d.id, d.version_id,
      d.type, d.name, d.version, d.content_hash,
      meta.ip, meta.user_agent, meta.locale,
      JSON.stringify({ documento_mostrado: { nombre: d.name, version: d.version } }),
    ],
  );

  await registrarEvento({
    event: EVENTOS.RETIRO_CONSENTIMIENTO,
    actor_user_id: userId,
    actor_role: actorRole,
    subject_user_id: userId,
    clinic_id: clinicId,
    document_id: d.id,
    document_version_id: d.version_id,
    document_type: d.type,
    document_version: d.version,
    document_hash: d.content_hash,
    acceptance_uid: uid,
    ip: meta.ip,
    user_agent: meta.user_agent,
  });

  invalidarUsuario(userId);
  return { acceptance_uid: uid, document_type: d.type, action: 'withdrawn' };
}

// ══════════════════════════════════════════════════════════════════
//  Bitácora
// ══════════════════════════════════════════════════════════════════

/**
 * Escribe en la bitácora legal. Nunca lanza: un fallo al registrar el evento no
 * puede tumbar la operación que lo generó — pero sí deja rastro en consola,
 * porque una bitácora que falla en silencio es peor que no tenerla.
 */
async function registrarEvento(e) {
  const ejecutar = ejecutorDe(e.client);
  try {
    await ejecutar(
      `INSERT INTO legal_audit_events
         (event, actor_user_id, actor_role, subject_user_id, clinic_id,
          document_id, document_version_id, document_type, document_version,
          document_hash, acceptance_uid, ip, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        String(e.event || 'UNKNOWN').slice(0, 60),
        e.actor_user_id || null,
        String(e.actor_role || '').slice(0, 40),
        e.subject_user_id || null,
        e.clinic_id || null,
        e.document_id || null,
        e.document_version_id || null,
        String(e.document_type || '').slice(0, 40),
        String(e.document_version || '').slice(0, 20),
        String(e.document_hash || '').slice(0, 64),
        e.acceptance_uid || null,
        String(e.ip || '').slice(0, 80),
        String(e.user_agent || '').slice(0, 400),
        JSON.stringify(e.metadata || {}),
      ],
    );
  } catch (err) {
    console.error('[legal] no se pudo registrar el evento de auditoría:', err.message);
  }
}

// ══════════════════════════════════════════════════════════════════
//  Evidencia
// ══════════════════════════════════════════════════════════════════

/**
 * El paquete de evidencia de un usuario: quién es, qué aceptó, de qué versión,
 * con qué hash, cuándo, desde dónde, y cómo verificarlo por cuenta propia.
 *
 * `incluirContenido` mete el texto íntegro de cada versión aceptada; sin él va
 * solo la referencia verificable (hash + URL de la versión exacta), que es lo
 * que evita que el archivo pese diez megas por cada exportación.
 */
async function evidenciaDe(userId, { incluirContenido = false } = {}) {
  const u = await query(
    `SELECT u.id, u.name, u.email, u.role, u.clinic_id, u.created_at, c.name AS clinic_name
       FROM users u LEFT JOIN clinics c ON c.id = u.clinic_id
      WHERE u.id = $1`,
    [userId],
  );
  if (u.rowCount === 0) return null;

  const historial = await historialDe(userId);
  const contenidos = new Map();
  if (incluirContenido && historial.length > 0) {
    const ids = [...new Set(historial.map((h) => h.document_version_id))];
    const r = await query(
      'SELECT id, content, content_hash FROM legal_document_versions WHERE id = ANY($1::int[])',
      [ids],
    );
    r.rows.forEach((f) => contenidos.set(f.id, f));
  }

  const base = String(process.env.APP_URL || '').replace(/\/+$/, '');
  const registros = historial.map((h) => {
    const cont = contenidos.get(h.document_version_id);
    return {
      acceptance_uid: h.acceptance_uid,
      accion: h.action,
      documento: { tipo: h.document_type, nombre: h.document_name, clave: h.doc_key },
      version: h.document_version,
      hash_sha256: h.document_hash,
      fecha_hora_utc: h.accepted_at,
      ip: h.ip,
      user_agent: h.user_agent,
      metodo: h.acceptance_method,
      idioma: h.locale,
      categoria: h.consent_category,
      evidencia_adicional: h.evidence,
      referencia_verificable: base
        ? `${base}/legal.html?doc=${encodeURIComponent(h.document_type)}&v=${encodeURIComponent(h.document_version)}`
        : `/legal.html?doc=${h.document_type}&v=${h.document_version}`,
      // El hash recalculado sobre el contenido guardado: si coincide con el de
      // la aceptación, el texto no se ha tocado desde que se aceptó.
      verificacion: cont
        ? {
            hash_recalculado: hashDe(cont.content),
            coincide: hashDe(cont.content) === h.document_hash,
          }
        : null,
      contenido: cont ? cont.content : undefined,
    };
  });

  return {
    generado_el: new Date().toISOString(),
    plataforma: 'Portal Salud Digital',
    usuario: {
      id: u.rows[0].id,
      nombre: u.rows[0].name,
      email: u.rows[0].email,
      rol: u.rows[0].role,
      clinica_id: u.rows[0].clinic_id,
      clinica: u.rows[0].clinic_name,
      cuenta_creada_el: u.rows[0].created_at,
    },
    total_registros: registros.length,
    registros,
    nota:
      'Cada registro identifica la versión exacta del documento aceptado mediante su huella ' +
      'SHA-256. El contenido íntegro de esa versión permanece consultable en la referencia ' +
      'indicada, incluso si el documento fue archivado o sustituido por una versión posterior.',
  };
}

module.exports = {
  ROLES_EXIGIDOS,
  EVENTOS,
  ErrorLegal,
  hashDe,
  datosDePeticion,
  enforcementActivo,
  sembrar,
  catalogo,
  catalogoPublico,
  requisitos,
  opcionales,
  documentoVigente,
  versionEspecifica,
  versionesDe,
  pendientesDe,
  cumpleRequisitos,
  historialDe,
  estadoDe,
  validarSeleccion,
  registrarAceptaciones,
  retirarConsentimiento,
  registrarEvento,
  evidenciaDe,
  invalidarUsuario,
  invalidarCatalogo,
};
