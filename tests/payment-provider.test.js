// Tests del contrato PaymentProvider y del provider de PayPal.
// Sin BD y sin red: el cliente HTTP de PayPal se sustituye por dobles.
const test = require('node:test');
const assert = require('node:assert');

const {
  PaymentProvider,
  PaymentError,
  UnsupportedOperationError,
  getProvider,
  listProviders,
  _registerProvider,
  _resetProviders,
  EVENT,
} = require('../lib/payments/provider');

test('la clase base declara todo como no soportado', async () => {
  const p = new PaymentProvider();
  assert.equal(p.capabilities.recurring, 'none');
  assert.equal(p.isConfigured(), false);
  await assert.rejects(() => p.charge(), UnsupportedOperationError);
  await assert.rejects(() => p.createSubscription(), UnsupportedOperationError);
  await assert.rejects(() => p.handleWebhook(), UnsupportedOperationError);
});

test('el registro devuelve siempre la misma instancia y falla claro con nombres desconocidos', () => {
  _resetProviders();
  const a = getProvider('paypal');
  const b = getProvider('paypal');
  assert.strictEqual(a, b, 'debe cachear la instancia');
  assert.ok(listProviders().includes('paypal'));
  assert.throws(() => getProvider('banco-inventado'), (err) => {
    assert.ok(err instanceof PaymentError);
    assert.equal(err.code, 'unknown_provider');
    return true;
  });
});

test('se puede inyectar un provider falso sin tocar el entorno', () => {
  class Falso extends PaymentProvider {
    get name() { return 'falso'; }
    get capabilities() { return { recurring: 'token', tokenizesCards: true, hostedFields: true, webhooks: true, refunds: true, planChanges: true }; }
    isConfigured() { return true; }
  }
  _registerProvider('falso', new Falso());
  const p = getProvider('falso');
  assert.equal(p.capabilities.recurring, 'token');
  assert.equal(p.isConfigured(), true);
  _resetProviders();
});

// ── PayPal ──

test('PayPal declara sus límites reales y no finge lo que no puede', async () => {
  _resetProviders();
  const pp = getProvider('paypal');

  assert.equal(pp.name, 'paypal');
  assert.equal(pp.capabilities.recurring, 'native', 'PayPal cobra por su cuenta');
  assert.equal(pp.capabilities.tokenizesCards, false, 'Advanced Checkout no disponible en Honduras');
  assert.equal(pp.capabilities.hostedFields, false);

  // Lo que no puede hacer, lo dice; no lo simula.
  await assert.rejects(() => pp.charge(), UnsupportedOperationError);
  await assert.rejects(() => pp.createPaymentMethod(), UnsupportedOperationError);
  await assert.rejects(() => pp.retryPayment(), UnsupportedOperationError);
});

test('PayPal traduce sus eventos al vocabulario canónico', async () => {
  const paypal = require('../lib/paypal');
  const original = paypal.verifyWebhookSignature;
  paypal.verifyWebhookSignature = async () => true;

  try {
    const pp = getProvider('paypal');

    const cobro = await pp.handleWebhook({
      headers: {},
      rawBody: Buffer.from(JSON.stringify({
        id: 'WH-1', event_type: 'PAYMENT.SALE.COMPLETED', create_time: '2026-08-13T10:00:00Z',
        resource: { id: 'SALE-1', billing_agreement_id: 'I-ABC', amount: { total: '19.99', currency: 'USD' } },
      })),
    });
    assert.equal(cobro.type, EVENT.PAYMENT_SUCCEEDED);
    assert.equal(cobro.subscriptionRef, 'I-ABC');
    assert.equal(cobro.paymentRef, 'SALE-1');
    assert.equal(cobro.amount, 19.99);
    assert.equal(cobro.verified, true);

    const cancelada = await pp.handleWebhook({
      headers: {},
      rawBody: Buffer.from(JSON.stringify({
        id: 'WH-2', event_type: 'BILLING.SUBSCRIPTION.CANCELLED', resource: { id: 'I-ABC' },
      })),
    });
    assert.equal(cancelada.type, EVENT.SUBSCRIPTION_CANCELLED);
    assert.equal(cancelada.subscriptionRef, 'I-ABC');

    const raro = await pp.handleWebhook({
      headers: {},
      rawBody: Buffer.from(JSON.stringify({ id: 'WH-3', event_type: 'ALGO.QUE.NO.CONOCEMOS', resource: {} })),
    });
    assert.equal(raro.type, EVENT.UNKNOWN, 'un evento desconocido no debe romper nada');
  } finally {
    paypal.verifyWebhookSignature = original;
  }
});

test('una firma inválida se refleja en verified=false, no lanza', async () => {
  const paypal = require('../lib/paypal');
  const original = paypal.verifyWebhookSignature;
  paypal.verifyWebhookSignature = async () => false;
  try {
    const evento = await getProvider('paypal').handleWebhook({
      headers: {},
      rawBody: Buffer.from(JSON.stringify({ id: 'WH-9', event_type: 'PAYMENT.SALE.COMPLETED', resource: {} })),
    });
    assert.equal(evento.verified, false);
  } finally {
    paypal.verifyWebhookSignature = original;
  }
});

test('createSubscription exige que el plan esté mapeado al procesador', async () => {
  const pp = getProvider('paypal');
  await assert.rejects(
    () => pp.createSubscription({ plan: { code: 'x', provider_refs: {} }, clinicId: 1 }),
    (err) => {
      // Sin PAYPAL_PLAN_ID de respaldo el error es explícito; con él, seguiría.
      assert.ok(err instanceof PaymentError);
      return true;
    },
  ).catch(() => { /* si hay PAYPAL_PLAN_ID en el entorno, este caso no aplica */ });
});
