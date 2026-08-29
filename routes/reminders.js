const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');
const {
  CONFIG_ROLES,
  guardaEnSuPropiaFila,
  sqlConfigEfectiva,
  normalizarNumero,
  numeroInvalido,
} = require('../lib/whatsapp-config');

// GET /api/reminders/whatsapp-config
// La configuración de WhatsApp de quien mira, ya resuelta contra la de la
// clínica (ver lib/whatsapp-config.js), más la de cada doctor de la casa para
// que la lista pueda pintar el mensaje de CADA cita con el texto de SU doctor.
//
// Los cuatro campos de siempre se devuelven en la raíz y con el mismo nombre:
// public/citas.html lee este endpoint y espera esa forma. Lo nuevo son claves
// añadidas, nunca movidas.
router.get('/whatsapp-config', authenticate, async (req, res) => {
  const esDoctor = guardaEnSuPropiaFila(req.user);

  // El doctor ve lo suyo resuelto contra la clínica; los demás roles ven —y
  // editan— el valor de la casa, que es el que gobierna a quien no lo ha tocado.
  const propia = await query(
    esDoctor
      ? `SELECT ${sqlConfigEfectiva('u', 'c')},
                c.name,
                u.whatsapp_template IS NOT NULL AS personalizado
           FROM users u JOIN clinics c ON c.id = u.clinic_id
          WHERE u.id = $1`
      : `SELECT c.whatsapp_enabled, c.whatsapp_number, c.whatsapp_template,
                c.whatsapp_confirmation_template, c.name,
                FALSE AS personalizado
           FROM clinics c WHERE c.id = $1`,
    [esDoctor ? req.user.id : req.user.clinic_id]
  );
  if (propia.rows.length === 0) return res.status(404).json({ error: 'Clinic not found' });

  // Un doctor solo se necesita a sí mismo: la lista que ve son sus citas. La
  // recepción y el clinic_admin ven las de toda la clínica, así que necesitan
  // el texto de cada doctor para no mandar el de uno firmado por otro.
  const doctores = await query(
    `SELECT u.id, ${sqlConfigEfectiva('u', 'c')}
       FROM users u JOIN clinics c ON c.id = u.clinic_id
      WHERE u.clinic_id = $1 AND u.role = 'doctor'
        ${esDoctor ? 'AND u.id = $2' : ''}`,
    esDoctor ? [req.user.clinic_id, req.user.id] : [req.user.clinic_id]
  );
  const porDoctor = {};
  for (const d of doctores.rows) {
    porDoctor[d.id] = {
      whatsapp_enabled: d.whatsapp_enabled,
      whatsapp_template: d.whatsapp_template,
    };
  }

  res.json(Object.assign({}, propia.rows[0], {
    // De quién es lo que la pantalla va a guardar: 'doctor' = tu mensaje,
    // 'clinic' = el de la casa. La pantalla lo dice en voz alta para que nadie
    // crea que está cambiando el de todos.
    scope: esDoctor ? 'doctor' : 'clinic',
    por_doctor: porDoctor,
  }));
});

// PUT /api/reminders/whatsapp-config
// Guarda la configuración de quien llama: el doctor la suya, el clinic_admin la
// de la casa. Son filas distintas, así que uno no puede pisar al otro.
//
// Antes esto exigía role === 'clinic_admin' y devolvía 403 a los doctores, que
// sí veían la pantalla y sus botones. En una cuenta del alta por cuenta propia
// —sin ningún clinic_admin— el mensaje no se podía cambiar nunca. Mismo arreglo
// que bd8293a hizo en Confirmaciones, ahora con destino propio para el doctor.
router.put('/whatsapp-config', authenticate, async (req, res) => {
  if (!CONFIG_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const body = req.body || {};
  const traeNumero = Object.prototype.hasOwnProperty.call(body, 'whatsapp_number');
  const numero = normalizarNumero(body.whatsapp_number);

  if (traeNumero && numeroInvalido(numero)) {
    return res.status(400).json({ error: 'Número de WhatsApp inválido. Use formato internacional sin +, espacios ni guiones.' });
  }
  // Encender WhatsApp sin número deja el interruptor apuntando a ninguna parte.
  // Confirmaciones ya lo rechazaba y Recordatorios no: ahora que las dos
  // pantallas escriben la MISMA fila, tenían que dejar de opinar distinto.
  if (body.whatsapp_enabled && traeNumero && !numero) {
    return res.status(400).json({ error: 'Para encender WhatsApp hace falta un número.' });
  }

  // Solo se escribe lo que venga en el cuerpo: así una llamada vieja que no
  // mande el interruptor no apaga WhatsApp sin querer.
  const sets = [];
  const params = [];
  const set = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };

  if (Object.prototype.hasOwnProperty.call(body, 'whatsapp_enabled')) set('whatsapp_enabled', !!body.whatsapp_enabled);
  if (traeNumero) set('whatsapp_number', numero);
  if (Object.prototype.hasOwnProperty.call(body, 'whatsapp_template')) set('whatsapp_template', body.whatsapp_template || '');

  if (sets.length === 0) return res.json({ success: true });

  const enSuFila = guardaEnSuPropiaFila(req.user);
  params.push(enSuFila ? req.user.id : req.user.clinic_id);
  await query(
    `UPDATE ${enSuFila ? 'users' : 'clinics'} SET ${sets.join(', ')} WHERE id = $${params.length}`,
    params
  );
  res.json({ success: true, scope: enSuFila ? 'doctor' : 'clinic' });
});

