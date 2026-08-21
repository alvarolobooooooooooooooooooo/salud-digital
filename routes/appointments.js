const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');
const { checkRoomCapacity } = require('../lib/room-capacity');
const { rejectIfBlocked } = require('../lib/availability-blocks');
const apptTypes = require('../lib/appointment-types');
const { fechaLocal, rangoDelDia, normalizarFechaHora } = require('../lib/dia-local');

// Alias del helper compartido: el nombre viejo se usa en varios sitios de este
// archivo y no vale la pena tocarlos todos.
const getLocalDateString = fechaLocal;

// Ventana por defecto del calendario. Antes devolvía TODAS las citas de la
// historia de la clínica con tres joins encima, así que el tamaño de la
// respuesta crecía sin freno con la antigüedad. Las dos pantallas que lo usan
// (agendar-online y recepcion-citas) solo miran disponibilidad futura y choques
// de horario; ninguna lee el pasado lejano. Con la ventana, el tamaño deja de
// depender de cuántos años lleve abierta la clínica. Se puede pedir otro rango
// con ?from= y ?to=.
const CALENDARIO_DIAS_ATRAS = 30;
const CALENDARIO_DIAS_ADELANTE = 180;

function desplazarDias(dias) {
  // A mediodía, para que ningún cambio de horario mueva el día resultante.
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + dias);
  return fechaLocal(d);
}

// Ventana de fechas OPCIONAL (?from=&to=, ambos inclusive). Sin parámetros
// devuelve el historial completo, igual que siempre.
//
// ── Por qué opcional y no por defecto ──
// Esta ruta traía TODAS las citas de la historia del doctor con dos joins encima:
// a los dos años de consulta son miles de filas en cada carga de la agenda, y el
// coste crecía sin freno. Lo correcto es pedir solo lo que se pinta, y eso hace
// ahora citas.html. Pero poner la ventana por DEFECTO truncaría la respuesta de
// cualquier pestaña que siguiera abierta con el HTML anterior durante un
// despliegue —el usuario vería su agenda medio vacía sin saber por qué—, así que
// se sigue el mismo criterio que /finances/paid: comportamiento nuevo solo si se
// pide. Ver también la ventana de /calendar, más arriba.
router.get('/', authenticate, async (req, res) => {
  const from = DIA_RE.test(String(req.query.from || '')) ? req.query.from : null;
  const to = DIA_RE.test(String(req.query.to || '')) ? req.query.to : null;
  if (from && to && from > to) {
    return res.status(400).json({ error: 'El rango de fechas está invertido.' });
  }

  // `a.*` se queda a propósito: son 20 columnas cortas (ningún TEXT grande), así
  // que enumerarlas ahorraría poco y bastaría olvidar una para romper la agenda.
  // Lo que pesaba era el NÚMERO de filas, y eso es lo que corrige la ventana.
  let queryStr = `SELECT a.*, p.name AS patient_name, p.phone AS patient_phone, u.name AS doctor_name, u.email AS doctor_email FROM appointments a JOIN patients p ON a.patient_id = p.id JOIN users u ON a.doctor_id = u.id WHERE a.clinic_id = $1`;
  const params = [req.user.clinic_id];
  let paramIndex = 2;

  // Rango sobre la columna desnuda: usa el índice (clinic_id, scheduled_at).
  // scheduled_at es TEXT, pero en ISO-8601 el orden alfabético es el cronológico.
  if (from) {
    queryStr += ` AND a.scheduled_at >= $${paramIndex}`;
    params.push(from);
    paramIndex++;
  }
  if (to) {
    // El tope es exclusivo; quien pide ?to=2026-08-31 espera que ese día entre.
    queryStr += ` AND a.scheduled_at < $${paramIndex}`;
    params.push(rangoDelDia(to).hasta);
    paramIndex++;
  }

  if (req.user.role === 'doctor') {
    queryStr += ` AND a.doctor_id = $${paramIndex}`;
    params.push(req.user.id);
    paramIndex++;
  }

  // Filtro opcional por paciente. La ficha de paciente (patients.html) solo necesita
  // las citas de UN paciente, así que evita traer todas las citas de la clínica.
  // Retrocompatible: los demás callers no envían patient_id y reciben la lista completa.
  if (req.query.patient_id !== undefined) {
    const patientId = parseInt(req.query.patient_id, 10);
    if (isNaN(patientId)) return res.status(400).json({ error: 'patient_id inválido' });
    queryStr += ` AND a.patient_id = $${paramIndex}`;
    params.push(patientId);
    paramIndex++;
  }

  queryStr += ' ORDER BY a.scheduled_at ASC';
  const result = await query(queryStr, params);
  res.json(result.rows);
});

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get('/calendar', authenticate, async (req, res) => {
  // Ventana de fechas obligatoria (ver arriba). El rango usa el índice
  // (clinic_id, scheduled_at) en vez de recorrer la tabla entera.
  const from = DIA_RE.test(String(req.query.from || '')) ? req.query.from : desplazarDias(-CALENDARIO_DIAS_ATRAS);
  const to = DIA_RE.test(String(req.query.to || '')) ? req.query.to : desplazarDias(CALENDARIO_DIAS_ADELANTE);
  if (from > to) return res.status(400).json({ error: 'El rango de fechas está invertido.' });
  // El límite superior de la consulta es exclusivo, pero quien pide
  // ?to=2026-08-31 espera que ese día entre: se avanza uno para incluirlo.
  const hasta = rangoDelDia(to).hasta;

  const result = await query(
    `SELECT a.*, p.name AS patient_name, p.phone AS patient_phone,
            u.name AS doctor_name, u.email AS doctor_email, u.specialty AS doctor_specialty
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN users u ON a.doctor_id = u.id
      WHERE a.clinic_id = $1 AND a.scheduled_at >= $2 AND a.scheduled_at < $3
      ORDER BY a.scheduled_at ASC`,
    [req.user.clinic_id, from, hasta],
  );
  res.json(result.rows);
});

