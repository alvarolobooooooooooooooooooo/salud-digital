// ── Panel del administrador de la plataforma ──
//
// Todo lo que hay aquí es exclusivo de 'super_admin': la bandeja de solicitudes
// de cuenta, los reportes de actividad de las clínicas y el conteo de visitas de
// la web pública.
//
// REGLA QUE NO SE ROMPE: nada de esto devuelve datos de pacientes. El operador
// de la plataforma necesita saber CUÁNTO se está usando cada clínica, no QUIÉN
// está siendo atendido. Por eso los reportes son recuentos y fechas, y la
// bitácora nombra la clínica y el profesional, nunca al paciente ni su motivo
// de consulta. Ese límite es deliberado: lo contrario convertiría este panel en
// la vía más cómoda para leer expedientes ajenos.

const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const analytics = require('../lib/analytics');
const mailer = require('../utils/mailer');
const subscription = require('../lib/subscription');

// Un solo guardián para todo el router: ninguna ruta nueva puede olvidarse de
// pedir el rol.
router.use(authenticate, requireRole('super_admin'));

function entero(valor, porDefecto, maximo) {
  const n = parseInt(valor, 10);
  if (!Number.isFinite(n) || n <= 0) return porDefecto;
  return Math.min(n, maximo);
}

const n = (v) => parseInt(v, 10) || 0;

// ══════════════════════════════════════════════════════════════════
//  Resumen
// ══════════════════════════════════════════════════════════════════

router.get('/overview', async (req, res) => {
  const [plataforma, visitas] = await Promise.all([
    query(`
      SELECT
        (SELECT COUNT(*) FROM clinics)                                          AS clinicas,
        (SELECT COUNT(*) FROM users WHERE role = 'doctor')                       AS doctores,
        (SELECT COUNT(*) FROM users WHERE role IN ('doctor','clinic_admin','receptionist')) AS personal,
        (SELECT COUNT(*) FROM patients)                                          AS pacientes,
        (SELECT COUNT(*) FROM consultations)                                     AS consultas,
        (SELECT COUNT(*) FROM consultations WHERE created_at >= NOW() - INTERVAL '30 days') AS consultas_30,
        (SELECT COUNT(*) FROM consultations WHERE created_at >= NOW() - INTERVAL '7 days')  AS consultas_7,
        (SELECT COUNT(*) FROM appointments)                                      AS citas,
        (SELECT COUNT(*) FROM users WHERE approval_status = 'pending')           AS pendientes,
        (SELECT COUNT(*) FROM subscriptions WHERE status IN ('active','trialing')) AS suscripciones_activas,
        (SELECT COUNT(*) FROM clinic_landing_leads WHERE created_at >= NOW() - INTERVAL '30 days') AS leads_30
    `),
    // Las visitas viven en su propio módulo y su tabla puede no existir en un
    // despliegue a medio migrar: que falte el tráfico no puede dejar sin
    // resumen al resto del panel.
    analytics.resumen({ dias: 30 }).catch(() => null),
  ]);

  const p = plataforma.rows[0] || {};
  res.json({
    plataforma: {
      clinicas: n(p.clinicas),
      doctores: n(p.doctores),
      personal: n(p.personal),
      pacientes: n(p.pacientes),
      consultas: n(p.consultas),
      consultas_30: n(p.consultas_30),
      consultas_7: n(p.consultas_7),
      citas: n(p.citas),
      pendientes: n(p.pendientes),
      suscripciones_activas: n(p.suscripciones_activas),
      leads_30: n(p.leads_30),
    },
    visitas: visitas || null,
  });
});

// ══════════════════════════════════════════════════════════════════
//  Solicitudes de cuenta
// ══════════════════════════════════════════════════════════════════

const ESTADOS = ['pending', 'approved', 'rejected'];

