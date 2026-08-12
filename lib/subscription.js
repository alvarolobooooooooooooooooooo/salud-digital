// ── Estado de la suscripción de la plataforma ──
// Lógica compartida entre las rutas de facturación (/api/billing) y el guardián
// que bloquea la app cuando no hay suscripción activa (middleware/subscription).
//
// Regla de acceso (decidida con el dueño de la plataforma):
//   • ACTIVE                         → acceso
//   • CANCELLED / SUSPENDED con next_billing_time en el futuro → acceso hasta
//     esa fecha (el mes ya se cobró; cortar antes sería quedarse con el dinero)
//   • cualquier otra cosa            → sin acceso
//
// PayPal es la fuente de verdad: la tabla local es una copia que se refresca por
// webhook y, como red de seguridad, cada vez que el dueño abre /plan.html.

const { query } = require('../db');
const paypal = require('./paypal');

// Roles que "consumen" la plataforma y por tanto quedan sujetos al pago.
// 'patient' queda fuera a propósito: el paciente no es el cliente, solo mira su
// propio expediente desde el portal. 'super_admin' es el operador de la
// plataforma (tú) y nunca se bloquea, o un fallo de PayPal te dejaría fuera.
const ENFORCED_ROLES = ['clinic_admin', 'doctor', 'receptionist'];

// El bloqueo solo se activa si PayPal está configurado. En local, sin
// credenciales, la app funciona normal (si no, no se podría ni desarrollar).
// BILLING_ENFORCEMENT=off es la palanca de emergencia para desactivarlo en
// producción sin tocar código.
function enforcementEnabled() {
  if (String(process.env.BILLING_ENFORCEMENT || '').trim().toLowerCase() === 'off') return false;
  return paypal.isConfigured();
}

