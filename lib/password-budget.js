// ── Presupuesto global de hashing de contraseñas ──
//
// bcrypt es caro a propósito: esa es su función. El problema es que aquí se
// paga en el único hilo que tiene el proceso, y medido en esta máquina:
//
//     bcrypt.compare (coste 10) → 114 ms
//     8,8 operaciones saturan un segundo entero de CPU
//     8 en paralelo → 912 ms, durante los cuales un temporizador de 10 ms
//                     llegó a correr 2 veces en lugar de 91
//
// Es decir: bcryptjs NO cede el hilo entre rondas. Mientras hashea, el servidor
// no atiende a nadie más. En Render, con CPU compartida, el coste por operación
// es aún mayor.
//
// Los límites por IP no sirven contra esto. Diez intentos por IP y quince
// minutos parecen estrictos hasta que se hace la cuenta: para llegar a nueve
// operaciones por segundo —el punto en que la plataforma deja de responder—
// bastan unas ciento treinta IPs. Un lote de proxies residenciales cuesta unos
// pocos dólares. El límite por IP acota a CADA atacante; no acota la SUMA.
//
// Lo que se acota aquí es el recurso, no el origen: cuántas operaciones de
// hashing está dispuesto a pagar el proceso por segundo, vengan de donde vengan.
// Por encima de eso se responde 503 en microsegundos, sin gastar CPU. Bajo
// ataque, iniciar sesión va a trompicones; pero el doctor que ya está dentro,
// con un paciente delante, sigue trabajando. Ese es el intercambio correcto.
//
// Por qué un cubo de fichas y no una cola: una cola retendría sockets abiertos
// esperando turno, que es justo el fallo que se corrigió en lib/geocoding.js.
// Aquí se dice que no y se suelta la conexión.
//
// Deliberadamente NO se limita por cuenta de usuario. Sería eficaz contra el
// relleno de credenciales distribuido, pero permitiría dejar fuera a un doctor
// concreto durante quince minutos con solo fallarle la contraseña a propósito.
// En mitad de una consulta, eso es un daño real. Se acota el gasto, no la
// identidad.

function num(nombre, porDefecto) {
  const v = parseInt(process.env[nombre] || '', 10);
  return Number.isFinite(v) && v > 0 ? v : porDefecto;
}

// Ráfaga que se absorbe de golpe. Está en SEIS por una razón medida: como
// bcryptjs no cede el hilo, la ráfaga es literalmente el tiempo que el servidor
// puede quedarse congelado de una tacada. Con 150 intentos desde IPs distintas
// contra el servidor real:
//
//     sin presupuesto → 17.053 ms de congelación
//     ráfaga 30       →  3.188 ms
//     ráfaga 12       →  1.579 ms
//     ráfaga 12       →  1.579 ms   ← elegida
//     ráfaga 6        →    774 ms
//
// Doce es el punto de equilibrio: absorbe de golpe a una clínica pequeña
// entrando entera a las ocho, y bajo ataque reduce la congelación de diecisiete
// segundos a uno y medio. Bajarlo a seis protege más pero empieza a rechazar
// ráfagas legítimas —se vio en la propia suite de tests—; subirlo alarga la
// congelación en proporción directa. Ajustable por entorno según crezca la base
// de clínicas.
//
// Conviene decirlo claro: esto es un torniquete, no una cura. Mientras el
// hashing corra en el hilo principal, cualquier ráfaga permitida es tiempo en
// que el servidor no atiende. La solución de fondo es sacar bcrypt del hilo
// (worker_threads o bcrypt nativo, que usa el pool de libuv).
const CAPACIDAD = num('PASSWORD_BUDGET_BURST', 12);

// Ritmo sostenido. Dos por segundo son 120 inicios de sesión por minuto,
// muy por encima del uso real de la plataforma y muy por debajo del punto en
// que el hashing se come el hilo.
const POR_SEGUNDO = num('PASSWORD_BUDGET_PER_SECOND', 2);

// Fichas que solo pueden gastar las peticiones CON sesión abierta. Sin esta
// reserva, una avalancha de inicios de sesión anónimos dejaría sin presupuesto
// a quien ya está dentro y quiere cambiar su contraseña — precisamente lo que
// hay que poder hacer mientras te atacan.
const RESERVA_AUTENTICADOS = Math.max(1, Math.floor(CAPACIDAD * 0.25));

let fichas = CAPACIDAD;
let ultimaRecarga = Date.now();

// Contadores para diagnóstico: si esto empieza a rechazar en producción hay que
// enterarse, no descubrirlo por las quejas.
let concedidas = 0;
let rechazadas = 0;
let ultimoAviso = 0;

function recargar() {
  const ahora = Date.now();
  const transcurrido = (ahora - ultimaRecarga) / 1000;
  if (transcurrido <= 0) return;
  fichas = Math.min(CAPACIDAD, fichas + transcurrido * POR_SEGUNDO);
  ultimaRecarga = ahora;
}

/**
 * Pide permiso para gastar UNA operación de hashing.
 *
 * @param {object} [opciones]
 * @param {boolean} [opciones.autenticado] La petición trae sesión válida, así
 *   que puede echar mano de la reserva.
 * @returns {boolean} true si se puede hashear; false si hay que responder 503.
 */
function intentarGastar({ autenticado = false } = {}) {
  recargar();
  const minimo = autenticado ? 0 : RESERVA_AUTENTICADOS;
  if (fichas - 1 < minimo) {
    rechazadas++;
    // Un aviso por minuto como mucho: bajo ataque, registrar cada rechazo sería
    // otra forma de gastar el proceso.
    const ahora = Date.now();
    if (ahora - ultimoAviso > 60_000) {
      ultimoAviso = ahora;
      console.warn(
        `[password-budget] presupuesto agotado · ${rechazadas} rechazos acumulados · ` +
          `ritmo ${POR_SEGUNDO}/s, ráfaga ${CAPACIDAD}`,
      );
    }
    return false;
  }
  fichas -= 1;
  concedidas++;
  return true;
}

/**
 * Respuesta estándar cuando no hay presupuesto. Es deliberadamente idéntica sin
 * importar el correo enviado: si dijera algo distinto según la cuenta exista o
 * no, sería un enumerador de usuarios.
 */
function responderSinPresupuesto(res) {
  res.set('Retry-After', '5');
  return res.status(503).json({
    error: 'Demasiadas verificaciones de contraseña en este momento. Intenta de nuevo en unos segundos.',
    code: 'auth_busy',
  });
}

function estado() {
  recargar();
  return {
    fichas: Math.floor(fichas),
    capacidad: CAPACIDAD,
    porSegundo: POR_SEGUNDO,
    reservaAutenticados: RESERVA_AUTENTICADOS,
    concedidas,
    rechazadas,
  };
}

// Solo para pruebas: deja el cubo lleno otra vez.
function _reiniciar() {
  fichas = CAPACIDAD;
  ultimaRecarga = Date.now();
  concedidas = 0;
  rechazadas = 0;
}

module.exports = {
  intentarGastar,
  responderSinPresupuesto,
  estado,
  _reiniciar,
  CAPACIDAD,
  POR_SEGUNDO,
  RESERVA_AUTENTICADOS,
};
