// ── Purga de tablas que solo crecen ──
//
// Tres tablas de la base crecen con cada petición y nadie las vaciaba nunca:
//
//   user_sessions  — una fila por inicio de sesión. El JWT caduca a las 24 h,
//                    pero la fila se queda para siempre. Como el limitador de
//                    login solo cuenta los intentos FALLIDOS, cualquiera con una
//                    cuenta propia podía inflarla a voluntad.
//   payment_events — el webhook de pagos es público: guarda TODO evento que
//                    llega, incluidos los de firma inválida. Eso es correcto
//                    (son señal de ataque), pero significa que un desconocido
//                    escribe en nuestra base sin límite de tiempo.
//   clinic_landing_leads — formulario público de las landings.
//   landing_visits — una fila por cada carga de la web pública.
//
// Ninguna es catastrófica en un día. Todas lo son en un mes: en Render el disco
// de Postgres no crece solo, y una base llena no acepta ni escrituras ni —según
// el momento— conexiones nuevas. Es el único fallo de esta lista del que no se
// sale reiniciando.
//
// Qué se conserva y por qué:
//   · Sesiones revocadas o caducadas hace más de RETENTION_SESSION_DAYS. Las
//     sesiones VIVAS no se tocan nunca, sea cual sea su antigüedad.
//   · Eventos de pago ya procesados o descartados de hace más de
//     RETENTION_PAYMENT_EVENT_DAYS. Los que están 'pending' o 'failed' se
//     quedan: son justo los que hay que reprocesar.
//
// Corre en el mismo proceso, como la purga de auditoría: sin cron externo.

const { query } = require('../db');

function dias(nombre, porDefecto) {
  const v = parseInt(process.env[nombre] || '', 10);
  return Number.isFinite(v) && v > 0 ? v : porDefecto;
}

/**
 * Borra las sesiones que ya no sirven para nada: las revocadas y las que
 * caducaron hace tiempo. El JWT vive 24 h, así que una fila sin actividad
 * reciente no puede corresponder a nadie conectado.
 */
async function purgarSesiones() {
  const d = dias('RETENTION_SESSION_DAYS', 30);
  try {
    const r = await query(
      `DELETE FROM user_sessions
        WHERE (revoked_at IS NOT NULL AND revoked_at < NOW() - ($1 || ' days')::interval)
           OR (COALESCE(last_seen, created_at) < NOW() - ($1 || ' days')::interval)`,
      [String(d)],
    );
    return { borradas: r.rowCount, dias: d };
  } catch (err) {
    console.warn('[retention] sesiones:', err.message);
    return { borradas: 0, dias: d, error: err.message };
  }
}

/**
 * Borra los eventos de pago ya resueltos. Deja intactos los que siguen
 * pendientes o fallidos: esos los reintenta el job de facturación.
 */
async function purgarEventosDePago() {
  const d = dias('RETENTION_PAYMENT_EVENT_DAYS', 180);
  try {
    const r = await query(
      `DELETE FROM payment_events
        WHERE status IN ('processed', 'ignored')
          AND received_at < NOW() - ($1 || ' days')::interval`,
      [String(d)],
    );
    return { borrados: r.rowCount, dias: d };
  } catch (err) {
    console.warn('[retention] eventos de pago:', err.message);
    return { borrados: 0, dias: d, error: err.message };
  }
}

/**
 * Visitas de la web pública. Una fila por carga de página: es la tabla que más
 * rápido crece de todas y la que menos vale con el tiempo — el panel mira los
 * últimos 30 días, y el conteo histórico se conserva un año. Nada de lo que hay
 * en ella identifica a nadie (ver lib/analytics.js), así que el recorte es solo
 * cuestión de espacio.
 */
async function purgarVisitas() {
  const d = dias('RETENTION_VISIT_DAYS', 365);
  try {
    const r = await query(
      `DELETE FROM landing_visits WHERE created_at < NOW() - ($1 || ' days')::interval`,
      [String(d)],
    );
    return { borradas: r.rowCount, dias: d };
  } catch (err) {
    console.warn('[retention] visitas:', err.message);
    return { borradas: 0, dias: d, error: err.message };
  }
}

/** Una pasada completa. Nunca lanza: un fallo aquí no puede tumbar el proceso. */
async function purgar() {
  const sesiones = await purgarSesiones();
  const eventos = await purgarEventosDePago();
  const visitas = await purgarVisitas();
  if (sesiones.borradas > 0 || eventos.borrados > 0 || visitas.borradas > 0) {
    console.log(
      `[retention] sesiones ${sesiones.borradas} (>${sesiones.dias}d) · ` +
        `eventos de pago ${eventos.borrados} (>${eventos.dias}d) · ` +
        `visitas ${visitas.borradas} (>${visitas.dias}d)`,
    );
  }
  return { sesiones, eventos, visitas };
}

module.exports = { purgar, purgarSesiones, purgarEventosDePago, purgarVisitas };
