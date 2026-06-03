// ============================================================
// Mensajería clínica interna — API
// Chat entre el personal de una misma clínica (doctores y admin).
// Persistencia en Postgres; el frontend hace polling para tiempo casi-real.
// ============================================================
const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { v4: uuid } = require('uuid');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Estudios clínicos: imágenes (rayos X, fotos de labs) y PDFs. resource_type
// 'auto' deja que Cloudinary maneje imagen o documento según el archivo.
const studyUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Formato no permitido. Usa JPEG, PNG, WebP o PDF.'));
  },
});

function uploadBufferToCloudinary(buffer, publicId, folder, resourceType) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, folder, resource_type: resourceType || 'auto', overwrite: true },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

const CONV_KINDS = ['directo', 'equipo', 'caso', 'interconsulta', 'anuncio'];
const MSG_KINDS = ['text', 'urgent-text', 'study', 'interconsulta', 'task', 'voice', 'patient-card', 'system'];

const ROLE_LABEL = {
  doctor: 'Médico/a',
  clinic_admin: 'Administración',
  receptionist: 'Recepción',
  super_admin: 'Administración',
};

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function firstName(name) {
  if (!name) return '';
  const parts = String(name).trim().split(/\s+/);
  // "Dra. Patricia López" → "Dra. López"; "Daniel Soto" → "Daniel"
  if (/^(dr|dra)\.?$/i.test(parts[0]) && parts.length > 2) return `${parts[0]} ${parts[parts.length - 1]}`;
  return parts[0];
}

function previewFor(last, ownerId) {
  if (!last) return '';
  let txt;
  switch (last.kind) {
    case 'text':
    case 'urgent-text': txt = last.body || ''; break;
    case 'study': txt = 'Estudio adjunto'; break;
    case 'interconsulta': txt = 'Interconsulta'; break;
    case 'task': txt = 'Tarea'; break;
    case 'voice': txt = 'Nota de voz'; break;
    case 'patient-card': txt = 'Ficha de paciente'; break;
    case 'system': return last.body || '';
    default: txt = '';
  }
  const who = last.sender_id === ownerId ? 'Tú' : firstName(last.sender_name);
  return who ? `${who}: ${txt}` : txt;
}

const KIND_ICON = { equipo: 'users', caso: 'folder', interconsulta: 'stethoscope', anuncio: 'megaphone' };
const KIND_GROUP = { directo: 'directos', equipo: 'equipos', caso: 'casos', interconsulta: 'interconsultas', anuncio: 'anuncios' };

function shapeMember(m) {
  return { id: m.id, name: m.name || 'Sin nombre', role: m.role, specialty: m.specialty || '', photo: m.photo_url || '' };
}

