// ── /api/billing — suscripción mensual de la plataforma (PayPal) ──
//
// Alta:      POST /subscribe  → crea la suscripción en PayPal y devuelve el link
//                               de aprobación (el navegador va ahí)
// Regreso:   POST /confirm    → la página vuelve con ?subscription_id=… y aquí
//                               se verifica contra PayPal antes de darla por buena
// Recurrente: el cobro mensual lo hace PayPal; nos llega por /webhook
//
// Nada de esto confía en lo que manda el navegador: el estado SIEMPRE se lee de
// la API de PayPal (o de un webhook con firma verificada).

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const paypal = require('../lib/paypal');
const subscription = require('../lib/subscription');

// Roles que pueden contratar/cancelar: el dueño de la cuenta. La recepcionista
// puede VER el estado (para saber por qué está bloqueada la app) pero no pagar.
const OWNER_ROLES = ['clinic_admin', 'doctor'];

const SUBSCRIPTION_ID_RE = /^I-[A-Z0-9]{6,32}$/i;

function appUrl() {
  const raw = String(process.env.APP_URL || '').trim().replace(/\/+$/, '');
  return raw || 'http://localhost:' + (process.env.PORT || 3000);
}

function publicSubscription(sub) {
  if (!sub) return null;
  return {
    id: sub.external_id,
    status: sub.status,
    amount: sub.amount != null ? Number(sub.amount) : null,
    currency: sub.currency,
    subscriber_email: sub.subscriber_email || '',
    subscriber_name: sub.subscriber_name || '',
    start_time: sub.start_time,
    next_billing_time: sub.next_billing_time,
    last_payment_at: sub.last_payment_at,
    last_payment_amount: sub.last_payment_amount != null ? Number(sub.last_payment_amount) : null,
    cancelled_at: sub.cancelled_at,
    created_at: sub.created_at,
  };
}

// ── GET /api/billing/status ──
// La usan la página de suscripción y el guardián del frontend. Exenta del
// bloqueo (ver middleware/subscription.js) porque es justo lo que hay que poder
// consultar cuando la app está bloqueada.
router.get('/status', authenticate, async (req, res) => {
  const clinicId = req.user.clinic_id;
  const sub = clinicId ? await subscription.getClinicSubscription(clinicId) : null;
  const access = subscription.accessFromSubscription(sub);
  const exempt = clinicId ? subscription.isExemptClinic(clinicId) : true;

  res.json({
    configured: paypal.isConfigured(),
    plan_ready: paypal.hasPlan(),
    environment: paypal.env(),
    enforced: subscription.enforcementEnabled(),
    exempt,
    can_manage: OWNER_ROLES.includes(req.user.role),
    // Client id público: la página lo necesita para cargar el SDK de PayPal y
    // cobrar sin sacar al usuario de la app. El secreto se queda en el servidor.
    client_id: paypal.clientId(),
    price: paypal.price(),
    currency: paypal.currency(),
    access: {
      // exempt o sin enforcement → la app no bloquea, aunque no haya suscripción
      active: access.active || exempt || !subscription.enforcementEnabled(),
      paid: access.active,
      reason: access.reason,
    },
    subscription: publicSubscription(sub),
  });
});

// ── GET /api/billing/payments — historial de cobros ──
router.get('/payments', authenticate, requireRole(...OWNER_ROLES), async (req, res) => {
  if (!req.user.clinic_id) return res.json([]);
  const r = await query(
    `SELECT p.external_payment_id, p.amount, p.currency, p.status, p.paid_at
       FROM subscription_payments p
       JOIN subscriptions s ON s.external_id = p.external_subscription_id
      WHERE s.clinic_id = $1
      ORDER BY p.paid_at DESC
      LIMIT 24`,
    [req.user.clinic_id],
  );
  res.json(
    r.rows.map((row) => ({
      id: row.external_payment_id,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      paid_at: row.paid_at,
    })),
  );
});

