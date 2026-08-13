// Tests de integración del ciclo de vida completo de una suscripción.
//
// Tocan la BD, así que solo corren con BILLING_TEST_DB=1:
//     BILLING_TEST_DB=1 npm run test:db
// Crean su propia clínica y su propio plan, y lo borran todo al final.
//
// El procesador es un doble con recurring:'token' — así se ejercita también el
// camino de cobro propio (BillingService), que con PayPal nunca se usa.

const test = require('node:test');
const assert = require('node:assert');

const activo = process.env.BILLING_TEST_DB === '1';
const saltar = { skip: activo ? false : 'requiere BILLING_TEST_DB=1 y DATABASE_URL' };

if (activo) require('dotenv').config({ quiet: true });

const { query, pool } = activo ? require('../db') : { query: null, pool: null };
const provider = require('../lib/payments/provider');
const subs = require('../lib/billing/subscription-service');
const billing = require('../lib/billing/billing-service');
const webhooks = require('../lib/billing/webhook-service');

const SUFIJO = 't' + Date.now().toString(36);
let clinicId = null;
let planBasico = null;
let planPro = null;

// ── Doble de procesador ──
class ProviderFalso extends provider.PaymentProvider {
  constructor() {
    super();
    this.cobros = [];
    this.siguienteCobroFalla = false;
    this.canceladas = [];
  }
  get name() { return 'falso'; }
  get capabilities() {
    return { recurring: 'token', tokenizesCards: true, hostedFields: true, webhooks: true, refunds: true, planChanges: false };
  }
  isConfigured() { return true; }
  async createCustomer({ clinicId }) { return { customerId: 'cus_' + clinicId }; }
  async createSubscription({ plan, clinicId }) {
    return { id: 'sub_' + clinicId + '_' + Math.random().toString(36).slice(2, 8), status: 'incomplete', raw: {} };
  }
  async getSubscription(id) {
    return { id, status: 'active', currentPeriodEnd: new Date(Date.now() + 30 * 864e5), raw: {} };
  }
  async cancelSubscription(id) { this.canceladas.push(id); return { cancelled: true }; }
  async charge({ amount, currency, idempotencyKey }) {
    this.cobros.push({ amount, currency, idempotencyKey });
    if (this.siguienteCobroFalla) {
      throw new provider.PaymentError('Fondos insuficientes', { code: 'insufficient_funds', retryable: true });
    }
    return { id: 'pay_' + this.cobros.length + '_' + idempotencyKey.slice(0, 6), status: 'succeeded', amount, currency, raw: {} };
  }
}

const falso = new ProviderFalso();

test.before(async () => {
  if (!activo) return;
  provider._registerProvider('falso', falso);

  const c = await query("INSERT INTO clinics (name) VALUES ($1) RETURNING id", ['ZZ Test ' + SUFIJO]);
  clinicId = c.rows[0].id;

  const p1 = await query(
    `INSERT INTO plans (code, name, amount, currency, billing_interval, interval_count, provider_refs)
     VALUES ($1,'Básico test',10.00,'USD','month',1,'{"falso":{"plan_id":"p_basico"}}'::jsonb) RETURNING *`,
    ['test-basico-' + SUFIJO],
  );
  planBasico = p1.rows[0];
  const p2 = await query(
    `INSERT INTO plans (code, name, amount, currency, billing_interval, interval_count, provider_refs)
     VALUES ($1,'Pro test',30.00,'USD','month',1,'{"falso":{"plan_id":"p_pro"}}'::jsonb) RETURNING *`,
    ['test-pro-' + SUFIJO],
  );
  planPro = p2.rows[0];
});

test.after(async () => {
  if (!activo) return;
  await query('DELETE FROM payments WHERE clinic_id = $1', [clinicId]);
  await query('DELETE FROM payment_methods WHERE clinic_id = $1', [clinicId]);
  await query('DELETE FROM subscriptions WHERE clinic_id = $1', [clinicId]);
  await query('DELETE FROM plans WHERE code LIKE $1', ['test-%' + SUFIJO]);
  await query('DELETE FROM payment_events WHERE provider_event_id LIKE $1', ['evt-' + SUFIJO + '%']);
  await query('DELETE FROM clinics WHERE id = $1', [clinicId]);
  await pool.end();
});

