// ── Contrato de procesador de pagos ──
//
// Toda la lógica de suscripciones (SubscriptionService, BillingService,
// WebhookService, rutas y frontend) habla EXCLUSIVAMENTE con esta interfaz.
// Cambiar de PayPal a PixelPay/Tilopay/BAC debe consistir en escribir una clase
// nueva aquí debajo y cambiar PAYMENTS_PROVIDER en el entorno — nada más.
//
// Reglas de la casa:
//   1. Ningún método devuelve estructuras propias del procesador: se normaliza
//      todo al vocabulario de este archivo (estados, eventos, errores).
//   2. Lo que un procesador no sepa hacer se declara en `capabilities` y lanza
//      UnsupportedOperationError. Nunca se simula ni se rodea la restricción.
//   3. El PAN completo y el CVV JAMÁS pasan por aquí: solo tokens del
//      procesador. Ver docs/PAYMENTS.md § PCI.

/** Estados canónicos de una suscripción (los de la BD). */
const SUBSCRIPTION_STATUS = {
  INCOMPLETE: 'incomplete',       // creada, aún sin primer pago aprobado
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',           // falló un cobro, seguimos reintentando
  PAYMENT_FAILED: 'payment_failed', // agotados los reintentos
  PAUSED: 'paused',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

/** Eventos canónicos que produce `handleWebhook`, sea cual sea el procesador. */
const EVENT = {
  SUBSCRIPTION_ACTIVATED: 'subscription.activated',
  SUBSCRIPTION_UPDATED: 'subscription.updated',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
  SUBSCRIPTION_SUSPENDED: 'subscription.suspended',
  SUBSCRIPTION_EXPIRED: 'subscription.expired',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',
  UNKNOWN: 'unknown',
};

class PaymentError extends Error {
  constructor(message, { code = 'provider_error', retryable = false, raw = null } = {}) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
    // retryable: si un reintento MÁS TARDE podría funcionar (fondos
    // insuficientes, timeout). Un "tarjeta inválida" no es reintentable.
    this.retryable = retryable;
    this.raw = raw;
  }
}

class UnsupportedOperationError extends PaymentError {
  constructor(provider, operation, motivo = '') {
    super(
      `El procesador "${provider}" no soporta ${operation}${motivo ? ': ' + motivo : ''}`,
      { code: 'unsupported_operation' },
    );
    this.name = 'UnsupportedOperationError';
    this.operation = operation;
  }
}

/**
 * @typedef {Object} Capabilities
 * @property {'native'|'token'|'manual'|'none'} recurring
 *   'native' → el procesador cobra cada periodo por su cuenta (PayPal
 *              Subscriptions). NO programamos nosotros el cobro.
 *   'token'  → nos entrega un token reutilizable y el cobro periódico lo
 *              ejecuta BillingService en la fecha correspondiente.
 *   'manual' → no se puede cobrar sin el cliente delante: la plataforma lleva
 *              los periodos y el acceso, pero cada renovación la paga el
 *              usuario pulsando un botón (pago único). Es el caso de PayPal en
 *              países sin tokenización de tarjeta.
 *   'none'   → solo pagos sueltos; no se pueden ofrecer suscripciones.
 * @property {boolean} tokenizesCards  Guarda tarjetas para cobrarlas luego.
 * @property {boolean} hostedFields    Campos de tarjeta embebibles en nuestra web.
 * @property {boolean} webhooks        Notifica cambios de forma verificable.
 * @property {boolean} refunds
 * @property {boolean} planChanges     Sabe cambiar de plan una suscripción viva.
 */

class PaymentProvider {
  /** Identificador corto y estable; es el valor de la columna `provider`. */
  get name() {
    throw new Error('PaymentProvider.name sin implementar');
  }

  /**
   * Nombre para mensajes de error. Existe porque `name` lanza a propósito
   * cuando un provider olvida implementarlo, y sin esto un "operación no
   * soportada" acababa enmascarado por ese error, que despista muchísimo.
   */
  _nombreSeguro() {
    try {
      return this.name;
    } catch {
      return this.constructor.name || 'desconocido';
    }
  }

  /** @returns {Capabilities} */
  get capabilities() {
    return {
      recurring: 'none',
      tokenizesCards: false,
      hostedFields: false,
      webhooks: false,
      refunds: false,
      planChanges: false,
    };
  }

  /** Credenciales presentes. Si es false, el sistema no ofrece cobrar. */
  isConfigured() {
    return false;
  }

  /**
   * Datos que el navegador necesita para pintar el checkout de ESTE procesador
   * (client id público, entorno, tipo de widget…). Nunca secretos.
   */
  publicConfig() {
    return { provider: this.name, checkout: 'none' };
  }

  // ── Cliente ──
  /** @returns {Promise<{customerId: string}>} */
  async createCustomer() { throw new UnsupportedOperationError(this._nombreSeguro(), 'createCustomer'); }

