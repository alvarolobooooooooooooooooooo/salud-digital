// ── API del sistema legal ──
//
// Tres audiencias en un solo router, separadas por guardián:
//
//   · Público      → leer los documentos. Sin sesión: hay que poder leerlos
//                    ANTES de tener cuenta, y las versiones archivadas tienen
//                    que seguir siendo accesibles para siempre.
//   · Autenticado  → qué tengo aceptado, aceptar, retirar lo opcional,
//                    exportar mi evidencia, pedir el cierre de la cuenta.
//   · super_admin  → publicar versiones, consultar aceptaciones ajenas,
//                    exportar evidencia y leer la bitácora legal.
//
// Lo que este router NO hace, a propósito: modificar o borrar una aceptación.
// No hay endpoint para eso ni con rol de administrador — y aunque alguien lo
// escribiera mañana, los triggers de la base lo rechazarían (lib/legal/schema.js).

const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const legal = require('../lib/legal/service');

const TIPO_VALIDO = /^[A-Z_]{2,40}$/;
const VERSION_VALIDA = /^[0-9]+\.[0-9]+(\.[0-9]+)?$/;

function tipoDe(param) {
  const t = String(param || '').toUpperCase().slice(0, 40);
  return TIPO_VALIDO.test(t) ? t : null;
}

// ══════════════════════════════════════════════════════════════════
//  Público — leer los documentos
// ══════════════════════════════════════════════════════════════════

// Catálogo vigente, sin contenido. Lo usa el visor y el paso legal del alta.
router.get('/documents', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ documents: await legal.catalogoPublico() });
});

// La versión vigente de un documento, con su texto completo y su hash. El hash
// que viaja aquí es el mismo que el cliente devuelve al aceptar: así el
// servidor puede comprobar que se aceptó exactamente lo que se mostró.
router.get('/documents/:type', async (req, res) => {
  const tipo = tipoDe(req.params.type);
  if (!tipo) return res.status(400).json({ error: 'Tipo de documento inválido.' });
  const doc = await legal.documentoVigente(tipo);
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });
  res.set('Cache-Control', 'no-store');
  res.json(doc);
});

// Todas las versiones publicadas o archivadas de un documento.
router.get('/documents/:type/versions', async (req, res) => {
  const tipo = tipoDe(req.params.type);
  if (!tipo) return res.status(400).json({ error: 'Tipo de documento inválido.' });
  res.json({ type: tipo, versions: await legal.versionesDe(tipo) });
});

// Una versión concreta. Incluye las archivadas: quien aceptó la v1.0 tiene
// derecho a leer exactamente lo que aceptó, aunque hoy rija la v3.0.
router.get('/documents/:type/versions/:version', async (req, res) => {
  const tipo = tipoDe(req.params.type);
  const version = String(req.params.version || '').slice(0, 20);
  if (!tipo || !VERSION_VALIDA.test(version)) {
    return res.status(400).json({ error: 'Documento o versión inválidos.' });
  }
  const v = await legal.versionEspecifica(tipo, version);
  if (!v) return res.status(404).json({ error: 'Versión no encontrada.' });
  res.json(v);
});

// ══════════════════════════════════════════════════════════════════
//  Usuario autenticado
// ══════════════════════════════════════════════════════════════════

// Lo que le falta por aceptar. Es lo que consulta layout.js en cada carga para
// decidir si pinta el modal de nueva versión.
router.get('/pending', authenticate, async (req, res) => {
  const pendientes = await legal.pendientesDe(req.user.id);
  res.set('Cache-Control', 'no-store');
  res.json({ pending: pendientes, count: pendientes.length });
});

// Estado completo para la pantalla de "Legal y privacidad".
router.get('/me', authenticate, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await legal.estadoDe(req.user.id));
});