test('alta: la suscripción nace incompleta y NO da acceso', saltar, async () => {
  const r = await subs.start({
    clinicId,
    planCode: planBasico.code,
    email: 'test@ejemplo.com',
    name: 'Test',
    providerName: 'falso',
  });
  assert.equal(r.subscription.status, 'incomplete');
  assert.equal(subs.access(r.subscription).active, false, 'sin pago confirmado no hay acceso');
});

test('el primer cobro la activa y fija el periodo', saltar, async () => {
  const sub = await subs.getForClinic(clinicId);
  const actualizada = await subs.markPaymentSucceeded(sub, {
    amount: 10, currency: 'USD', providerPaymentId: 'pay-inicial-' + SUFIJO,
  });
  assert.equal(actualizada.status, 'active');
  assert.ok(actualizada.current_period_end, 'debe quedar fijado el fin de periodo');
  assert.equal(subs.access(actualizada).active, true);

  const pagos = await query('SELECT * FROM payments WHERE clinic_id = $1', [clinicId]);
  assert.equal(pagos.rowCount, 1);
  assert.equal(pagos.rows[0].status, 'succeeded');
});

test('un cobro fallido pasa a past_due sin cortar el acceso ya pagado', saltar, async () => {
  const sub = await subs.getForClinic(clinicId);
  const actualizada = await subs.markPaymentFailed(sub, { reason: 'tarjeta rechazada', code: 'declined' });

  assert.equal(actualizada.status, 'past_due');
  assert.equal(actualizada.failed_attempts, 1);
  assert.equal(subs.access(actualizada).active, true, 'el mes pagado sigue valiendo');
});

test('agotados los reintentos cae a payment_failed', saltar, async () => {
  let sub = await subs.getForClinic(clinicId);
  const max = subs.maxReintentos();
  for (let i = sub.failed_attempts; i < max; i++) {
    sub = await subs.markPaymentFailed(sub, { reason: 'otra vez', maxAttempts: max });
  }
  assert.equal(sub.status, 'payment_failed');
});

test('un cobro correcto recupera la suscripción y limpia los intentos', saltar, async () => {
  const sub = await subs.getForClinic(clinicId);
  const actualizada = await subs.markPaymentSucceeded(sub, {
    amount: 10, currency: 'USD', providerPaymentId: 'pay-recupera-' + SUFIJO,
  });
  assert.equal(actualizada.status, 'active');
  assert.equal(actualizada.failed_attempts, 0);
});

test('BillingService cobra lo vencido con el token y avanza el periodo', saltar, async () => {
  let sub = await subs.getForClinic(clinicId);

  const pm = await query(
    `INSERT INTO payment_methods (clinic_id, provider, provider_token, brand, last4, is_default)
     VALUES ($1,'falso','tok_test','visa','4242',TRUE) RETURNING id`,
    [clinicId],
  );
  await query('UPDATE subscriptions SET payment_method_id = $2, next_billing_at = NOW() - INTERVAL \'1 hour\' WHERE id = $1', [sub.id, pm.rows[0].id]);
  sub = await subs.getForClinic(clinicId);

  const antes = falso.cobros.length;
  const r = await billing.chargeSubscription(sub);

  assert.equal(r.ok, true);
  assert.equal(falso.cobros.length, antes + 1, 'debe haber llamado al procesador una vez');
  assert.ok(new Date(r.subscription.current_period_end) > new Date(), 'el periodo se renovó');
});

test('nunca se cobra dos veces el mismo periodo (clave de idempotencia estable)', saltar, async () => {
  const sub = await subs.getForClinic(clinicId);
  const c1 = billing._claveIdempotencia(sub);
  const c2 = billing._claveIdempotencia(sub);
  assert.equal(c1, c2, 'la misma suscripción y fecha producen la misma clave');
});

