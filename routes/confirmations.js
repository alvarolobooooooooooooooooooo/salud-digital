const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

// Tokens URL-safe de 32 chars (16 bytes hex). Suficiente entropía contra
// fuerza bruta y permite que el endpoint público sea identificable sin
// requerir login del paciente.
function newToken() {
  return crypto.randomBytes(16).toString('hex');
}

// ───────────────────────── Configuración WhatsApp ─────────────────────────

// Quién puede tocar los textos y el número de WhatsApp de la clínica. No es
// solo el clinic_admin: el alta por cuenta propia crea DOCTORES dueños de su
// consultorio (ver routes/auth.js), y en una cuenta así no existe ningún
// clinic_admin — dejándolo cerrado, el doctor que se registró solo veía la
// pantalla de Confirmaciones pero no podía cambiar su propio mensaje. Mismo
// criterio que MONEDA_ROLES/BOOKING_COLOR_ROLES en routes/clinics.js y
// OWNER_ROLES en routes/billing.js. La recepcionista sigue fuera: envía los
// mensajes, no decide qué dicen.
const CONFIG_ROLES = ['clinic_admin', 'doctor'];

// Texto por defecto de la tarjeta: el mismo que la página mostraba fijo antes de
// que fuera editable, para que una clínica que nunca lo toque no note el cambio.
const CARD_MESSAGE_DEFAULT = 'Hola {{patientName}}, ¿podrás asistir a esta cita?';