// Carga y arma conversaciones para un usuario (lista completa o una sola por onlyId).
async function loadConversations({ clinicId, userId, userRole, onlyId }) {
  const params = [userId, clinicId];
  let extra = '';
  if (onlyId) { params.push(onlyId); extra = ' AND c.id = $3'; }
  const convRes = await query(
    `SELECT c.id, c.kind, c.title, c.subtitle, c.patient_id, c.created_by, c.created_at, c.last_message_at,
            p.name AS patient_name, p.identity_number AS patient_doc,
            (SELECT last_read_at FROM chat_members m WHERE m.conversation_id = c.id AND m.user_id = $1) AS my_last_read
       FROM chat_conversations c
       LEFT JOIN patients p ON p.id = c.patient_id
      WHERE c.clinic_id = $2
        AND (EXISTS (SELECT 1 FROM chat_members m WHERE m.conversation_id = c.id AND m.user_id = $1)
             OR c.kind = 'anuncio')${extra}
      ORDER BY c.last_message_at DESC NULLS LAST`,
    params
  );
  const convs = convRes.rows;
  if (!convs.length) return [];
  const ids = convs.map(c => c.id);

  const [memRes, lastRes, unreadRes, urgRes] = await Promise.all([
    query(
      `SELECT m.conversation_id, u.id, u.name, u.role, u.specialty, u.photo_url,
              (SELECT max(s.last_seen) FROM user_sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL) AS last_seen
         FROM chat_members m JOIN users u ON u.id = m.user_id
        WHERE m.conversation_id = ANY($1::int[])`,
      [ids]
    ),
    query(
      `SELECT DISTINCT ON (msg.conversation_id)
              msg.conversation_id, msg.kind, msg.body, msg.sender_id, msg.created_at, u.name AS sender_name
         FROM chat_messages msg LEFT JOIN users u ON u.id = msg.sender_id
        WHERE msg.conversation_id = ANY($1::int[])
        ORDER BY msg.conversation_id, msg.id DESC`,
      [ids]
    ),
    query(
      `SELECT msg.conversation_id, count(*)::int AS unread
         FROM chat_messages msg
         JOIN chat_members mem ON mem.conversation_id = msg.conversation_id AND mem.user_id = $1
        WHERE msg.conversation_id = ANY($2::int[])
          AND msg.sender_id IS DISTINCT FROM $1
          AND msg.created_at > mem.last_read_at
        GROUP BY msg.conversation_id`,
      [userId, ids]
    ),
    query(
      `SELECT DISTINCT conversation_id FROM chat_messages
        WHERE conversation_id = ANY($1::int[]) AND kind = 'urgent-text'`,
      [ids]
    ),
  ]);

  const membersByConv = {};
  for (const r of memRes.rows) {
    (membersByConv[r.conversation_id] = membersByConv[r.conversation_id] || []).push(r);
  }
  const lastByConv = {};
  for (const r of lastRes.rows) lastByConv[r.conversation_id] = r;
  const unreadByConv = {};
  for (const r of unreadRes.rows) unreadByConv[r.conversation_id] = r.unread;
  const urgentSet = new Set(urgRes.rows.map(r => r.conversation_id));

  const now = Date.now();
  return convs.map(c => {
    const members = membersByConv[c.id] || [];
    let title = c.title;
    let subtitle = c.subtitle;
    let online = false;
    if (c.kind === 'directo') {
      const other = members.find(m => m.id !== userId) || members[0];
      if (other) {
        title = other.name || 'Médico/a';
        subtitle = other.specialty || ROLE_LABEL[other.role] || '';
        online = !!other.last_seen && (now - new Date(other.last_seen).getTime() < ONLINE_WINDOW_MS);
      }
    } else if (!title && c.patient_name) {
      title = c.patient_name;
    }
    const last = lastByConv[c.id];
    return {
      id: c.id,
      kind: c.kind,
      group: KIND_GROUP[c.kind],
      icon: KIND_ICON[c.kind] || null,
      title: title || 'Conversación',
      subtitle: subtitle || '',
      patientId: c.patient_id || null,
      patientName: c.patient_name || null,
      members: members.map(shapeMember),
      preview: previewFor(last, userId),
      time: c.last_message_at,
      unread: unreadByConv[c.id] || 0,
      urgent: urgentSet.has(c.id),
      online,
      readOnly: c.kind === 'anuncio' && userRole !== 'clinic_admin',
      createdBy: c.created_by,
    };
  });
}

function shapeMessage(r) {
  return {
    id: r.id,
    kind: r.kind,
    body: r.body || '',
    payload: r.payload || null,
    senderId: r.sender_id,
    senderName: r.sender_name || '',
    senderRole: r.sender_role || '',
    senderSpecialty: r.sender_specialty || '',
    senderPhoto: r.sender_photo || '',
    createdAt: r.created_at,
  };
}

// Verifica que el usuario pueda ver/escribir en una conversación de su clínica.
// Devuelve la fila de la conversación o null.
async function getAccessibleConv(convId, user) {
  const r = await query(
    `SELECT c.*, EXISTS (SELECT 1 FROM chat_members m WHERE m.conversation_id = c.id AND m.user_id = $2) AS is_member
       FROM chat_conversations c WHERE c.id = $1`,
    [convId, user.id]
  );
  const conv = r.rows[0];
  if (!conv) return null;
  if (conv.clinic_id !== user.clinic_id) return null;
  // Anuncios: visibles para toda la clínica; el resto requiere ser miembro.
  if (!conv.is_member && conv.kind !== 'anuncio') return null;
  return conv;
}

// ───────────────────────── Endpoints ─────────────────────────

// GET /api/messaging/me — usuario actual (atajo para el cliente del chat)
router.get('/me', authenticate, async (req, res) => {
  const r = await query(
    'SELECT id, name, role, specialty, photo_url FROM users WHERE id = $1',
    [req.user.id]
  );
  const u = r.rows[0] || {};
  res.json({ id: req.user.id, name: u.name || '', role: u.role || req.user.role, specialty: u.specialty || '', photo: u.photo_url || '' });
});

