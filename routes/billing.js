// ── /api/billing — API de suscripciones ──
//
// Esta capa NO conoce PayPal: solo habla con los servicios y con la interfaz
// PaymentProvider. Cambiar de procesador no debería tocar este archivo salvo,
// como mucho, el bloque `checkout` que se envía al navegador.

const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { getProvider, enabledProviderNames, PaymentError } = require('../lib/payments/provider');
const subs = require('../lib/billing/subscription-service');
const billing = require('../lib/billing/billing-service');
const webhooks = require('../lib/billing/webhook-service');

// Quien puede contratar y cancelar: el dueño de la cuenta. La recepcionista ve
// el estado (para entender por qué está bloqueada la app) pero no paga.
const OWNER_ROLES = ['clinic_admin', 'doctor'];

const REF_SUSCRIPCION = /^[A-Za-z0-9_-]{6,64}$/;

function appUrl() {
  const raw = String(process.env.APP_URL || '').trim().replace(/\/+$/, '');
  return raw || 'http://localhost:' + (process.env.PORT || 3000);
}

function publicPlan(p) {
  return {
    code: p.code,
    name: p.name,
    description: p.description,
    amount: p.amount,
    currency: p.currency,
    interval: p.billing_interval,
    interval_count: p.interval_count,
    trial_days: p.trial_days,
  };
}

function publicSubscription(s) {
  if (!s) return null;
  return {
    id: s.provider_subscription_id,
    provider: s.provider,
    status: s.status,
    plan_code: s.plan_code || null,
    plan_name: s.plan_name || null,
    amount: s.amount,
    currency: s.currency,
    interval: s.billing_interval,
    current_period_start: s.current_period_start,
    current_period_end: s.current_period_end,
    next_billing_at: s.next_billing_at,
    cancel_at_period_end: s.cancel_at_period_end,
    cancelled_at: s.cancelled_at,
    failed_attempts: s.failed_attempts,
    subscriber_email: s.subscriber_email || '',
    subscriber_name: s.subscriber_name || '',
    created_at: s.created_at,
  };
}

/**
 * Procesador que pide el navegador, validado contra los habilitados. Devolver
 * `null` significa "el que toque por defecto". Un nombre que no esté habilitado
 * NO se ignora en silencio: cobrar por un procesador distinto del que el usuario
 * eligió sería una sorpresa desagradable, así que se responde 400.
 */
function providerPedido(req) {
  const pedido = String((req.body && req.body.provider) || '').trim().toLowerCase();
  if (!pedido) return null;
  if (!enabledProviderNames().includes(pedido)) {
    const err = new PaymentError('Ese método de pago no está disponible.', { code: 'provider_not_enabled' });
    throw err;
  }
  return pedido;
}

function manejarError(res, err, mensajeGenerico) {
  if (err instanceof PaymentError) {
    const mapa = {
      already_subscribed: 409,
      unknown_plan: 400,
      inactive_plan: 400,
      no_clinic: 403,
      provider_not_enabled: 400,
      provider_not_configured: 503,
      plan_not_mapped: 503,
      unsupported_operation: 501,
    };
    const status = mapa[err.code] || 502;
    return res.status(status).json({ error: err.message, code: err.code });
  }
  console.error('[billing]', mensajeGenerico, err);
  return res.status(500).json({ error: mensajeGenerico });
}

// ── Catálogo ──
router.get('/plans', authenticate, async (req, res) => {
  res.json((await subs.listPlans()).map(publicPlan));
});

