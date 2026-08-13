// ── SubscriptionService — el corazón del negocio ──
//
// Aquí vive TODA la lógica de suscripciones: alta, estados, renovación,
// cambio de plan, cancelación y acceso. No sabe qué procesador hay debajo: solo
// habla con la interfaz PaymentProvider. Cambiar PayPal por PixelPay no toca
// este archivo.
//
// Máquina de estados:
//
//   incomplete ──(primer cobro OK)──► active ──(cobro falla)──► past_due
//        │                              │  ▲                       │
//        │                              │  └──(cobro recuperado)───┤
//        │                              │                          ▼
//        └──(abandonada / expira)──► expired ◄──(fin de periodo)  payment_failed
//                                        ▲                          │
//   active ──(usuario cancela)──► cancelled ──────────────────────────┘
//
// Regla de acceso: manda la fecha pagada, no el estado. Si cancelas a mitad de
// mes conservas el acceso hasta current_period_end — cobrar y cortar el mismo
// día sería quedarse con el dinero.

const crypto = require('crypto');
const { query } = require('../../db');
const { getProvider, SUBSCRIPTION_STATUS, PaymentError } = require('../payments/provider');
const { addInterval, periodFrom, prorate } = require('./periods');
const AuditService = require('../audit/service');

const auditoria = new AuditService();

const ESTADOS_CON_ACCESO = [
  SUBSCRIPTION_STATUS.TRIALING,
  SUBSCRIPTION_STATUS.ACTIVE,
  SUBSCRIPTION_STATUS.PAST_DUE, // sigue dentro del periodo ya pagado
];

// ── Lectura ──

async function listPlans({ soloActivos = true } = {}) {
  const r = await query(
    `SELECT * FROM plans ${soloActivos ? 'WHERE is_active = TRUE' : ''} ORDER BY amount ASC`,
  );
  return r.rows.map(normalizarPlan);
}

async function getPlan(code) {
  const r = await query('SELECT * FROM plans WHERE code = $1', [code]);
  return r.rows[0] ? normalizarPlan(r.rows[0]) : null;
}

async function getPlanById(id) {
  const r = await query('SELECT * FROM plans WHERE id = $1', [id]);
  return r.rows[0] ? normalizarPlan(r.rows[0]) : null;
}

function normalizarPlan(fila) {
  return {
    ...fila,
    amount: Number(fila.amount),
    provider_refs: fila.provider_refs || {},
  };
}

/**
 * Suscripción vigente de una clínica: la que da acceso si existe, si no la más
 * reciente. Nunca devuelve dos.
 */
async function getForClinic(clinicId) {
  if (!clinicId) return null;
  const r = await query(
    `SELECT s.*, p.code AS plan_code, p.name AS plan_name, p.provider_refs AS plan_provider_refs
       FROM subscriptions s
       LEFT JOIN plans p ON p.id = s.plan_id
      WHERE s.clinic_id = $1
      ORDER BY (CASE WHEN s.status IN ('active','trialing','past_due') THEN 0 ELSE 1 END),
               COALESCE(s.current_period_end, s.created_at) DESC,
               s.id DESC
      LIMIT 1`,
    [clinicId],
  );
  return r.rows[0] ? normalizarSuscripcion(r.rows[0]) : null;
}

async function getByProviderRef(provider, providerSubscriptionId) {
  const r = await query(
    `SELECT s.*, p.code AS plan_code, p.name AS plan_name, p.provider_refs AS plan_provider_refs
       FROM subscriptions s LEFT JOIN plans p ON p.id = s.plan_id
      WHERE s.provider = $1 AND s.provider_subscription_id = $2`,
    [provider, providerSubscriptionId],
  );
  return r.rows[0] ? normalizarSuscripcion(r.rows[0]) : null;
}

function normalizarSuscripcion(fila) {
  return {
    ...fila,
    amount: fila.amount == null ? null : Number(fila.amount),
    metadata: fila.metadata || {},
  };
}

/**
 * ¿Esta suscripción da acceso a la plataforma?
 * Se decide por fecha pagada, no por estado — ver cabecera.
 */