// ── Aceptar ──
// El cuerpo debe traer, por cada documento, el tipo, la versión y el hash que
// el usuario tuvo delante. Si algo no coincide con lo publicado, no se registra
// nada: 409 y a recargar. Aceptar "a ciegas" llamando a la API sin esos datos
// devuelve 400, que es justo el bypass que este endpoint tiene que cerrar.
router.post('/accept', authenticate, async (req, res) => {
  const cuerpo = req.body || {};
  const seleccion = Array.isArray(cuerpo.acceptances) ? cuerpo.acceptances : [];
  if (seleccion.length === 0) {
    return res.status(400).json({
      error: 'Indica qué documentos aceptas, con su versión y su huella.',
      code: 'empty_selection',
    });
  }
  if (seleccion.length > 20) {
    return res.status(400).json({ error: 'Demasiados documentos en una sola petición.' });
  }

  // Los métodos son un vocabulario cerrado: es un campo de evidencia, no un
  // texto libre que el cliente pueda usar para escribir lo que quiera.
  const METODOS = ['signup_checkbox', 'reacceptance_modal', 'settings_toggle', 'invitation_checkbox'];
  const metodo = METODOS.includes(cuerpo.method) ? cuerpo.method : 'reacceptance_modal';

  try {
    const creadas = await legal.registrarAceptaciones({
      userId: req.user.id,
      clinicId: req.user.clinic_id || null,
      seleccion,
      metodo,
      req,
      actorRole: req.user.role,
      // Aquí no se exige el paquete completo: un usuario puede estar aceptando
      // solo la versión nueva de privacidad, o activando el consentimiento
      // opcional de marketing. Lo obligatorio lo sigue exigiendo el guardián en
      // cada escritura, que es donde importa.
      exigirObligatorios: false,
      contexto: { origen: String(cuerpo.source || '').slice(0, 80) || 'app' },
    });
    const pendientes = await legal.pendientesDe(req.user.id);
    res.status(201).json({ accepted: creadas, pending: pendientes });
  } catch (err) {
    if (err instanceof legal.ErrorLegal) {
      const estado = err.codigo === 'version_mismatch' ? 409 : 400;
      return res.status(estado).json({ error: err.message, code: err.codigo, ...err.extra });
    }
    throw err;
  }
});

// Retirar un consentimiento opcional. No se borra el otorgamiento anterior:
// se añade la retirada, fechada.
router.post('/consents/:type/withdraw', authenticate, async (req, res) => {
  const tipo = tipoDe(req.params.type);
  if (!tipo) return res.status(400).json({ error: 'Tipo de documento inválido.' });
  try {
    const r = await legal.retirarConsentimiento({
      userId: req.user.id,
      clinicId: req.user.clinic_id || null,
      tipo,
      req,
      actorRole: req.user.role,
    });
    res.json(r);
  } catch (err) {
    if (err instanceof legal.ErrorLegal) {
      return res.status(400).json({ error: err.message, code: err.codigo });
    }
    throw err;
  }
});

// ── Mi evidencia ──
// El usuario puede exportar la suya sin pedírsela a nadie. En JSON (verificable
// a máquina) o en PDF (para adjuntar a un expediente).
router.get('/me/evidence', authenticate, async (req, res) => {
  const conContenido = String(req.query.full || '') === '1';
  const evidencia = await legal.evidenciaDe(req.user.id, { incluirContenido: conContenido });
  if (!evidencia) return res.status(404).json({ error: 'Usuario no encontrado.' });

  await legal.registrarEvento({
    event: legal.EVENTOS.EVIDENCIA_EXPORTADA,
    actor_user_id: req.user.id,
    actor_role: req.user.role,
    subject_user_id: req.user.id,
    clinic_id: req.user.clinic_id || null,
    ...legal.datosDePeticion(req),
    metadata: { formato: req.query.format === 'pdf' ? 'pdf' : 'json', propia: true },
  });

  if (req.query.format === 'pdf') return evidenciaEnPdf(res, evidencia);
  res.setHeader('Content-Disposition', 'attachment; filename="evidencia-legal.json"');
  res.json(evidencia);
});

// ── Cierre de cuenta ──
// Solicitud, no ejecución. Cerrar la cuenta NO borra el expediente clínico:
// abre un expediente de cierre que la plataforma tramita respetando los plazos
// legales de conservación.
router.get('/account-closure', authenticate, async (req, res) => {
  const r = await query(
    `SELECT id, status, reason, requested_at, export_generated_at,
            clinical_retention_until, retention_basis, data_deleted_at, notes
       FROM account_closure_requests
      WHERE user_id = $1
      ORDER BY requested_at DESC
      LIMIT 5`,
    [req.user.id],
  );
  res.json({ requests: r.rows });
});

