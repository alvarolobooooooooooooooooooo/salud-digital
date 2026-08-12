// ── Cliente REST de PayPal (Subscriptions API v1) ──
//
// Flujo elegido: REDIRECT server-side (no el SDK JS de PayPal).
//   1. El servidor crea la suscripción por API  → POST /v1/billing/subscriptions
//   2. El navegador va al link "approve" de PayPal (el usuario paga ahí)
//   3. PayPal devuelve al usuario a APP_URL/plan.html?subscription_id=I-XXXX
//   4. El servidor re-consulta la suscripción por API y guarda el estado real
//
// Por qué redirect y no el SDK: (a) el botón del SDK es amarillo y de marca
// PayPal, imposible de alinear con el diseño de la plataforma; (b) el SDK
// obligaría a abrir el CSP (script-src/frame-src/connect-src) a *.paypal.com,
// que hoy está cerrado a 'self'. Con redirect nada externo se carga en la app.
//
// El cobro mensual recurrente lo ejecuta PayPal solo (es una suscripción sobre
// un plan de facturación); nosotros nos enteramos por webhooks.

const SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';
const LIVE_BASE = 'https://api-m.paypal.com';

const REQUEST_TIMEOUT_MS = 20000;

function env() {
  return String(process.env.PAYPAL_ENV || 'sandbox').trim().toLowerCase() === 'live'
    ? 'live'
    : 'sandbox';
}

function baseUrl() {
  return env() === 'live' ? LIVE_BASE : SANDBOX_BASE;
}

function clientId() {
  return String(process.env.PAYPAL_CLIENT_ID || '').trim();
}

function clientSecret() {
  return String(process.env.PAYPAL_CLIENT_SECRET || '').trim();
}

function planId() {
  return String(process.env.PAYPAL_PLAN_ID || '').trim();
}

function webhookId() {
  return String(process.env.PAYPAL_WEBHOOK_ID || '').trim();
}

// Precio y moneda viven en env para poder cambiarlos sin tocar código, pero el
// plan de PayPal es la fuente de verdad del cobro: esto es solo lo que se
// MUESTRA en la interfaz. Si cambias el precio, crea un plan nuevo en PayPal.
function price() {
  const raw = parseFloat(process.env.SUBSCRIPTION_PRICE || '19.99');
  return Number.isFinite(raw) && raw > 0 ? raw : 19.99;
}

function currency() {
  return String(process.env.SUBSCRIPTION_CURRENCY || 'USD').trim().toUpperCase();
}

// Credenciales presentes = se puede hablar con PayPal. No implica que exista un
// plan configurado (ver hasPlan) ni que los webhooks estén dados de alta.
function isConfigured() {
  return !!(clientId() && clientSecret());
}

function hasPlan() {
  return !!planId();
}

// ── OAuth2 client_credentials ──
// El token dura ~9h; se cachea en memoria con margen de 60s. La clave del caché
// incluye client id + entorno para que un cambio de credenciales no reutilice
// un token viejo (típico al pasar de sandbox a live sin reiniciar).
let tokenCache = { key: '', value: '', expiresAt: 0 };

async function accessToken() {
  if (!isConfigured()) {
    throw new Error('PayPal no está configurado (falta PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET).');
  }
  const key = env() + '|' + clientId();
  if (tokenCache.value && tokenCache.key === key && Date.now() < tokenCache.expiresAt) {
    return tokenCache.value;
  }

  const basic = Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64');
  const res = await fetch(baseUrl() + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + basic,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.access_token) {
    const detail = (data && (data.error_description || data.error)) || `HTTP ${res.status}`;
    throw new Error('PayPal auth falló: ' + detail);
  }

  tokenCache = {
    key,
    value: data.access_token,
    expiresAt: Date.now() + Math.max(0, (data.expires_in || 3600) - 60) * 1000,
  };
  return tokenCache.value;
}