function access(sub, ahora = new Date()) {
  if (!sub) return { active: false, reason: 'none' };

  const dentroDelPeriodo =
    sub.current_period_end && new Date(sub.current_period_end).getTime() > ahora.getTime();

  if (ESTADOS_CON_ACCESO.includes(sub.status)) {
    // active/trialing sin fecha (p. ej. recién activada y el webhook aún no
    // trajo el periodo) se considera con acceso: el estado ya lo confirmó el
    // procesador.
    if (sub.status !== SUBSCRIPTION_STATUS.PAST_DUE) return { active: true, reason: sub.status };

    // En mora: se respeta un margen tras el fin del periodo. Con renovación
    // manual (el usuario tiene que pulsar "pagar") cortar el mismo día sería
    // brutal; con cobro automático, da aire a los reintentos.
    const limite = sub.current_period_end
      ? new Date(sub.current_period_end).getTime() + graceDays() * 86400000
      : 0;
    return ahora.getTime() < limite
      ? { active: true, reason: dentroDelPeriodo ? 'past_due_grace' : 'grace_period' }
      : { active: false, reason: 'past_due_expired' };
  }

  // Cancelada o pausada: el acceso dura hasta que termine lo ya pagado.
  if (
    (sub.status === SUBSCRIPTION_STATUS.CANCELLED || sub.status === SUBSCRIPTION_STATUS.PAUSED) &&
    dentroDelPeriodo
  ) {
    return { active: true, reason: 'paid_through' };
  }

  return { active: false, reason: sub.status };
}

// ── Alta ──

/**
 * Crea la suscripción en el procesador y la registra localmente en estado
 * `incomplete`. NO da acceso todavía: eso ocurre cuando el procesador confirma
 * el primer cobro (webhook o confirmación explícita).
 */