  // ── Métodos de pago ──
  /**
   * Convierte el token de un solo uso que produjo el widget del procesador en
   * el navegador en un método de pago reutilizable.
   * @returns {Promise<{token:string, brand:string, last4:string, expMonth:number, expYear:number, customerId?:string}>}
   */
  async createPaymentMethod() { throw new UnsupportedOperationError(this._nombreSeguro(), 'createPaymentMethod'); }

  async deletePaymentMethod() { throw new UnsupportedOperationError(this._nombreSeguro(), 'deletePaymentMethod'); }

  // ── Cobros ──
  /**
   * Cobro iniciado por el comercio contra un token guardado.
   * @returns {Promise<{id:string, status:'succeeded'|'failed'|'pending', amount:number, currency:string, raw:any}>}
   */
  async charge() { throw new UnsupportedOperationError(this._nombreSeguro(), 'charge'); }

  async getPayment() { throw new UnsupportedOperationError(this._nombreSeguro(), 'getPayment'); }

  // ── Pago único (procesadores 'manual') ──
  // El usuario está delante: se crea una orden, él la aprueba en el widget y
  // nosotros la capturamos. Es el único camino cuando no hay tokenización.
  /** @returns {Promise<{orderId:string, amount:number, currency:string}>} */
  async createOrder() { throw new UnsupportedOperationError(this._nombreSeguro(), 'createOrder'); }

  /** @returns {Promise<{id:string, status:'succeeded'|'failed', amount:number, currency:string, raw:any}>} */
  async captureOrder() { throw new UnsupportedOperationError(this._nombreSeguro(), 'captureOrder'); }

  async refund() { throw new UnsupportedOperationError(this._nombreSeguro(), 'refund'); }

  // ── Suscripciones ──
  /** @returns {Promise<{id:string, status:string, approvalUrl?:string, currentPeriodEnd?:Date, raw:any}>} */
  async createSubscription() { throw new UnsupportedOperationError(this._nombreSeguro(), 'createSubscription'); }

  async getSubscription() { throw new UnsupportedOperationError(this._nombreSeguro(), 'getSubscription'); }

  async cancelSubscription() { throw new UnsupportedOperationError(this._nombreSeguro(), 'cancelSubscription'); }

  async updateSubscription() { throw new UnsupportedOperationError(this._nombreSeguro(), 'updateSubscription'); }

  /** Reintento de un cobro fallido usando el mecanismo propio del procesador. */
  async retryPayment() { throw new UnsupportedOperationError(this._nombreSeguro(), 'retryPayment'); }

  // ── Webhooks ──
  /**
   * Verifica la firma y traduce el evento al vocabulario canónico.
   * @returns {Promise<{eventId:string, type:string, verified:boolean,
   *                    subscriptionRef?:string, paymentRef?:string,
   *                    amount?:number, currency?:string, occurredAt?:Date, raw:any}>}
   */
  async handleWebhook() { throw new UnsupportedOperationError(this._nombreSeguro(), 'handleWebhook'); }
}

// ── Registro ──
// Los providers se cargan de forma perezosa: así añadir uno nuevo no obliga a
// tener sus credenciales configuradas para arrancar la aplicación.
const REGISTRO = {
  paypal: () => require('./providers/paypal'),
  // Mismo PayPal, pero cobrando por pago único: es la única forma de que el
  // formulario de tarjeta viva dentro de nuestra página. Ver su cabecera.
  paypal_onetime: () => require('./providers/paypal-onetime'),
  // Al añadir un procesador nuevo, basta con una línea aquí:
  // pixelpay: () => require('./providers/pixelpay'),
  // tilopay:  () => require('./providers/tilopay'),
};

const instancias = new Map();

function nombreProviderPorDefecto() {
  return String(process.env.PAYMENTS_PROVIDER || 'paypal').trim().toLowerCase();
}

/**
 * @param {string} [nombre] — por defecto, PAYMENTS_PROVIDER.
 * @returns {PaymentProvider}
 */
function getProvider(nombre) {
  const clave = String(nombre || nombreProviderPorDefecto()).trim().toLowerCase();
  if (instancias.has(clave)) return instancias.get(clave);

  const cargar = REGISTRO[clave];
  if (!cargar) {
    throw new PaymentError(`Procesador de pagos desconocido: "${clave}"`, { code: 'unknown_provider' });
  }
  const Clase = cargar();
  const instancia = new Clase();
  instancias.set(clave, instancia);
  return instancia;
}

function listProviders() {
  return Object.keys(REGISTRO);
}

// Solo para tests: permite inyectar un doble sin tocar el entorno.
function _registerProvider(nombre, instancia) {
  instancias.set(String(nombre).toLowerCase(), instancia);
}

function _resetProviders() {
  instancias.clear();
}

module.exports = {
  PaymentProvider,
  PaymentError,
  UnsupportedOperationError,
  SUBSCRIPTION_STATUS,
  EVENT,
  getProvider,
  listProviders,
  nombreProviderPorDefecto,
  _registerProvider,
  _resetProviders,
};