async function papi(method, path, body, extraHeaders = {}) {
  const token = await accessToken();
  const res = await fetch(baseUrl() + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
  }

  if (!res.ok) {
    const detail =
      (data && data.details && data.details[0] && (data.details[0].description || data.details[0].issue)) ||
      (data && (data.message || data.error_description || data.name)) ||
      `HTTP ${res.status}`;
    const err = new Error(`PayPal ${method} ${path} → ${detail}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

// ── Suscripciones ──

// customId viaja a PayPal y vuelve en cada webhook: lo usamos para atar el
// evento a la clínica sin depender solo de nuestra tabla.
async function createSubscription({
  customId,
  subscriberEmail,
  subscriberName,
  returnUrl,
  cancelUrl,
  requestId,
}) {
  if (!hasPlan()) {
    throw new Error('Falta PAYPAL_PLAN_ID. Ejecuta: node tools/paypal-setup.js');
  }

  const nameParts = String(subscriberName || '').trim().split(/\s+/).filter(Boolean);
  const subscriber = {};
  if (subscriberEmail) subscriber.email_address = String(subscriberEmail).slice(0, 254);
  if (nameParts.length) {
    subscriber.name = {
      given_name: nameParts[0].slice(0, 140),
      surname: (nameParts.slice(1).join(' ') || nameParts[0]).slice(0, 140),
    };
  }

  const body = {
    plan_id: planId(),
    custom_id: String(customId || ''),
    application_context: {
      brand_name: process.env.SUBSCRIPTION_BRAND_NAME || 'Salud Digital',
      locale: 'es-ES',
      shipping_preference: 'NO_SHIPPING',
      // SUBSCRIBE_NOW: el botón final en PayPal dice "Suscribirse" y vuelve
      // directo a la app en vez de mostrar una pantalla de revisión extra.
      user_action: 'SUBSCRIBE_NOW',
      payment_method: {
        payer_selected: 'PAYPAL',
        payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED',
      },
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  };
  if (Object.keys(subscriber).length) body.subscriber = subscriber;

  // PayPal-Request-Id = idempotencia: un doble clic en "Suscribirme" no crea
  // dos suscripciones.
  const headers = requestId ? { 'PayPal-Request-Id': String(requestId) } : {};
  return papi('POST', '/v1/billing/subscriptions', body, headers);
}

async function getSubscription(id) {
  return papi('GET', `/v1/billing/subscriptions/${encodeURIComponent(id)}`);
}

async function cancelSubscription(id, reason) {
  // 204 sin cuerpo cuando funciona.
  return papi('POST', `/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`, {
    reason: String(reason || 'Cancelada por el usuario desde Salud Digital').slice(0, 128),
  });
}

function approveLink(subscription) {
  const links = (subscription && subscription.links) || [];
  const link = links.find((l) => String(l.rel).toLowerCase() === 'approve');
  return link ? link.href : null;
}

// ── Webhooks ──

// Verificación de firma contra la API de PayPal. Sin esto cualquiera podría
// POSTear a /api/billing/webhook y "activar" la suscripción gratis.
async function verifyWebhookSignature(headers, rawBody) {
  const id = webhookId();
  if (!id) throw new Error('Falta PAYPAL_WEBHOOK_ID.');

  const h = (name) => headers[name] || headers[name.toLowerCase()] || '';
  const payload = {
    auth_algo: h('paypal-auth-algo'),
    cert_url: h('paypal-cert-url'),
    transmission_id: h('paypal-transmission-id'),
    transmission_sig: h('paypal-transmission-sig'),
    transmission_time: h('paypal-transmission-time'),
    webhook_id: id,
    // PayPal exige el evento como objeto JSON, no como string.
    webhook_event: JSON.parse(rawBody.toString('utf8')),
  };
  if (!payload.transmission_id || !payload.transmission_sig) return false;

  const data = await papi('POST', '/v1/notifications/verify-webhook-signature', payload);
  return !!data && data.verification_status === 'SUCCESS';
}

// ── Alta de producto / plan / webhook (usados por tools/paypal-setup.js) ──

async function createProduct({ name, description }) {
  return papi(
    'POST',
    '/v1/catalogs/products',
    {
      name,
      description,
      type: 'SERVICE',
      category: 'SOFTWARE',
    },
    { 'PayPal-Request-Id': 'sd-product-' + Date.now() },
  );
}

async function createPlan({ productId, name, description, amount, currencyCode }) {
  return papi(
    'POST',
    '/v1/billing/plans',
    {
      product_id: productId,
      name,
      description,
      status: 'ACTIVE',
      billing_cycles: [
        {
          frequency: { interval_unit: 'MONTH', interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0, // 0 = para siempre, hasta que se cancele
          pricing_scheme: {
            fixed_price: { value: Number(amount).toFixed(2), currency_code: currencyCode },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: { value: '0.00', currency_code: currencyCode },
        setup_fee_failure_action: 'CONTINUE',
        // Tras 3 intentos fallidos PayPal suspende la suscripción (y nos avisa
        // por webhook BILLING.SUBSCRIPTION.SUSPENDED).
        payment_failure_threshold: 3,
      },
    },
    { 'PayPal-Request-Id': 'sd-plan-' + Date.now() },
  );
}

async function listWebhooks() {
  return papi('GET', '/v1/notifications/webhooks');
}

async function createWebhook({ url, eventTypes }) {
  return papi('POST', '/v1/notifications/webhooks', {
    url,
    event_types: eventTypes.map((name) => ({ name })),
  });
}

module.exports = {
  env,
  isConfigured,
  hasPlan,
  planId,
  webhookId,
  price,
  currency,
  createSubscription,
  getSubscription,
  cancelSubscription,
  approveLink,
  verifyWebhookSignature,
  createProduct,
  createPlan,
  listWebhooks,
  createWebhook,
};
