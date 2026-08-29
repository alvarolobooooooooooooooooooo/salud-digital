// ── Periodos de prueba concedidos por el administrador ──
//
// Dos mitades: las comprobaciones puras (la regla de acceso y el "procesador"
// de cortesía) corren siempre; las que tocan la BD solo con
//     BILLING_TEST_DB=1 npm run test:db
// y crean su propia clínica, que borran al terminar.
//
// Lo que se protege aquí es lo que costaría dinero si se rompiera: que una
// prueba caducada NO siga abriendo la plataforma, que extenderla no regale
// menos meses de los prometidos, y que pagar durante la prueba no se coma los
// días que quedaban.

const test = require('node:test');
const assert = require('node:assert');

const activo = process.env.BILLING_TEST_DB === '1';
const saltar = { skip: activo ? false : 'requiere BILLING_TEST_DB=1 y DATABASE_URL' };

if (activo) require('dotenv').config({ quiet: true });

const { query, pool } = activo ? require('../db') : { query: null, pool: null };
const provider = require('../lib/payments/provider');
const subs = require('../lib/billing/subscription-service');

const SUFIJO = 'c' + Date.now().toString(36);
let clinicId = null;

// ══════════════ Sin base de datos ══════════════

test('una prueba con la fecha pasada NO da acceso, aunque nadie la haya caducado', () => {
  const ayer = new Date(Date.now() - 86400000);
  const acceso = subs.access({ status: 'trialing', current_period_end: ayer });
  assert.equal(acceso.active, false);
  assert.equal(acceso.reason, 'trial_expired');
});

test('una prueba vigente da acceso', () => {
  const manana = new Date(Date.now() + 86400000);
  assert.equal(subs.access({ status: 'trialing', current_period_end: manana }).active, true);
});

test('una prueba sin fecha sigue dando acceso (la confirmó el procesador)', () => {
  assert.equal(subs.access({ status: 'trialing', current_period_end: null }).active, true);
});

test('el procesador de cortesía existe, no cobra y no se ofrece como forma de pago', () => {
  const cortesia = provider.getProvider('cortesia');
  assert.equal(cortesia.name, 'cortesia');
  // 'none' es lo que lo deja fuera del ciclo de cobro y de la renovación manual.
  assert.equal(cortesia.capabilities.recurring, 'none');
  assert.equal(cortesia.isConfigured(), false);
  assert.ok(!provider.enabledProviderNames().includes('cortesia'), 'nunca se ofrece al cliente');
});

test('ni siquiera configurándolo a mano se convierte en el procesador por defecto', () => {
  const previo = process.env.PAYMENTS_PROVIDER;
  process.env.PAYMENTS_PROVIDER = 'cortesia';
  try {
    assert.notEqual(provider.nombreProviderPorDefecto(), 'cortesia');
  } finally {
    if (previo === undefined) delete process.env.PAYMENTS_PROVIDER;
    else process.env.PAYMENTS_PROVIDER = previo;
  }
});

// ══════════════ Con base de datos ══════════════

test.before(async () => {
  if (!activo) return;
  const c = await query('INSERT INTO clinics (name) VALUES ($1) RETURNING id', ['ZZ Prueba ' + SUFIJO]);
  clinicId = c.rows[0].id;
});

test.after(async () => {
  if (!activo) return;
  await query('DELETE FROM payments WHERE clinic_id = $1', [clinicId]);
  await query('DELETE FROM subscriptions WHERE clinic_id = $1', [clinicId]);
  await query('DELETE FROM clinics WHERE id = $1', [clinicId]);
  await pool.end();
});

