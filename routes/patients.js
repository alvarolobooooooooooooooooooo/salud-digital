const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

// ── Relación médico-paciente en las ESCRITURAS ──
//
// Las tres rutas de abajo comprobaban la clínica pero no si el doctor tiene algo
// que ver con ese paciente: bastaba cambiar el id de la URL para editar el
// expediente, las alergias o el odontograma de cualquier paciente de la clínica.
// El `GET` equivalente sí lo comprobaba, así que la lectura estaba cerrada y la
// escritura abierta — que es el peor reparto posible.
//
// La regla es a propósito UN PUNTO MÁS PERMISIVA que la de lectura (que solo
// admite "tiene cita conmigo"): aquí vale también "lo di de alta yo". Así queda
// cubierto el caso del doctor que registra a un paciente nuevo y corrige sus
// datos antes de que exista la cita, sin abrir la puerta al resto del padrón.
// Como toda pantalla que edita carga antes al paciente, y esa carga ya exige
// relación, esto no puede cerrar ningún flujo que hoy funcione.
//
// Recepción y administración no pasan por aquí: su alcance es la clínica entera
// por diseño.
async function doctorTieneAcceso(req, patient) {
  if (req.user.role !== 'doctor') return true;
  const r = await query(
    `SELECT 1 FROM patients p
      WHERE p.id = $1 AND p.clinic_id = $2
        AND (p.created_by = $3
             OR EXISTS (SELECT 1 FROM appointments a
                         WHERE a.patient_id = p.id AND a.doctor_id = $3
                           AND a.clinic_id = $2))
      LIMIT 1`,
    [patient.id, req.user.clinic_id, req.user.id],
  );
  return r.rowCount > 0;
}

const SIN_ACCESO = { error: 'Access denied' };

router.get('/', authenticate, async (req, res) => {
  let queryStr;
  let params;

  if (req.user.role === 'doctor') {
    queryStr = `SELECT DISTINCT p.* FROM patients p
      WHERE p.clinic_id = $1 AND (
        p.created_by = $2 OR
        p.id IN (SELECT DISTINCT patient_id FROM appointments WHERE doctor_id = $3 AND clinic_id = $4)
      )
      ORDER BY p.name`;
    params = [req.user.clinic_id, req.user.id, req.user.id, req.user.clinic_id];
  } else {
    queryStr = 'SELECT * FROM patients WHERE clinic_id = $1 ORDER BY name';
    params = [req.user.clinic_id];
  }

  const result = await query(queryStr, params);
  res.json(result.rows);
});

