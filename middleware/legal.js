// ── Guardián de aceptación legal ──
//
// Sin los términos aceptados no se escribe nada en la plataforma. Las lecturas
// siguen pasando: quien tiene una versión nueva pendiente debe poder entrar,
// leer el documento y decidir — encerrarle en un muro antes de dejarle ver lo
// que se le pide aceptar sería, además de hostil, malo como consentimiento.
//
// Es el mismo patrón que el guardián de suscripción: se monta UNA vez sobre
// /api, antes de los routers, para que ninguna ruta futura se olvide de estar
// cubierta. Y como corre antes, req.user todavía no existe: se decodifica el
// JWT por cuenta propia. La validez de la sesión la sigue comprobando
// `authenticate` dentro de cada router.
//
// Responde 451 (Unavailable For Legal Reasons) con la lista de lo que falta,
// que es justo lo que el modal del frontend necesita para pintarse solo.

const { decodeToken } = require('./auth');
const legal = require('../lib/legal/service');

// Rutas que deben seguir vivas con la aceptación pendiente, o el usuario no
// podría ni entrar ni aceptar:
//   /auth                 → su propia sesión
//   /legal                → leer los documentos y aceptarlos
//   /public               → páginas y reservas públicas, ajenas a esto
//   /confirmations/public → enlace que el paciente ya tiene en su correo
//   /billing/webhook      → lo llama el procesador de pagos, no una persona
const PREFIJOS_EXENTOS = [
  '/auth',
  '/legal',
  '/public',
  '/confirmations/public',
  '/billing/webhook',
];

const METODOS_DE_LECTURA = ['GET', 'HEAD', 'OPTIONS'];

function esRutaExenta(pathname) {
  return PREFIJOS_EXENTOS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

async function gate(req, res, next) {
  if (!legal.enforcementActivo()) return next();
  if (esRutaExenta(req.path)) return next();
  if (METODOS_DE_LECTURA.includes(req.method)) return next();

  const user = decodeToken(req);
  // Sin token válido no hay a quién exigirle nada: que el 401 lo dé
  // `authenticate` en el router, con su mensaje de siempre.
  if (!user) return next();
  if (!legal.ROLES_EXIGIDOS.includes(user.role)) return next();

  let estado;
  try {
    estado = await legal.cumpleRequisitos(user.id);
  } catch (err) {
    // Si la comprobación falla (base caída, esquema a medio migrar) NO se
    // bloquea la plataforma entera: se deja pasar y se avisa. El coste de un
    // falso negativo aquí —una escritura sin la nueva versión aceptada— es
    // mucho menor que dejar sin trabajar a todas las clínicas.
    console.error('[legal] no se pudo comprobar la aceptación:', err.message);
    return next();
  }

  if (estado.ok) return next();

  res.status(451).json({
    error:
      estado.pendientes.some((p) => p.motivo === 'actualizado')
        ? 'Actualizamos nuestros documentos legales. Revísalos y acéptalos para seguir guardando cambios.'
        : 'Antes de continuar debes aceptar los Términos y Condiciones y la Política de Privacidad.',
    code: 'legal_acceptance_required',
    pending: estado.pendientes.map((p) => ({
      type: p.type,
      name: p.name,
      version: p.version,
      content_hash: p.content_hash,
      effective_at: p.effective_at,
      summary_of_changes: p.summary_of_changes,
      motivo: p.motivo,
      version_anterior: p.version_anterior,
    })),
  });
}

module.exports = { gate, PREFIJOS_EXENTOS };
