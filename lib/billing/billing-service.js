// ── BillingService — cobrar cuando el procesador NO lo hace por nosotros ──
//
// Solo actúa sobre suscripciones cuyo procesador declara capabilities.recurring
// === 'token'. Con un procesador de recurrencia nativa (PayPal Subscriptions)
// este servicio NO programa nada: cobrar por nuestra cuenta duplicaría cargos.
//
// Garantías:
//   • Idempotencia por periodo: la clave de idempotencia incluye la suscripción
//     y la fecha de cobro, así que dos ejecuciones simultáneas del job no
//     cobran dos veces.
//   • Un fallo no rompe la suscripción: pasa a past_due y se reprograma el
//     reintento. Solo tras agotar los intentos cae a payment_failed.
//   • Nunca se cobra una suscripción cancelada o expirada.

const crypto = require('crypto');
const { query } = require('../../db');
const { getProvider, PaymentError } = require('../payments/provider');
const subs = require('./subscription-service');

// Días de espera entre reintentos. Se puede afinar por entorno; el último valor
// se repite si hicieran falta más intentos.
function calendarioReintentos() {
  const raw = String(process.env.BILLING_RETRY_DAYS || '1,3,5')
    .split(',')
    .map((n) => parseFloat(n.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return raw.length ? raw : [1, 3, 5];
}

function esperaParaIntento(intento) {
  const cal = calendarioReintentos();
  const dias = cal[Math.min(intento, cal.length) - 1] || cal[cal.length - 1];
  return dias * 24 * 60 * 60 * 1000;
}

/** Suscripciones que toca cobrar ahora (solo procesadores de tipo token). */
async function findDue({ ahora = new Date(), limit = 50 } = {}) {
  const r = await query(
    `SELECT s.*, p.code AS plan_code, p.name AS plan_name, p.provider_refs AS plan_provider_refs
       FROM subscriptions s
       LEFT JOIN plans p ON p.id = s.plan_id
      WHERE s.status IN ('active','past_due','trialing')
        AND s.next_billing_at IS NOT NULL
        AND s.next_billing_at <= $1
      ORDER BY s.next_billing_at ASC
      LIMIT $2`,
    [ahora, limit],
  );

  // El filtro por capacidad se hace en memoria: la BD no sabe de providers.
  return r.rows.filter((s) => {
    try {
      return getProvider(s.provider).capabilities.recurring === 'token';
    } catch {
      return false;
    }
  });
}

/**
 * Cobra un periodo de una suscripción.
 * @returns {Promise<{ok:boolean, skipped?:string, payment?:object, subscription:object}>}
 */
async function chargeSubscription(sub, { ahora = new Date() } = {}) {
  if (['cancelled', 'expired'].includes(sub.status)) {
    return { ok: false, skipped: 'subscription_' + sub.status, subscription: sub };
  }

  const provider = getProvider(sub.provider);
  if (provider.capabilities.recurring !== 'token') {
    return { ok: false, skipped: 'provider_bills_natively', subscription: sub };
  }
  if (!provider.isConfigured()) {
    return { ok: false, skipped: 'provider_not_configured', subscription: sub };
  }

  const metodo = await metodoDePago(sub);
  if (!metodo) {
    const actualizada = await subs.markPaymentFailed(sub, {
      reason: 'No hay método de pago guardado para cobrar la renovación',
      code: 'no_payment_method',
    });
    return { ok: false, skipped: 'no_payment_method', subscription: actualizada };
  }

  // Clave estable por suscripción + fecha de cobro: si el job corre dos veces
  // (o dos instancias a la vez) el procesador reconoce el duplicado.
  const clave = claveIdempotencia(sub);

  let cobro;
  try {
    cobro = await provider.charge({
      amount: Number(sub.amount),
      currency: sub.currency,
      paymentMethodToken: metodo.provider_token,
      customerId: sub.provider_customer_id || '',
      idempotencyKey: clave,
      description: `Salud Digital — ${sub.plan_name || 'suscripción'}`,
      metadata: { subscription_id: sub.id, clinic_id: sub.clinic_id },
    });
  } catch (err) {
    const actualizada = await tratarFallo(sub, err, ahora);
    return { ok: false, error: err.message, subscription: actualizada };
  }

  if (cobro.status !== 'succeeded') {
    const actualizada = await tratarFallo(
      sub,
      new PaymentError(cobro.failureMessage || 'El cobro no fue aprobado', {
        code: cobro.failureCode || 'declined',
        retryable: true,
      }),
      ahora,
      cobro.id,
    );
    return { ok: false, error: 'declined', subscription: actualizada };
  }

  const actualizada = await subs.markPaymentSucceeded(sub, {
    amount: cobro.amount != null ? cobro.amount : Number(sub.amount),
    currency: cobro.currency || sub.currency,
    paidAt: ahora,
    providerPaymentId: cobro.id,
  });

  return { ok: true, payment: cobro, subscription: actualizada };
}

async function tratarFallo(sub, err, ahora, providerPaymentId) {
  const actualizada = await subs.markPaymentFailed(sub, {
    reason: err.message,
    code: err.code,
    providerPaymentId,
  });

  // Si aún quedan intentos, se reprograma. Si se agotaron, next_billing_at se
  // queda a NULL: no se vuelve a intentar hasta que el usuario actúe.
  if (actualizada.status === 'past_due' && err.retryable !== false) {
    const proximo = new Date(ahora.getTime() + esperaParaIntento(actualizada.failed_attempts));
    await query('UPDATE subscriptions SET next_billing_at = $2 WHERE id = $1', [sub.id, proximo]);
    actualizada.next_billing_at = proximo;
  } else if (actualizada.status === 'payment_failed') {
    await query('UPDATE subscriptions SET next_billing_at = NULL WHERE id = $1', [sub.id]);
    actualizada.next_billing_at = null;
  }
  return actualizada;
}

function claveIdempotencia(sub) {
  const fecha = sub.next_billing_at ? new Date(sub.next_billing_at).toISOString().slice(0, 10) : 'inicial';
  return crypto
    .createHash('sha256')
    .update(`sub:${sub.id}:${fecha}:${sub.failed_attempts || 0}`)
    .digest('hex')
    .slice(0, 40);
}

async function metodoDePago(sub) {
  if (sub.payment_method_id) {
    const r = await query("SELECT * FROM payment_methods WHERE id = $1 AND status = 'active'", [sub.payment_method_id]);
    if (r.rows[0]) return r.rows[0];
  }
  const r = await query(
    `SELECT * FROM payment_methods
      WHERE clinic_id = $1 AND provider = $2 AND status = 'active'
      ORDER BY is_default DESC, id DESC LIMIT 1`,
    [sub.clinic_id, sub.provider],
  );
  return r.rows[0] || null;
}

/** Pasada completa del ciclo: cobra lo vencido y caduca lo que ya no toca. */
async function runBillingCycle({ ahora = new Date(), limit = 50 } = {}) {
  const resumen = { intentadas: 0, cobradas: 0, fallidas: 0, omitidas: 0, expiradas: 0, pendientesDePago: 0, errores: [] };

  let pendientes = [];
  try {
    pendientes = await findDue({ ahora, limit });
  } catch (err) {
    resumen.errores.push('findDue: ' + err.message);
    return resumen;
  }

  for (const sub of pendientes) {
    resumen.intentadas++;
    try {
      const r = await chargeSubscription(sub, { ahora });
      if (r.ok) resumen.cobradas++;
      else if (r.skipped) resumen.omitidas++;
      else resumen.fallidas++;
    } catch (err) {
      resumen.fallidas++;
      resumen.errores.push(`sub ${sub.id}: ${err.message}`);
    }
  }

  // Renovación manual: no se puede cobrar sin el usuario delante, así que lo
  // único que toca es marcar la renovación como vencida para que la interfaz
  // se la pida.
  try {
    resumen.pendientesDePago = await subs.markManualOverdue(ahora);
  } catch (err) {
    resumen.errores.push('markManualOverdue: ' + err.message);
  }

  try {
    resumen.expiradas = await subs.expireOverdue(ahora);
  } catch (err) {
    resumen.errores.push('expireOverdue: ' + err.message);
  }

  return resumen;
}

/** Reintento a petición del usuario (botón "reintentar el cobro"). */
async function retryNow(sub) {
  const provider = getProvider(sub.provider);
  if (provider.capabilities.recurring === 'native') {
    // Con recurrencia nativa el reintento lo maneja el procesador; lo único
    // honesto es releer el estado.
    return { ok: true, delegated: true, subscription: await subs.syncFromProvider(sub) };
  }
  return chargeSubscription(sub);
}

module.exports = {
  findDue,
  chargeSubscription,
  runBillingCycle,
  retryNow,
  calendarioReintentos,
  esperaParaIntento,
  _claveIdempotencia: claveIdempotencia,
};