router.post('/account-closure', authenticate, async (req, res) => {
  const motivo = String((req.body && req.body.reason) || '').slice(0, 1000);

  const abierta = await query(
    `SELECT id FROM account_closure_requests
      WHERE user_id = $1 AND status IN ('requested', 'export_ready', 'retention_hold')`,
    [req.user.id],
  );
  if (abierta.rowCount > 0) {
    return res.status(409).json({
      error: 'Ya tienes una solicitud de cierre en curso.',
      code: 'closure_in_progress',
    });
  }

  const r = await query(
    `INSERT INTO account_closure_requests (user_id, clinic_id, reason, requested_by, notes)
     VALUES ($1, $2, $3, $1, $4)
     RETURNING id, status, requested_at`,
    [
      req.user.id,
      req.user.clinic_id || null,
      motivo,
      'Plazo de conservación del expediente clínico pendiente de determinar según la ' +
        'jurisdicción del profesional. REQUIERE REVISIÓN LEGAL antes de cualquier eliminación.',
    ],
  );

  await legal.registrarEvento({
    event: legal.EVENTOS.CIERRE_SOLICITADO,
    actor_user_id: req.user.id,
    actor_role: req.user.role,
    subject_user_id: req.user.id,
    clinic_id: req.user.clinic_id || null,
    ...legal.datosDePeticion(req),
    metadata: { solicitud_id: r.rows[0].id, motivo_indicado: !!motivo },
  });

  res.status(201).json({
    request: r.rows[0],
    message:
      'Recibimos tu solicitud. Antes de cerrar la cuenta te contactaremos para que exportes ' +
      'tu información. El expediente clínico no se elimina de forma automática: está sujeto a ' +
      'los plazos legales de conservación que apliquen a tu ejercicio profesional.',
  });
});

router.post('/account-closure/:id/cancel', authenticate, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido.' });
  const r = await query(
    `UPDATE account_closure_requests
        SET status = 'cancelled', decided_at = CURRENT_TIMESTAMP, decided_by = $2
      WHERE id = $1 AND user_id = $2 AND status IN ('requested', 'export_ready')
      RETURNING id, status`,
    [id, req.user.id],
  );
  if (r.rowCount === 0) return res.status(404).json({ error: 'Solicitud no encontrada o ya resuelta.' });

  await legal.registrarEvento({
    event: legal.EVENTOS.CIERRE_CANCELADO,
    actor_user_id: req.user.id,
    actor_role: req.user.role,
    subject_user_id: req.user.id,
    ...legal.datosDePeticion(req),
    metadata: { solicitud_id: id },
  });
  res.json({ ok: true, request: r.rows[0] });
});

// ══════════════════════════════════════════════════════════════════
//  Administración de la plataforma (super_admin)
// ══════════════════════════════════════════════════════════════════

const soloAdmin = [authenticate, requireRole('super_admin')];

// Documentos con todas sus versiones y cuánta gente aceptó cada una.
router.get('/admin/documents', ...soloAdmin, async (req, res) => {
  const docs = await query(
    `SELECT id, doc_key, type, name, description, audience, country, jurisdiction,
            locale, consent_category, display_order, created_at, archived_at
       FROM legal_documents
      ORDER BY display_order, id`,
  );
  const versiones = await query(
    `SELECT v.id, v.document_id, v.version, v.content_hash, v.content_format,
            v.summary_of_changes, v.requires_new_acceptance, v.status,
            v.created_at, v.published_at, v.effective_at, v.archived_at,
            (SELECT COUNT(*) FROM legal_acceptances a
              WHERE a.document_version_id = v.id AND a.action = 'accepted') AS aceptaciones
       FROM legal_document_versions v
      ORDER BY v.document_id, v.published_at DESC NULLS LAST, v.id DESC`,
  );
  res.json({
    documents: docs.rows.map((d) => ({
      ...d,
      versions: versiones.rows
        .filter((v) => v.document_id === d.id)
        .map((v) => ({ ...v, aceptaciones: parseInt(v.aceptaciones, 10) || 0 })),
    })),
  });
});

