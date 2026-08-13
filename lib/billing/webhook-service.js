// ── WebhookService — la única fuente de verdad sobre los cobros ──
//
// El frontend NUNCA decide si un pago fue bueno: lo dice el procesador por aquí
// (o una relectura explícita por API). Este servicio:
//   1. delega la verificación de firma en el provider;
//   2. guarda TODO evento recibido, verificado o no;
//   3. es idempotente: el mismo provider_event_id no se procesa dos veces;
//   4. deja los fallos en estado 'failed' con su error, para reprocesarlos.

const { query } = require('../../db');
const { getProvider, EVENT } = require('../payments/provider');
const subs = require('./subscription-service');

/**
 * Punto de entrada del endpoint HTTP.
 * @returns {Promise<{status:number, resultado:string, eventId?:string}>}
 *   status es el código HTTP que debe devolverse al procesador.
 */
async function receive({ providerName, headers, rawBody }) {
  let provider;
  try {
    provider = getProvider(providerName);
  } catch (err) {
    return { status: 404, resultado: 'unknown_provider' };
  }

  if (!provider.isConfigured()) {
    // 503 → el procesador reintentará cuando el servicio esté configurado.
    return { status: 503, resultado: 'provider_not_configured' };
  }

  let evento;
  try {
    evento = await provider.handleWebhook({ headers, rawBody });
  } catch (err) {
    console.error('[billing] webhook ilegible:', err.message);
    await registrarEvento(provider.name, {
      eventId: 'unparseable:' + Date.now(),
      type: EVENT.UNKNOWN,
      verified: false,
      raw: { error: err.message },
    }, 'failed', err.message);
    return { status: 400, resultado: 'bad_request' };
  }

  if (!evento.verified) {
    // Firma inválida: se deja constancia (es señal de ataque o de webhook mal
    // configurado) pero NO se procesa nada.
    console.warn('[billing] webhook con firma inválida — descartado');
    await registrarEvento(provider.name, evento, 'ignored', 'firma no verificada');
    return { status: 400, resultado: 'invalid_signature' };
  }

  const { fila, duplicado } = await registrarEvento(provider.name, evento, 'pending');
  if (duplicado) {
    // Reintento del procesador sobre algo ya procesado: 200 y a otra cosa.
    return { status: 200, resultado: 'duplicate', eventId: evento.eventId };
  }

  try {
    const resultado = await procesar(provider, evento);
    await query(
      `UPDATE payment_events SET status = 'processed', processed_at = CURRENT_TIMESTAMP,
              attempts = attempts + 1, last_error = '' WHERE id = $1`,
      [fila.id],
    );
    return { status: 200, resultado, eventId: evento.eventId };
  } catch (err) {
    console.error('[billing] error procesando webhook', evento.type, err.message);
    await query(
      `UPDATE payment_events SET status = 'failed', attempts = attempts + 1,
              last_error = $2 WHERE id = $1`,
      [fila.id, String(err.message).slice(0, 400)],
    );
    // 200 igualmente: el evento ya está guardado y se reprocesa desde nuestro
    // lado. Devolver 5xx haría que el procesador reintentara en bucle por un
    // fallo que es nuestro.
    return { status: 200, resultado: 'stored_with_error', eventId: evento.eventId };
  }
}

