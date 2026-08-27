// ── PayPal como PaymentProvider ──
//
// Este archivo es el ÚNICO sitio del sistema de facturación que sabe cómo habla
// PayPal. Envuelve al cliente HTTP de lib/paypal.js y traduce sus estados y
// eventos al vocabulario canónico de ../provider.js.
//
// LÍMITES REALES DE ESTA CUENTA (comprobados, no supuestos — 2026-08-13):
//
//   paypal.CardFields().isEligible()            → false
//   paypal.Buttons({fundingSource:card})        → true
//
// Es decir: PayPal NO ofrece a esta cuenta campos de tarjeta propios ni tokens
// de tarjeta reutilizables, porque "Advanced (Expanded) Checkout" está limitado
// a ~37 países y Honduras no está entre ellos. En consecuencia:
//
//   • charge() / createPaymentMethod() → UnsupportedOperationError. No hay
//     forma legítima de cobrar una tarjeta guardada por iniciativa nuestra, y
//     no se intenta rodear la restricción.
//   • Las suscripciones van por el motor NATIVO de PayPal (capabilities
//     .recurring = 'native'): PayPal cobra cada mes, reintenta y avisa por
//     webhook. Nuestro BillingService no programa cobros para este provider.
//   • El comprador introduce la tarjeta en la ventana alojada por PayPal.
//
// Cuando se conecte un procesador con tokenización (PixelPay, Tilopay, BAC),
// ese sí declarará recurring:'token' y el cobro periódico lo hará BillingService
// sin cambiar una línea de la lógica de suscripciones.

const paypal = require('../../paypal');
const {
  PaymentProvider,
  PaymentError,
  UnsupportedOperationError,
  EVENT,
} = require('../provider');

