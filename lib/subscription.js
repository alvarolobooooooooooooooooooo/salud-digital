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
 * El bloqueo solo se activa si hay un procesador configurado: en local, sin
 * credenciales, la app funciona normal. BILLING_ENFORCEMENT=off es la palanca
 * de emergencia para desactivarlo en producción sin tocar código.
 */
function enforcementEnabled() {
  if (String(process.env.BILLING_ENFORCEMENT || '').trim().toLowerCase() === 'off') return false;
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

module.exports = {
  ENFORCED_ROLES,
  enforcementEnabled,
  isExemptClinic,
  clinicHasAccess,
  invalidate,
  invalidateAll,
};