async function start({ clinicId, userId, planCode, email, name, returnUrl, cancelUrl, providerName }) {
  if (!clinicId) throw new PaymentError('La suscripción necesita una clínica', { code: 'no_clinic' });

  const plan = await getPlan(planCode || 'individual-monthly');
  if (!plan) throw new PaymentError('Plan desconocido: ' + planCode, { code: 'unknown_plan' });
  if (!plan.is_active) throw new PaymentError('Ese plan ya no está disponible', { code: 'inactive_plan' });

  const existente = await getForClinic(clinicId);
  if (existente && access(existente).active && existente.status !== SUBSCRIPTION_STATUS.CANCELLED) {
    throw new PaymentError('Ya hay una suscripción activa para esta clínica', { code: 'already_subscribed' });
  }

  const provider = getProvider(providerName);
  if (!provider.isConfigured()) {
    throw new PaymentError('El procesador de pagos no está configurado', { code: 'provider_not_configured' });
  }

  const cliente = await provider.createCustomer({ clinicId, email, name });
  const idempotencia = crypto.randomUUID();

  const creada = await provider.createSubscription({
    plan,
    clinicId,
    customerId: cliente.customerId,
    email,
    name,
    returnUrl,
    cancelUrl,
    idempotencyKey: idempotencia,
  });

  const r = await query(
    `INSERT INTO subscriptions
       (clinic_id, user_id, provider, provider_subscription_id, provider_customer_id,
        provider_plan_id, plan_id, status, amount, currency, billing_interval, interval_count,
        subscriber_email, subscriber_name, metadata, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, CURRENT_TIMESTAMP)
     ON CONFLICT (provider_subscription_id) DO UPDATE
       SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      clinicId,
      userId || null,
      provider.name,
      creada.id,
      cliente.customerId || '',
      (plan.provider_refs[provider.name] && plan.provider_refs[provider.name].plan_id) || '',
      plan.id,
      creada.status || SUBSCRIPTION_STATUS.INCOMPLETE,
      plan.amount,
      plan.currency,
      plan.billing_interval,
      plan.interval_count,
      email || '',
      name || '',
      JSON.stringify({ idempotency_key: idempotencia }),
    ],
  );

  await auditar({ userId, clinicId, action: 'billing.subscription.started', input: { plan: plan.code, provider: provider.name } });

  return {
    subscription: normalizarSuscripcion(r.rows[0]),
    plan,
    approvalUrl: creada.approvalUrl || null,
    providerSubscriptionId: creada.id,
    capabilities: provider.capabilities,
  };
}

/**
 * Relee el estado real en el procesador y lo vuelca a la BD. Es la red de
 * seguridad de todo el sistema: si un webhook se pierde, esto lo arregla.
 */
async function syncFromProvider(sub) {
  if (!sub || !sub.provider_subscription_id) return sub;
  const provider = getProvider(sub.provider);
  const remota = await provider.getSubscription(sub.provider_subscription_id);

  const nuevoEstado = remota.status || sub.status;
  const periodoFin = remota.currentPeriodEnd || sub.current_period_end;

  const r = await query(
    `UPDATE subscriptions
        SET status = $2,
            current_period_start = COALESCE($3, current_period_start),
            current_period_end = COALESCE($4, current_period_end),
            next_billing_at = COALESCE($5, next_billing_at),
            subscriber_email = COALESCE(NULLIF($6,''), subscriber_email),
            subscriber_name = COALESCE(NULLIF($7,''), subscriber_name),
            provider_customer_id = COALESCE(NULLIF($8,''), provider_customer_id),
            failed_attempts = $9,
            cancelled_at = CASE WHEN $2 IN ('cancelled','expired') THEN COALESCE(cancelled_at, CURRENT_TIMESTAMP) ELSE cancelled_at END,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *`,
    [
      sub.id,
      nuevoEstado,
      remota.startedAt || null,
      periodoFin,
      remota.nextBillingAt || null,
      remota.subscriberEmail || '',
      remota.subscriberName || '',
      remota.customerId || '',
      remota.failedPayments || 0,
    ],
  );

  const actualizada = normalizarSuscripcion(r.rows[0]);
  await espejarEnClinica(actualizada);
  return actualizada;
}

// ── Transiciones ──

/** El procesador confirma un cobro: la suscripción entra (o sigue) activa. */
async function markPaymentSucceeded(sub, { amount, currency, paidAt = new Date(), providerPaymentId, periodEnd } = {}) {
  const plan = sub.plan_id ? await getPlanById(sub.plan_id) : null;
  const intervalo = sub.billing_interval || (plan && plan.billing_interval) || 'month';
  const cuenta = sub.interval_count || (plan && plan.interval_count) || 1;

  // El pago se registra ANTES de tocar el periodo, y si la fila ya existía
  // (mismo id de cobro) se sale sin hacer nada: es la barrera que impide que
  // un webhook repetido —o un doble clic en "pagar"— regale un mes extra.
  const filaPago = await registrarPago(sub, {
    amount: amount != null ? amount : sub.amount,
    currency: currency || sub.currency,
    status: 'succeeded',
    providerPaymentId,
    paidAt,
  });
  if (!filaPago && providerPaymentId) {
    return sub; // cobro ya contabilizado
  }

  // Renovar antes de que venza NO debe perder los días que quedan: el periodo
  // nuevo encadena desde el fin del actual, no desde hoy.
  const base =
    sub.current_period_end && new Date(sub.current_period_end).getTime() > paidAt.getTime()
      ? new Date(sub.current_period_end)
      : paidAt;

  // Si el procesador dice hasta cuándo, manda él.
  const periodo = periodEnd
    ? { start: base, end: new Date(periodEnd) }
    : periodFrom(base, intervalo, cuenta);

  const r = await query(
    `UPDATE subscriptions
        SET status = CASE WHEN status IN ('cancelled','expired') THEN status ELSE 'active' END,
            current_period_start = $2,
            current_period_end = $3,
            next_billing_at = $3,
            failed_attempts = 0,
            last_error = '',
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING *`,
    [sub.id, periodo.start, periodo.end],
  );

  // El periodo se conoce después de calcularlo: se completa en el pago.
  if (filaPago) {
    await query('UPDATE payments SET period_start = $2, period_end = $3 WHERE id = $1', [
      filaPago.id,
      periodo.start,
      periodo.end,
    ]);
  }

  const actualizada = normalizarSuscripcion(r.rows[0]);
  await espejarEnClinica(actualizada);
  await auditar({
    clinicId: sub.clinic_id,
    action: 'billing.payment.succeeded',
    input: { amount, currency, provider_payment_id: providerPaymentId },
  });
  return actualizada;
}

/**
 * Un cobro falló. No se corta el acceso de inmediato: se pasa a past_due
 * mientras queden reintentos y el periodo pagado siga vigente.
 */
async function markPaymentFailed(sub, { reason = '', code = '', maxAttempts = maxReintentos(), providerPaymentId, amount } = {}) {
  const intentos = (sub.failed_attempts || 0) + 1;
  const agotados = intentos >= maxAttempts;

  const r = await query(
    `UPDATE subscriptions
        SET status = CASE WHEN status IN ('cancelled','expired') THEN status
                          WHEN $3 THEN 'payment_failed' ELSE 'past_due' END,
            failed_attempts = $2,
            last_error = $4,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING *`,
    [sub.id, intentos, agotados, String(reason).slice(0, 400)],
  );

  await registrarPago(sub, {
    amount: amount != null ? amount : sub.amount,
    currency: sub.currency,
    status: 'failed',
    providerPaymentId,
    attempt: intentos,
    failureCode: code,
    failureMessage: reason,
  });

  const actualizada = normalizarSuscripcion(r.rows[0]);
  await espejarEnClinica(actualizada);
  await auditar({
    clinicId: sub.clinic_id,
    action: 'billing.payment.failed',
    status: 'error',
    error: String(reason).slice(0, 200),
    input: { attempt: intentos, exhausted: agotados },
  });
  return actualizada;
}

/**
 * Cancelación. Por defecto NO corta el acceso: se detienen los cobros y el
 * usuario conserva lo pagado hasta current_period_end.
 */
async function cancel(sub, { reason = '', immediate = false, userId = null } = {}) {
  const provider = getProvider(sub.provider);

  if (sub.provider_subscription_id) {
    try {
      await provider.cancelSubscription(sub.provider_subscription_id, reason || 'Cancelada por el usuario');
    } catch (err) {
      // Si el procesador ya la tenía cancelada seguimos; cualquier otro fallo
      // se propaga: no podemos prometer que no habrá más cobros si no lo sabemos.
      if (err.code !== 'unsupported_operation') throw err;
    }
  }

  const r = await query(
    `UPDATE subscriptions
        SET status = CASE WHEN $3 THEN 'expired' ELSE 'cancelled' END,
            cancel_at_period_end = NOT $3,
            cancelled_at = CURRENT_TIMESTAMP,
            cancel_reason = $2,
            next_billing_at = NULL,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING *`,
    [sub.id, String(reason).slice(0, 200), !!immediate],
  );

  const actualizada = normalizarSuscripcion(r.rows[0]);
  await espejarEnClinica(actualizada);
  await auditar({ userId, clinicId: sub.clinic_id, action: 'billing.subscription.cancelled', input: { reason, immediate } });
  return actualizada;
}

/**
 * Cambio de plan. Calcula el prorrateo del periodo en curso y delega en el
 * procesador si sabe hacerlo (PayPal /revise); si no, cancela y crea una nueva.
 */
async function changePlan(sub, { planCode, userId = null }) {
  const nuevo = await getPlan(planCode);
  if (!nuevo) throw new PaymentError('Plan desconocido: ' + planCode, { code: 'unknown_plan' });
  if (nuevo.id === sub.plan_id) return { subscription: sub, unchanged: true };

  const provider = getProvider(sub.provider);
  const ahora = new Date();

  const calculo = prorate({
    amountOld: Number(sub.amount || 0),
    amountNew: nuevo.amount,
    periodStart: sub.current_period_start ? new Date(sub.current_period_start) : ahora,
    periodEnd: sub.current_period_end ? new Date(sub.current_period_end) : addInterval(ahora, sub.billing_interval || 'month', sub.interval_count || 1),
    changeAt: ahora,
  });

  let approvalUrl = null;
  if (provider.capabilities.planChanges && sub.provider_subscription_id) {
    const r = await provider.updateSubscription(sub.provider_subscription_id, { plan: nuevo });
    approvalUrl = r.approvalUrl || null;
  }

  const r = await query(
    `UPDATE subscriptions
        SET plan_id = $2, amount = $3, currency = $4,
            billing_interval = $5, interval_count = $6,
            provider_plan_id = $7,
            metadata = metadata || $8::jsonb,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING *`,
    [
      sub.id,
      nuevo.id,
      nuevo.amount,
      nuevo.currency,
      nuevo.billing_interval,
      nuevo.interval_count,
      (nuevo.provider_refs[provider.name] && nuevo.provider_refs[provider.name].plan_id) || '',
      JSON.stringify({ last_plan_change: { at: ahora.toISOString(), from: sub.plan_code, to: nuevo.code, proration: calculo } }),
    ],
  );

  await auditar({ userId, clinicId: sub.clinic_id, action: 'billing.subscription.plan_changed', input: { from: sub.plan_code, to: nuevo.code, proration: calculo } });
  return { subscription: normalizarSuscripcion(r.rows[0]), proration: calculo, approvalUrl };
}

/**
 * Suscripciones de renovación MANUAL cuyo periodo terminó sin que el usuario
 * pagara: pasan a past_due para que la interfaz le pida el pago. No se cobra
 * nada, porque con este tipo de procesador no se puede cobrar sin él delante.
 */
async function markManualOverdue(ahora = new Date()) {
  const r = await query(
    `SELECT id, clinic_id, provider FROM subscriptions
      WHERE status IN ('active','trialing')
        AND current_period_end IS NOT NULL
        AND current_period_end < $1`,
    [ahora],
  );

  const manuales = r.rows.filter((s) => {
    try {
      return getProvider(s.provider).capabilities.recurring === 'manual';
    } catch {
      return false;
    }
  });

  for (const fila of manuales) {
    await query(
      `UPDATE subscriptions SET status = 'past_due', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [fila.id],
    );
    await espejarEnClinica({ clinic_id: fila.clinic_id, status: 'past_due', current_period_end: null });
    await auditar({ clinicId: fila.clinic_id, action: 'billing.renewal.due', input: { subscription_id: fila.id } });
  }
  return manuales.length;
}