router.get('/registrations', async (req, res) => {
  const estado = ESTADOS.includes(req.query.status) ? req.query.status : 'pending';
  const limite = entero(req.query.limit, 100, 500);

  const r = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.specialty, u.role,
            u.approval_status, u.approval_requested_at, u.approval_decided_at,
            u.approval_notes, u.clinic_id,
            c.name AS clinic_name, c.city AS clinic_city, c.address AS clinic_address,
            d.name AS decided_by_name
       FROM users u
       LEFT JOIN clinics c ON c.id = u.clinic_id
       LEFT JOIN users  d ON d.id = u.approval_decided_by
      WHERE u.approval_status = $1 AND u.role <> 'super_admin'
      ORDER BY COALESCE(u.approval_decided_at, u.approval_requested_at, u.created_at) DESC NULLS LAST
      LIMIT $2`,
    [estado, limite],
  );

  const conteos = await query(
    `SELECT approval_status, COUNT(*)::int AS total
       FROM users WHERE role <> 'super_admin' GROUP BY 1`,
  );
  const totales = { pending: 0, approved: 0, rejected: 0 };
  for (const fila of conteos.rows) totales[fila.approval_status] = fila.total;

  res.json({ status: estado, totales, solicitudes: r.rows });
});

// Resuelve una solicitud. Aprobar y rechazar comparten casi todo —la misma
// comprobación, la misma escritura, el mismo aviso— así que comparten función:
// dos copias del mismo UPDATE es como se acaban abriendo agujeros entre una y
// otra.
async function resolver(req, res, decision) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido.' });

  const motivo = String((req.body && req.body.reason) || '').trim().slice(0, 400);
  if (id === req.user.id) {
    return res.status(400).json({ error: 'No puedes cambiar el estado de tu propia cuenta.' });
  }

  // Un super_admin no se aprueba ni se rechaza desde aquí: es el operador de la
  // plataforma, no un cliente esperando su turno.
  const r = await query(
    `UPDATE users
        SET approval_status = $1,
            approval_decided_at = CURRENT_TIMESTAMP,
            approval_decided_by = $2,
            approval_notes = $3
      WHERE id = $4 AND role <> 'super_admin'
      RETURNING id, name, email, clinic_id, approval_status`,
    [decision, req.user.id, decision === 'rejected' ? motivo : '', id],
  );
  if (r.rowCount === 0) return res.status(404).json({ error: 'Solicitud no encontrada.' });
  const usuario = r.rows[0];

  if (decision === 'rejected') {
    // Si la cuenta llegó a estar aprobada y tenía sesión abierta, se corta aquí:
    // el JWT vive 24 h y `authenticate` valida contra user_sessions, así que
    // revocar la fila la deja fuera en la siguiente petición.
    await query(
      `UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND revoked_at IS NULL`,
      [id],
    );
  } else if (usuario.clinic_id) {
    // La caché del guardián de suscripción guarda el veredicto 60 s por clínica.
    subscription.invalidate(usuario.clinic_id);
  }

  // El correo va después de que el cambio esté guardado y nunca puede fallarlo.
  const aviso =
    decision === 'approved'
      ? mailer.sendAccountApproved({ to: usuario.email, doctorName: usuario.name })
      : mailer.sendAccountRejected({ to: usuario.email, doctorName: usuario.name, reason: motivo });
  const notificado = await aviso.catch(() => false);

  res.json({ ok: true, id: usuario.id, approval_status: usuario.approval_status, notificado });
}

router.post('/registrations/:id/approve', (req, res) => resolver(req, res, 'approved'));
router.post('/registrations/:id/reject', (req, res) => resolver(req, res, 'rejected'));

// ══════════════════════════════════════════════════════════════════
//  Reportes por clínica
// ══════════════════════════════════════════════════════════════════
//
// Una fila por clínica con su volumen de uso. Nada de dinero de la clínica: lo
// que factura cada consultorio es información de su negocio, no de la
// plataforma. Lo que sí sale es el estado de SU suscripción con nosotros, que
// es la relación que este panel administra.

router.get('/clinics-report', async (req, res) => {
  const r = await query(`
    SELECT c.id,
           c.name,
           COALESCE(c.city, '')        AS city,
           COALESCE(c.specialties, '') AS specialties,
           c.created_at,
           (SELECT COUNT(*)::int FROM users u
             WHERE u.clinic_id = c.id AND u.role IN ('doctor','clinic_admin','receptionist')
               AND u.approval_status = 'approved')                                 AS personal,
           (SELECT COUNT(*)::int FROM users u
             WHERE u.clinic_id = c.id AND u.approval_status = 'pending')            AS personal_pendiente,
           (SELECT COUNT(*)::int FROM patients p WHERE p.clinic_id = c.id)          AS pacientes,
           (SELECT COUNT(*)::int FROM consultations k WHERE k.clinic_id = c.id)     AS consultas,
           (SELECT COUNT(*)::int FROM consultations k
             WHERE k.clinic_id = c.id AND k.created_at >= NOW() - INTERVAL '30 days') AS consultas_30,
           (SELECT COUNT(*)::int FROM appointments a WHERE a.clinic_id = c.id)      AS citas,
           (SELECT COUNT(*)::int FROM appointments a
             WHERE a.clinic_id = c.id AND a.created_at >= NOW() - INTERVAL '30 days') AS citas_30,
           (SELECT COUNT(*)::int FROM clinic_landing_leads l
             WHERE l.clinic_id = c.id AND l.created_at >= NOW() - INTERVAL '30 days') AS leads_30,
           (SELECT MAX(k.created_at) FROM consultations k WHERE k.clinic_id = c.id) AS ultima_consulta,
           s.status        AS plan_status,
           s.current_period_end AS plan_hasta,
           (SELECT email FROM users u
             WHERE u.clinic_id = c.id AND u.role IN ('clinic_admin','doctor')
             ORDER BY CASE u.role WHEN 'clinic_admin' THEN 0 ELSE 1 END, u.id LIMIT 1) AS contacto
      FROM clinics c
      LEFT JOIN LATERAL (
        SELECT status, current_period_end
          FROM subscriptions
         WHERE clinic_id = c.id
         ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'trialing' THEN 1 ELSE 2 END, created_at DESC
         LIMIT 1
      ) s ON TRUE
     ORDER BY consultas_30 DESC, c.name ASC
  `);
  res.json(r.rows);
});

// ══════════════════════════════════════════════════════════════════
//  Bitácora de actividad
// ══════════════════════════════════════════════════════════════════
//
// Se arma leyendo las marcas de tiempo que las propias tablas ya guardan, en vez
// de escribir un evento aparte en cada operación: así refleja lo que de verdad
// pasó, no lo que alguien se acordó de registrar. Las filas anteriores a que
// existiera created_at quedan fuera (su fecha es NULL) — nadie sabe cuándo se
// crearon y colocarlas en una fecha inventada sería peor que no mostrarlas.

router.get('/activity', async (req, res) => {
  const limite = entero(req.query.limit, 60, 200);
  const dias = entero(req.query.days, 90, 365);
  const clinicId = parseInt(req.query.clinic_id, 10);
  const filtroClinica = Number.isInteger(clinicId) ? clinicId : null;

  const r = await query(
    `SELECT tipo, cuando, clinica, clinic_id, actor, detalle, importe
       FROM (
         SELECT 'solicitud'::text AS tipo, u.approval_requested_at AS cuando,
                COALESCE(c.name,'')::text AS clinica, u.clinic_id,
                COALESCE(u.name,'')::text AS actor,
                COALESCE(NULLIF(u.specialty,''),'')::text AS detalle,
                NULL::numeric AS importe
           FROM users u LEFT JOIN clinics c ON c.id = u.clinic_id
          WHERE u.approval_requested_at IS NOT NULL

         UNION ALL
         SELECT CASE WHEN u.approval_status = 'approved' THEN 'aprobada' ELSE 'rechazada' END,
                u.approval_decided_at, COALESCE(c.name,''), u.clinic_id,
                COALESCE(u.name,''), COALESCE(u.approval_notes,''), NULL
           FROM users u LEFT JOIN clinics c ON c.id = u.clinic_id
          WHERE u.approval_decided_at IS NOT NULL AND u.role <> 'super_admin'

         UNION ALL
         SELECT 'clinica', c.created_at, c.name, c.id, '', COALESCE(c.city,''), NULL
           FROM clinics c WHERE c.created_at IS NOT NULL

         UNION ALL
         SELECT 'consulta', k.created_at, c.name, c.id,
                COALESCE(d.name,''), COALESCE(NULLIF(k.specialty,''),''), NULL
           FROM consultations k
           JOIN clinics c ON c.id = k.clinic_id
           LEFT JOIN users d ON d.id = k.doctor_id
          WHERE k.created_at IS NOT NULL

         UNION ALL
         SELECT 'cita', a.created_at, c.name, c.id,
                COALESCE(d.name,''), COALESCE(a.source,'manual'), NULL
           FROM appointments a
           JOIN clinics c ON c.id = a.clinic_id
           LEFT JOIN users d ON d.id = a.doctor_id
          WHERE a.created_at IS NOT NULL

         UNION ALL
         SELECT 'paciente', p.created_at, c.name, c.id, '', '', NULL
           FROM patients p JOIN clinics c ON c.id = p.clinic_id
          WHERE p.created_at IS NOT NULL

         UNION ALL
         SELECT 'contacto', l.created_at, c.name, c.id, '', COALESCE(l.source,'landing'), NULL
           FROM clinic_landing_leads l JOIN clinics c ON c.id = l.clinic_id

         UNION ALL
         SELECT 'pago', pg.created_at, COALESCE(c.name,''), pg.clinic_id, '', pg.status, pg.amount
           FROM payments pg LEFT JOIN clinics c ON c.id = pg.clinic_id
       ) AS eventos
      WHERE cuando IS NOT NULL
        AND cuando >= NOW() - ($1 || ' days')::interval
        AND ($2::int IS NULL OR clinic_id = $2::int)
      ORDER BY cuando DESC
      LIMIT $3`,
    [String(dias), filtroClinica, limite],
  );
  res.json(r.rows);
});

// ══════════════════════════════════════════════════════════════════
//  Visitas de la web pública
// ══════════════════════════════════════════════════════════════════

router.get('/visits', async (req, res) => {
  const dias = entero(req.query.days, 30, 365);
  res.json(await analytics.resumen({ dias }));
});

module.exports = router;