/** Aplica un evento ya verificado al estado de la suscripción. */
async function procesar(provider, evento) {
  if (!evento.subscriptionRef) return 'sin_suscripcion_asociada';

  const sub = await subs.getByProviderRef(provider.name, evento.subscriptionRef);
  if (!sub) {
    // Puede pasar legítimamente: suscripción creada fuera de la plataforma o
    // ya borrada. Se guarda el evento igualmente.
    return 'suscripcion_desconocida';
  }

  switch (evento.type) {
    case EVENT.PAYMENT_SUCCEEDED: {
      await subs.markPaymentSucceeded(sub, {
        amount: evento.amount,
        currency: evento.currency,
        paidAt: evento.occurredAt,
        providerPaymentId: evento.paymentRef,
      });
      // Tras el cobro cambia el periodo: se relee para tener la fecha exacta
      // que dice el procesador, no la nuestra calculada.
      await subs.syncFromProvider(sub).catch(() => {});
      return 'pago_registrado';
    }

    case EVENT.PAYMENT_FAILED: {
      await subs.markPaymentFailed(sub, {
        reason: 'El procesador reportó un cobro fallido',
        code: 'provider_reported',
        providerPaymentId: evento.paymentRef,
        amount: evento.amount,
      });
      return 'fallo_registrado';
    }

    case EVENT.PAYMENT_REFUNDED: {
      await query(
        `UPDATE payments SET status = 'refunded' WHERE provider = $1 AND provider_payment_id = $2`,
        [provider.name, evento.paymentRef || ''],
      );
      return 'reembolso_registrado';
    }

    case EVENT.SUBSCRIPTION_ACTIVATED:
    case EVENT.SUBSCRIPTION_UPDATED:
    case EVENT.SUBSCRIPTION_SUSPENDED:
    case EVENT.SUBSCRIPTION_CANCELLED:
    case EVENT.SUBSCRIPTION_EXPIRED: {
      // Para los cambios de estado se relee del procesador en vez de fiarse del
      // cuerpo del evento, que a veces llega parcial.
      await subs.syncFromProvider(sub);
      return 'estado_sincronizado';
    }

    default:
      return 'evento_ignorado';
  }
}

/**
 * Guarda el evento. El UNIQUE (provider, provider_event_id) es lo que hace
 * imposible procesar dos veces el mismo.
 */
async function registrarEvento(providerName, evento, status = 'pending', error = '') {
  const r = await query(
    `INSERT INTO payment_events (provider, provider_event_id, event_type, signature_verified, status, payload, last_error, attempts)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,0)
     ON CONFLICT (provider, provider_event_id) DO NOTHING
     RETURNING *`,
    [
      providerName,
      String(evento.eventId || 'sin-id:' + Date.now()).slice(0, 200),
      String(evento.providerType || evento.type || '').slice(0, 100),
      !!evento.verified,
      status,
      JSON.stringify(evento.raw || {}),
      String(error || '').slice(0, 400),
    ],
  );

  if (r.rows[0]) return { fila: r.rows[0], duplicado: false };

  const existente = await query(
    'SELECT * FROM payment_events WHERE provider = $1 AND provider_event_id = $2',
    [providerName, String(evento.eventId || '')],
  );
  return { fila: existente.rows[0], duplicado: true };
}

/**
 * Reproceso de eventos que fallaron. Lo llama el job periódico y también puede
 * dispararse a mano desde la API.
 */
async function reprocessFailed({ limit = 20, maxAttempts = 5 } = {}) {
  const r = await query(
    `SELECT * FROM payment_events
      WHERE status = 'failed' AND attempts < $1
      ORDER BY received_at ASC LIMIT $2`,
    [maxAttempts, limit],
  );

  const resumen = { intentados: r.rows.length, recuperados: 0, fallidos: 0 };

  for (const fila of r.rows) {
    let provider;
    try {
      provider = getProvider(fila.provider);
    } catch {
      resumen.fallidos++;
      continue;
    }

    // Se reconstruye el evento normalizado desde el payload guardado, sin
    // volver a verificar firma: ya se verificó al recibirlo.
    try {
      const evento = await provider.handleWebhook({
        headers: {},
        rawBody: Buffer.from(JSON.stringify(fila.payload)),
      }).catch(() => null);

      if (!evento) throw new Error('no se pudo re-normalizar el evento');

      await procesar(provider, { ...evento, verified: true });
      await query(
        `UPDATE payment_events SET status='processed', processed_at=CURRENT_TIMESTAMP,
                attempts = attempts + 1, last_error='' WHERE id=$1`,
        [fila.id],
      );
      resumen.recuperados++;
    } catch (err) {
      await query(
        `UPDATE payment_events SET attempts = attempts + 1, last_error=$2 WHERE id=$1`,
        [fila.id, String(err.message).slice(0, 400)],
      );
      resumen.fallidos++;
    }
  }

  return resumen;
}

module.exports = { receive, reprocessFailed, _procesar: procesar, _registrarEvento: registrarEvento };