// GET /api/confirmations/whatsapp-config
// Devuelve también el mensaje de la tarjeta: la pantalla de Confirmaciones edita
// los dos textos y así los carga en una sola petición.
router.get('/whatsapp-config', authenticate, async (req, res) => {
  const result = await query(
    `SELECT whatsapp_enabled, whatsapp_number, whatsapp_confirmation_template,
            confirmation_card_message, name
       FROM clinics WHERE id = $1`,
    [req.user.clinic_id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Clinic not found' });
  const row = result.rows[0];
  if (!row.confirmation_card_message) row.confirmation_card_message = CARD_MESSAGE_DEFAULT;
  res.json(row);
});

// PUT /api/confirmations/card-message  (clinic_admin o doctor)
// Mensaje que el paciente lee en la tarjeta de confirmación.
router.put('/card-message', authenticate, async (req, res) => {
  if (!CONFIG_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  // El texto acaba dentro de una página pública. La página ya escapa antes de
  // pintar, pero se limpian < y > aquí también: nada de lo que escriba la clínica
  // tiene por qué ser HTML, y así ni un fallo futuro en el frontend abre un XSS.
  const raw = String((req.body && req.body.confirmation_card_message) || '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 600);
  if (!raw) {
    return res.status(400).json({ error: 'El mensaje no puede quedar vacío.' });
  }
  await query(
    'UPDATE clinics SET confirmation_card_message = $1 WHERE id = $2',
    [raw, req.user.clinic_id]
  );
  res.json({ success: true, confirmation_card_message: raw });
});

// PUT /api/confirmations/whatsapp-config  (clinic_admin o doctor)
// Antes solo guardaba la plantilla: el interruptor y el número vivían en
// Recordatorios. Al desactivar esa pantalla se quedaban sin sitio donde
// editarse, así que ahora los tres campos se guardan desde aquí. Los campos
// son opcionales: si la petición no los trae, se dejan como están (la pantalla
// de Confirmaciones los manda siempre, pero así ninguna llamada vieja apaga
// WhatsApp sin querer).
router.put('/whatsapp-config', authenticate, async (req, res) => {
  if (!CONFIG_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  const body = req.body || {};
  const { whatsapp_confirmation_template } = body;

  const sets = ['whatsapp_confirmation_template = $1'];
  const params = [whatsapp_confirmation_template || ''];

  const traeEnabled = Object.prototype.hasOwnProperty.call(body, 'whatsapp_enabled');
  const traeNumero = Object.prototype.hasOwnProperty.call(body, 'whatsapp_number');

  // Solo dígitos, igual que hacía Recordatorios: el número acaba en un enlace
  // wa.me, donde los espacios y guiones rompen el link.
  const numero = (body.whatsapp_number || '').replace(/\D/g, '');
  if (traeNumero && numero && !/^\d{8,15}$/.test(numero)) {
    return res.status(400).json({ error: 'Número de WhatsApp inválido. Use formato internacional sin +, espacios ni guiones.' });
  }
  // Encender sin número deja la clínica con el botón activo y ningún sitio
  // desde donde escribir: se corta aquí en vez de fallar al enviar.
  if (traeEnabled && body.whatsapp_enabled && traeNumero && !numero) {
    return res.status(400).json({ error: 'Escribe el número de WhatsApp de la clínica antes de activarlo.' });
  }

  if (traeEnabled) { params.push(!!body.whatsapp_enabled); sets.push(`whatsapp_enabled = $${params.length}`); }
  if (traeNumero) { params.push(numero); sets.push(`whatsapp_number = $${params.length}`); }

  params.push(req.user.clinic_id);
  await query(
    `UPDATE clinics SET ${sets.join(', ')} WHERE id = $${params.length}`,
    params
  );
  res.json({ success: true });
});

// GET /api/confirmations/preview
// Datos REALES de la cuenta para la vista previa de la tarjeta.
//
// /confirm.html?preview=1 los llevaba inventados dentro de la propia página
// —"María González", "Dr. Álvaro Lobo", "Clínica Demostración"—, así que el
// doctor abría la vista previa y no veía su tarjeta: veía la de una clínica que
// no existe. Con esto ve la suya: su nombre, su consultorio, su dirección, su
// mensaje y —si tiene alguna cita por delante— su propio paciente con su día y
// su hora.
//
// Devuelve la MISMA forma que /public/:token para que la página pinte con el
// mismo código y no haya dos maneras de dibujar la tarjeta.
//
// Va declarado antes que GET /:appointmentId: si no, "preview" entraría por ahí
// como si fuera un id de cita.
router.get('/preview', authenticate, async (req, res) => {
  const clinicaRes = await query(
    `SELECT name, phone, brand_color, address, city, latitude, longitude,
            map_url, location_notes, confirmation_card_message
       FROM clinics WHERE id = $1`,
    [req.user.clinic_id]
  );
  const clinica = clinicaRes.rows[0];
  if (!clinica) return res.status(404).json({ error: 'Clinic not found' });

  // La próxima cita de verdad. Un doctor ve la suya; clinic_admin y recepción
  // ven la siguiente de la clínica, que es la que tienen delante de todos modos.
  const params = [req.user.clinic_id];
  let filtroDoctor = '';
  if (req.user.role === 'doctor') {
    params.push(req.user.id);
    filtroDoctor = ` AND a.doctor_id = $${params.length}`;
  }
  const citaRes = await query(
    `SELECT a.scheduled_at, p.name AS patient_name, u.name AS doctor_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN users u ON a.doctor_id = u.id
      WHERE a.clinic_id = $1${filtroDoctor}
        AND a.scheduled_at >= CURRENT_TIMESTAMP
        AND a.status <> 'cancelled'
      ORDER BY a.scheduled_at
      LIMIT 1`,
    params
  );
  const cita = citaRes.rows[0] || null;

  // Sin ninguna cita por delante (cuenta recién abierta) hace falta al menos un
  // nombre de doctor de verdad: el de quien mira, o el de un doctor de la casa.
  let doctorName = cita && cita.doctor_name;
  if (!doctorName) {
    const dueño = await query(
      req.user.role === 'doctor'
        ? 'SELECT name FROM users WHERE id = $1'
        : `SELECT name FROM users WHERE clinic_id = $1 AND role = 'doctor' ORDER BY name LIMIT 1`,
      [req.user.role === 'doctor' ? req.user.id : req.user.clinic_id]
    );
    doctorName = (dueño.rows[0] && dueño.rows[0].name) || '';
  }

  // Mañana a las 10:00 cuando no hay cita real: futuro, para que la tarjeta no
  // caiga en el caso "cita pasada".
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  manana.setHours(10, 0, 0, 0);

  res.json({
    // Con cita real el paciente es el de verdad; sin ella, un hueco con forma de
    // nombre — nunca el de un paciente que no venga a cuento.
    patient_name: cita ? cita.patient_name : 'Nombre del paciente',
    doctor_name: doctorName,
    clinic_name: clinica.name,
    clinic_phone: clinica.phone,
    brand_color: clinica.brand_color,
    clinic_address: clinica.address,
    clinic_city: clinica.city,
    latitude: clinica.latitude,
    longitude: clinica.longitude,
    map_url: clinica.map_url,
    location_notes: clinica.location_notes,
    scheduled_at: cita ? cita.scheduled_at : manana.toISOString(),
    status: 'sent',
    card_message: clinica.confirmation_card_message || CARD_MESSAGE_DEFAULT,
    // Para que la página pueda decir si lo que se ve es una cita de verdad.
    cita_real: !!cita,
  });
});

// ───────────────────────── Listado para staff ─────────────────────────

// GET /api/confirmations  → cita + paciente + confirmación (si existe)
router.get('/', authenticate, async (req, res) => {
  let queryStr = `
    SELECT
      a.id AS appointment_id,
      a.scheduled_at,
      a.status AS appointment_status,
      p.id AS patient_id,
      p.name AS patient_name,
      p.phone,
      u.name AS doctor_name,
      c.id AS confirmation_id,
      c.token,
      c.status AS confirmation_status,
      c.sent_at,
      c.sent_by,
      sender.name AS sent_by_name,
      c.responded_at,
      c.message_content
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN users u ON a.doctor_id = u.id
    LEFT JOIN appointment_confirmations c ON c.appointment_id = a.id
    LEFT JOIN users sender ON c.sent_by = sender.id
    WHERE a.clinic_id = $1
  `;
  const params = [req.user.clinic_id];
  let paramIndex = 2;

  // Un doctor solo ve sus propias citas; clinic_admin ve toda la clínica.
  if (req.user.role === 'doctor') {
    queryStr += ` AND a.doctor_id = $${paramIndex}`;
    params.push(req.user.id);
    paramIndex++;
  }

  queryStr += ' ORDER BY a.scheduled_at DESC';

  const result = await query(queryStr, params);
  res.json(result.rows);
});

// GET /api/confirmations/appointment/:appointmentId
router.get('/appointment/:appointmentId', authenticate, async (req, res) => {
  const apptCheck = await query(
    'SELECT id FROM appointments WHERE id = $1 AND clinic_id = $2',
    [req.params.appointmentId, req.user.clinic_id]
  );
  if (apptCheck.rows.length === 0) return res.status(404).json({ error: 'Cita no encontrada' });

  const result = await query(
    `SELECT c.*, u.name AS sent_by_name FROM appointment_confirmations c
     LEFT JOIN users u ON c.sent_by = u.id
     WHERE c.appointment_id = $1`,
    [req.params.appointmentId]
  );
  res.json(result.rows[0] || null);
});

// ───────────────────────── Crear / reenviar ─────────────────────────

// POST /api/confirmations  → marca enviada y genera/refresca token
router.post('/', authenticate, async (req, res) => {
  const { appointment_id, message_content } = req.body;
  if (!appointment_id) return res.status(400).json({ error: 'appointment_id es requerido' });

  const apptResult = await query(
    'SELECT id, patient_id, clinic_id FROM appointments WHERE id = $1 AND clinic_id = $2',
    [appointment_id, req.user.clinic_id]
  );
  const appt = apptResult.rows[0];
  if (!appt) return res.status(404).json({ error: 'Cita no encontrada' });

  const existing = await query(
    `SELECT id, token, status FROM appointment_confirmations WHERE appointment_id = $1`,
    [appointment_id]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    // Si ya respondió, no regeneramos token — solo actualizamos quién/cuándo
    // se reenvió el mensaje (útil para historial).
    await query(
      `UPDATE appointment_confirmations
       SET sent_at = CURRENT_TIMESTAMP, sent_by = $1, message_content = $2,
           status = CASE WHEN status IN ('confirmed','declined') THEN status ELSE 'sent' END
       WHERE id = $3`,
      [req.user.id, message_content || '', row.id]
    );
    return res.json({ id: row.id, token: row.token, success: true });
  }

  const token = newToken();
  const result = await query(
    `INSERT INTO appointment_confirmations
       (appointment_id, patient_id, clinic_id, token, status, sent_at, sent_by, message_content)
     VALUES ($1, $2, $3, $4, 'sent', CURRENT_TIMESTAMP, $5, $6)
     RETURNING id, token`,
    [appointment_id, appt.patient_id, appt.clinic_id, token, req.user.id, message_content || '']
  );
  res.json({ id: result.rows[0].id, token: result.rows[0].token, success: true });
});

// POST /api/confirmations/manual  → staff marca confirmada/declinada a mano
// (p. ej. el paciente confirmó por llamada)
router.post('/manual', authenticate, async (req, res) => {
  const { appointment_id, action } = req.body;
  if (!appointment_id || !['confirm', 'decline'].includes(action)) {
    return res.status(400).json({ error: 'appointment_id y action (confirm|decline) son requeridos' });
  }

  const apptResult = await query(
    'SELECT id, patient_id, clinic_id FROM appointments WHERE id = $1 AND clinic_id = $2',
    [appointment_id, req.user.clinic_id]
  );
  const appt = apptResult.rows[0];
  if (!appt) return res.status(404).json({ error: 'Cita no encontrada' });

  const newStatus = action === 'confirm' ? 'confirmed' : 'declined';
  const apptStatus = action === 'confirm' ? 'confirmed' : 'cancelled';

  const existing = await query(
    `SELECT id FROM appointment_confirmations WHERE appointment_id = $1`,
    [appointment_id]
  );

  if (existing.rows.length > 0) {
    await query(
      `UPDATE appointment_confirmations
       SET status = $1, responded_at = CURRENT_TIMESTAMP, confirmed_via = 'manual'
       WHERE id = $2`,
      [newStatus, existing.rows[0].id]
    );
  } else {
    await query(
      `INSERT INTO appointment_confirmations
         (appointment_id, patient_id, clinic_id, token, status, sent_at, sent_by, responded_at, confirmed_via)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, CURRENT_TIMESTAMP, 'manual')`,
      [appointment_id, appt.patient_id, appt.clinic_id, newToken(), newStatus, req.user.id]
    );
  }

  await query(
    'UPDATE appointments SET status = $1 WHERE id = $2 AND clinic_id = $3',
    [apptStatus, appointment_id, req.user.clinic_id]
  );

  res.json({ success: true, status: newStatus });
});

// DELETE /api/confirmations/:id  → resetear (clinic_admin)
router.delete('/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'clinic_admin') {
    return res.status(403).json({ error: 'No autorizado' });
  }
  const result = await query(
    'SELECT appointment_id, status FROM appointment_confirmations WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Confirmación no encontrada' });

  await query('DELETE FROM appointment_confirmations WHERE id = $1', [req.params.id]);

  // Si la cita estaba marcada como confirmada por esta confirmación, devolverla
  // a pending para no dejar estado inconsistente.
  if (result.rows[0].status === 'confirmed') {
    await query(
      `UPDATE appointments SET status = 'pending' WHERE id = $1 AND clinic_id = $2 AND status = 'confirmed'`,
      [result.rows[0].appointment_id, req.user.clinic_id]
    );
  }
  res.json({ success: true });
});

// ───────────────────────── Endpoints públicos (por token) ─────────────────────────
// No requieren autenticación: cualquiera con el link puede confirmar.
// El token es la "credencial" — la entropía (128 bits) es suficiente para que
// no se adivinen.

// GET /api/confirmations/public/:token  → datos de la cita para mostrar al paciente
router.get('/public/:token', async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!/^[a-f0-9]{32}$/i.test(token)) {
    return res.status(400).json({ error: 'Token inválido' });
  }
  const result = await query(
    `SELECT
       c.id, c.token, c.status, c.responded_at,
       a.id AS appointment_id, a.scheduled_at, a.status AS appointment_status,
       p.name AS patient_name,
       u.name AS doctor_name,
       cl.name AS clinic_name, cl.phone AS clinic_phone, cl.brand_color,
       cl.address AS clinic_address, cl.city AS clinic_city,
       cl.latitude, cl.longitude, cl.map_url, cl.location_notes,
       cl.confirmation_card_message AS card_message
     FROM appointment_confirmations c
     JOIN appointments a ON c.appointment_id = a.id
     JOIN patients p ON c.patient_id = p.id
     JOIN users u ON a.doctor_id = u.id
     JOIN clinics cl ON c.clinic_id = cl.id
     WHERE c.token = $1`,
    [token]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Confirmación no encontrada' });
  const row = result.rows[0];
  if (!row.card_message) row.card_message = CARD_MESSAGE_DEFAULT;
  res.json(row);
});

// POST /api/confirmations/public/:token  → paciente confirma/declina
router.post('/public/:token', async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!/^[a-f0-9]{32}$/i.test(token)) {
    return res.status(400).json({ error: 'Token inválido' });
  }
  const action = req.body && req.body.action;
  if (!['confirm', 'decline'].includes(action)) {
    return res.status(400).json({ error: 'action debe ser confirm o decline' });
  }

  const lookup = await query(
    `SELECT c.id, c.appointment_id, c.clinic_id, a.scheduled_at
     FROM appointment_confirmations c
     JOIN appointments a ON c.appointment_id = a.id
     WHERE c.token = $1`,
    [token]
  );
  if (lookup.rows.length === 0) return res.status(404).json({ error: 'Confirmación no encontrada' });
  const row = lookup.rows[0];

  // Permitimos que el paciente cambie su respuesta hasta el momento de la cita.
  if (new Date(row.scheduled_at) < new Date()) {
    return res.status(410).json({ error: 'Esta cita ya pasó' });
  }

  const newStatus = action === 'confirm' ? 'confirmed' : 'declined';
  const apptStatus = action === 'confirm' ? 'confirmed' : 'cancelled';

  await query(
    `UPDATE appointment_confirmations
     SET status = $1, responded_at = CURRENT_TIMESTAMP, confirmed_via = 'patient_link'
     WHERE id = $2`,
    [newStatus, row.id]
  );
  await query(
    'UPDATE appointments SET status = $1 WHERE id = $2 AND clinic_id = $3',
    [apptStatus, row.appointment_id, row.clinic_id]
  );

  res.json({ success: true, status: newStatus });
});

// ───────────────────────── Notificaciones para el doctor ─────────────────────────
// GET /api/confirmations/notifications  → confirmaciones del paciente (link público)
// para citas del doctor autenticado, de las últimas 48h. El frontend hace polling
// y compara contra IDs vistos en localStorage para sonar/disparar notificación nativa.
router.get('/notifications', authenticate, async (req, res) => {
  if (req.user.role !== 'doctor') {
    return res.json([]);
  }
  const result = await query(
    `SELECT
       c.id,
       c.status,
       c.responded_at,
       a.id AS appointment_id,
       a.scheduled_at,
       p.name AS patient_name
     FROM appointment_confirmations c
     JOIN appointments a ON c.appointment_id = a.id
     JOIN patients p ON c.patient_id = p.id
     WHERE a.clinic_id = $1
       AND a.doctor_id = $2
       AND c.confirmed_via = 'patient_link'
       AND c.responded_at IS NOT NULL
       AND c.responded_at >= (CURRENT_TIMESTAMP - INTERVAL '48 hours')
     ORDER BY c.responded_at DESC
     LIMIT 30`,
    [req.user.clinic_id, req.user.id]
  );
  res.json(result.rows);
});

module.exports = router;
