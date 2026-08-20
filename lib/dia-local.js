// ── Días locales para filtrar por fecha ──
//
// Dos problemas resueltos en el mismo sitio, porque son el mismo sitio.
//
// 1. LA ZONA HORARIA
//    `new Date().toISOString().split('T')[0]` devuelve la fecha en UTC, no la
//    del reloj de la clínica. Honduras es UTC−6, así que a partir de las seis
//    de la tarde la fecha UTC ya es la de mañana:
//
//        18:30 en Tegucigalpa → toISOString() dice 2026-08-21
//                             → la fecha real es  2026-08-20
//
//    Recepción usaba esa forma, de modo que a partir de las 18:00 consultaba el
//    día equivocado: la agenda del día se vaciaba sola al caer la tarde.
//    `process.env.TZ` ya está fijado a America/Tegucigalpa en server.js, así que
//    basta con leer los componentes locales de la fecha.
//
// 2. EL ÍNDICE
//    Filtrar con `DATE(a.scheduled_at) = $2` obliga a Postgres a calcular esa
//    función en CADA fila, y una columna envuelta en una función deja de poder
//    buscarse por índice. El índice existe —(clinic_id, scheduled_at)— pero no
//    se usaba: cada consulta recorría todas las citas históricas de la clínica.
//    En una pantalla que se refresca cada tres segundos, eso crece hasta doler.
//
//    Un rango medio abierto `>= inicio AND < inicioDelDiaSiguiente` sí usa el
//    índice, y funciona aunque la columna sea TEXT: una fecha ISO-8601 ordena
//    igual alfabéticamente que cronológicamente, así que '2026-08-20T10:00'
//    cae entre '2026-08-20' y '2026-08-21'.
//
//    OJO: eso vale mientras el valor guardado empiece por AAAA-MM-DD. Por eso
//    `normalizarFechaHora` se usa al ESCRIBIR y `comprobarFormatoDeCitas`
//    avisa al arrancar si quedan filas antiguas con otra forma.

/** Fecha local (AAAA-MM-DD) según la zona horaria del proceso. */
function fechaLocal(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Límites de un día para un filtro por rango.
 *
 * @param {string|Date} [dia] Día local (AAAA-MM-DD). Por defecto, hoy.
 * @returns {{desde: string, hasta: string}} `desde` incluido, `hasta` excluido.
 */
function rangoDelDia(dia) {
  const base = dia instanceof Date ? fechaLocal(dia) : (dia || fechaLocal());
  // El día siguiente se calcula a mediodía para que ningún cambio de horario
  // pueda hacer que "sumar 24 horas" caiga otra vez en el mismo día.
  const siguiente = new Date(`${base}T12:00:00`);
  siguiente.setDate(siguiente.getDate() + 1);
  return { desde: base, hasta: fechaLocal(siguiente) };
}

/**
 * Deja una fecha/hora en la forma que espera el filtro por rango:
 * `AAAA-MM-DDTHH:MM:SS`, en hora local.
 *
 * Se aplica al guardar una cita. Antes se almacenaba tal cual llegaba del
 * cliente —solo se comprobaba que `new Date()` supiera interpretarlo—, así que
 * la base podía acabar con formatos mezclados y el filtro por rango dejaría
 * fuera los que no empezaran por la fecha.
 *
 * Devuelve null si el valor no es una fecha reconocible, para que quien llama
 * responda 400 en vez de guardar basura.
 */
function normalizarFechaHora(valor) {
  if (valor instanceof Date) {
    return isNaN(valor.getTime()) ? null : componer(valor);
  }
  const texto = String(valor || '').trim();
  if (!texto) return null;

  // Si el valor trae zona explícita (Z o ±HH:MM) es un instante absoluto, no una
  // hora de pared: hay que CONVERTIRLO a la hora local, no recortarle la zona.
  // `reception.html` manda `toISOString()`, así que una cita de las 10:00 en
  // Honduras llega como 16:00Z; quedarnos con el 16:00 la movería seis horas.
  if (/[Zz]$|[+-]\d{2}:?\d{2}$/.test(texto)) {
    const abs = new Date(texto);
    return isNaN(abs.getTime()) ? null : componer(abs);
  }

  // Sin zona: es hora de pared y se respeta tal cual la escribió el cliente.
  const m = texto.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const [, y, mes, d, h, min, seg] = m;
    // Se valida que la fecha exista de verdad (no "2026-13-45").
    const prueba = new Date(`${y}-${mes}-${d}T12:00:00`);
    if (isNaN(prueba.getTime()) || fechaLocal(prueba) !== `${y}-${mes}-${d}`) return null;
    if (+h > 23 || +min > 59) return null;
    return `${y}-${mes}-${d}T${h}:${min}:${seg || '00'}`;
  }

  // Cualquier otra cosa que el motor sepa interpretar ("Aug 20 2026 10:00").
  const d = new Date(texto);
  return isNaN(d.getTime()) ? null : componer(d);
}

