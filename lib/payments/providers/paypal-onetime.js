// ── PayPal por PAGO ÚNICO (tarjeta embebida) ──
//
// Por qué existe además de providers/paypal.js:
//
// Con `intent=subscription` PayPal obliga a que la tarjeta se teclee en SU
// ventana. Con `intent=capture` (pago único), en cambio, el botón de tarjeta
// despliega el formulario DENTRO de nuestra página — comprobado con las
// credenciales del proyecto el 2026-08-13:
//
//     botón de tarjeta elegible : true
//     window.open()             : []          ← ninguna ventana
//     alto del contenedor       : 48px → 664px ← el formulario crece embebido
//
// Así que la plataforma lleva la estructura de suscripción (planes, periodos,
// acceso, mora, historial) y cada periodo se liquida con un pago único.
//
// EL LÍMITE, dicho sin adornos: un pago único lo inicia el CLIENTE. Sin
// tokenización —que PayPal no habilita en Honduras— no se puede cobrar el mes
// siguiente por nuestra cuenta. Por eso capabilities.recurring = 'manual':
// BillingService no intenta cobrar solo, marca la renovación como vencida y la
// interfaz pide al usuario que pague. No se simula un débito automático que no
// existe.

const crypto = require('crypto');
const paypal = require('../../paypal');
const { PaymentProvider, PaymentError, UnsupportedOperationError, EVENT } = require('../provider');

const EVENTOS = {
  'PAYMENT.CAPTURE.COMPLETED': EVENT.PAYMENT_SUCCEEDED,
  'PAYMENT.CAPTURE.DENIED': EVENT.PAYMENT_FAILED,
  'PAYMENT.CAPTURE.DECLINED': EVENT.PAYMENT_FAILED,
  'PAYMENT.CAPTURE.REFUNDED': EVENT.PAYMENT_REFUNDED,
  'PAYMENT.CAPTURE.REVERSED': EVENT.PAYMENT_REFUNDED,
};

function envolver(err) {
  if (err instanceof PaymentError) return err;
  const estado = err.status || 0;
  return new PaymentError(err.message || 'Error de PayPal', {
    code: estado ? 'paypal_http_' + estado : 'paypal_error',
    retryable: estado === 0 || estado >= 500 || estado === 429,
    raw: err.body || null,
  });
}

class PayPalOneTimeProvider extends PaymentProvider {
  get name() {
    return 'paypal_onetime';
  }

  get capabilities() {
    return {
      recurring: 'manual',
      tokenizesCards: false,
      hostedFields: true,   // el formulario de tarjeta vive en nuestra página
      webhooks: true,
      refunds: false,
      planChanges: true,    // no hay plan remoto: cambiar de plan es cosa nuestra
    };
  }

  isConfigured() {
    return paypal.isConfigured();
  }

  publicConfig() {
    return {
      provider: 'paypal_onetime',
      // El frontend pinta el SDK con intent=capture y enable-funding=card.
      checkout: 'inline_card',
      client_id: paypal.clientId(),
      environment: paypal.env(),
    };
  }

  async createCustomer({ clinicId, email = '', name = '' } = {}) {
    // No hay objeto cliente en el flujo de órdenes.
    return { customerId: 'clinic:' + clinicId, email, name, synthetic: true };
  }

  /**
   * No existe suscripción en PayPal: la lleva la plataforma. Se devuelve una
   * referencia local para que el resto del sistema no distinga.
   */
  async createSubscription({ clinicId } = {}) {
    return {
      id: 'local-' + clinicId + '-' + crypto.randomUUID().slice(0, 8),
      status: 'incomplete',
      approvalUrl: null,
      currentPeriodEnd: null,
      raw: { local: true },
    };
  }

  /** No hay nada remoto que releer: manda nuestra base de datos. */
  async getSubscription(id) {
    return { id, status: null, raw: { local: true } };
  }

  async cancelSubscription() {
    // Sin suscripción remota no hay nada que cancelar: basta con dejar de
    // pedirle al usuario que pague, y de eso se encarga SubscriptionService.
    return { cancelled: true, local: true };
  }