// Crear una versión nueva. Nace como BORRADOR: publicar es un acto aparte, para
// que nadie deje vigente un texto a medio escribir por un clic de más.
router.post('/admin/documents/:id/versions', ...soloAdmin, async (req, res) => {
  const documentId = parseInt(req.params.id, 10);
  if (!Number.isInteger(documentId)) return res.status(400).json({ error: 'ID inválido.' });

  const b = req.body || {};
  const version = String(b.version || '').trim().slice(0, 20);
  const contenido = String(b.content || '');
  if (!VERSION_VALIDA.test(version)) {
    return res.status(400).json({ error: 'La versión debe tener la forma 1.0 o 1.0.1.' });
  }
  if (contenido.trim().length < 200) {
    return res.status(400).json({ error: 'El contenido del documento es demasiado corto.' });
  }

  const doc = await query('SELECT id, type, name FROM legal_documents WHERE id = $1', [documentId]);
  if (doc.rowCount === 0) return res.status(404).json({ error: 'Documento no encontrado.' });

  const hash = legal.hashDe(contenido);
  let creada;
  try {
    creada = await query(
      `INSERT INTO legal_document_versions
         (document_id, version, content, content_format, content_hash,
          summary_of_changes, requires_new_acceptance, status, effective_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9)
       RETURNING id, version, content_hash, status, created_at`,
      [
        documentId, version, contenido,
        b.content_format === 'html' ? 'html' : 'markdown',
        hash,
        String(b.summary_of_changes || '').slice(0, 4000),
        b.requires_new_acceptance !== false,
        b.effective_at ? new Date(b.effective_at) : null,
        req.user.id,
      ],
    );
  } catch (err) {
    if (err && err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe esa versión para este documento.' });
    }
    throw err;
  }

  await legal.registrarEvento({
    event: legal.EVENTOS.VERSION_CREADA,
    actor_user_id: req.user.id,
    actor_role: req.user.role,
    document_id: documentId,
    document_version_id: creada.rows[0].id,
    document_type: doc.rows[0].type,
    document_version: version,
    document_hash: hash,
    ...legal.datosDePeticion(req),
    metadata: { requiere_nueva_aceptacion: b.requires_new_acceptance !== false },
  });

  res.status(201).json({ version: creada.rows[0] });
});

// Publicar. A partir de aquí la versión es inmutable (lo impone la base) y, si
// exige nueva aceptación, todo el mundo verá el modal en su próxima escritura.
router.post('/admin/versions/:id/publish', ...soloAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido.' });

  const v = await query(
    `SELECT v.*, d.type FROM legal_document_versions v
       JOIN legal_documents d ON d.id = v.document_id
      WHERE v.id = $1`,
    [id],
  );
  if (v.rowCount === 0) return res.status(404).json({ error: 'Versión no encontrada.' });
  if (v.rows[0].status !== 'draft') {
    return res.status(409).json({ error: 'Esa versión ya fue publicada.' });
  }

  // Comprobación de integridad antes de dar el paso irreversible: si el hash
  // guardado no corresponde al contenido, algo tocó la fila y no se publica.
  if (legal.hashDe(v.rows[0].content) !== v.rows[0].content_hash) {
    return res.status(409).json({
      error: 'La huella del contenido no coincide. No se publica una versión cuya integridad no se puede confirmar.',
      code: 'hash_mismatch',
    });
  }

  const efectiva = req.body && req.body.effective_at ? new Date(req.body.effective_at) : null;
  const r = await query(
    `UPDATE legal_document_versions
        SET status = 'published',
            published_at = CURRENT_TIMESTAMP,
            published_by = $2,
            effective_at = COALESCE($3, effective_at, CURRENT_TIMESTAMP)
      WHERE id = $1 AND status = 'draft'
      RETURNING id, version, status, published_at, effective_at, content_hash`,
    [id, req.user.id, efectiva],
  );

  // Archivar automáticamente las versiones publicadas anteriores del mismo
  // documento: dejan de regir, pero SIGUEN siendo consultables y la evidencia
  // que apunta a ellas sigue en pie.
  await query(
    `UPDATE legal_document_versions
        SET status = 'archived', archived_at = CURRENT_TIMESTAMP
      WHERE document_id = $1 AND id <> $2 AND status = 'published'`,
    [v.rows[0].document_id, id],
  );

  legal.invalidarCatalogo();

  await legal.registrarEvento({
    event: legal.EVENTOS.DOC_PUBLICADO,
    actor_user_id: req.user.id,
    actor_role: req.user.role,
    document_id: v.rows[0].document_id,
    document_version_id: id,
    document_type: v.rows[0].type,
    document_version: v.rows[0].version,
    document_hash: v.rows[0].content_hash,
    ...legal.datosDePeticion(req),
    metadata: { requiere_nueva_aceptacion: v.rows[0].requires_new_acceptance },
  });

  res.json({ version: r.rows[0] });
});