// GET /api/messaging/members — colegas de la clínica (para iniciar conversación)
router.get('/members', authenticate, async (req, res) => {
  const r = await query(
    `SELECT id, name, role, specialty, photo_url
       FROM users
      WHERE clinic_id = $1 AND id <> $2 AND role IN ('doctor', 'clinic_admin')
      ORDER BY name NULLS LAST, email`,
    [req.user.clinic_id, req.user.id]
  );
  res.json(r.rows.map(shapeMember));
});

// GET /api/messaging/patients?q= — búsqueda de pacientes de la clínica
router.get('/patients', authenticate, async (req, res) => {
  const q = (req.query.q || '').trim();
  const like = `%${q}%`;
  const r = await query(
    `SELECT id, name, identity_number, age, gender
       FROM patients
      WHERE clinic_id = $1 AND ($2 = '' OR name ILIKE $3 OR identity_number ILIKE $3)
      ORDER BY name LIMIT 20`,
    [req.user.clinic_id, q, like]
  );
  res.json(r.rows);
});

// GET /api/messaging/patients/:id — ficha para el panel lateral
router.get('/patients/:id', authenticate, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  const pr = await query(
    `SELECT id, name, identity_number, age, gender, phone, birth_date
       FROM patients WHERE id = $1 AND clinic_id = $2`,
    [id, req.user.clinic_id]
  );
  const p = pr.rows[0];
  if (!p) return res.status(404).json({ error: 'Paciente no encontrado' });
  const ci = await query(
    'SELECT allergies, medications, conditions FROM critical_info WHERE patient_id = $1',
    [id]
  );
  const last = await query(
    `SELECT visit_reason, observations, created_at, u.name AS doctor_name
       FROM consultations c LEFT JOIN users u ON u.id = c.doctor_id
      WHERE c.patient_id = $1 ORDER BY c.created_at DESC LIMIT 1`,
    [id]
  );
  const crit = ci.rows[0] || {};
  const lastVisit = last.rows[0] || null;
  const splitList = (s) => String(s || '').split(/[,;\n]+/).map(x => x.trim()).filter(Boolean);
  res.json({
    id: p.id,
    name: p.name,
    identity_number: p.identity_number,
    age: p.age,
    gender: p.gender,
    phone: p.phone,
    alerts: splitList(crit.allergies),        // alergias = alertas clínicas (banner rojo)
    medications: splitList(crit.medications),
    conditions: splitList(crit.conditions),
    motivo: lastVisit ? (lastVisit.visit_reason || lastVisit.observations || '') : '',
    lastVisit: lastVisit ? lastVisit.created_at : null,
    lastVisitDoctor: lastVisit ? (lastVisit.doctor_name || '') : '',
  });
});

// GET /api/messaging/conversations — lista agrupable para la barra lateral
router.get('/conversations', authenticate, async (req, res) => {
  const list = await loadConversations({
    clinicId: req.user.clinic_id, userId: req.user.id, userRole: req.user.role,
  });
  res.json(list);
});

