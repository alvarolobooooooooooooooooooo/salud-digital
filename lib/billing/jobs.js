// ── Trabajos periódicos de facturación ──
//
// Mismo patrón que la purga de auditoría en server.js: setInterval dentro del
// proceso, sin dependencias nuevas ni cron externo. Con una sola instancia (el
// caso hoy) es suficiente y no añade infraestructura.
//
// Qué hace cada pasada:
//   1. Cobra las suscripciones vencidas cuyo procesador NO cobra solo.
//      Con PayPal (recurrencia nativa) esta parte no encuentra nada que hacer,
//      y así debe ser: cobrar por nuestra cuenta duplicaría cargos.
//   2. Caduca lo que ya agotó su periodo pagado.
//   3. Reprocesa los webhooks que fallaron.
//
// Si algún día hay varias instancias, hay que añadir un lock (advisory lock de
// Postgres) antes de cobrar; está anotado en docs/PAYMENTS.md.

const billing = require('./billing-service');
const webhooks = require('./webhook-service');

let temporizador = null;
let corriendo = false;

function intervaloMs() {
  const min = parseInt(process.env.BILLING_JOB_INTERVAL_MINUTES || '60', 10);
  const seguro = Number.isFinite(min) && min >= 1 ? min : 60;
  return seguro * 60 * 1000;
}

/** Una pasada completa. Exportada para poder invocarla desde tests o a mano. */
async function runOnce({ ahora = new Date() } = {}) {
  if (corriendo) return { omitido: 'ya_en_ejecucion' };
  corriendo = true;
  const t0 = Date.now();
  try {
    const cobros = await billing.runBillingCycle({ ahora });
    const reproceso = await webhooks.reprocessFailed({ limit: 20 });

    const huboAlgo =
      cobros.intentadas || cobros.expiradas || reproceso.intentados || cobros.errores.length;
    if (huboAlgo) {
      console.log(
        `[billing] ciclo en ${Date.now() - t0}ms → cobradas ${cobros.cobradas}, ` +
          `fallidas ${cobros.fallidas}, expiradas ${cobros.expiradas}, ` +
          `webhooks reprocesados ${reproceso.recuperados}/${reproceso.intentados}`,
      );
      cobros.errores.forEach((e) => console.warn('[billing]', e));
    }
    return { cobros, reproceso };
  } catch (err) {
    console.error('[billing] el ciclo falló:', err.message);
    return { error: err.message };
  } finally {
    corriendo = false;
  }
}

function start() {
  if (temporizador) return temporizador;
  // Primera pasada a los 90s del arranque: da tiempo a que la BD esté lista y
  // no compite con el resto del arranque.
  setTimeout(() => { runOnce().catch(() => {}); }, 90 * 1000);
  temporizador = setInterval(() => { runOnce().catch(() => {}); }, intervaloMs());
  if (temporizador.unref) temporizador.unref(); // no impide que el proceso termine
  console.log(`[billing] job de facturación cada ${intervaloMs() / 60000} min`);
  return temporizador;
}

function stop() {
  if (temporizador) clearInterval(temporizador);
  temporizador = null;
}

module.exports = { start, stop, runOnce, intervaloMs };