// Archivar un documento entero (deja de pedirse; su historia sigue accesible).
router.post('/admin/documents/:id/archive', ...soloAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido.' });
  const r = await query(
    `UPDATE legal_documents SET archived_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND archived_at IS NULL
      RETURNING id, type, name`,
    [id],
  );
  if (r.rowCount === 0) return res.status(404).json({ error: 'Documento no encontrado o ya archivado.' });
  legal.invalidarCatalogo();

  await legal.registrarEvento({
    event: legal.EVENTOS.DOC_ARCHIVADO,
    actor_user_id: req.user.id,
    actor_role: req.user.role,
    document_id: id,
    document_type: r.rows[0].type,
    ...legal.datosDePeticion(req),
  });
  res.json({ ok: true, document: r.rows[0] });
});

// Aceptaciones de todo el mundo, o de un usuario concreto. Solo lectura: no
// existe forma de editarlas desde ninguna ruta.
router.get('/admin/acceptances', ...soloAdmin, async (req, res) => {
  const userId = parseInt(req.query.user_id, 10);
  const limite = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const busqueda = String(req.query.q || '').trim().slice(0, 120);

  const filtros = [];
  const params = [];
  if (Number.isInteger(userId)) {
    params.push(userId);
    filtros.push(`a.user_id = $${params.length}`);
  }
  if (busqueda) {
    params.push(`%${busqueda}%`);
    filtros.push(`(u.email ILIKE $${params.length} OR u.name ILIKE $${params.length})`);
  }
  params.push(limite);

  const r = await query(
    `SELECT a.acceptance_uid, a.user_id, u.name AS user_name, u.email AS user_email,
            a.clinic_id, c.name AS clinic_name, a.document_type, a.document_name,
            a.document_version, a.document_hash, a.action, a.accepted_at,
            a.ip, a.user_agent, a.acceptance_method, a.locale
       FROM legal_acceptances a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN clinics c ON c.id = a.clinic_id
      ${filtros.length ? 'WHERE ' + filtros.join(' AND ') : ''}
      ORDER BY a.accepted_at DESC, a.id DESC
      LIMIT $${params.length}`,
    params,
  );
  res.json({ acceptances: r.rows });
});

// Exportar la evidencia de un usuario, en JSON o en PDF.
router.get('/admin/evidence/:userId', ...soloAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (!Number.isInteger(userId)) return res.status(400).json({ error: 'ID inválido.' });
  const conContenido = String(req.query.full || '') === '1';
  const evidencia = await legal.evidenciaDe(userId, { incluirContenido: conContenido });
  if (!evidencia) return res.status(404).json({ error: 'Usuario no encontrado.' });

  await legal.registrarEvento({
    event: legal.EVENTOS.EVIDENCIA_EXPORTADA,
    actor_user_id: req.user.id,
    actor_role: req.user.role,
    subject_user_id: userId,
    ...legal.datosDePeticion(req),
    metadata: { formato: req.query.format === 'pdf' ? 'pdf' : 'json', propia: false },
  });

  if (req.query.format === 'pdf') return evidenciaEnPdf(res, evidencia);
  res.setHeader('Content-Disposition', `attachment; filename="evidencia-legal-${userId}.json"`);
  res.json(evidencia);
});