/**
 * Caduca las suscripciones cuyo periodo pagado ya terminó.
 * `cancelled` expira justo al acabar lo pagado (no hay nada que esperar);
 * las que están en mora disfrutan del margen de gracia antes de perder acceso.
 */
async function expireOverdue(ahora = new Date()) {
  const r = await query(
    `UPDATE subscriptions
        SET status = 'expired', updated_at = CURRENT_TIMESTAMP
      WHERE current_period_end IS NOT NULL
        AND (
              (status = 'cancelled' AND current_period_end < $1)
           OR (status IN ('payment_failed','past_due')
               AND current_period_end + make_interval(days => $2) < $1)
        )
      RETURNING id, clinic_id`,
    [ahora, graceDays()],
  );
  for (const fila of r.rows) {
    await espejarEnClinica({ clinic_id: fila.clinic_id, status: 'expired', current_period_end: null });
  }
  return r.rows.length;
}

// ── Auxiliares ──

async function registrarPago(sub, { amount, currency, status, providerPaymentId, attempt = 1, failureCode = '', failureMessage = '', paidAt = null, periodStart = null, periodEnd = null }) {
  // provider_payment_id es UNIQUE por proveedor: un webhook repetido no duplica
  // la fila. Cuando no hay id (fallo local antes de llegar al procesador) se
  // genera uno interno para conservar la trazabilidad.
  const ref = providerPaymentId || `local:${sub.id}:${Date.now()}`;
  const r = await query(
    `INSERT INTO payments
       (subscription_id, clinic_id, provider, provider_payment_id, provider_subscription_id,
        payment_method_id, amount, currency, status, attempt, failure_code, failure_message,
        period_start, period_end, paid_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (provider, provider_payment_id) DO NOTHING
     RETURNING id`,
    [
      sub.id,
      sub.clinic_id,
      sub.provider,
      ref,
      sub.provider_subscription_id || '',
      sub.payment_method_id || null,
      amount || 0,
      currency || 'USD',
      status,
      attempt,
      String(failureCode || '').slice(0, 80),
      String(failureMessage || '').slice(0, 400),
      periodStart,
      periodEnd,
      status === 'succeeded' ? paidAt || new Date() : null,
    ],
  );
  return r.rows[0] || null;
}