// ── Estado ──
// Exenta del bloqueo (ver middleware/subscription.js): es justo lo que hay que
// poder consultar cuando la app está bloqueada.
router.get('/status', authenticate, async (req, res) => {
  const clinicId = req.user.clinic_id;
  const sub = clinicId ? await subs.getForClinic(clinicId) : null;
  const acceso = subs.access(sub);

  const enforcement = require('../lib/subscription');
  const exento = clinicId ? enforcement.isExemptClinic(clinicId) : true;

  let provider = null;
  let checkout = { provider: 'none', configured: false };
  try {
    // Qué checkout se pinta: el del procesador que cobrará el PRÓXIMO pago.
    // Solo se usa el de la suscripción existente mientras esta dé acceso (hay
    // que poder gestionarla con su propio procesador). Si es un intento a
    // medias del provider anterior, manda el activo — si no, cambiar
    // PAYMENTS_PROVIDER no serviría de nada: la pantalla seguiría ofreciendo el
    // checkout viejo para siempre.
    provider = getProvider(sub && acceso.active ? sub.provider : undefined);
    checkout = { ...provider.publicConfig(), configured: provider.isConfigured(), capabilities: provider.capabilities };
  } catch (_) {
    /* procesador desconocido: se informa como no configurado */
  }

  // Todos los procesadores ofrecidos, uno por forma de pagar. La pantalla pinta
  // una opción por cada uno: con PayPal el cobro es automático pero exige cuenta
  // PayPal; con pago único se acepta cualquier tarjeta pero cada mes lo paga el
  // cliente a mano. `checkout` (singular) se conserva por compatibilidad.
  const checkouts = [];
  for (const nombre of enabledProviderNames()) {
    try {
      const p = getProvider(nombre);
      if (!p.isConfigured()) continue;
      checkouts.push({ ...p.publicConfig(), configured: true, capabilities: p.capabilities });
    } catch (_) {
      /* procesador desconocido o sin credenciales: no se ofrece */
    }
  }

  const planes = await subs.listPlans();

  res.json({
    configured: !!(provider && provider.isConfigured()),
    enforced: enforcement.enforcementEnabled(),
    exempt: exento,
    can_manage: OWNER_ROLES.includes(req.user.role),
    checkout,
    checkouts,
    plans: planes.map(publicPlan),
    access: {
      active: acceso.active || exento || !enforcement.enforcementEnabled(),
      paid: acceso.active,
      reason: acceso.reason,
    },
    subscription: publicSubscription(sub),
  });
});

// ── Historial de cobros ──
router.get('/payments', authenticate, requireRole(...OWNER_ROLES), async (req, res) => {
  if (!req.user.clinic_id) return res.json([]);
  const r = await query(
    `SELECT provider_payment_id, amount, currency, status, attempt, failure_message, paid_at, created_at
       FROM payments WHERE clinic_id = $1 ORDER BY COALESCE(paid_at, created_at) DESC LIMIT 50`,
    [req.user.clinic_id],
  );
  res.json(
    r.rows.map((p) => ({
      id: p.provider_payment_id,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      attempt: p.attempt,
      failure_message: p.failure_message || '',
      paid_at: p.paid_at || p.created_at,
    })),
  );
});

// ── Alta ──
router.post('/subscribe', authenticate, requireRole(...OWNER_ROLES), async (req, res) => {
  try {
    const usuario = await query('SELECT name, email FROM users WHERE id = $1', [req.user.id]);
    const yo = usuario.rows[0] || {};

    const r = await subs.start({
      clinicId: req.user.clinic_id,
      userId: req.user.id,
      planCode: String((req.body && req.body.plan_code) || 'individual-monthly'),
      email: yo.email || req.user.email,
      name: yo.name || '',
      returnUrl: appUrl() + '/plan.html?checkout=return',
      cancelUrl: appUrl() + '/plan.html?checkout=cancel',
      providerName: providerPedido(req) || undefined,
    });

    res.json({
      subscription_id: r.providerSubscriptionId,
      approve_url: r.approvalUrl,
      plan: publicPlan(r.plan),
    });
  } catch (err) {
    manejarError(res, err, 'No se pudo iniciar la suscripción.');
  }
});

// ── Pago único de un periodo (procesadores 'manual') ──
//
// Es el flujo que permite el formulario de tarjeta DENTRO de nuestra página.
// El navegador pide una orden, el usuario paga en el widget y luego pedimos la
// captura. El importe lo pone SIEMPRE el servidor desde el catálogo de planes:
// si viniera del navegador, cualquiera podría suscribirse por un centavo.
router.post('/order', authenticate, requireRole(...OWNER_ROLES), async (req, res) => {
  try {
    const clinicId = req.user.clinic_id;
    if (!clinicId) return res.status(403).json({ error: 'Tu usuario no tiene una clínica asignada.' });

    let sub = await subs.getForClinic(clinicId);
    const acceso = subs.access(sub);
    const pedido = providerPedido(req);
    const activo = getProvider(pedido || undefined);

    // Sin suscripción utilizable se crea una nueva antes de cobrar. Cuenta como
    // inutilizable:
    //   • que no exista, haya expirado, o esté cancelada y ya vencida;
    //   • que sea de OTRO procesador y nunca llegara a dar acceso — típico al
    //     cambiar PAYMENTS_PROVIDER dejando atrás intentos a medias. Sin esto,
    //     el intento viejo bloquearía el cobro nuevo con un error confuso.
    const inutilizable =
      !sub ||
      sub.status === 'expired' ||
      (sub.status === 'cancelled' && !acceso.active) ||
      (sub.provider !== activo.name && !acceso.active);

    if (inutilizable) {
      const alta = await subs.start({
        clinicId,
        userId: req.user.id,
        planCode: String((req.body && req.body.plan_code) || 'individual-monthly'),
        email: req.user.email,
        providerName: pedido || undefined,
      });
      sub = alta.subscription;
    }

    const provider = getProvider(sub.provider);
    if (provider.capabilities.recurring !== 'manual') {
      return res.status(400).json({
        error: 'Este procesador cobra por su cuenta; no se crean órdenes manuales.',
        code: 'not_manual_provider',
      });
    }

    const plan = await subs.getPlanById(sub.plan_id);
    if (!plan) return res.status(500).json({ error: 'La suscripción no tiene plan asociado.' });

    const orden = await provider.createOrder({
      amount: plan.amount,
      currency: plan.currency,
      description: `${plan.name} — ${plan.billing_interval === 'month' ? 'mes' : plan.billing_interval}`,
      // Ata el pago a la suscripción: vuelve en la captura y en el webhook.
      customId: sub.provider_subscription_id,
      idempotencyKey: 'ord-' + sub.id + '-' + Date.now(),
    });

    res.json({
      order_id: orden.orderId,
      amount: plan.amount,
      currency: plan.currency,
      plan: publicPlan(plan),
    });
  } catch (err) {
    manejarError(res, err, 'No se pudo preparar el pago.');
  }
});