function componer(d) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${fechaLocal(d)}T${hh}:${mm}:${ss}`;
}

/** ¿Este valor sirve para el filtro por rango? */
function tieneFormatoDeRango(valor) {
  return /^\d{4}-\d{2}-\d{2}/.test(String(valor || ''));
}

/**
 * Límites del minuto al que pertenece una fecha/hora ya normalizada, para
 * comparar "la misma hora" sin depender de cómo se escribiera (con segundos o
 * sin ellos).
 *
 * Los dos extremos se dan al minuto —'…T10:00' y '…T10:01'— y NUNCA con un
 * carácter centinela pegado al final. Es deliberado: la comparación de texto en
 * Postgres usa la intercalación de la base, y en las intercalaciones habituales
 * (en_US.UTF-8 y compañía) los signos de puntuación pueden ignorarse al
 * comparar. Un tope como '…T10:00~' dejaría de funcionar. Terminando en dígito,
 * la decisión recae siempre sobre un número y el orden es el mismo en cualquier
 * intercalación.
 */
function rangoDelMinuto(fechaHora) {
  const base = String(fechaHora || '');
  const m = base.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mes, d, h, min] = m;
  const desde = `${y}-${mes}-${d}T${h}:${min}`;
  const siguiente = new Date(`${desde}:00`);
  if (isNaN(siguiente.getTime())) return null;
  siguiente.setMinutes(siguiente.getMinutes() + 1);
  const hh = String(siguiente.getHours()).padStart(2, '0');
  const mm = String(siguiente.getMinutes()).padStart(2, '0');
  return { desde, hasta: `${fechaLocal(siguiente)}T${hh}:${mm}` };
}

/**
 * Aviso de arranque: cuenta las citas cuyo `scheduled_at` NO empieza por
 * AAAA-MM-DD y, si hay alguna, lo deja bien visible en los logs.
 *
 * Importa porque los filtros por día son ahora rangos de texto, y una fila con
 * otro formato quedaría fuera del rango: la cita no aparecería en el panel de
 * recepción. Una cita lenta es un fastidio; una cita que desaparece es un
 * paciente que se queda sin atender. Esto convierte un riesgo silencioso en una
 * línea que se ve.
 *
 * Solo lee. Nunca lanza: un fallo aquí no puede impedir el arranque.
 */
async function comprobarFormatoDeCitas(query) {
  try {
    const r = await query(
      `SELECT count(*)::int AS raras, count(*) FILTER (WHERE TRUE)::int AS total
         FROM appointments
        WHERE scheduled_at !~ '^\\d{4}-\\d{2}-\\d{2}'`,
    );
    const raras = r.rows[0] ? r.rows[0].raras : 0;
    if (raras > 0) {
      console.warn('\n' + '='.repeat(72));
      console.warn(`  ATENCIÓN: ${raras} cita(s) con scheduled_at en un formato inesperado.`);
      console.warn('  Los paneles que filtran por día usan un rango de texto, así que');
      console.warn('  esas citas NO aparecerán en la agenda del día. Para verlas:');
      console.warn("      SELECT id, clinic_id, scheduled_at FROM appointments");
      console.warn("       WHERE scheduled_at !~ '^\\d{4}-\\d{2}-\\d{2}' LIMIT 50;");
      console.warn('='.repeat(72) + '\n');
    }
    return { raras };
  } catch (err) {
    console.warn('[dia-local] no se pudo comprobar el formato de las citas:', err.message);
    return { raras: 0, error: err.message };
  }
}

module.exports = {
  fechaLocal, rangoDelDia, rangoDelMinuto, normalizarFechaHora,
  tieneFormatoDeRango, comprobarFormatoDeCitas,
};