// PayPal → vocabulario propio.
const ESTADOS = {
  APPROVAL_PENDING: 'incomplete',
  APPROVED: 'incomplete',
  ACTIVE: 'active',
  SUSPENDED: 'past_due',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

const EVENTOS = {
  'BILLING.SUBSCRIPTION.ACTIVATED': EVENT.SUBSCRIPTION_ACTIVATED,
  'BILLING.SUBSCRIPTION.RE-ACTIVATED': EVENT.SUBSCRIPTION_ACTIVATED,
  'BILLING.SUBSCRIPTION.UPDATED': EVENT.SUBSCRIPTION_UPDATED,
  'BILLING.SUBSCRIPTION.CANCELLED': EVENT.SUBSCRIPTION_CANCELLED,
  'BILLING.SUBSCRIPTION.SUSPENDED': EVENT.SUBSCRIPTION_SUSPENDED,
  'BILLING.SUBSCRIPTION.EXPIRED': EVENT.SUBSCRIPTION_EXPIRED,
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED': EVENT.PAYMENT_FAILED,
  'PAYMENT.SALE.COMPLETED': EVENT.PAYMENT_SUCCEEDED,
  'PAYMENT.SALE.REFUNDED': EVENT.PAYMENT_REFUNDED,
  'PAYMENT.SALE.REVERSED': EVENT.PAYMENT_REFUNDED,
};

function envolver(err) {
  if (err instanceof PaymentError) return err;
  // 5xx y timeouts son reintentables; un 4xx significa que la petición estaba mal.
  const estado = err.status || 0;
  return new PaymentError(err.message || 'Error de PayPal', {
    code: estado ? 'paypal_http_' + estado : 'paypal_error',
    retryable: estado === 0 || estado >= 500 || estado === 429,
    raw: err.body || null,
  });
}

class PayPalPaymentProvider extends PaymentProvider {
  get name() {
    return 'paypal';
  }

  get capabilities() {
    return {
      recurring: 'native',
      tokenizesCards: false, // Advanced Checkout no disponible para esta cuenta
      hostedFields: false,   // idem: los campos de tarjeta los aloja PayPal
      webhooks: true,
      refunds: false,        // se hacen desde el panel de PayPal, no por API aquí
      planChanges: true,     // /revise permite cambiar el plan de una suscripción
    };
  }

  isConfigured() {
    return paypal.isConfigured();
  }

  publicConfig() {
    return {
      provider: 'paypal',
      // El frontend usa esto para decidir qué checkout pintar. 'redirect_or_modal'
      // = ventana alojada por PayPal (SDK v6 en modo modal, con respaldo de
      // redirección). No hay campos de tarjeta propios.
      checkout: 'provider_hosted',
      client_id: paypal.clientId(),
      environment: paypal.env(),
    };
  }

  // ── Cliente ──
  // PayPal no tiene un objeto "cliente" en suscripciones: el pagador se
  // identifica dentro de cada suscripción. Se devuelve una referencia
  // sintética para que la capa de negocio pueda guardarla igual que con
  // cualquier otro procesador.
  async createCustomer({ clinicId, email = '', name = '' } = {}) {
    return { customerId: 'clinic:' + clinicId, email, name, synthetic: true };
  }

  async createPaymentMethod() {
    throw new UnsupportedOperationError(
      'paypal',
      'guardar tarjetas (tokenización)',
      'requiere Advanced Checkout, no disponible en Honduras',
    );
  }

  async charge() {
    throw new UnsupportedOperationError(
      'paypal',
      'cobros iniciados por el comercio',
      'requiere un token de tarjeta que esta cuenta no puede emitir',
    );
  }

  // ── Suscripciones ──
  async createSubscription({ plan, clinicId, email, name, returnUrl, cancelUrl, idempotencyKey } = {}) {
    const planProveedor = plan && plan.provider_refs && plan.provider_refs.paypal;
    // ── El respaldo del entorno vale para UN solo plan ──
    //
    // PAYPAL_PLAN_ID se creó cuando solo existía el plan individual, y en PayPal
    // un plan lleva su propio precio dentro. Aceptarlo como respaldo para
    // cualquiera significaba cobrar 19,99 a quien contrató Premium, y
    // sin ningún error: la suscripción se crea perfecta, por el importe que no
    // es. Mejor fallar aquí y que alguien cree el plan en PayPal.
    const planId = (planProveedor && planProveedor.plan_id)
      || (plan && plan.code === 'individual-monthly' ? paypal.planId() : '');
    if (!planId) {
      throw new PaymentError('El plan no tiene equivalente en PayPal (falta provider_refs.paypal.plan_id)', {
        code: 'plan_not_mapped',
      });
    }

    let creada;
    try {
      creada = await paypal.createSubscription({
        planId,
        customId: String(clinicId),
        subscriberEmail: email,
        subscriberName: name,
        returnUrl,
        cancelUrl,
        requestId: idempotencyKey,
      });
    } catch (err) {
      throw envolver(err);
    }

    return this._normalizarSuscripcion(creada, paypal.approveLink(creada));
  }

  async getSubscription(providerSubscriptionId) {
    try {
      return this._normalizarSuscripcion(await paypal.getSubscription(providerSubscriptionId));
    } catch (err) {
      throw envolver(err);
    }
  }

  async cancelSubscription(providerSubscriptionId, reason = 'Cancelada por el usuario') {
    try {
      await paypal.cancelSubscription(providerSubscriptionId, reason);
    } catch (err) {
      // 422 = PayPal dice que ya no está activa. Para la capa de negocio el
      // resultado deseado (que no vuelva a cobrar) ya se cumple.
      if (err.status !== 422) throw envolver(err);
    }
    return { cancelled: true };
  }

  async updateSubscription(providerSubscriptionId, { plan } = {}) {
    const planProveedor = plan && plan.provider_refs && plan.provider_refs.paypal;
    const planId = planProveedor && planProveedor.plan_id;
    if (!planId) {
      throw new PaymentError('El plan destino no tiene equivalente en PayPal', { code: 'plan_not_mapped' });
    }
    try {
      const r = await paypal.reviseSubscription(providerSubscriptionId, planId);
      // PayPal devuelve un enlace de aprobación: cambiar de plan puede exigir
      // que el pagador vuelva a autorizar el nuevo importe.
      return { approvalUrl: paypal.approveLink(r), raw: r };
    } catch (err) {
      throw envolver(err);
    }
  }

  async retryPayment() {
    // PayPal reintenta por su cuenta según payment_failure_threshold del plan.
    throw new UnsupportedOperationError(
      'paypal',
      'reintentos manuales',
      'los gestiona PayPal automáticamente y avisa por webhook',
    );
  }

  async getPayment(providerPaymentId) {
    try {
      const venta = await paypal.getSale(providerPaymentId);
      return {
        id: venta.id,
        status: String(venta.state || '').toLowerCase() === 'completed' ? 'succeeded' : 'failed',
        amount: parseFloat((venta.amount && venta.amount.total) || 0),
        currency: (venta.amount && venta.amount.currency) || 'USD',
        raw: venta,
      };
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

    const tipoPaypal = String(evento.event_type || '').toUpperCase();
    const recurso = evento.resource || {};
    const importe = recurso.amount || {};

    // En los eventos de venta, la suscripción viene en billing_agreement_id;
    // en los de suscripción, el propio recurso ES la suscripción.
    const refSuscripcion = recurso.billing_agreement_id || recurso.id || null;

    return {
      eventId: String(evento.id || ''),
      type: EVENTOS[tipoPaypal] || EVENT.UNKNOWN,
      providerType: tipoPaypal,
      verified: verificado,
      subscriptionRef: tipoPaypal.startsWith('PAYMENT.SALE') ? recurso.billing_agreement_id : refSuscripcion,
      paymentRef: tipoPaypal.startsWith('PAYMENT.SALE') ? recurso.id : null,
      amount: parseFloat(importe.total || importe.value || 0) || null,
      currency: importe.currency || importe.currency_code || null,
      occurredAt: evento.create_time ? new Date(evento.create_time) : new Date(),
      raw: evento,
    };
  }

  // ── Interno ──
  _normalizarSuscripcion(recurso, approvalUrl) {
    const facturacion = recurso.billing_info || {};
    const suscriptor = recurso.subscriber || {};
    const nombre = [suscriptor.name && suscriptor.name.given_name, suscriptor.name && suscriptor.name.surname]
      .filter(Boolean)
      .join(' ');

    return {
      id: recurso.id,
      status: ESTADOS[String(recurso.status || '').toUpperCase()] || 'incomplete',
      approvalUrl: approvalUrl || paypal.approveLink(recurso) || null,
      currentPeriodEnd: facturacion.next_billing_time ? new Date(facturacion.next_billing_time) : null,
      nextBillingAt: facturacion.next_billing_time ? new Date(facturacion.next_billing_time) : null,
      startedAt: recurso.start_time ? new Date(recurso.start_time) : null,
      customerId: suscriptor.payer_id || '',
      subscriberEmail: suscriptor.email_address || '',
      subscriberName: nombre,
      failedPayments: parseInt((facturacion.failed_payments_count || 0), 10) || 0,
      raw: recurso,
    };
  }
}

module.exports = PayPalPaymentProvider;
