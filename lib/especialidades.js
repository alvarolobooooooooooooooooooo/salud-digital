// ── Nombre canónico de la especialidad ──
//
// La especialidad se guarda como TEXTO libre en users.specialty y se compara con
// `===` en muchos sitios: cada página de consulta se defiende de que la abra un
// doctor de otra especialidad, y citas.html decide a qué página lleva "Iniciar
// consulta". O sea que el valor guardado tiene que coincidir LETRA POR LETRA.
//
// El fallo que motivó esto: el <select> de Configuración ofrecía slugs sin tilde
// («podologia») mientras el resto de la app comparaba contra «Podología». Al
// entrar en Configuración el select no reconocía el valor guardado y salía en
// blanco; el doctor lo volvía a elegir, se guardaba «podologia», y a partir de
// ahí TODAS sus consultas rebotaban a la agenda sin decir por qué.
//
// Aquí se fija el nombre canónico y se acepta cualquier variante razonable
// —slug, sin tildes, en mayúsculas, con espacios de más—. Un valor desconocido se
// devuelve tal cual: normalizar no puede convertirse en perder datos.

const CANONICAS = [
  'Medicina General',
  'Podología',
  'Odontología',
  'Odontopediatría',
  'Ortodoncia',
  'Periodoncia',
  'Nutrición',
  'Dermatología',
];

// Deja una cadena en su forma comparable: sin tildes, sin signos, minúsculas.
function clave(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

const PORCLAVE = new Map(CANONICAS.map((c) => [clave(c), c]));
// Alias que se han llegado a guardar y no son el nombre completo.
PORCLAVE.set('general', 'Medicina General');
PORCLAVE.set('medgeneral', 'Medicina General');
PORCLAVE.set('odontopediatria', 'Odontopediatría');

/**
 * Devuelve el nombre canónico, o el valor original si no se reconoce.
 * Una cadena vacía sigue siendo vacía: "sin especialidad" es un estado válido.
 */
function normalizar(valor) {
  const v = String(valor == null ? '' : valor).trim();
  if (!v) return '';
  return PORCLAVE.get(clave(v)) || v;
}

module.exports = { CANONICAS, normalizar };