/**
 * Espejo en `clinics.plan_*`. Esas columnas existían antes de este sistema y
 * las leen otras pantallas; se mantienen al día para no dejar un estado
 * fantasma. La fuente de verdad sigue siendo `subscriptions`.
 */
async function espejarEnClinica(sub) {
  if (!sub || !sub.clinic_id) return;
  const acceso = access(sub);

  // Invalida la caché del guardián para que el cambio de estado se note en la
  // siguiente petición y no hasta 60s después. require perezoso: lib/subscription
  // depende de este archivo y al revés (ciclo).
  try {
    require('../subscription').invalidate(sub.clinic_id);
  } catch (_) {}

  try {
    await query(
      `UPDATE clinics SET plan_status = $2, plan_expires_at = $3, billing_cycle = 'monthly' WHERE id = $1`,
      [sub.clinic_id, acceso.active ? 'active' : 'inactive', sub.current_period_end || null],
    );
  } catch (_) {
    /* no crítico */
  }
}

/** Margen tras vencer el periodo antes de cortar el acceso. */
function graceDays() {
  const n = parseInt(process.env.BILLING_GRACE_DAYS || '3', 10);
  return Number.isFinite(n) && n >= 0 ? n : 3;
}

function maxReintentos() {
  const n = parseInt(process.env.BILLING_MAX_RETRIES || '3', 10);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

async function auditar({ userId = null, clinicId = null, action, status = 'success', input = null, error = null }) {
  try {
    await auditoria.logAction({
      user_id: userId,
      clinic_id: clinicId,
      action,
      status,
      tool_input: input ? JSON.stringify(input) : null,
      error,
    });
  } catch (_) {
    /* la auditoría nunca debe tumbar un cobro */
  }
}

module.exports = {
  ESTADOS_CON_ACCESO,
  listPlans,
  getPlan,
  getPlanById,
  getForClinic,
  getByProviderRef,
  access,
  start,
  syncFromProvider,
  markPaymentSucceeded,
  markPaymentFailed,
  cancel,
  changePlan,
  expireOverdue,
  markManualOverdue,
  maxReintentos,
  graceDays,
  _registrarPago: registrarPago,
};
