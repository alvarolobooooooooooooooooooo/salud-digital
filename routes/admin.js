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
const subs = require('../lib/billing/subscription-service');
const { PaymentError } = require('../lib/payments/provider');

// Un solo guardián para todo el router: ninguna ruta nueva puede olvidarse de
// pedir el rol.
router.use(authenticate, requireRole('super_admin'));

function entero(valor, porDefecto, maximo) {
  const n = parseInt(valor, 10);
  if (!Number.isFinite(n) || n <= 0) return porDefecto;
  return Math.min(n, maximo);
}

const n = (v) => parseInt(v, 10) || 0;

/**
 * Con cuántos días de antelación empieza el panel a avisar de un cobro. Es el
 * margen para escribirle al doctor ANTES de que se le acabe la prueba o el mes
 * pagado, no después: avisar el mismo día es avisar tarde.
 */
function diasDeAviso() {
  const d = parseInt(process.env.BILLING_ALERT_DAYS || '5', 10);
  return Number.isFinite(d) && d >= 0 ? Math.min(d, 90) : 5;
}

// Los errores del motor de facturación ya vienen con un código legible; el
// resto sube al manejador global de Express.
function errorDeCobro(res, err) {
  if (err instanceof PaymentError) {
    const mapa = { already_subscribed: 409, unknown_plan: 400, inactive_plan: 400,
                   no_clinic: 400, invalid_trial_length: 400 };
    return res.status(mapa[err.code] || 400).json({ error: err.message, code: err.code });
  }
  throw err;
}

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
        (SELECT COUNT(*) FROM subscriptions
          WHERE status = 'trialing'
            AND (current_period_end IS NULL OR current_period_end >= NOW()))          AS en_prueba,
        -- Lo que hay que cobrar pronto y lo que ya se pasó de fecha van por
        -- separado: no es lo mismo "escríbele esta semana" que "ya se te pasó".
        (SELECT COUNT(*) FROM subscriptions
          WHERE status IN ('active','trialing') AND current_period_end IS NOT NULL
            AND current_period_end >= NOW()
            AND current_period_end <= NOW() + make_interval(days => $1))              AS por_cobrar,
        (SELECT COUNT(*) FROM subscriptions
          WHERE status IN ('active','trialing') AND current_period_end IS NOT NULL
            AND current_period_end < NOW())                                           AS cobros_vencidos,
        (SELECT COUNT(*) FROM subscriptions WHERE status IN ('past_due','payment_failed')) AS en_mora,
        (SELECT COUNT(*) FROM clinic_landing_leads WHERE created_at >= NOW() - INTERVAL '30 days') AS leads_30
    `, [diasDeAviso()]),
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
      en_prueba: n(p.en_prueba),
      por_cobrar: n(p.por_cobrar),
      cobros_vencidos: n(p.cobros_vencidos),
      en_mora: n(p.en_mora),
      leads_30: n(p.leads_30),
    },
    dias_aviso: diasDeAviso(),
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

  // Meses de prueba a conceder en el mismo gesto. 0 (o nada) = solo aprobar.
  const meses = parseInt((req.body && req.body.trial_months) || 0, 10) || 0;
  if (meses < 0 || meses > 24) {
    return res.status(400).json({ error: 'La prueba tiene que ir de 1 a 24 meses.' });
  }
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

  // ── Aprobar y dejarle trabajar son dos cosas distintas ──
  // Una cuenta aprobada puede entrar, pero sin suscripción no guarda ni un
  // paciente. Por eso el botón de "aprobar con prueba" concede las dos cosas de
  // una vez: es lo que el administrador quiere hacer casi siempre.
  let prueba = null;
  if (decision === 'approved' && meses > 0) {
    if (!usuario.clinic_id) {
      prueba = { error: 'Esta cuenta no tiene clínica asignada, así que no se le puede dar la prueba.' };
    } else {
      try {
        const dada = await subs.grantTrial({
          clinicId: usuario.clinic_id,
          months: meses,
          userId: usuario.id,
          grantedBy: req.user.id,
          note: 'Concedida al aprobar la solicitud',
        });
        prueba = {
          meses,
          hasta: dada.trialEndsAt,
          plan: dada.plan.name,
          extendida: dada.extended,
        };
      } catch (err) {
        // La aprobación YA está guardada y no se deshace porque la prueba
        // falle: son dos decisiones distintas y revertir la primera dejaría al
        // doctor fuera sin que nadie lo hubiera decidido. Se informa para que
        // se conceda a mano desde Suscripciones.
        prueba = { error: err.message || 'No se pudo conceder la prueba.' };
      }
    }
  }

  // El correo va después de que el cambio esté guardado y nunca puede fallarlo.
  const aviso =
    decision === 'approved'
      ? mailer.sendAccountApproved({
          to: usuario.email,
          doctorName: usuario.name,
          trialEndsAt: prueba && !prueba.error ? prueba.hasta : null,
          trialMonths: prueba && !prueba.error ? prueba.meses : 0,
        })
      : mailer.sendAccountRejected({ to: usuario.email, doctorName: usuario.name, reason: motivo });
  const notificado = await aviso.catch(() => false);

  res.json({
    ok: true,
    id: usuario.id,
    approval_status: usuario.approval_status,
    notificado,
    prueba,
  });
}

router.post('/registrations/:id/approve', (req, res) => resolver(req, res, 'approved'));
router.post('/registrations/:id/reject', (req, res) => resolver(req, res, 'rejected'));

// ══════════════════════════════════════════════════════════════════
//  Suscripciones
// ══════════════════════════════════════════════════════════════════
//
// Una fila por clínica —tenga suscripción o no—, porque la pregunta que se
// contesta aquí no es "quién paga" sino "de quién tengo que estar pendiente", y
// una clínica aprobada que nunca contrató entra de lleno en esa lista.
//
// El único dinero que aparece es el que la clínica nos paga a NOSOTROS. Lo que
// ella le cobre a sus pacientes sigue sin salir de su cuenta (ver la cabecera
// de este archivo).

/**
 * Etiqueta de urgencia de una fila. Se calcula en el servidor, y no en el
 * navegador, para que el número del aviso y el que se pinta en la tabla no
 * puedan discrepar: los cuenta el mismo criterio.
 */
function alertaDe(fila, dias) {
  if (!fila.status) return null;                       // nunca contrató
  if (fila.status === 'past_due' || fila.status === 'payment_failed') return 'mora';
  if (!['active', 'trialing'].includes(fila.status)) return null;  // cancelada, expirada…
  if (fila.dias == null) return null;                  // sin fecha que vigilar
  if (fila.dias < 0) return 'vencida';
  return fila.dias <= dias ? 'pronto' : null;
}

router.get('/subscriptions', async (req, res) => {
  const aviso = diasDeAviso();

  const r = await query(`
    SELECT c.id                          AS clinic_id,
           c.name                        AS clinic_name,
           COALESCE(c.city, '')          AS city,
           COALESCE(c.country, '')       AS country,
           c.created_at                  AS clinic_created_at,
           s.id                          AS subscription_id,
           s.provider,
           s.status,
           s.amount,
           s.currency,
           s.current_period_start,
           s.current_period_end,
           s.trial_ends_at,
           s.cancel_at_period_end,
           s.failed_attempts,
           s.created_at                  AS subscription_created_at,
           s.metadata,
           pl.name                       AS plan_name,
           pl.code                       AS plan_code,
           -- Días que faltan para el cobro. Se resta en Postgres y no en el
           -- navegador: la fecha se guarda sin zona horaria y restarla contra
           -- el reloj del cliente daba un día de diferencia según quién mirara.
           CASE WHEN s.current_period_end IS NULL THEN NULL
                ELSE FLOOR(EXTRACT(EPOCH FROM (s.current_period_end - NOW())) / 86400)::int
           END                           AS dias,
           contacto.name                 AS contacto_nombre,
           contacto.email                AS contacto,
           COALESCE(contacto.phone, '')  AS contacto_tel,
           pagos.ultimo                  AS ultimo_pago,
           COALESCE(pagos.total, 0)      AS cobros,
           COALESCE(pagos.suma, 0)       AS pagado,
           (SELECT COUNT(*)::int FROM users u
             WHERE u.clinic_id = c.id
               AND u.role IN ('doctor','clinic_admin','receptionist')
               AND u.approval_status = 'approved')                         AS personal
      FROM clinics c
      -- La misma elección que hace getForClinic: la que da acceso si existe y,
      -- si no, la más reciente. Si aquí saliera otra, el panel enseñaría un
      -- estado distinto del que de verdad gobierna el acceso de esa clínica.
      LEFT JOIN LATERAL (
        SELECT * FROM subscriptions
         WHERE clinic_id = c.id
         ORDER BY (CASE WHEN status IN ('active','trialing','past_due') THEN 0 ELSE 1 END),
                  COALESCE(current_period_end, created_at) DESC, id DESC
         LIMIT 1
      ) s ON TRUE
      LEFT JOIN plans pl ON pl.id = s.plan_id
      LEFT JOIN LATERAL (
        SELECT u.name, u.email, u.phone FROM users u
         WHERE u.clinic_id = c.id AND u.role IN ('clinic_admin','doctor')
           AND u.approval_status = 'approved'
         ORDER BY CASE u.role WHEN 'clinic_admin' THEN 0 ELSE 1 END, u.id
         LIMIT 1
      ) contacto ON TRUE
      LEFT JOIN LATERAL (
        SELECT MAX(paid_at) AS ultimo, COUNT(*)::int AS total, SUM(amount) AS suma
          FROM payments pg WHERE pg.clinic_id = c.id AND pg.status = 'succeeded'
      ) pagos ON TRUE
  `);

  const filas = r.rows.map((f) => ({
    ...f,
    amount: f.amount == null ? null : Number(f.amount),
    pagado: Number(f.pagado || 0),
    // Una prueba de cortesía no es una suscripción de pago aunque ocupe su
    // sitio: la tabla necesita distinguirlas para no prometer un cobro que
    // ningún procesador va a hacer solo.
    cortesia: f.provider === 'cortesia',
    alerta: alertaDe(f, aviso),
  }));

  const PRIORIDAD = { mora: 0, vencida: 1, pronto: 2 };
  filas.sort((a, b) => {
    const pa = PRIORIDAD[a.alerta] != null ? PRIORIDAD[a.alerta] : 3;
    const pb = PRIORIDAD[b.alerta] != null ? PRIORIDAD[b.alerta] : 3;
    if (pa !== pb) return pa - pb;
    // Dentro del mismo grupo, primero lo que vence antes. Lo que no tiene fecha
    // (sin plan) se va al final, ordenado por nombre.
    const da = a.dias == null ? Infinity : a.dias;
    const db = b.dias == null ? Infinity : b.dias;
    if (da !== db) return da - db;
    return String(a.clinic_name).localeCompare(String(b.clinic_name), 'es');
  });

  const cuenta = (fn) => filas.filter(fn).length;
  res.json({
    dias_aviso: aviso,
    resumen: {
      clinicas: filas.length,
      activas: cuenta((f) => f.status === 'active'),
      en_prueba: cuenta((f) => f.status === 'trialing' && f.alerta !== 'vencida'),
      por_cobrar: cuenta((f) => f.alerta === 'pronto'),
      vencidas: cuenta((f) => f.alerta === 'vencida'),
      en_mora: cuenta((f) => f.alerta === 'mora'),
      sin_plan: cuenta((f) => !f.status || ['expired', 'cancelled', 'incomplete'].includes(f.status)),
      // Lo que entra al mes por las suscripciones que de verdad se están
      // cobrando. Las de cortesía no suman: son gratis, y contarlas sería
      // inventarse un ingreso.
      mensual: filas
        .filter((f) => f.status === 'active' && !f.cortesia)
        .reduce((total, f) => total + (f.amount || 0), 0),
    },
    suscripciones: filas,
  });
});

/**
 * Concede o extiende una prueba gratuita. Es la misma operación que hace el
 * botón de la bandeja de solicitudes, pero apuntando a una clínica cualquiera:
 * sirve para dar aire a quien ya estaba dentro y para alargar una prueba que se
 * queda corta.
 */
router.post('/subscriptions/trial', async (req, res) => {
  const b = req.body || {};
  const clinicId = parseInt(b.clinic_id, 10);
  if (!Number.isInteger(clinicId)) return res.status(400).json({ error: 'Falta la clínica.' });

  try {
    const dada = await subs.grantTrial({
      clinicId,
      months: b.months,
      planCode: b.plan_code ? String(b.plan_code) : undefined,
      grantedBy: req.user.id,
      note: String(b.note || '').slice(0, 400),
    });
    res.json({
      ok: true,
      clinic_id: clinicId,
      meses: parseInt(b.months, 10),
      hasta: dada.trialEndsAt,
      plan: dada.plan.name,
      extendida: dada.extended,
    });
  } catch (err) {
    errorDeCobro(res, err);
  }
});

/** Catálogo de planes, para elegir cuál disfruta la prueba. */
router.get('/plans', async (req, res) => {
  const planes = await subs.listPlans();
  res.json(planes.map((p) => ({ code: p.code, name: p.name, amount: p.amount, currency: p.currency })));
});

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
//  Doctores: cuántos pacientes lleva cada uno
// ══════════════════════════════════════════════════════════════════
//
// La columna "pacientes" es EL MISMO número que el doctor ve en su Inicio, y
// eso es deliberado: si el panel contara con otra regla, el operador y el
// doctor estarían mirando dos cifras distintas del mismo dato y ninguna sería
// discutible. La regla la define routes/patients.js (consultaListado) y dice:
//
//     es mío si lo di de alta yo, o si tiene (o tuvo) una cita conmigo.
//
// La segunda mitad no sobra: en las clínicas con recepción, quien da de alta al
// paciente es la recepcionista, así que contar solo `created_by` dejaría a esos
// doctores en cero teniendo agenda llena. Por eso van las dos columnas: la de
// arriba es "cuántos lleva", `pacientes_alta` es "cuántos registró esa cuenta".
//
// Consecuencia que la pantalla tiene que decir: un paciente atendido por dos
// doctores cuenta en los dos, así que la suma de la columna puede pasarse del
// total de la plataforma. No es un error de conteo — la columna responde
// "cuántos lleva este doctor", no "cómo se reparten los pacientes".
//
// Y sigue sin salir un solo dato de paciente: todo son recuentos.

router.get('/doctors-report', async (req, res) => {
  const r = await query(`
    SELECT u.id,
           COALESCE(NULLIF(u.name, ''), u.email)   AS nombre,
           u.email,
           COALESCE(u.specialty, '')               AS especialidad,
           u.clinic_id,
           COALESCE(c.name, '')                    AS clinica,
           u.approval_status,
           u.created_at                            AS alta,
           (SELECT COUNT(*)::int FROM patients p
             WHERE p.clinic_id = u.clinic_id
               AND (p.created_by = u.id
                    OR EXISTS (SELECT 1 FROM appointments a
                                WHERE a.patient_id = p.id
                                  AND a.doctor_id = u.id
                                  AND a.clinic_id = u.clinic_id)))            AS pacientes,
           (SELECT COUNT(*)::int FROM patients p
             WHERE p.clinic_id = u.clinic_id AND p.created_by = u.id)         AS pacientes_alta,
           (SELECT COUNT(*)::int FROM consultations k WHERE k.doctor_id = u.id) AS consultas,
           (SELECT COUNT(*)::int FROM consultations k
             WHERE k.doctor_id = u.id
               AND k.created_at >= NOW() - INTERVAL '30 days')                AS consultas_30,
           (SELECT MAX(k.created_at) FROM consultations k WHERE k.doctor_id = u.id) AS ultima_consulta
      FROM users u
      LEFT JOIN clinics c ON c.id = u.clinic_id
     WHERE u.role = 'doctor'
     ORDER BY pacientes DESC, consultas_30 DESC, nombre ASC
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