// ── POST /api/billing/subscribe ──
router.post('/subscribe', authenticate, requireRole(...OWNER_ROLES), async (req, res) => {
  const clinicId = req.user.clinic_id;
  if (!clinicId) return res.status(403).json({ error: 'Tu usuario no tiene una clínica asignada.' });
  if (!paypal.isConfigured()) {
    return res.status(503).json({ error: 'PayPal no está configurado en el servidor.' });
  }
  if (!paypal.hasPlan()) {
    return res.status(503).json({ error: 'Falta el plan de PayPal. Ejecuta tools/paypal-setup.js.' });
  }

  const existing = await subscription.getClinicSubscription(clinicId);
  if (existing && String(existing.status).toUpperCase() === 'ACTIVE') {
    return res.status(409).json({ error: 'Ya tienes una suscripción activa.' });
  }

  const userRow = await query('SELECT name, email FROM users WHERE id = $1', [req.user.id]);
  const me = userRow.rows[0] || {};

  let created;
  try {
    created = await paypal.createSubscription({
      customId: clinicId,
      subscriberEmail: me.email || req.user.email,
      subscriberName: me.name || '',
      returnUrl: appUrl() + '/plan.html?paypal=return',
      cancelUrl: appUrl() + '/plan.html?paypal=cancel',
      requestId: crypto.randomUUID(),
    });
  } catch (err) {
    console.error('[billing] createSubscription:', err.message);
    return res.status(502).json({ error: 'PayPal rechazó la solicitud. Intenta de nuevo en unos minutos.' });
  }

  const approveUrl = paypal.approveLink(created);
  if (!approveUrl) {
    return res.status(502).json({ error: 'PayPal no devolvió un enlace de pago.' });
  }

  // Se guarda ya en APPROVAL_PENDING: así, al volver, podemos comprobar que la
  // suscripción que nos presentan es una que NOSOTROS creamos para esta clínica.
  await subscription.upsertFromPayPal(created, { clinicId, userId: req.user.id });

  res.json({ subscription_id: created.id, approve_url: approveUrl });
});

// ── POST /api/billing/confirm ──
// Se llama al volver de PayPal. El id llega por la URL, así que se valida contra
// la fila local antes de consultar a PayPal: nadie puede "adoptar" la
// suscripción de otro pasando un id ajeno.
router.post('/confirm', authenticate, requireRole(...OWNER_ROLES), async (req, res) => {
  const clinicId = req.user.clinic_id;
  const id = String((req.body && req.body.subscription_id) || '').trim();
  if (!SUBSCRIPTION_ID_RE.test(id)) return res.status(400).json({ error: 'Identificador de suscripción inválido.' });
  if (!clinicId) return res.status(403).json({ error: 'Tu usuario no tiene una clínica asignada.' });

  const own = await query('SELECT id FROM subscriptions WHERE external_id = $1 AND clinic_id = $2', [id, clinicId]);
  if (own.rowCount === 0) {
    return res.status(404).json({ error: 'Esa suscripción no pertenece a esta cuenta.' });
  }

  let remote;
  try {
    remote = await paypal.getSubscription(id);
  } catch (err) {
    console.error('[billing] getSubscription:', err.message);
    return res.status(502).json({ error: 'No se pudo verificar el estado con PayPal. Intenta de nuevo.' });
  }

  const row = await subscription.upsertFromPayPal(remote, { clinicId, userId: req.user.id });
  const access = subscription.accessFromSubscription(row);
  res.json({ subscription: publicSubscription(row), access });
});

// ── POST /api/billing/sync — refrescar contra PayPal a mano ──
// Red de seguridad si un webhook se perdió (o si aún no están configurados).
router.post('/sync', authenticate, requireRole(...OWNER_ROLES), async (req, res) => {
  const clinicId = req.user.clinic_id;
  const local = clinicId ? await subscription.getClinicSubscription(clinicId) : null;
  if (!local) return res.json({ subscription: null, access: { active: false, reason: 'none' } });
  if (!paypal.isConfigured()) return res.status(503).json({ error: 'PayPal no está configurado.' });

  let remote;
  try {
    remote = await paypal.getSubscription(local.external_id);
  } catch (err) {
    console.error('[billing] sync:', err.message);
    return res.status(502).json({ error: 'No se pudo consultar a PayPal.' });
  }

  const row = await subscription.upsertFromPayPal(remote, { clinicId });
  res.json({ subscription: publicSubscription(row), access: subscription.accessFromSubscription(row) });
});