// Clínicas exentas del cobro (demos, la tuya propia). Lista de ids separados por coma.
function exemptClinicIds() {
  return String(process.env.BILLING_EXEMPT_CLINIC_IDS || '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n));
}

function isExemptClinic(clinicId) {
  return exemptClinicIds().includes(Number(clinicId));
}

// Suscripción vigente de una clínica: la ACTIVE si existe, si no la más reciente.
async function getClinicSubscription(clinicId) {
  if (!clinicId) return null;
  const r = await query(
    `SELECT * FROM subscriptions
      WHERE clinic_id = $1
      ORDER BY (CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END),
               COALESCE(next_billing_time, created_at) DESC,
               id DESC
      LIMIT 1`,
    [clinicId],
  );
  return r.rows[0] || null;
}

function accessFromSubscription(sub) {
  if (!sub) return { active: false, reason: 'none' };
  const status = String(sub.status || '').toUpperCase();
  if (status === 'ACTIVE') return { active: true, reason: 'active' };
  if (
    (status === 'CANCELLED' || status === 'SUSPENDED') &&
    sub.next_billing_time &&
    new Date(sub.next_billing_time).getTime() > Date.now()
  ) {
    return { active: true, reason: 'paid_through' };
  }
  return { active: false, reason: status.toLowerCase() || 'inactive' };
}

// ── Caché de estado por clínica ──
// El guardián corre en CADA request a /api; sin caché sería un SELECT extra por
// llamada. 60s de TTL es suficientemente fresco para cobros mensuales y se
// invalida a mano en cuanto cambiamos el estado (webhook, alta, cancelación).
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // clinicId → { access, at }

function invalidate(clinicId) {
  cache.delete(Number(clinicId));
}

async function clinicHasAccess(clinicId) {
  const key = Number(clinicId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.access;

  const sub = await getClinicSubscription(key);
  const access = accessFromSubscription(sub);
  cache.set(key, { access, at: Date.now() });
  return access;
}

// ── Escritura: volcar a la BD lo que dice PayPal ──
// `resource` es el objeto subscription de la API v1 (el mismo shape que llega
// dentro de los webhooks BILLING.SUBSCRIPTION.*).
async function upsertFromPayPal(resource, { clinicId, userId } = {}) {
  if (!resource || !resource.id) return null;

  const billing = resource.billing_info || {};
  const lastPayment = billing.last_payment || {};
  const amount =
    (billing.last_payment && billing.last_payment.amount && billing.last_payment.amount.value) ||
    (resource.plan && resource.plan.billing_cycles && resource.plan.billing_cycles[0] &&
      resource.plan.billing_cycles[0].pricing_scheme &&
      resource.plan.billing_cycles[0].pricing_scheme.fixed_price &&
      resource.plan.billing_cycles[0].pricing_scheme.fixed_price.value) ||
    paypal.price();
  const currencyCode =
    (lastPayment.amount && lastPayment.amount.currency_code) || paypal.currency();

  const subscriber = resource.subscriber || {};
  const subscriberName = [subscriber.name && subscriber.name.given_name, subscriber.name && subscriber.name.surname]
    .filter(Boolean)
    .join(' ');

  const status = String(resource.status || '').toUpperCase() || 'APPROVAL_PENDING';
  const cancelledAt = status === 'CANCELLED' || status === 'EXPIRED' ? new Date() : null;

  // custom_id lleva el clinic_id: en los webhooks es la única pista de a quién
  // pertenece la suscripción si la fila local aún no existiera.
  const resolvedClinicId = clinicId || parseInt(resource.custom_id, 10) || null;
  if (!resolvedClinicId) return null;

  const r = await query(
    `INSERT INTO subscriptions
       (clinic_id, user_id, provider, external_id, plan_id, status, amount, currency,
        subscriber_email, subscriber_name, start_time, next_billing_time,
        last_payment_at, last_payment_amount, cancelled_at, updated_at)
     VALUES ($1, $2, 'paypal', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
     ON CONFLICT (external_id) DO UPDATE SET
       status = EXCLUDED.status,
       plan_id = EXCLUDED.plan_id,
       amount = EXCLUDED.amount,
       currency = EXCLUDED.currency,
       subscriber_email = COALESCE(NULLIF(EXCLUDED.subscriber_email, ''), subscriptions.subscriber_email),
       subscriber_name = COALESCE(NULLIF(EXCLUDED.subscriber_name, ''), subscriptions.subscriber_name),
       start_time = COALESCE(EXCLUDED.start_time, subscriptions.start_time),
       next_billing_time = EXCLUDED.next_billing_time,
       last_payment_at = COALESCE(EXCLUDED.last_payment_at, subscriptions.last_payment_at),
       last_payment_amount = COALESCE(EXCLUDED.last_payment_amount, subscriptions.last_payment_amount),
       cancelled_at = COALESCE(EXCLUDED.cancelled_at, subscriptions.cancelled_at),
       user_id = COALESCE(subscriptions.user_id, EXCLUDED.user_id),
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      resolvedClinicId,
      userId || null,
      resource.id,
      resource.plan_id || '',
      status,
      amount,
      currencyCode,
      subscriber.email_address || '',
      subscriberName,
      resource.start_time || null,
      billing.next_billing_time || null,
      lastPayment.time || null,
      (lastPayment.amount && lastPayment.amount.value) || null,
      cancelledAt,
    ],
  );

  const row = r.rows[0];
  invalidate(resolvedClinicId);
  await syncClinicPlanColumns(resolvedClinicId, row);
  return row;
}

// Las columnas plan_* de `clinics` son anteriores a esto y las lee la API de la
// clínica; se mantienen alineadas para que no muestren un estado fantasma.
async function syncClinicPlanColumns(clinicId, sub) {
  const access = accessFromSubscription(sub);
  try {
    await query(
      `UPDATE clinics
          SET plan_type = 'individual',
              plan_status = $2,
              plan_expires_at = $3,
              billing_cycle = 'monthly'
        WHERE id = $1`,
      [clinicId, access.active ? 'active' : 'inactive', (sub && sub.next_billing_time) || null],
    );
  } catch (_) {
    // No es crítico: el acceso se decide con la tabla subscriptions.
  }
}

// Registra un cobro mensual. Idempotente por external_payment_id.
async function recordPayment({ externalSubscriptionId, paymentId, amount, currencyCode, status, paidAt }) {
  if (!externalSubscriptionId || !paymentId) return null;
  const subRow = await query('SELECT id, clinic_id FROM subscriptions WHERE external_id = $1', [
    externalSubscriptionId,
  ]);
  const local = subRow.rows[0] || null;

  await query(
    `INSERT INTO subscription_payments
       (subscription_id, external_subscription_id, external_payment_id, amount, currency, status, paid_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (external_payment_id) DO NOTHING`,
    [
      local ? local.id : null,
      externalSubscriptionId,
      paymentId,
      amount || 0,
      currencyCode || paypal.currency(),
      status || 'COMPLETED',
      paidAt || new Date(),
    ],
  );

  if (local) {
    await query(
      `UPDATE subscriptions
          SET last_payment_at = $2, last_payment_amount = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [local.id, paidAt || new Date(), amount || 0],
    );
    invalidate(local.clinic_id);
  }
  return local;
}

module.exports = {
  ENFORCED_ROLES,
  enforcementEnabled,
  isExemptClinic,
  getClinicSubscription,
  accessFromSubscription,
  clinicHasAccess,
  invalidate,
  upsertFromPayPal,
  recordPayment,
};
