// ── Configuración de WhatsApp: de la clínica al doctor ──
//
// Los mensajes que salen por WhatsApp los firma un doctor, no un edificio. Un
// paciente que recibe «le recordamos su cita con la Dra. Fabiola» está leyendo
// un texto que la Dra. Fabiola debería poder escribir, y hasta ahora no podía:
// los cuatro campos vivían solo en la tabla clinics y únicamente el
// clinic_admin los guardaba. En una cuenta nacida del alta por cuenta propia
// —donde el dueño se registra como `doctor` y NO existe ningún clinic_admin—
// eso significaba que el mensaje no se podía cambiar nunca.
//
// DOS NIVELES, NO UNO.
//
//   clinics.*   el valor de la casa. Lo edita el clinic_admin. Es lo que ve un
//               doctor que nunca ha tocado su configuración y lo que se usa
//               cuando la cita es de un doctor que no la ha personalizado.
//   users.*     la personalización de cada doctor. NULL = no la ha tocado.
//
// La gracia de que NULL signifique «no tocado» y no «vacío» es que una clínica
// que ya tenía su texto no pierde nada: sus doctores lo siguen viendo hasta que
// alguno decida escribir el suyo. Y si el clinic_admin cambia el de la casa,
// el cambio sigue llegando a todos los que no se han separado.
//
// DE QUIÉN ES EL MENSAJE QUE SALE: DEL DOCTOR DE LA CITA.
//
// No del que pulsa el botón. La recepcionista manda recordatorios de las citas
// de toda la clínica; si saliera su configuración, mandaría el mismo texto
// firmado por cinco doctores distintos. Por eso las pantallas piden la config
// efectiva POR FILA (ver sqlConfigEfectiva) en vez de leer una global.
//
// QUIÉN PUEDE GUARDAR. El doctor guarda LO SUYO y el clinic_admin guarda LO DE
// LA CASA — son destinos distintos, así que ninguno de los dos puede pisar al
// otro. La recepcionista queda fuera: envía los mensajes, no decide qué dicen.
// El super_admin tampoco entra; no tiene clínica propia que configurar.

// Roles que pueden guardar. Mismo criterio que MONEDA_ROLES y
// BOOKING_COLOR_ROLES (routes/clinics.js) y OWNER_ROLES (routes/billing.js).
const CONFIG_ROLES = ['clinic_admin', 'doctor'];

// Un doctor guarda en su propia fila; cualquier otro rol autorizado, en la de
// la clínica. Es lo único que decide el destino del UPDATE.
function guardaEnSuPropiaFila(user) {
  return user.role === 'doctor';
}

// Las cuatro columnas, con el mismo nombre en users y en clinics para que el
// COALESCE se lea de un vistazo. `whatsapp_confirmation_template` es de la
// pantalla de Confirmaciones; las otras tres las comparten las dos pantallas.
const CAMPOS = [
  'whatsapp_enabled',
  'whatsapp_number',
  'whatsapp_template',
  'whatsapp_confirmation_template',
];

// Fragmento SELECT con la configuración efectiva de un doctor, para incrustar
// en las consultas que ya hacen JOIN con users. `aliasUser` es el alias de la
// fila del doctor DE LA CITA (no el de quien mira) y `aliasClinic` el de la
// clínica.
//
// NULLIF en el número y en las plantillas, y no un COALESCE a secas: una cadena
// vacía guardada por descuido —un campo que alguien borró y salvó— no debe
// tapar el texto de la casa, debe caer a él igual que un NULL. Con enabled no
// se hace: ahí `false` es una decisión de verdad («no quiero que salgan
// mensajes míos») y tiene que ganarle al `true` de la clínica.
function sqlConfigEfectiva(aliasUser, aliasClinic) {
  return `
      COALESCE(${aliasUser}.whatsapp_enabled, ${aliasClinic}.whatsapp_enabled) AS whatsapp_enabled,
      COALESCE(NULLIF(${aliasUser}.whatsapp_number, ''), ${aliasClinic}.whatsapp_number) AS whatsapp_number,
      COALESCE(NULLIF(${aliasUser}.whatsapp_template, ''), ${aliasClinic}.whatsapp_template) AS whatsapp_template,
      COALESCE(NULLIF(${aliasUser}.whatsapp_confirmation_template, ''), ${aliasClinic}.whatsapp_confirmation_template) AS whatsapp_confirmation_template`;
}

// Solo dígitos, como espera wa.me. Lo mismo que hace normalizePhone en
// public/whatsapp.js, repetido aquí porque el servidor no carga aquel archivo.
function normalizarNumero(raw) {
  return String(raw == null ? '' : raw).replace(/\D/g, '');
}

// Un número guardado tiene que poder marcarse. Se valida solo si viene algo:
// dejarlo en blanco es válido mientras WhatsApp esté apagado.
function numeroInvalido(numero) {
  return !!numero && !/^\d{8,15}$/.test(numero);
}

module.exports = {
  CONFIG_ROLES,
  CAMPOS,
  guardaEnSuPropiaFila,
  sqlConfigEfectiva,
  normalizarNumero,
  numeroInvalido,
};