// Captura: aquí es donde el dinero se mueve de verdad y donde se extiende el
// periodo. Es idempotente por partida doble — PayPal reconoce la orden ya
// capturada y, aun así, el pago se registra con UNIQUE, de modo que repetir la
// llamada nunca regala un mes.
router.post('/capture', authenticate, requireRole(...OWNER_ROLES), async (req, res) => {
  const orderId = String((req.body && req.body.order_id) || '').trim();
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(orderId)) {
    return res.status(400).json({ error: 'Identificador de orden inválido.' });
  }

  try {
    // La captura la hace el MISMO procesador que creó la orden — el navegador lo
    // manda de vuelta y se valida contra los habilitados; si no lo manda, el de
    // por defecto. Nunca el de una suscripción antigua que pudiera quedar por ahí.
    const provider = getProvider(providerPedido(req) || undefined);
    const captura = await provider.captureOrder({ orderId, idempotencyKey: 'cap-' + orderId });

    // A qué suscripción pertenece: manda el custom_id que puso el servidor al
    // crear la orden — el navegador no puede falsearlo. Si no viniera, se cae a
    // la suscripción vigente de la clínica.
    let sub = captura.customId
      ? await subs.getByProviderRef(provider.name, captura.customId)
      : null;
    if (!sub) sub = await subs.getForClinic(req.user.clinic_id);

    if (!sub) return res.status(404).json({ error: 'No hay suscripción que pagar.' });
    if (sub.clinic_id !== req.user.clinic_id) {
      return res.status(403).json({ error: 'Esa orden no corresponde a esta cuenta.' });
    }

    if (captura.status !== 'succeeded') {
      const fallida = await subs.markPaymentFailed(sub, {
        reason: captura.failureMessage || 'El pago no fue aprobado',
        code: 'capture_' + captura.status,
        providerPaymentId: captura.id,
        amount: captura.amount,
      });
      return res.status(402).json({
        error: 'El pago no se completó. Revisa los datos de tu tarjeta e inténtalo de nuevo.',
        subscription: publicSubscription(fallida),
      });
    }

    // Comprobación de importe: si no coincide con el plan, se registra igual
    // (el dinero ya se movió) pero queda constancia para revisarlo.
    const plan = await subs.getPlanById(sub.plan_id);
    if (plan && Math.abs(captura.amount - plan.amount) > 0.009) {
      console.warn(
        `[billing] importe capturado ${captura.amount} ≠ plan ${plan.amount} (suscripción ${sub.id})`,
      );
    }

    const actualizada = await subs.markPaymentSucceeded(sub, {
      amount: captura.amount,
      currency: captura.currency,
      providerPaymentId: captura.id,
      paidAt: new Date(),
    });

    res.json({
      subscription: publicSubscription(actualizada),
      access: subs.access(actualizada),
      payment: { id: captura.id, amount: captura.amount, currency: captura.currency },
    });
  } catch (err) {
    manejarError(res, err, 'No se pudo confirmar el pago.');
  }
});

