// Tests del provider de PAGO ÚNICO (el que permite el formulario de tarjeta
// dentro de nuestra página). Sin red: se sustituye el cliente HTTP de PayPal.
const test = require('node:test');
const assert = require('node:assert');

const { getProvider, UnsupportedOperationError, EVENT, _resetProviders } = require('../lib/payments/provider');

function proveedor() {
  _resetProviders();
  return getProvider('paypal_onetime');
}

test('declara renovación manual: no finge cobrar solo', async () => {
  const p = proveedor();
  assert.equal(p.name, 'paypal_onetime');
  assert.equal(p.capabilities.recurring, 'manual');
  assert.equal(p.capabilities.hostedFields, true, 'el formulario vive en nuestra página');
  assert.equal(p.capabilities.tokenizesCards, false, 'PayPal no tokeniza para esta cuenta');

  // Lo que no puede, lo dice.
  await assert.rejects(() => p.charge(), UnsupportedOperationError);
  await assert.rejects(() => p.createPaymentMethod(), UnsupportedOperationError);
});

test('publicConfig le dice al frontend que pinte el checkout embebido', () => {
  const c = proveedor().publicConfig();
  assert.equal(c.checkout, 'inline_card');
  assert.equal(c.provider, 'paypal_onetime');
});

test('la suscripción es local: no se inventa una en PayPal', async () => {
  const s = await proveedor().createSubscription({ clinicId: 7 });
  assert.match(s.id, /^local-7-/);
  assert.equal(s.status, 'incomplete');
  assert.equal(s.approvalUrl, null);
});

test('normaliza la captura de una orden pagada', async () => {
  const paypal = require('../lib/paypal');
  const original = paypal.captureOrder;
  paypal.captureOrder = async () => ({
    id: 'ORDER-1',
    status: 'COMPLETED',
    payer: { email_address: 'ana@ejemplo.com' },
    purchase_units: [{
      custom_id: 'local-7-abc',
      payments: { captures: [{ id: 'CAP-1', status: 'COMPLETED', amount: { value: '19.99', currency_code: 'USD' } }] },
    }],
  });
  try {
    const r = await proveedor().captureOrder({ orderId: 'ORDER-1' });
    assert.equal(r.id, 'CAP-1');
    assert.equal(r.status, 'succeeded');
    assert.equal(r.amount, 19.99);
    assert.equal(r.currency, 'USD');
    assert.equal(r.customId, 'local-7-abc', 'el custom_id ata el pago a la suscripción');
  } finally {
    paypal.captureOrder = original;
  }
});

// Cobrar dos veces sería el peor fallo posible: si PayPal dice que la orden ya
// estaba capturada, se recupera la captura existente en vez de propagar error.
test('una orden ya capturada no vuelve a cobrarse', async () => {
  const paypal = require('../lib/paypal');
  const capOriginal = paypal.captureOrder;
  const getOriginal = paypal.getOrder;

  let vecesCapturado = 0;
  paypal.captureOrder = async () => {
    vecesCapturado++;
    const err = new Error('ya capturada');
    err.status = 422;
    err.body = { details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] };
    throw err;
  };
  paypal.getOrder = async () => ({
    id: 'ORDER-2', status: 'COMPLETED',
    purchase_units: [{ payments: { captures: [{ id: 'CAP-2', status: 'COMPLETED', amount: { value: '19.99', currency_code: 'USD' } }] } }],
  });

  try {
    const r = await proveedor().captureOrder({ orderId: 'ORDER-2' });
    assert.equal(r.status, 'succeeded');
    assert.equal(r.id, 'CAP-2', 'devuelve la captura que ya existía');
    assert.equal(vecesCapturado, 1);
  } finally {
    paypal.captureOrder = capOriginal;
    paypal.getOrder = getOriginal;
  }
});

test('una captura rechazada se refleja como fallo, no como éxito', async () => {
  const paypal = require('../lib/paypal');
  const original = paypal.captureOrder;
  paypal.captureOrder = async () => ({
    id: 'ORDER-3', status: 'DECLINED',
    purchase_units: [{ payments: { captures: [{ id: 'CAP-3', status: 'DECLINED', amount: { value: '19.99', currency_code: 'USD' } }] } }],
  });
  try {
    const r = await proveedor().captureOrder({ orderId: 'ORDER-3' });
    assert.equal(r.status, 'failed');
    assert.ok(r.failureMessage);
  } finally {
    paypal.captureOrder = original;
  }
});

test('traduce los webhooks de captura al vocabulario canónico', async () => {
  const paypal = require('../lib/paypal');
  const original = paypal.verifyWebhookSignature;
  paypal.verifyWebhookSignature = async () => true;

  try {
    const p = proveedor();
    const ok = await p.handleWebhook({
      headers: {},
      rawBody: Buffer.from(JSON.stringify({
        id: 'WH-C1', event_type: 'PAYMENT.CAPTURE.COMPLETED', create_time: '2026-08-13T10:00:00Z',
        resource: { id: 'CAP-9', custom_id: 'local-7-abc', amount: { value: '19.99', currency_code: 'USD' } },
      })),
    });
    assert.equal(ok.type, EVENT.PAYMENT_SUCCEEDED);
    assert.equal(ok.subscriptionRef, 'local-7-abc');
    assert.equal(ok.paymentRef, 'CAP-9');
    assert.equal(ok.amount, 19.99);

    const denegado = await p.handleWebhook({
      headers: {},
      rawBody: Buffer.from(JSON.stringify({
        id: 'WH-C2', event_type: 'PAYMENT.CAPTURE.DENIED', resource: { id: 'CAP-10', custom_id: 'local-7-abc' },
      })),
    });
    assert.equal(denegado.type, EVENT.PAYMENT_FAILED);
  } finally {
    paypal.verifyWebhookSignature = original;
  }
});