// POST /api/messaging/conversations — crear conversación
router.post('/conversations', authenticate, async (req, res) => {
  const { kind, memberIds, title, subtitle, patientId } = req.body || {};
  if (!CONV_KINDS.includes(kind)) return res.status(400).json({ error: 'Tipo de conversación inválido' });
  if (kind === 'anuncio' && req.user.role !== 'clinic_admin') {
    return res.status(403).json({ error: 'Solo la administración puede crear anuncios' });
  }

  // Valida que los miembros pertenezcan a la clínica.
  let ids = Array.isArray(memberIds) ? memberIds.map(Number).filter(Boolean) : [];
  if (ids.length) {
    const chk = await query(
      "SELECT id FROM users WHERE clinic_id = $1 AND id = ANY($2::int[]) AND role IN ('doctor','clinic_admin')",
      [req.user.clinic_id, ids]
    );
    ids = chk.rows.map(r => r.id);
  }
  // El creador siempre es miembro.
  const memberSet = new Set([req.user.id, ...ids]);

  if (kind === 'directo') {
    const others = [...memberSet].filter(x => x !== req.user.id);
    if (others.length !== 1) return res.status(400).json({ error: 'Un mensaje directo requiere exactamente un destinatario' });
    // Dedupe: ¿ya existe un directo entre estos dos?
    const dup = await query(
      `SELECT c.id FROM chat_conversations c
        WHERE c.clinic_id = $1 AND c.kind = 'directo'
          AND (SELECT count(*) FROM chat_members m WHERE m.conversation_id = c.id) = 2
          AND EXISTS (SELECT 1 FROM chat_members m WHERE m.conversation_id = c.id AND m.user_id = $2)
          AND EXISTS (SELECT 1 FROM chat_members m WHERE m.conversation_id = c.id AND m.user_id = $3)
        LIMIT 1`,
      [req.user.clinic_id, req.user.id, others[0]]
    );
    if (dup.rows[0]) {
      const [one] = await loadConversations({ clinicId: req.user.clinic_id, userId: req.user.id, userRole: req.user.role, onlyId: dup.rows[0].id });
      return res.json(one);
    }
  } else if (!title || !title.trim()) {
    if (kind === 'caso' && patientId) { /* el título se resolverá al nombre del paciente */ }
    else return res.status(400).json({ error: 'Falta el título de la conversación' });
  }

  let pid = null;
  if (patientId) {
    const pr = await query('SELECT id FROM patients WHERE id = $1 AND clinic_id = $2', [Number(patientId), req.user.clinic_id]);
    if (pr.rows[0]) pid = pr.rows[0].id;
  }

  const ins = await query(
    `INSERT INTO chat_conversations (clinic_id, kind, title, subtitle, patient_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [req.user.clinic_id, kind, (title || '').trim(), (subtitle || '').trim(), pid, req.user.id]
  );
  const convId = ins.rows[0].id;

  for (const uid of memberSet) {
    await query(
      'INSERT INTO chat_members (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [convId, uid]
    );
  }

  // Mensaje de sistema inicial (excepto en directos).
  if (kind !== 'directo') {
    let sysText = 'Canal creado.';
    if (kind === 'caso') {
      const pn = pid ? (await query('SELECT name FROM patients WHERE id = $1', [pid])).rows[0]?.name : null;
      sysText = pn ? `Canal de caso creado para el paciente ${pn}.` : 'Canal de caso creado.';
    } else if (kind === 'interconsulta') {
      sysText = 'Canal de interconsulta creado.';
    } else if (kind === 'anuncio') {
      sysText = 'Canal de anuncios de la clínica.';
    }
    await query(
      "INSERT INTO chat_messages (conversation_id, sender_id, kind, body) VALUES ($1, NULL, 'system', $2)",
      [convId, sysText]
    );
  }

  const [one] = await loadConversations({ clinicId: req.user.clinic_id, userId: req.user.id, userRole: req.user.role, onlyId: convId });
  res.status(201).json(one);
});

// GET /api/messaging/conversations/:id/messages?after=<id>
router.get('/conversations/:id/messages', authenticate, async (req, res) => {
  const convId = parseInt(req.params.id, 10);
  if (!convId) return res.status(400).json({ error: 'ID inválido' });
  const conv = await getAccessibleConv(convId, req.user);
  if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });

  const after = parseInt(req.query.after, 10) || 0;
  const r = await query(
    `SELECT msg.id, msg.kind, msg.body, msg.payload, msg.sender_id, msg.created_at,
            u.name AS sender_name, u.role AS sender_role, u.specialty AS sender_specialty, u.photo_url AS sender_photo
       FROM chat_messages msg LEFT JOIN users u ON u.id = msg.sender_id
      WHERE msg.conversation_id = $1 ${after ? 'AND msg.id > $2' : ''}
      ORDER BY msg.id ASC
      ${after ? '' : 'LIMIT 300'}`,
    after ? [convId, after] : [convId]
  );
  res.json(r.rows.map(shapeMessage));
});

// POST /api/messaging/conversations/:id/messages — enviar mensaje
router.post('/conversations/:id/messages', authenticate, async (req, res) => {
  const convId = parseInt(req.params.id, 10);
  if (!convId) return res.status(400).json({ error: 'ID inválido' });
  const conv = await getAccessibleConv(convId, req.user);
  if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });

  // Anuncios: solo la administración publica.
  if (conv.kind === 'anuncio' && req.user.role !== 'clinic_admin') {
    return res.status(403).json({ error: 'Solo la administración puede publicar en anuncios' });
  }

  const { kind, body, payload } = req.body || {};
  const k = MSG_KINDS.includes(kind) ? kind : 'text';
  if (k === 'system') return res.status(400).json({ error: 'Tipo de mensaje no permitido' });
  const text = (body || '').toString().slice(0, 8000);
  if ((k === 'text' || k === 'urgent-text') && !text.trim()) {
    return res.status(400).json({ error: 'El mensaje está vacío' });
  }
  // Estudios: la URL debe ser http(s) (proviene de nuestro upload a Cloudinary).
  // Bloquea esquemas peligrosos (javascript:, data:) en el origen, no solo en el render.
  if (k === 'study') {
    const u = payload && typeof payload.url === 'string' ? payload.url.trim() : '';
    if (!/^https?:\/\//i.test(u)) return res.status(400).json({ error: 'URL de estudio inválida' });
  }

  const ins = await query(
    `INSERT INTO chat_messages (conversation_id, sender_id, kind, body, payload)
     VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
    [convId, req.user.id, k, text, payload ? JSON.stringify(payload) : null]
  );
  await query('UPDATE chat_conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1', [convId]);
  // Marca como leído para el emisor.
  await query(
    `INSERT INTO chat_members (conversation_id, user_id, last_read_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = CURRENT_TIMESTAMP`,
    [convId, req.user.id]
  );

  const r = await query(
    `SELECT msg.id, msg.kind, msg.body, msg.payload, msg.sender_id, msg.created_at,
            u.name AS sender_name, u.role AS sender_role, u.specialty AS sender_specialty, u.photo_url AS sender_photo
       FROM chat_messages msg LEFT JOIN users u ON u.id = msg.sender_id
      WHERE msg.id = $1`,
    [ins.rows[0].id]
  );
  res.status(201).json(shapeMessage(r.rows[0]));
});