  async updateSubscription() {
    // El importe lo decide nuestro catálogo de planes en el próximo cobro.
    return { approvalUrl: null, local: true };
  }

  async charge() {
    throw new UnsupportedOperationError(
      'paypal_onetime',
      'cobros iniciados por el comercio',
      'un pago único exige al cliente delante; PayPal no habilita tokenización aquí',
    );
  }

  async createPaymentMethod() {
    throw new UnsupportedOperationError(
      'paypal_onetime',
      'guardar tarjetas',
      'requiere Advanced Checkout, no disponible en Honduras',
    );
  }

  // ── Pago único ──

  async createOrder({ amount, currency, description, customId, idempotencyKey } = {}) {
    try {
      const orden = await paypal.createOrder({
        amount,
        currency,
        description,
        customId,
        requestId: idempotencyKey,
      });
      return { orderId: orden.id, amount: Number(amount), currency, raw: orden };
    } catch (err) {
      throw envolver(err);
    }
  }

  async captureOrder({ orderId, idempotencyKey } = {}) {
    let resultado;
    try {
      resultado = await paypal.captureOrder(orderId, idempotencyKey);
    } catch (err) {
      // Si la orden ya estaba capturada (doble clic, reintento de red) no es un
      // error: se relee y se devuelve la captura que ya existe. Cobrar dos
      // veces sería mucho peor que este rodeo.
      const yaCapturada =
        err.status === 422 &&
        JSON.stringify(err.body || {}).includes('ORDER_ALREADY_CAPTURED');
      if (!yaCapturada) throw envolver(err);
      try {
        resultado = await paypal.getOrder(orderId);
      } catch (err2) {
        throw envolver(err2);
      }
    }
    return this._normalizarCaptura(resultado);
  }

  async getPayment(providerPaymentId) {
    try {
      return this._normalizarCaptura(await paypal.getOrder(providerPaymentId));
    } catch (err) {
      throw envolver(err);
    }
  }

  // ── Webhooks ──

  async handleWebhook({ headers, rawBody }) {
    let verificado = false;
    try {
      verificado = await paypal.verifyWebhookSignature(headers, rawBody);
    } catch (err) {
      throw envolver(err);
    }

    let evento;
    try {
      evento = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new PaymentError('Cuerpo de webhook ilegible', { code: 'bad_payload' });
    }

    const tipo = String(evento.event_type || '').toUpperCase();
    const recurso = evento.resource || {};
    const importe = recurso.amount || {};

    // custom_id viaja en la orden y vuelve en la captura: es lo que ata el pago
    // a la suscripción local, ya que no hay suscripción en PayPal.
    return {
      eventId: String(evento.id || ''),
      type: EVENTOS[tipo] || EVENT.UNKNOWN,
      providerType: tipo,
      verified: verificado,
      subscriptionRef: recurso.custom_id || null,
      paymentRef: recurso.id || null,
      amount: parseFloat(importe.value || importe.total || 0) || null,
      currency: importe.currency_code || importe.currency || null,
      occurredAt: evento.create_time ? new Date(evento.create_time) : new Date(),
      raw: evento,
    };
  }

  // ── Interno ──

  _normalizarCaptura(orden) {
    const unidad = (orden.purchase_units || [])[0] || {};
    const captura = ((unidad.payments || {}).captures || [])[0] || {};
    const importe = captura.amount || {};
    const estado = String(captura.status || orden.status || '').toUpperCase();

    return {
      id: captura.id || orden.id,
      orderId: orden.id,
      status: estado === 'COMPLETED' ? 'succeeded' : estado === 'PENDING' ? 'pending' : 'failed',
      amount: parseFloat(importe.value || 0) || 0,
      currency: importe.currency_code || 'USD',
      customId: unidad.custom_id || captura.custom_id || '',
      payerEmail: (orden.payer && orden.payer.email_address) || '',
      failureMessage: estado === 'COMPLETED' ? '' : 'La captura quedó en estado ' + estado,
      raw: orden,
    };
  }
}

module.exports = PayPalOneTimeProvider;