// ── POST /api/billing/cancel ──
router.post('/cancel', authenticate, requireRole(...OWNER_ROLES), async (req, res) => {
  const clinicId = req.user.clinic_id;
  const local = clinicId ? await subscription.getClinicSubscription(clinicId) : null;
  if (!local) return res.status(404).json({ error: 'No hay ninguna suscripción que cancelar.' });

  const reason = String((req.body && req.body.reason) || '').slice(0, 128) || 'Cancelada desde Salud Digital';

  try {
    await paypal.cancelSubscription(local.external_id, reason);
  } catch (err) {
    // 422 = PayPal dice que ya no está activa. No es un error para el usuario:
    // se sincroniza el estado real y se responde normal.
    if (err.status !== 422) {
      console.error('[billing] cancel:', err.message);
      return res.status(502).json({ error: 'PayPal no pudo cancelar la suscripción. Intenta de nuevo.' });
    }
  }

  let row = local;
  try {
    row = await subscription.upsertFromPayPal(await paypal.getSubscription(local.external_id), { clinicId });
  } catch (err) {
    console.warn('[billing] no se pudo releer tras cancelar:', err.message);
  }

  res.json({ subscription: publicSubscription(row), access: subscription.accessFromSubscription(row) });
});

// ── POST /api/billing/webhook ──
// Público (PayPal no manda cookies). La autenticidad la da la verificación de
// firma contra la API de PayPal; sin PAYPAL_WEBHOOK_ID no se procesa nada.
// req.body llega como Buffer: express.raw se monta para esta ruta en server.js
// ANTES del express.json global, porque la firma se calcula sobre el cuerpo tal
// cual llegó.
router.post('/webhook', async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));

  if (!paypal.isConfigured() || !paypal.webhookId()) {
    console.warn('[billing] webhook recibido pero PayPal no está configurado');
    return res.status(503).end();
  }

  let verified = false;
  try {
    verified = await paypal.verifyWebhookSignature(req.headers, raw);
  } catch (err) {
    console.error('[billing] verificación de webhook falló:', err.message);
  }
  if (!verified) {
    console.warn('[billing] webhook con firma inválida — descartado');
    return res.status(400).end();
  }

  let event;
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).end();
  }

  // Idempotencia: si el id ya está registrado, PayPal está reintentando.
  try {
    const dedupe = await query(
      `INSERT INTO paypal_webhook_events (event_id, event_type)
       VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
      [String(event.id || '').slice(0, 120), String(event.event_type || '').slice(0, 80)],
    );
    if (dedupe.rowCount === 0) return res.status(200).end();
  } catch (err) {
    console.warn('[billing] dedupe de webhook falló:', err.message);
  }

  try {
    await handleEvent(event);
  } catch (err) {
    // 200 igualmente: reintentar no arreglaría un bug nuestro y PayPal seguiría
    // machacando. El estado real se recupera con el botón "Actualizar estado".
    console.error('[billing] error procesando webhook', event.event_type, err.message);
  }

  res.status(200).end();
});

async function handleEvent(event) {
  const type = String(event.event_type || '').toUpperCase();
  const resource = event.resource || {};

  if (type === 'PAYMENT.SALE.COMPLETED' || type === 'PAYMENT.SALE.REFUNDED' || type === 'PAYMENT.SALE.REVERSED') {
    const subId = resource.billing_agreement_id;
    if (!subId) return;
    const amount = resource.amount || {};
    await subscription.recordPayment({
      externalSubscriptionId: subId,
      paymentId: resource.id,
      amount: parseFloat(amount.total || amount.value || 0) || 0,
      currencyCode: amount.currency || amount.currency_code,
      status: type === 'PAYMENT.SALE.COMPLETED' ? 'COMPLETED' : type.split('.').pop(),
      paidAt: resource.create_time || new Date(),
    });
    // Tras el cobro cambia next_billing_time: se relee la suscripción completa.
    await refreshSubscription(subId);
    return;
  }

  if (type.startsWith('BILLING.SUBSCRIPTION.')) {
    const subId = resource.id;
    if (!subId) return;
    await refreshSubscription(subId, resource);
  }
}

// Relee el estado desde la API (más fiable que el resource del evento, que a
// veces llega parcial) y cae al resource del webhook si la API falla.
async function refreshSubscription(subId, fallbackResource) {
  try {
    const remote = await paypal.getSubscription(subId);
    await subscription.upsertFromPayPal(remote, {});
  } catch (err) {
    console.warn('[billing] no se pudo releer la suscripción', subId, '→', err.message);
    if (fallbackResource && fallbackResource.id) {
      await subscription.upsertFromPayPal(fallbackResource, {});
    }
  }
}

module.exports = router;