// La bitácora legal. Append-only, nunca purgada.
router.get('/admin/audit', ...soloAdmin, async (req, res) => {
  const limite = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const evento = String(req.query.event || '').trim().slice(0, 60);
  const params = [];
  let filtro = '';
  if (evento) {
    params.push(evento);
    filtro = `WHERE e.event = $${params.length}`;
  }
  params.push(limite);
  const r = await query(
    `SELECT e.id, e.event, e.actor_user_id, e.actor_role, e.subject_user_id,
            e.clinic_id, e.document_type, e.document_version, e.document_hash,
            e.acceptance_uid, e.ip, e.created_at, e.metadata,
            a.name AS actor_name, s.name AS subject_name
       FROM legal_audit_events e
       LEFT JOIN users a ON a.id = e.actor_user_id
       LEFT JOIN users s ON s.id = e.subject_user_id
       ${filtro}
      ORDER BY e.id DESC
      LIMIT $${params.length}`,
    params,
  );
  res.json({ events: r.rows });
});

// Solicitudes de cierre de cuenta abiertas.
router.get('/admin/closures', ...soloAdmin, async (req, res) => {
  const r = await query(
    `SELECT r.*, u.name AS user_name, u.email AS user_email, c.name AS clinic_name
       FROM account_closure_requests r
       LEFT JOIN users u ON u.id = r.user_id
       LEFT JOIN clinics c ON c.id = r.clinic_id
      ORDER BY r.requested_at DESC
      LIMIT 200`,
  );
  res.json({ requests: r.rows });
});

// ══════════════════════════════════════════════════════════════════
//  Evidencia en PDF
// ══════════════════════════════════════════════════════════════════

function evidenciaEnPdf(res, ev) {
  const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
  const nombreArchivo = `evidencia-legal-${String(ev.usuario.id)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
  doc.pipe(res);

  const linea = (etiqueta, valor) => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569').text(etiqueta, { continued: true });
    doc.font('Helvetica').fillColor('#0f172a').text('  ' + String(valor ?? '—'));
  };

  doc.font('Helvetica-Bold').fontSize(17).fillColor('#0f172a')
    .text('Evidencia de aceptación contractual');
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(10).fillColor('#64748b')
    .text('Portal Salud Digital · documento generado automáticamente');
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Titular');
  doc.moveDown(0.3);
  linea('Nombre:', ev.usuario.nombre);
  linea('Correo:', ev.usuario.email);
  linea('Identificador de usuario:', ev.usuario.id);
  linea('Clínica:', ev.usuario.clinica || '—');
  linea('Generado el:', ev.generado_el);
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a')
    .text(`Registros de aceptación (${ev.total_registros})`);
  doc.moveDown(0.5);

  if (ev.registros.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor('#64748b')
      .text('No hay registros de aceptación para este usuario.');
  }

  ev.registros.forEach((r, i) => {
    if (doc.y > 640) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0891b2')
      .text(`${i + 1}. ${r.documento.nombre} — versión ${r.version}`);
    doc.moveDown(0.25);
    linea('Acción:', r.accion === 'accepted' ? 'Aceptado' : r.accion === 'withdrawn' ? 'Retirado' : r.accion);
    linea('Fecha y hora (UTC):', r.fecha_hora_utc);
    linea('Identificador de aceptación:', r.acceptance_uid);
    linea('Huella SHA-256 del documento:', r.hash_sha256);
    linea('Dirección IP:', r.ip || '—');
    linea('Agente de usuario:', (r.user_agent || '—').slice(0, 160));
    linea('Método:', r.metodo);
    linea('Idioma:', r.idioma);
    linea('Documento verificable en:', r.referencia_verificable);
    if (r.verificacion) {
      linea(
        'Verificación de integridad:',
        r.verificacion.coincide
          ? 'La huella recalculada coincide con la registrada.'
          : 'ATENCIÓN: la huella recalculada NO coincide con la registrada.',
      );
    }
    doc.moveDown(0.8);
  });

  if (doc.y > 620) doc.addPage();
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(ev.nota, { align: 'justify' });
  doc.end();
}

module.exports = router;