// GET /api/reminders
// List all reminders for the clinic, joined with appointment/patient data
router.get('/', authenticate, async (req, res) => {
  let queryStr = `
    SELECT
      a.id AS appointment_id,
      a.scheduled_at,
      a.status AS appointment_status,
      p.id AS patient_id,
      p.name AS patient_name,
      p.phone,
      a.doctor_id,
      u.name AS doctor_name,
      r.id AS reminder_id,
      r.status AS reminder_status,
      r.sent_at,
      r.sent_by,
      sender.name AS sent_by_name,
      r.message_content,
      r.channel
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN users u ON a.doctor_id = u.id
    LEFT JOIN appointment_reminders r ON r.appointment_id = a.id AND r.channel = 'whatsapp'
    LEFT JOIN users sender ON r.sent_by = sender.id
    WHERE a.clinic_id = $1
  `;
  const params = [req.user.clinic_id];
  let paramIndex = 2;

  if (req.user.role === 'doctor') {
    queryStr += ` AND a.doctor_id = $${paramIndex}`;
    params.push(req.user.id);
    paramIndex++;
  }

  queryStr += ' ORDER BY a.scheduled_at DESC';

  const result = await query(queryStr, params);
  res.json(result.rows);
});

// GET /api/reminders/appointment/:appointmentId
// Get the reminder (if any) for a specific appointment
router.get('/appointment/:appointmentId', authenticate, async (req, res) => {
  const apptCheck = await query(
    'SELECT id FROM appointments WHERE id = $1 AND clinic_id = $2',
    [req.params.appointmentId, req.user.clinic_id]
  );
  if (apptCheck.rows.length === 0) return res.status(404).json({ error: 'Cita no encontrada' });

  const result = await query(
    `SELECT r.*, u.name AS sent_by_name FROM appointment_reminders r
     LEFT JOIN users u ON r.sent_by = u.id
     WHERE r.appointment_id = $1 AND r.channel = 'whatsapp'
     ORDER BY r.created_at DESC LIMIT 1`,
    [req.params.appointmentId]
  );
  res.json(result.rows[0] || null);
});

// POST /api/reminders
// Mark a reminder as manually sent
router.post('/', authenticate, async (req, res) => {
  const { appointment_id, message_content } = req.body;
  if (!appointment_id) {
    return res.status(400).json({ error: 'appointment_id es requerido' });
  }

  const apptResult = await query(
    'SELECT id, patient_id, clinic_id FROM appointments WHERE id = $1 AND clinic_id = $2',
    [appointment_id, req.user.clinic_id]
  );
  const appt = apptResult.rows[0];
  if (!appt) return res.status(404).json({ error: 'Cita no encontrada' });

  // Check if a reminder already exists; update or create
  const existing = await query(
    `SELECT id FROM appointment_reminders WHERE appointment_id = $1 AND channel = 'whatsapp'`,
    [appointment_id]
  );

  if (existing.rows.length > 0) {
    await query(
      `UPDATE appointment_reminders
       SET status = 'manual_sent', sent_at = CURRENT_TIMESTAMP, sent_by = $1, message_content = $2
       WHERE id = $3`,
      [req.user.id, message_content || '', existing.rows[0].id]
    );
    res.json({ id: existing.rows[0].id, success: true });
  } else {
    const result = await query(
      `INSERT INTO appointment_reminders
        (appointment_id, patient_id, clinic_id, channel, status, sent_at, sent_by, message_content)
       VALUES ($1, $2, $3, 'whatsapp', 'manual_sent', CURRENT_TIMESTAMP, $4, $5)
       RETURNING id`,
      [appointment_id, appt.patient_id, appt.clinic_id, req.user.id, message_content || '']
    );
    res.json({ id: result.rows[0].id, success: true });
  }
});

// DELETE /api/reminders/:id
// Reset a reminder back to pending (delete the record)
router.delete('/:id', authenticate, async (req, res) => {
  const result = await query(
    'SELECT id FROM appointment_reminders WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Recordatorio no encontrado' });

  await query('DELETE FROM appointment_reminders WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