// Tipos comunes a todas las especialidades + tipos exclusivos de Podología
// (en Podología no se ofrece 'control'; el filtrado por especialidad se hace en
// el frontend, que lee el mismo catálogo — ver lib/appointment-types.js).
const VALID_APPOINTMENT_TYPES = apptTypes.ALL;

router.put('/:id', authenticate, async (req, res) => {
  const { patient_id, doctor_id, scheduled_at, status, appointment_type } = req.body;
  const apptResult = await query(
    'SELECT id, doctor_id as current_doctor_id, scheduled_at AS current_scheduled_at FROM appointments WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  const appt = apptResult.rows[0];
  if (!appt) return res.status(404).json({ error: 'Cita no encontrada' });
  // Un doctor solo puede modificar citas que le pertenecen, y no puede reasignarlas a otros doctores.
  if (req.user.role === 'doctor') {
    if (appt.current_doctor_id !== req.user.id) {
      return res.status(403).json({ error: 'No puedes modificar citas de otro doctor' });
    }
    if (doctor_id !== undefined && Number(doctor_id) !== req.user.id) {
      return res.status(403).json({ error: 'No puedes reasignar la cita a otro doctor' });
    }
  }

  const fields = [];
  const vals   = [];
  let paramIndex = 1;

  if (patient_id !== undefined) {
    const patientResult = await query('SELECT id FROM patients WHERE id = $1 AND clinic_id = $2',
      [patient_id, req.user.clinic_id]);
    if (patientResult.rows.length === 0) return res.status(404).json({ error: 'Paciente no encontrado' });
    fields.push(`patient_id = $${paramIndex++}`);
    vals.push(patient_id);
  }

  let specialty = null;
  if (doctor_id !== undefined) {
    const doctorResult = await query('SELECT specialty FROM users WHERE id = $1 AND clinic_id = $2 AND role = $3',
      [doctor_id, req.user.clinic_id, 'doctor']);
    if (doctorResult.rows.length === 0) return res.status(404).json({ error: 'Doctor no encontrado' });
    specialty = doctorResult.rows[0].specialty || '';
    fields.push(`doctor_id = $${paramIndex++}`);    vals.push(doctor_id);
    fields.push(`specialty = $${paramIndex++}`);    vals.push(specialty);
  }

  if (scheduled_at !== undefined) {
    // Se normaliza ANTES de comprobar nada, y a partir de aquí se usa siempre
    // `cuando`. Si se comprobara la disponibilidad con el valor crudo y se
    // guardara el normalizado, las dos cosas podrían no referirse al mismo
    // instante y la cita se colaría sobre otra.
    const cuando = normalizarFechaHora(scheduled_at);
    if (!cuando) return res.status(400).json({ error: 'Fecha/hora inválida' });

    // Only revalidate room capacity if the new status (if provided) isn't 'cancelled',
    // since cancelled appointments don't occupy a room.
    const futureStatus = status !== undefined ? status : null;
    if (futureStatus !== 'cancelled') {
      // Mover una cita a una hora que el doctor bloqueó tampoco vale.
      const targetDoctor = doctor_id !== undefined ? doctor_id : appt.current_doctor_id;
      // …pero una cita que YA estaba a esa hora se puede seguir editando aunque
      // el doctor haya recortado su horario después: si no, cambiarle el estado
      // o el paciente sería imposible sin moverla antes. Se compara al minuto,
      // porque la columna guarda tanto '…T10:00' como '…T10:00:00'.
      const mismaHora = String(appt.current_scheduled_at || '').slice(0, 16) === cuando.slice(0, 16);
      const mismoDoctor = Number(targetDoctor) === Number(appt.current_doctor_id);
      if (!(mismaHora && mismoDoctor) && await rejectIfBlocked(res, targetDoctor, cuando)) return;

      const cap = await checkRoomCapacity(req.user.clinic_id, cuando, req.params.id);
      if (!cap.ok) {
        return res.status(409).json({
          error: `No hay salas disponibles en ese horario (${cap.overlapping}/${cap.roomCount} ocupadas).`,
          code: 'rooms_full',
          ...cap,
        });
      }
    }
    fields.push(`scheduled_at = $${paramIndex++}`);
    vals.push(cuando);
  }
  if (status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    vals.push(status);
  }
  if (appointment_type !== undefined) {
    if (!VALID_APPOINTMENT_TYPES.includes(appointment_type)) {
      return res.status(400).json({ error: 'Tipo de cita inválido' });
    }
    fields.push(`appointment_type = $${paramIndex++}`);
    vals.push(appointment_type);
  }

  if (!fields.length) return res.status(400).json({ error: 'Nada que actualizar' });

  vals.push(req.params.id);
  await query(`UPDATE appointments SET ${fields.join(', ')} WHERE id = $${paramIndex}`, vals);
  res.json({ success: true });
});

router.get('/public-bookings/stats', authenticate, async (req, res) => {
  if (req.user.role !== 'doctor' && req.user.role !== 'clinic_admin') {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const params = [req.user.clinic_id];
  let doctorFilter = '';
  if (req.user.role === 'doctor') {
    doctorFilter = ' AND a.doctor_id = $2';
    params.push(req.user.id);
  }

  const totalResult = await query(
    `SELECT COUNT(*) AS total FROM appointments a WHERE a.clinic_id = $1 AND a.source = 'public_link'${doctorFilter}`,
    params
  );
  const total = parseInt(totalResult.rows[0].total);

  const monthResult = await query(
    `SELECT COUNT(*) AS total FROM appointments a
     WHERE a.clinic_id = $1 AND a.source = 'public_link'${doctorFilter}
     AND DATE_TRUNC('month', a.scheduled_at::timestamp) = DATE_TRUNC('month', CURRENT_DATE)`,
    params
  );
  const this_month = parseInt(monthResult.rows[0].total);

  const cancelledResult = await query(
    `SELECT COUNT(*) AS total FROM appointments a
     WHERE a.clinic_id = $1 AND a.source = 'public_link' AND a.status = 'cancelled'${doctorFilter}`,
    params
  );
  const cancelled = parseInt(cancelledResult.rows[0].total);

  const conversion_rate = total > 0 ? Math.round(((total - cancelled) / total) * 100) : 0;

  const recentResult = await query(
    `SELECT a.id, a.scheduled_at, a.status, a.reason, a.specialty, a.appointment_type,
            p.id AS patient_id, p.name AS patient_name, p.phone AS patient_phone, p.age AS patient_age,
            u.name AS doctor_name
     FROM appointments a
     JOIN patients p ON a.patient_id = p.id
     JOIN users u ON a.doctor_id = u.id
     WHERE a.clinic_id = $1 AND a.source = 'public_link'${doctorFilter}
     ORDER BY a.scheduled_at DESC LIMIT 20`,
    params
  );

  res.json({
    total,
    this_month,
    conversion_rate,
    recent: recentResult.rows
  });
});

router.get('/today', authenticate, async (req, res) => {
  // Rango en vez de `scheduled_at::date`: el cast envuelve la columna y anula el
  // índice (clinic_id, scheduled_at). Ver lib/dia-local.js.
  const { desde, hasta } = rangoDelDia();
  let queryStr = `SELECT a.*, p.name AS patient_name, p.phone AS patient_phone, u.name AS doctor_name, u.email AS doctor_email FROM appointments a JOIN patients p ON a.patient_id = p.id JOIN users u ON a.doctor_id = u.id WHERE a.clinic_id = $1 AND a.scheduled_at >= $2 AND a.scheduled_at < $3`;
  const params = [req.user.clinic_id, desde, hasta];
  let paramIndex = 4;

  if (req.user.role === 'doctor') {
    queryStr += ` AND a.doctor_id = $${paramIndex}`;
    params.push(req.user.id);
    paramIndex++;
  }

  queryStr += ' ORDER BY a.scheduled_at';
  const result = await query(queryStr, params);
  res.json(result.rows);
});

// Una sola cita. Las siete páginas de consulta hacían
// `api('/api/appointments').find(a => a.id === X)`: se descargaba el historial
// entero del doctor para quedarse con UNA fila, y encima en el momento más caro
// (abrir una consulta con el paciente delante).
//
// El patrón `:id(\\d+)` la deja fuera del camino de /today, /calendar y
// /public-bookings/stats aunque alguien cambie el orden de las rutas más adelante.
//
// Mantiene la misma regla de visibilidad que la lista: un doctor solo ve sus
// citas, así que pedir la de otro devuelve 404 igual que antes devolvía "no
// encontrada" al no estar en el arreglo.
router.get('/:id(\\d+)', authenticate, async (req, res) => {
  const params = [req.params.id, req.user.clinic_id];
  let queryStr = `SELECT a.*, p.name AS patient_name, p.phone AS patient_phone, u.name AS doctor_name, u.email AS doctor_email
                    FROM appointments a
                    JOIN patients p ON a.patient_id = p.id
                    JOIN users u ON a.doctor_id = u.id
                   WHERE a.id = $1 AND a.clinic_id = $2`;
  if (req.user.role === 'doctor') {
    queryStr += ' AND a.doctor_id = $3';
    params.push(req.user.id);
  }
  const result = await query(queryStr, params);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Cita no encontrada' });
  res.json(result.rows[0]);
});

router.post('/', authenticate, async (req, res) => {
  if (req.user.role === 'clinic_admin') {
    return res.status(403).json({ error: 'Clinic admin cannot create appointments' });
  }
  const { patient_id, doctor_id, scheduled_at, appointment_type, reason } = req.body;
  if (!patient_id || !doctor_id || !scheduled_at) {
    return res.status(400).json({ error: 'patient_id, doctor_id y scheduled_at son requeridos' });
  }

  // Se normaliza aquí, una sola vez, y de aquí en adelante se usa `cuando`:
  // las comprobaciones de disponibilidad y el INSERT tienen que hablar del
  // mismo instante escrito de la misma forma. Antes se guardaba tal cual llegara
  // —solo se comprobaba que `new Date()` lo entendiera—, así que la base acabó
  // con formatos mezclados (`reception.html` manda hora UTC con Z; el resto de
  // pantallas, hora de pared). Ver lib/dia-local.js.
  const cuando = normalizarFechaHora(scheduled_at);
  if (!cuando) {
    return res.status(400).json({ error: 'Fecha y hora inválidas' });
  }

  const aptType = appointment_type || 'seguimiento';
  if (!VALID_APPOINTMENT_TYPES.includes(aptType)) {
    return res.status(400).json({ error: 'Tipo de cita inválido' });
  }

  const reasonText = typeof reason === 'string' ? reason.trim().slice(0, 500) : '';

  const patientResult = await query('SELECT id FROM patients WHERE id = $1 AND clinic_id = $2',
    [patient_id, req.user.clinic_id]);
  if (patientResult.rows.length === 0) return res.status(404).json({ error: 'Paciente no encontrado' });

  const doctorResult = await query('SELECT specialty FROM users WHERE id = $1 AND clinic_id = $2 AND role = $3',
    [doctor_id, req.user.clinic_id, 'doctor']);
  if (doctorResult.rows.length === 0) return res.status(404).json({ error: 'Doctor no encontrado' });

  // Lo que el doctor bloqueó en su disponibilidad también vale por dentro: si
  // cerró el día o quitó esa hora, tampoco se agenda desde recepción.
  if (await rejectIfBlocked(res, doctor_id, cuando)) return;

  const cap = await checkRoomCapacity(req.user.clinic_id, cuando, null);
  if (!cap.ok) {
    return res.status(409).json({
      error: `No hay salas disponibles en ese horario (${cap.overlapping}/${cap.roomCount} ocupadas).`,
      code: 'rooms_full',
      ...cap,
    });
  }

  const result = await query(
    'INSERT INTO appointments (patient_id, doctor_id, clinic_id, specialty, scheduled_at, status, appointment_type, reason) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
    [patient_id, doctor_id, req.user.clinic_id, doctorResult.rows[0].specialty || '', cuando, 'pending', aptType, reasonText]
  );
  res.json({ id: result.rows[0].id });
});

router.put('/:id/status', authenticate, async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'waiting', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  const apptResult = await query('SELECT id, doctor_id FROM appointments WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  if (apptResult.rows.length === 0) return res.status(404).json({ error: 'Cita no encontrada' });
  if (req.user.role === 'doctor' && apptResult.rows[0].doctor_id !== req.user.id) {
    return res.status(403).json({ error: 'No puedes modificar citas de otro doctor' });
  }

  await query('UPDATE appointments SET status = $1 WHERE id = $2 AND clinic_id = $3',
    [status, req.params.id, req.user.clinic_id]);
  res.json({ success: true });
});

router.delete('/:id', authenticate, async (req, res) => {
  const apptResult = await query('SELECT id, doctor_id FROM appointments WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  if (apptResult.rows.length === 0) return res.status(404).json({ error: 'Cita no encontrada' });
  if (req.user.role === 'doctor' && apptResult.rows[0].doctor_id !== req.user.id) {
    return res.status(403).json({ error: 'No puedes borrar citas de otro doctor' });
  }

  await query('DELETE FROM appointments WHERE id = $1 AND clinic_id = $2', [req.params.id, req.user.clinic_id]);
  res.json({ success: true });
});

module.exports = router;