test('conceder una prueba deja a la clínica trabajando desde ya', saltar, async () => {
  const r = await subs.grantTrial({ clinicId, months: 6, note: 'test' });
  assert.equal(r.subscription.status, 'trialing');
  assert.equal(r.subscription.provider, 'cortesia');
  assert.equal(r.extended, false);
  assert.equal(subs.access(r.subscription).active, true);

  // El importe es el del plan, no cero: es lo que habrá que cobrar después.
  assert.ok(Number(r.subscription.amount) > 0);

  const dias = Math.round((r.trialEndsAt - Date.now()) / 86400000);
  assert.ok(dias > 175 && dias < 190, 'seis meses, y no otra cosa: ' + dias + ' días');
});

test('extender encadena desde el final y no abre una segunda prueba', saltar, async () => {
  const r = await subs.grantTrial({ clinicId, months: 6 });
  assert.equal(r.extended, true);

  const dias = Math.round((r.trialEndsAt - Date.now()) / 86400000);
  assert.ok(dias > 355 && dias < 375, 'seis + seis son doce, no seis: ' + dias + ' días');

  const filas = await query(
    "SELECT COUNT(*)::int AS n FROM subscriptions WHERE clinic_id = $1 AND provider = 'cortesia'",
    [clinicId],
  );
  assert.equal(filas.rows[0].n, 1, 'una clínica no acumula filas de cortesía');
});

test('al vencer, la prueba caduca y la clínica pierde el acceso', saltar, async () => {
  await query(
    "UPDATE subscriptions SET current_period_end = NOW() - INTERVAL '1 day' WHERE clinic_id = $1 AND provider = 'cortesia'",
    [clinicId],
  );
  await subs.expireOverdue();
  const sub = await subs.getForClinic(clinicId);
  assert.equal(sub.status, 'expired');
  assert.equal(subs.access(sub).active, false);
});

test('pagar durante la prueba no se come los días que quedaban', saltar, async () => {
  await query(
    `UPDATE subscriptions
        SET status = 'trialing',
            current_period_end = NOW() + INTERVAL '90 days',
            trial_ends_at = NOW() + INTERVAL '90 days'
      WHERE clinic_id = $1 AND provider = 'cortesia'`,
    [clinicId],
  );

  const dePago = await query(
    `INSERT INTO subscriptions (clinic_id, provider, provider_subscription_id, status, plan_id,
                                amount, currency, billing_interval, interval_count)
     SELECT $1, 'paypal_onetime', $2, 'incomplete', id, amount, currency, 'month', 1
       FROM plans WHERE code = 'individual-monthly' RETURNING *`,
    [clinicId, 'zzsub-' + SUFIJO],
  );

  const cobrada = await subs.markPaymentSucceeded(
    { ...dePago.rows[0], amount: Number(dePago.rows[0].amount) },
    { amount: 19.99, currency: 'USD', providerPaymentId: 'zzpay-' + SUFIJO, paidAt: new Date() },
  );

  const dias = Math.round((new Date(cobrada.current_period_end) - Date.now()) / 86400000);
  assert.ok(dias > 115 && dias < 125, 'el mes pagado empieza tras la prueba: ' + dias + ' días');

  const cortesia = await query(
    "SELECT status FROM subscriptions WHERE clinic_id = $1 AND provider = 'cortesia'",
    [clinicId],
  );
  assert.equal(cortesia.rows[0].status, 'expired', 'el cobro cierra la prueba');

  const manda = await subs.getForClinic(clinicId);
  assert.equal(manda.provider, 'paypal_onetime', 'a partir de aquí manda la de pago');
});

test('no se regalan meses a quien ya está pagando', saltar, async () => {
  await assert.rejects(
    () => subs.grantTrial({ clinicId, months: 6 }),
    (err) => err.code === 'already_subscribed',
  );
});

test('la duración se valida', saltar, async () => {
  await assert.rejects(() => subs.grantTrial({ clinicId, months: 99 }), (e) => e.code === 'invalid_trial_length');
  await assert.rejects(() => subs.grantTrial({ clinicId, months: 0 }), (e) => e.code === 'invalid_trial_length');
  await assert.rejects(() => subs.grantTrial({ clinicId: null, months: 6 }), (e) => e.code === 'no_clinic');
});
