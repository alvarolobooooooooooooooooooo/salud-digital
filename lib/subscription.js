// ── Control de acceso por suscripción ──
//
// Capa fina entre el guardián HTTP (middleware/subscription.js) y la lógica de
// negocio (lib/billing/subscription-service.js). Aquí solo vive lo que decide
// si una clínica puede usar la plataforma, más la caché que evita consultar la
// BD en cada petición.
//
// Nada de esto sabe qué procesador de pagos hay debajo.

const subs = require('./billing/subscription-service');
const { getProvider } = require('./payments/provider');

// Roles que "consumen" la plataforma y por tanto quedan sujetos al pago.
// 'patient' queda fuera a propósito: el paciente no es el cliente, solo mira su
// propio expediente. 'super_admin' es el operador de la plataforma y nunca se
// bloquea, o un fallo del procesador dejaría a todos fuera, incluido quien
// tendría que arreglarlo.
const ENFORCED_ROLES = ['clinic_admin', 'doctor', 'receptionist'];

/**
 * Tres estados, en este orden de prioridad:
 *
 *   BILLING_ENFORCEMENT=off  → nunca se bloquea (palanca de emergencia).
 *   BILLING_ENFORCEMENT=on   → se bloquea SIEMPRE, aunque el procesador no esté
 *                              configurado. Es lo que debe estar en producción:
 *                              sin esto, borrar por error PAYPAL_CLIENT_ID deja
 *                              la plataforma entera gratis y en silencio.
 *   (vacío)                  → se bloquea solo si hay procesador configurado,
 *                              para que en local, sin credenciales, la app
 *                              funcione normal.
 */
function enforcementEnabled() {
  const palanca = String(process.env.BILLING_ENFORCEMENT || '').trim().toLowerCase();
  if (palanca === 'off') return false;
  if (palanca === 'on') return true;
  try {
    return getProvider().isConfigured();
  } catch {
    return false;
  }
}

function exemptClinicIds() {
  return String(process.env.BILLING_EXEMPT_CLINIC_IDS || '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n));
}

function isExemptClinic(clinicId) {
  return exemptClinicIds().includes(Number(clinicId));
}

// ── Caché de acceso ──
// El guardián corre en CADA request a /api; sin caché sería un SELECT extra por
// llamada. 60s es suficientemente fresco para cobros mensuales, y se invalida a
// mano en cuanto cambia el estado (webhook, alta, cancelación).
const TTL_MS = 60 * 1000;
const cache = new Map(); // clinicId → { acceso, at }

function invalidate(clinicId) {
  cache.delete(Number(clinicId));
}

function invalidateAll() {
  cache.clear();
}

async function clinicHasAccess(clinicId) {
  const clave = Number(clinicId);
  const hit = cache.get(clave);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.acceso;

  const sub = await subs.getForClinic(clave);
  const acceso = subs.access(sub);
  cache.set(clave, { acceso, at: Date.now() });
  return acceso;
}

/**
 * ¿Puede esta clínica GUARDAR datos? Reúne en un único sitio las cuatro
 * condiciones del bloqueo, para que todo el que necesite decidirlo —el guardián
 * de /api y la reserva pública, que no pasa por él— use exactamente el mismo
 * criterio y no se abran agujeros por copiar la lógica a medias.
 *
 * @returns {Promise<{allowed:boolean, reason:string}>}
 */
async function clinicCanWrite(clinicId) {
  if (!enforcementEnabled()) return { allowed: true, reason: 'enforcement_off' };
  if (!clinicId) return { allowed: true, reason: 'no_clinic' };
  if (isExemptClinic(clinicId)) return { allowed: true, reason: 'exempt_clinic' };

  let acceso;
  try {
    acceso = await clinicHasAccess(clinicId);
  } catch (err) {
    // Fallo de BD → se deja pasar. Un hipo de Postgres no puede dejar al doctor
    // fuera de su propia consulta; el cobro se revisa en el siguiente request.
    console.warn('[billing] no se pudo verificar la suscripción:', err.message);
    return { allowed: true, reason: 'check_failed' };
  }

  return { allowed: !!acceso.active, reason: acceso.reason };
}

module.exports = {
  ENFORCED_ROLES,
  enforcementEnabled,
  isExemptClinic,
  clinicHasAccess,
  clinicCanWrite,
  invalidate,
  invalidateAll,
};
