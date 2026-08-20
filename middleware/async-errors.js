// ── Red de seguridad para los handlers async ──
//
// Express 4 no entiende de promesas. Cuando un handler declarado `async` lanza
// —y aquí lanzan casi todos, porque la mayoría no tiene try/catch— Express no
// se entera: lo que queda es una promesa rechazada que nadie recoge. Y Node,
// desde la v15, mata el proceso ante una promesa rechazada sin dueño.
//
// El resultado es peor de lo que parece: NO es que esa petición devuelva un
// error, es que el servidor entero se cae. Todas las clínicas conectadas, todas
// las consultas a medio guardar, todo el mundo fuera. Y basta un error de
// Postgres cualquiera —un parámetro con forma rara, una consulta que agota su
// tiempo, un pico de carga— para provocarlo desde una petición normal.
//
// Comprobado en este mismo repositorio: un `throw` dentro de un `router.get`
// async sale por la consola con "Node.js v24" y código de salida 1, sin que el
// manejador de errores de server.js llegue a ejecutarse.
//
// `capturar` recorre un router ya construido y envuelve cada handler para que,
// si devuelve una promesa rechazada, esta acabe en `next(err)`. A partir de ahí
// es un error de Express normal y lo atiende el manejador global: 500 o 503,
// con su JSON, y el proceso sigue en pie.
//
// Se aplica al montar cada router en server.js, así no hay que acordarse de
// poner try/catch en cada handler nuevo — que es justo el olvido que causa esto.

function envolver(fn) {
  // Los manejadores de error de Express se reconocen por tener 4 argumentos;
  // envolverlos cambiaría su firma y dejarían de recibir el error.
  if (typeof fn !== 'function' || fn.length === 4) return fn;
  const envuelto = function (req, res, next) {
    let resultado;
    try {
      resultado = fn.call(this, req, res, next);
    } catch (err) {
      // Un throw síncrono ya lo maneja Express, pero si llega aquí lo pasamos igual.
      return next(err);
    }
    if (resultado && typeof resultado.catch === 'function') {
      resultado.catch(next);
    }
    return resultado;
  };
  // Conservar el nombre ayuda a leer las trazas.
  Object.defineProperty(envuelto, 'name', { value: fn.name || 'handler' });
  return envuelto;
}

/**
 * Envuelve, en su sitio, todos los handlers de un router de Express.
 * Devuelve el mismo router para poder encadenarlo en `app.use(...)`.
 */
function capturar(router) {
  if (!router || !Array.isArray(router.stack)) return router;
  for (const capa of router.stack) {
    if (capa.route && Array.isArray(capa.route.stack)) {
      // Un endpoint: cada capa de su pila es un middleware o el handler final.
      for (const sub of capa.route.stack) {
        sub.handle = envolver(sub.handle);
      }
    } else if (capa.handle && Array.isArray(capa.handle.stack)) {
      // Router anidado: se baja un nivel.
      capturar(capa.handle);
    } else {
      // Middleware montado con router.use(...).
      capa.handle = envolver(capa.handle);
    }
  }
  return router;
}

/**
 * Último cortafuegos del proceso. Si aun así se escapa una promesa rechazada
 * (por ejemplo desde un job de fondo, que no pasa por ningún router), se
 * registra y se sigue. Un trabajo periódico que falla no puede llevarse por
 * delante a los usuarios conectados.
 *
 * `uncaughtException` se deja fuera a propósito: ahí el proceso SÍ puede haber
 * quedado en un estado inconsistente y seguir sería peor que reiniciar.
 */
function instalarRedDeSeguridad() {
  process.on('unhandledRejection', (motivo) => {
    console.error('[proceso] promesa rechazada sin manejar (ignorada para no caer):', motivo);
  });
}

module.exports = { capturar, envolver, instalarRedDeSeguridad };