router.get('/:id', authenticate, async (req, res) => {
  const patientResult = await query('SELECT * FROM patients WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  const patient = patientResult.rows[0];
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  if (req.user.role === 'doctor') {
    const accessResult = await query(
      'SELECT COUNT(*) as count FROM appointments WHERE patient_id = $1 AND doctor_id = $2 AND clinic_id = $3',
      [patient.id, req.user.id, req.user.clinic_id]
    );
    if (parseInt(accessResult.rows[0].count) === 0) return res.status(403).json({ error: 'Access denied' });
  }

  const criticalResult = await query('SELECT * FROM critical_info WHERE patient_id = $1', [patient.id]);
  const critical_info = criticalResult.rows[0] || {};

  let consultations = [];
  if (req.user.role !== 'clinic_admin') {
    // `odontogram_state` NO viaja aquí a propósito. En Ortodoncia ese campo lleva
    // las fotos clínicas embebidas en base64 y puede pesar megabytes por consulta;
    // incluirlo convertía la ficha de un paciente con historial en una respuesta de
    // cientos de MB que el proceso tiene que materializar entera en memoria. Nadie
    // en el frontend lo lee desde aquí: las pantallas que necesitan el diagrama lo
    // piden a /api/consultations/:id, y las fotos a /:id/photo-index.
    let queryStr = 'SELECT c.id, c.patient_id, c.notes, c.diagnosis, c.treatment, c.specialty, c.cost, c.payment_status, c.lifestyle, c.procedures, c.radiography_notes, c.observations, c.doctor_id, c.visit_reason, c.created_at, c.clinic_id, u.name as doctor_name FROM consultations c LEFT JOIN users u ON c.doctor_id = u.id WHERE c.patient_id = $1 AND c.clinic_id = $2';
    const params = [patient.id, req.user.clinic_id];
    let paramIndex = 3;

    if (req.user.role === 'doctor') {
      queryStr += ` AND c.doctor_id = $${paramIndex}`;
      params.push(req.user.id);
    }

    // Techo de seguridad. Quinientas consultas son más visitas de las que acumula
    // un paciente en toda su vida; existe para que la respuesta no pueda crecer
    // sin freno, no para recortar historiales reales.
    queryStr += ' ORDER BY c.created_at DESC LIMIT 500';
    const consResult = await query(queryStr, params);
    consultations = consResult.rows;
  }

  res.json({ ...patient, critical_info, consultations });
});

// Índice barato de fotos: una entrada por consulta CON fotos, solo con conteos (sin bytes
// de imagen). Alimenta el acordeón del panel; las imágenes se cargan al expandir cada grupo.
// Funciona para clinic_admin (alcance de clínica) y para doctor (solo sus consultas + acceso).
router.get('/:id/photo-index', authenticate, async (req, res) => {
  const patientResult = await query('SELECT id FROM patients WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  const patient = patientResult.rows[0];
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  if (req.user.role === 'doctor') {
    const accessResult = await query(
      'SELECT COUNT(*) as count FROM appointments WHERE patient_id = $1 AND doctor_id = $2 AND clinic_id = $3',
      [patient.id, req.user.id, req.user.clinic_id]
    );
    if (parseInt(accessResult.rows[0].count) === 0) return res.status(403).json({ error: 'Access denied' });
  }

  // Solo traemos odontogram_state para Ortodoncia (única especialidad con fotos base64
  // embebidas), para no transferir blobs grandes de otras especialidades solo para contar.
  let queryStr = `
    SELECT c.id AS consultation_id, c.created_at, c.specialty,
           CASE WHEN c.specialty = 'Ortodoncia' THEN c.odontogram_state END AS ortho_state,
           u.name AS doctor_name, COUNT(ci.id)::int AS gallery_count
    FROM consultations c
    LEFT JOIN consultation_images ci ON ci.consultation_id = c.id AND ci.clinic_id = c.clinic_id
    LEFT JOIN users u ON c.doctor_id = u.id
    WHERE c.patient_id = $1 AND c.clinic_id = $2`;
  const params = [patient.id, req.user.clinic_id];
  if (req.user.role === 'doctor') { queryStr += ' AND c.doctor_id = $3'; params.push(req.user.id); }
  // LIMIT obligatorio: más abajo se hace JSON.parse de `ortho_state`, que puede
  // ser un blob de varios MB por consulta. JSON.parse bloquea el hilo mientras
  // dura, y este proceso solo tiene uno: sin tope, un paciente con historial
  // largo dejaba al servidor entero sin responder durante segundos, y bastaban
  // unas cuantas peticiones a la vez para que no volviera. Doscientos grupos de
  // fotos es más de lo que muestra el acordeón.
  queryStr += ' GROUP BY c.id, u.name ORDER BY c.created_at DESC LIMIT 200';

  const result = await query(queryStr, params);

  const groups = result.rows.map(r => {
    let diagram_count = 0;
    try {
      const parsed = JSON.parse(r.ortho_state || '{}');
      const media = parsed && parsed.state && parsed.state.media;
      if (media && typeof media === 'object') {
        diagram_count = Object.values(media).filter(v => typeof v === 'string' && v.startsWith('data:')).length;
      }
    } catch { /* ignore malformed state */ }
    return {
      consultation_id: r.consultation_id,
      created_at: r.created_at,
      specialty: r.specialty || 'Consulta',
      doctor_name: r.doctor_name || null,
      gallery_count: r.gallery_count,
      diagram_count,
      total: r.gallery_count + diagram_count
    };
  }).filter(g => g.total > 0);

  res.json(groups);
});

router.post('/', authenticate, async (req, res) => {
  const { name, identity_number, age, birth_date, gender, phone } = req.body;
  if (!name || !identity_number) {
    return res.status(400).json({ error: 'name e identity_number son requeridos' });
  }

  let resolvedAge = parseInt(age) || 0;
  if (birth_date && !age) {
    const birth = new Date(birth_date);
    const today = new Date();
    resolvedAge = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) resolvedAge--;
  }

  const result = await query(
    'INSERT INTO patients (name, identity_number, age, birth_date, gender, phone, clinic_id, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
    [
      name.trim(), identity_number.trim(), resolvedAge,
      birth_date || '', gender || '', phone || '',
      req.user.clinic_id, req.user.role === 'doctor' ? req.user.id : null
    ]
  );

  const patientId = result.rows[0].id;
  await query('INSERT INTO critical_info (patient_id, allergies, medications, conditions) VALUES ($1, $2, $3, $4)',
    [patientId, '', '', '']);

  res.json({ id: patientId, name, identity_number, age: resolvedAge, birth_date, gender, phone, clinic_id: req.user.clinic_id });
});

router.put('/:id', authenticate, async (req, res) => {
  const patientResult = await query('SELECT * FROM patients WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  const patient = patientResult.rows[0];
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  if (!(await doctorTieneAcceso(req, patient))) return res.status(403).json(SIN_ACCESO);

  const { name, identity_number, birth_date, gender, phone } = req.body;

  await query('UPDATE patients SET name = $1, identity_number = $2, birth_date = $3, gender = $4, phone = $5 WHERE id = $6 AND clinic_id = $7',
    [name || patient.name, identity_number || patient.identity_number, birth_date || patient.birth_date, gender || patient.gender, phone || patient.phone, patient.id, req.user.clinic_id]);

  res.json({ success: true });
});

// GET de la info crítica (alergias/medicamentos/condiciones) para el banner de
// alerta médica que muestran las pantallas de consulta. Devuelve forma plana.
router.get('/:id/critical-info', authenticate, async (req, res) => {
  const patientResult = await query('SELECT id FROM patients WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  const patient = patientResult.rows[0];
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  if (req.user.role === 'doctor') {
    const accessResult = await query(
      'SELECT COUNT(*) as count FROM appointments WHERE patient_id = $1 AND doctor_id = $2 AND clinic_id = $3',
      [patient.id, req.user.id, req.user.clinic_id]
    );
    if (parseInt(accessResult.rows[0].count) === 0) return res.status(403).json({ error: 'Access denied' });
  }

  const r = await query('SELECT allergies, medications, conditions FROM critical_info WHERE patient_id = $1', [patient.id]);
  const info = r.rows[0] || { allergies: '', medications: '', conditions: '' };
  res.json(info);
});

router.put('/:id/critical-info', authenticate, async (req, res) => {
  const patientResult = await query('SELECT * FROM patients WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  const patient = patientResult.rows[0];
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  if (!(await doctorTieneAcceso(req, patient))) return res.status(403).json(SIN_ACCESO);

  const { allergies = '', medications = '', conditions = '' } = req.body;
  const existingResult = await query('SELECT id FROM critical_info WHERE patient_id = $1', [patient.id]);

  if (existingResult.rows.length > 0) {
    await query('UPDATE critical_info SET allergies = $1, medications = $2, conditions = $3 WHERE patient_id = $4',
      [allergies, medications, conditions, patient.id]);
  } else {
    await query('INSERT INTO critical_info (patient_id, allergies, medications, conditions) VALUES ($1, $2, $3, $4)',
      [patient.id, allergies, medications, conditions]);
  }
  res.json({ success: true });
});

router.get('/:id/consultations', authenticate, async (req, res) => {
  const patientResult = await query('SELECT * FROM patients WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  const patient = patientResult.rows[0];
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  if (req.user.role === 'doctor') {
    const accessResult = await query(
      'SELECT COUNT(*) as count FROM appointments WHERE patient_id = $1 AND doctor_id = $2 AND clinic_id = $3',
      [patient.id, req.user.id, req.user.clinic_id]
    );
    if (parseInt(accessResult.rows[0].count) === 0) return res.status(403).json({ error: 'Access denied' });
  }

  // El tope importa: estas filas son `c.*`, e incluyen `odontogram_state`, que en
  // Ortodoncia lleva las fotos clínicas embebidas en base64 (hasta 25 MB por
  // consulta). Sin cap, `?limit=100000` traía el historial entero a memoria de
  // golpe —cientos de MB en una sola respuesta— y bastaba repetirlo para tumbar
  // el proceso por falta de RAM. La pantalla que más pide usa limit=100.
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 200);

  let countQueryStr = 'SELECT COUNT(*) as count FROM consultations WHERE patient_id = $1 AND clinic_id = $2';
  let params = [patient.id, req.user.clinic_id];
  let paramIndex = 3;

  if (req.user.role === 'doctor') {
    countQueryStr += ` AND doctor_id = $${paramIndex}`;
    params.push(req.user.id);
    paramIndex++;
  }

  const totalResult = await query(countQueryStr, params);
  const total = parseInt(totalResult.rows[0].count);

  let queryStr = 'SELECT c.*, u.name as doctor_name, u.email as doctor_email FROM consultations c LEFT JOIN users u ON c.doctor_id = u.id WHERE c.patient_id = $1 AND c.clinic_id = $2';
  params = [patient.id, req.user.clinic_id];
  paramIndex = 3;

  if (req.user.role === 'doctor') {
    queryStr += ` AND c.doctor_id = $${paramIndex}`;
    params.push(req.user.id);
    paramIndex++;
  }

  queryStr += ` ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const consResult = await query(queryStr, params);

  res.json({ consultations: consResult.rows, total, offset, limit });
});

// Historial acotado para autocompletar (prefill) una consulta nueva. A diferencia de
// /:id/consultations, NO filtra por doctor: devuelve el historial de la clínica para la
// misma especialidad, de modo que la anamnesis/antecedentes se hereden aunque haya
// atendido otro profesional de la misma especialidad. Expone SOLO los campos necesarios
// para el prefill (anamnesis/antecedentes), nunca diagnóstico/tratamiento/notas/costos.
// El acceso del doctor sigue requiriendo una cita con el paciente.
router.get('/:id/prefill-history', authenticate, async (req, res) => {
  const patientResult = await query('SELECT id FROM patients WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  const patient = patientResult.rows[0];
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  if (req.user.role === 'doctor') {
    const accessResult = await query(
      'SELECT COUNT(*) as count FROM appointments WHERE patient_id = $1 AND doctor_id = $2 AND clinic_id = $3',
      [patient.id, req.user.id, req.user.clinic_id]
    );
    if (parseInt(accessResult.rows[0].count) === 0) return res.status(403).json({ error: 'Access denied' });
  }

  const specialty = req.query.specialty || '';
  // Solo se pueden exponer los contenedores de anamnesis/antecedentes, y el cliente
  // pide explícitamente cuál necesita (ortodoncia → lifestyle; podología → radiography_notes),
  // para no sobre-exponer notas clínicas de otras especialidades. Whitelist fija ⇒ sin inyección.
  const ALLOWED_FIELDS = ['lifestyle', 'radiography_notes'];
  const requested = String(req.query.fields || ALLOWED_FIELDS.join(','))
    .split(',').map(s => s.trim()).filter(f => ALLOWED_FIELDS.includes(f));
  const payloadCols = requested.map(f => `c.${f}`).join(', ');

  const params = [patient.id, req.user.clinic_id];
  let queryStr = `SELECT c.id, c.created_at, c.specialty, c.appointment_id, u.name as doctor_name${payloadCols ? ', ' + payloadCols : ''}
                  FROM consultations c LEFT JOIN users u ON c.doctor_id = u.id
                  WHERE c.patient_id = $1 AND c.clinic_id = $2`;
  if (specialty) { params.push(specialty); queryStr += ` AND c.specialty = $${params.length}`; }
  // created_at + id como desempate determinístico de "más reciente".
  queryStr += ' ORDER BY c.created_at DESC, c.id DESC LIMIT 50';

  const consResult = await query(queryStr, params);
  res.json({ consultations: consResult.rows });
});

router.put('/:id/odontogram', authenticate, async (req, res) => {
  const patientResult = await query('SELECT * FROM patients WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  const patient = patientResult.rows[0];
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  if (!(await doctorTieneAcceso(req, patient))) return res.status(403).json(SIN_ACCESO);

  const { odontogram_state } = req.body;
  const odontoStr = typeof odontogram_state === 'string' ? odontogram_state : JSON.stringify(odontogram_state || {});

  await query('UPDATE patients SET odontogram_state = $1 WHERE id = $2 AND clinic_id = $3',
    [odontoStr, patient.id, req.user.clinic_id]);

  res.json({ success: true });
});

module.exports = router;