// ── Confirmación tras el checkout ──
// El id llega por el navegador, así que se comprueba contra nuestra fila ANTES
// de consultar al procesador: nadie puede adoptar la suscripción de otro.
router.post('/confirm', authenticate, requireRole(...OWNER_ROLES), async (req, res) => {
  const ref = String((req.body && req.body.subscription_id) || '').trim();
  if (!REF_SUSCRIPCION.test(ref)) return res.status(400).json({ error: 'Identificador inválido.' });

  const propia = await query(
    'SELECT id FROM subscriptions WHERE provider_subscription_id = $1 AND clinic_id = $2',
    [ref, req.user.clinic_id],
  );
  if (propia.rowCount === 0) {
    return res.status(404).json({ error: 'Esa suscripción no pertenece a esta cuenta.' });
  }

  try {
    const sub = await subs.getForClinic(req.user.clinic_id);
    const actualizada = await subs.syncFromProvider(sub);
    res.json({ subscription: publicSubscription(actualizada), access: subs.access(actualizada) });
  } catch (err) {
    manejarError(res, err, 'No se pudo verificar el estado con el procesador.');
  }
});

// ── Relectura manual ──
router.post('/sync', authenticate, requireRole(...OWNER_ROLES), async (req, res) => {
  const sub = await subs.getForClinic(req.user.clinic_id);
  if (!sub) return res.json({ subscription: null, access: { active: false, reason: 'none' } });
  try {
    const actualizada = await subs.syncFromProvider(sub);
    res.json({ subscription: publicSubscription(actualizada), access: subs.access(actualizada) });
  } catch (err) {
    manejarError(res, err, 'No se pudo consultar al procesador.');
  }
});

// ── Cancelación ──
router.post('/cancel', authenticate, requireRole(...OWNER_ROLES), async (req, res) => {
  const sub = await subs.getForClinic(req.user.clinic_id);
  if (!sub) return res.status(404).json({ error: 'No hay ninguna suscripción que cancelar.' });
  try {
    const actualizada = await subs.cancel(sub, {
      reason: String((req.body && req.body.reason) || 'Cancelada por el usuario'),
      immediate: false,
      userId: req.user.id,
    });
    res.json({ subscription: publicSubscription(actualizada), access: subs.access(actualizada) });
  } catch (err) {
    manejarError(res, err, 'No se pudo cancelar la suscripción.');
  }
});

// ── Cambio de plan ──
router.post('/change-plan', authenticate, requireRole(...OWNER_ROLES), async (req, res) => {
  const sub = await subs.getForClinic(req.user.clinic_id);
  if (!sub) return res.status(404).json({ error: 'No hay suscripción que cambiar.' });
  try {
    const r = await subs.changePlan(sub, {
      planCode: String((req.body && req.body.plan_code) || ''),
      userId: req.user.id,
    });
    res.json({
      subscription: publicSubscription(r.subscription),
      proration: r.proration || null,
      approve_url: r.approvalUrl || null,
    });
  } catch (err) {
    manejarError(res, err, 'No se pudo cambiar de plan.');
  }
});

// ── Reintento manual de un cobro fallido ──
router.post('/retry', authenticate, requireRole(...OWNER_ROLES), async (req, res) => {
  const sub = await subs.getForClinic(req.user.clinic_id);
  if (!sub) return res.status(404).json({ error: 'No hay suscripción.' });
  try {
    const r = await billing.retryNow(sub);
    res.json({
      ok: !!r.ok,
      delegated: !!r.delegated,
      subscription: publicSubscription(r.subscription || sub),
    });
  } catch (err) {
    manejarError(res, err, 'No se pudo reintentar el cobro.');
  }
});

// ── Webhooks ──
// Públicos (el procesador no manda cookies). La autenticidad la da la
// verificación de firma dentro del provider. req.body llega como Buffer:
// express.raw se monta para esta ruta en server.js ANTES del express.json
// global, porque la firma se calcula sobre el cuerpo tal cual llegó.
async function manejarWebhook(req, res) {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  const r = await webhooks.receive({
    providerName: req.params.provider,
    headers: req.headers,
    rawBody: raw,
  });
  res.status(r.status).end();
}

router.post('/webhook', manejarWebhook);
router.post('/webhook/:provider', manejarWebhook);

// ── Observabilidad (solo super admin) ──
router.get('/events', authenticate, requireRole('super_admin'), async (req, res) => {
  const r = await query(
    `SELECT id, provider, provider_event_id, event_type, signature_verified, status,
            attempts, last_error, received_at, processed_at
       FROM payment_events ORDER BY received_at DESC LIMIT 100`,
  );
  res.json(r.rows);
});

router.post('/events/reprocess', authenticate, requireRole('super_admin'), async (req, res) => {
  res.json(await webhooks.reprocessFailed({ limit: 50 }));
});

module.exports = router;
