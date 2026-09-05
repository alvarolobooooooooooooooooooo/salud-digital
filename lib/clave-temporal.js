// ── Claves temporales ──
//
// Las pone el administrador de la plataforma cuando alguien pierde la suya, y
// casi siempre se dictan por teléfono o WhatsApp. Por eso no se generan con
// bytes al azar en base64: una clave que no se puede leer en voz alta se
// termina copiando mal, y la llamada acaba en "no, la ele es minúscula".
//
// Forma: Palabra-Palabra-NNNN (p. ej. "Cedro-Lirio-4827"). 16-20 caracteres,
// cuatro dígitos de un CSPRNG y dos palabras de un diccionario de 64 → algo
// más de 30 bits de entropía. Es poco para una contraseña definitiva y es de
// sobra para una que vive hasta el primer inicio de sesión y que además
// bloquea la app hasta ser cambiada.
//
// El diccionario evita palabras que se confundan al dictarlas (nada de "casa /
// caza") y no lleva tildes ni ñ: se teclean en cualquier teclado.

const crypto = require('crypto');

const PALABRAS = [
  'Cedro', 'Lirio', 'Playa', 'Nube', 'Faro', 'Roble', 'Salto', 'Mango',
  'Coral', 'Bruma', 'Trigo', 'Palma', 'Rueda', 'Selva', 'Norte', 'Cobre',
  'Aurora', 'Duna', 'Fuego', 'Grano', 'Hierro', 'Isla', 'Jardin', 'Lago',
  'Menta', 'Nieve', 'Olivo', 'Puente', 'Quinta', 'Ramo', 'Sierra', 'Torre',
  'Uva', 'Valle', 'Yunque', 'Zafiro', 'Arena', 'Barco', 'Campo', 'Delta',
  'Estrella', 'Flor', 'Golfo', 'Huerto', 'Ibis', 'Junco', 'Kiwi', 'Luna',
  'Marea', 'Nardo', 'Ombu', 'Pino', 'Quilla', 'Rocio', 'Sauce', 'Tejado',
  'Urna', 'Viento', 'Wafle', 'Xilofono', 'Yema', 'Zorro', 'Ancla', 'Brisa',
];

function elegir(lista) {
  // randomInt del propio Node: uniforme y sin el sesgo de `% n`.
  return lista[crypto.randomInt(0, lista.length)];
}

function generar() {
  const digitos = String(crypto.randomInt(1000, 10000));
  return `${elegir(PALABRAS)}-${elegir(PALABRAS)}-${digitos}`;
}

// Mínimo compartido con el resto de la app (registro y cambio de contraseña
// piden 8). Aquí solo se valida la que escribe el administrador a mano.
const LARGO_MINIMO = 8;

function validar(clave) {
  if (typeof clave !== 'string') return 'La clave temporal es obligatoria.';
  const limpia = clave.trim();
  if (limpia.length < LARGO_MINIMO) {
    return `La clave temporal debe tener al menos ${LARGO_MINIMO} caracteres.`;
  }
  if (limpia.length > 100) return 'La clave temporal es demasiado larga.';
  if (/\s/.test(limpia)) return 'La clave temporal no puede llevar espacios: se dicta y se teclea.';
  return null;
}

module.exports = { generar, validar, LARGO_MINIMO };