// POST /api/messaging/conversations/:id/read — marcar como leída
router.post('/conversations/:id/read', authenticate, async (req, res) => {
  const convId = parseInt(req.params.id, 10);
  if (!convId) return res.status(400).json({ error: 'ID inválido' });
  const conv = await getAccessibleConv(convId, req.user);
  if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });
  await query(
    `INSERT INTO chat_members (conversation_id, user_id, last_read_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = CURRENT_TIMESTAMP`,
    [convId, req.user.id]
  );
  res.json({ success: true });
});

// PATCH /api/messaging/messages/:id/task — alternar el estado de una tarea
router.patch('/messages/:id/task', authenticate, async (req, res) => {
  const msgId = parseInt(req.params.id, 10);
  if (!msgId) return res.status(400).json({ error: 'ID inválido' });
  const mr = await query('SELECT id, conversation_id, kind, payload FROM chat_messages WHERE id = $1', [msgId]);
  const m = mr.rows[0];
  if (!m || m.kind !== 'task') return res.status(404).json({ error: 'Tarea no encontrada' });
  const conv = await getAccessibleConv(m.conversation_id, req.user);
  if (!conv) return res.status(403).json({ error: 'Sin acceso' });
  const payload = m.payload || {};
  payload.done = !payload.done;
  await query('UPDATE chat_messages SET payload = $1::jsonb WHERE id = $2', [JSON.stringify(payload), msgId]);
  res.json({ id: msgId, done: payload.done });
});

// POST /api/messaging/upload — sube un estudio/imagen y devuelve su URL
router.post('/upload', authenticate, studyUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo' });
  try {
    const isPdf = req.file.mimetype === 'application/pdf';
    const publicId = `study-${Date.now()}-${uuid().slice(0, 8)}`;
    const result = await uploadBufferToCloudinary(
      req.file.buffer, publicId, `clinics/${req.user.clinic_id}/chat`, isPdf ? 'raw' : 'image'
    );
    res.json({
      url: result.secure_url,
      mimetype: req.file.mimetype,
      kind: isPdf ? 'doc' : 'image',
      original: req.file.originalname || '',
    });
  } catch (err) {
    console.error('[messaging/upload] error:', err && err.message);
    res.status(500).json({ error: 'No se pudo subir el archivo' });
  }
});

module.exports = router;