test('un fallo reprograma el reintento en vez de romper la suscripción', saltar, async () => {
  let sub = await subs.getForClinic(clinicId);
  await query("UPDATE subscriptions SET next_billing_at = NOW() - INTERVAL '1 hour', failed_attempts = 0, status='active' WHERE id = $1", [sub.id]);
  sub = await subs.getForClinic(clinicId);

  falso.siguienteCobroFalla = true;
  const r = await billing.chargeSubscription(sub);
  falso.siguienteCobroFalla = false;

  assert.equal(r.ok, false);
  assert.equal(r.subscription.status, 'past_due');
  assert.ok(r.subscription.next_billing_at, 'debe quedar programado el reintento');
  assert.ok(new Date(r.subscription.next_billing_at) > new Date(), 'el reintento es futuro');
});

test('cambio de plan: prorratea y actualiza importe e intervalo', saltar, async () => {
  let sub = await subs.getForClinic(clinicId);
  await query("UPDATE subscriptions SET status='active', current_period_start=NOW() - INTERVAL '15 days', current_period_end=NOW() + INTERVAL '15 days' WHERE id=$1", [sub.id]);
  sub = await subs.getForClinic(clinicId);

  const r = await subs.changePlan(sub, { planCode: planPro.code });
  assert.equal(Number(r.subscription.amount), 30);
  assert.ok(r.proration.unusedCredit > 0, 'debe haber crédito por lo no consumido');
  assert.ok(r.proration.newCharge > 0);
});

test('cancelar detiene los cobros pero respeta el periodo pagado', saltar, async () => {
  const sub = await subs.getForClinic(clinicId);
  const actualizada = await subs.cancel(sub, { reason: 'prueba' });

  assert.equal(actualizada.status, 'cancelled');
  assert.equal(actualizada.next_billing_at, null, 'no debe quedar ningún cobro programado');
  assert.ok(falso.canceladas.length > 0, 'debe avisar al procesador');
  assert.equal(subs.access(actualizada).active, true, 'conserva lo pagado');
  assert.equal(subs.access(actualizada).reason, 'paid_through');
});

test('una cancelada no entra en el ciclo de cobro', saltar, async () => {
  const sub = await subs.getForClinic(clinicId);
  const r = await billing.chargeSubscription(sub);
  assert.equal(r.ok, false);
  assert.match(r.skipped, /cancelled/);
});

test('al vencer el periodo, la cancelada expira y pierde el acceso', saltar, async () => {
  const sub = await subs.getForClinic(clinicId);
  await query("UPDATE subscriptions SET current_period_end = NOW() - INTERVAL '1 day' WHERE id = $1", [sub.id]);

  const n = await subs.expireOverdue();
  assert.ok(n >= 1);

  const final = await subs.getForClinic(clinicId);
  assert.equal(final.status, 'expired');
  assert.equal(subs.access(final).active, false);
});

// ── Webhooks ──

test('el mismo evento no se procesa dos veces', saltar, async () => {
  const evento = {
    eventId: 'evt-' + SUFIJO + '-dup',
    type: 'payment.succeeded',
    providerType: 'PAYMENT.SALE.COMPLETED',
    verified: true,
    raw: { id: 'evt-' + SUFIJO + '-dup' },
  };

  const primero = await webhooks._registrarEvento('falso', evento, 'pending');
  assert.equal(primero.duplicado, false);

  const segundo = await webhooks._registrarEvento('falso', evento, 'pending');
  assert.equal(segundo.duplicado, true, 'el UNIQUE debe impedir el reproceso');
});

test('un evento sin suscripción conocida se guarda sin romper nada', saltar, async () => {
  const r = await webhooks._procesar(falso, {
    eventId: 'evt-' + SUFIJO + '-huerfano',
    type: 'payment.succeeded',
    subscriptionRef: 'sub_inexistente',
    verified: true,
    raw: {},
  });
  assert.equal(r, 'suscripcion_desconocida');
});
