// ── Catálogo de campos de la migración de expedientes ──
//
// Un expediente que llega de fuera —una exportación de Medilink, un Excel que
// la clínica lleva a mano, o una libreta de papel que alguien está tecleando—
// no viene con los nombres de columna de esta base. Viene con "Nombres y
// Apellidos", "Cédula", "F. Nac.", "Celular", "Alergias del paciente"…
//
// Este módulo es el ÚNICO sitio donde vive esa traducción, y lo usan los dos
// lados: el servidor para validar lo que le llega (nunca se confía en lo que
// mande el navegador) y la página para proponer el mapeo automático y avisar
// antes de escribir nada. Si estuviera duplicado, el día que se añada un campo
// la página y la API dejarían de estar de acuerdo justo en la operación que
// menos perdona: la que crea expedientes en bloque.
//
// Reglas de las funciones de normalización:
//   · Normalizar NUNCA puede perder datos. Si un valor no se entiende, se
//     devuelve `null` y el llamador decide (aviso o error), pero el original
//     sigue disponible para que la persona lo corrija a mano.
//   · Ninguna adivina de más: una fecha ambigua (03/04/2019) se resuelve por el
//     formato que declaró la clínica, no por lo que parezca más probable.

// El archivo se carga en los DOS lados: `require()` en el servidor y
// <script src="/migracion-campos.js"> en la página (server.js lo sirve desde
// aquí mismo). Por eso va envuelto: sin el envoltorio, cargarlo en el navegador
// dejaría sueltos en `window` nombres tan genéricos como `clave` o `limpiar`.
(function (raiz) {
'use strict';

const ACENTOS = /[\u0300-\u036f]/g;

/** Forma comparable de un texto: sin acentos, sin signos, minúsculas. */
function clave(valor) {
  return String(valor == null ? '' : valor)
    .normalize('NFD')
    .replace(ACENTOS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Colapsa espacios y recorta. Lo mínimo que se le hace a cualquier texto. */
function limpiar(valor) {
  return String(valor == null ? '' : valor).replace(/\s+/g, ' ').trim();
}

// ── Fechas ──────────────────────────────────────────────────────────────────
//
// Los cuatro orígenes reales y cómo se distinguen:
//   2019-04-03            ISO. Sin ambigüedad posible.
//   03/04/2019            Ambigua. La resuelve `formato` ('dmy' | 'mdy').
//   43558                 Número de serie de Excel (días desde 1899-12-30).
//   3 de abril de 2019    Texto en español, tal cual sale de algunos informes.
//
// El serial de Excel es el que más silenciosamente rompe una migración: si nadie
// lo reconoce, la fecha de nacimiento del paciente queda guardada como "43558" y
// nadie lo nota hasta que un doctor abre el expediente meses después.

const MESES_ES = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4,
  may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9, set: 9, setiembre: 9, oct: 10, octubre: 10,
  nov: 11, noviembre: 11, dic: 12, diciembre: 12,
  jan: 1, apr: 4, aug: 8, dec: 12,
};

const HOY_ANIO = new Date().getFullYear();

function esFechaValida(a, m, d) {
  if (!(a >= 1900 && a <= HOY_ANIO + 2)) return false;
  if (!(m >= 1 && m <= 12)) return false;
  if (!(d >= 1 && d <= 31)) return false;
  // Rebote del propio calendario: 31/02 no existe aunque los rangos cuadren.
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

function iso(a, m, d) {
  return `${String(a).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Devuelve AAAA-MM-DD, o null si no hay forma de leerlo.
 * @param {*} valor  lo que venga de la hoja
 * @param {string} formato  'dmy' (por defecto, LatAm) | 'mdy' | 'iso'
 */
function normalizarFecha(valor, formato = 'dmy') {
  if (valor == null || valor === '') return null;

  // Un Date de verdad (lo produce el lector de .xlsx cuando la celda ya venía
  // marcada como fecha).
  if (valor instanceof Date && !isNaN(valor)) {
    return iso(valor.getFullYear(), valor.getMonth() + 1, valor.getDate());
  }

  const texto = limpiar(valor);
  if (!texto) return null;

  // Serial de Excel. El corte en 20000 (año 1954) evita tragarse un año suelto
  // escrito como número; por debajo de eso no hay serial de fecha creíble en un
  // expediente clínico.
  if (/^\d{4,6}$/.test(texto)) {
    const n = parseInt(texto, 10);
    if (n >= 20000 && n <= 60000) {
      const ms = (n - 25569) * 86400000; // 25569 = 1970-01-01 en serial Excel
      const f = new Date(ms);
      if (!isNaN(f)) return iso(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate());
    }
    return null;
  }

  // ISO o ISO con hora.
  let m = texto.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/);
  if (m) {
    const [a, mes, d] = [+m[1], +m[2], +m[3]];
    return esFechaValida(a, mes, d) ? iso(a, mes, d) : null;
  }

  // Texto en español: "3 de abril de 2019", "3 abril 2019", "3-abr-2019".
  m = texto
    .normalize('NFD').replace(ACENTOS, '').toLowerCase()
    .match(/^(\d{1,2})\s*(?:de\s+|[-/. ])\s*([a-z]+)\.?\s*(?:de\s+|[-/. ])\s*(\d{2,4})$/);
  if (m) {
    const mes = MESES_ES[m[2]];
    let a = +m[3];
    if (a < 100) a += a > 40 ? 1900 : 2000;
    if (mes && esFechaValida(a, mes, +m[1])) return iso(a, mes, +m[1]);
    return null;
  }

  // Numérica con separadores: dd/mm/aaaa o mm/dd/aaaa según lo declarado.
  m = texto.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[T ].*)?$/);
  if (m) {
    let a = +m[3];
    if (a < 100) a += a > 40 ? 1900 : 2000;
    let d = +m[1];
    let mes = +m[2];
    if (formato === 'mdy') { mes = +m[1]; d = +m[2]; }
    // Una sola concesión a la ambigüedad, y solo cuando el formato declarado da
    // una fecha IMPOSIBLE: 13/05/2019 en modo 'mdy' no es "mes 13", es dd/mm.
    if (!esFechaValida(a, mes, d) && esFechaValida(a, d, mes)) {
      const t = mes; mes = d; d = t;
    }
    return esFechaValida(a, mes, d) ? iso(a, mes, d) : null;
  }

  return null;
}

/** Edad a partir de la fecha de nacimiento, en años cumplidos. */
function edadDesde(fechaIso, hoy = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaIso || '');
  if (!m) return null;
  let edad = hoy.getFullYear() - +m[1];
  const mesDif = (hoy.getMonth() + 1) - +m[2];
  if (mesDif < 0 || (mesDif === 0 && hoy.getDate() < +m[3])) edad--;
  return edad >= 0 && edad <= 130 ? edad : null;
}

// ── Teléfonos ───────────────────────────────────────────────────────────────
//
// Se conserva el "+" y los dígitos, nada más. No se inventa prefijo de país: un
// número guardado con un código que no es el suyo es peor que uno sin código,
// porque parece correcto y el WhatsApp no llega.

function normalizarTelefono(valor) {
  const texto = String(valor == null ? '' : valor).trim();
  if (!texto) return '';
  // Notación científica: Excel convierte "50499887766" en 5.04999e+10 si la
  // columna quedó como número. Recuperable, y si no se avisa se guarda basura.
  if (/^\d+(\.\d+)?e\+?\d+$/i.test(texto)) {
    const n = Number(texto);
    if (Number.isFinite(n)) return String(BigInt(Math.round(n)));
  }
  const mas = texto.trimStart().startsWith('+');
  const digitos = texto.replace(/\D/g, '');
  if (!digitos) return '';
  return (mas ? '+' : '') + digitos;
}

/** Últimos 8 dígitos: lo que se compara para detectar el mismo teléfono. */
function colaTelefono(valor) {
  const d = String(valor == null ? '' : valor).replace(/\D/g, '');
  return d.length >= 8 ? d.slice(-8) : d;
}

// ── Sexo ────────────────────────────────────────────────────────────────────

const SEXOS = {
  m: 'Masculino', masculino: 'Masculino', hombre: 'Masculino', varon: 'Masculino',
  male: 'Masculino', h: 'Masculino', 1: 'Masculino',
  f: 'Femenino', femenino: 'Femenino', mujer: 'Femenino', female: 'Femenino',
  2: 'Femenino',
  o: 'Otro', otro: 'Otro', other: 'Otro', x: 'Otro', nb: 'Otro',
};

function normalizarSexo(valor) {
  const k = clave(valor);
  if (!k) return '';
  return SEXOS[k] || null;
}

// ── Identidad / número de expediente ────────────────────────────────────────
//
// Se guarda tal como lo escribió la clínica (con sus guiones), pero se COMPARA
// por su forma desnuda: "0801-1990-01234" y "0801199001234" son la misma
// persona, y una migración que no lo vea duplica el expediente.

function normalizarIdentidad(valor) {
  return limpiar(valor).toUpperCase();
}

function claveIdentidad(valor) {
  return String(valor == null ? '' : valor).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/** Clave de persona por nombre: sin acentos, sin dobles espacios, minúsculas. */
function claveNombre(valor) {
  return limpiar(valor).normalize('NFD').replace(ACENTOS, '').toLowerCase();
}

// ── Dinero ──────────────────────────────────────────────────────────────────

function normalizarMonto(valor) {
  if (valor == null || valor === '') return 0;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  // "L 1,250.00", "1.250,00", "$300"
  let t = String(valor).replace(/[^\d.,-]/g, '').trim();
  if (!t) return 0;
  const comas = (t.match(/,/g) || []).length;
  const puntos = (t.match(/\./g) || []).length;
  if (comas && puntos) {
    // El separador decimal es el que aparece más a la derecha.
    t = t.lastIndexOf(',') > t.lastIndexOf('.')
      ? t.replace(/\./g, '').replace(',', '.')
      : t.replace(/,/g, '');
  } else if (comas === 1 && /,\d{1,2}$/.test(t)) {
    t = t.replace(',', '.');
  } else {
    t = t.replace(/,/g, '');
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

// ── Catálogo ────────────────────────────────────────────────────────────────
//
// `alias` son las cabeceras que se han visto de verdad en exportaciones de
// Medilink, Dentalink, Odoo, hojas de Google y Excel hechos a mano. Se comparan
// por `clave()`, así que no hace falta repetir mayúsculas ni tildes.

const CAMPOS = [
  // — Identificación del paciente —
  {
    key: 'name', label: 'Nombre completo', grupo: 'paciente', requerido: true,
    ayuda: 'Si el origen trae nombre y apellidos por separado, asigna ambas columnas: se unen.',
    multiple: true,
    alias: ['nombre', 'nombres', 'nombrecompleto', 'nombredelpaciente', 'paciente',
      'nombreyapellido', 'nombresyapellidos', 'apellidos', 'apellido', 'apellidopaterno',
      'apellidomaterno', 'primernombre', 'segundonombre', 'fullname', 'name', 'patientname',
      'nombrepaciente', 'razonsocial'],
  },
  {
    key: 'identity_number', label: 'Identidad o Nº de expediente', grupo: 'paciente', requerido: true,
    ayuda: 'Cédula, DNI, pasaporte o el número de ficha del archivo físico. Es la llave para no duplicar.',
    alias: ['identidad', 'numeroidentidad', 'nidentidad', 'noidentidad', 'nodeidentidad',
      'identificacion', 'noidentificacion', 'cedula', 'nocedula', 'nodecedula',
      'dni', 'dpi', 'cui', 'documento', 'nodocumento', 'numerodocumento', 'rut', 'curp', 'nss', 'pasaporte',
      'expediente', 'noexpediente', 'numeroexpediente', 'nexpediente', 'ficha', 'nficha',
      'historiaclinica', 'nhistoria', 'codigopaciente', 'idpaciente', 'id', 'rtn'],
  },
  {
    key: 'birth_date', label: 'Fecha de nacimiento', grupo: 'paciente', tipo: 'fecha',
    alias: ['fechanacimiento', 'fechadenacimiento', 'fechadenac', 'fnacimiento', 'fnac',
      'nacimiento', 'nacio', 'birthdate', 'dateofbirth', 'dob', 'fechanac', 'fdn'],
  },
  {
    key: 'age', label: 'Edad', grupo: 'paciente', tipo: 'entero',
    ayuda: 'Opcional: si hay fecha de nacimiento, la edad se calcula sola.',
    alias: ['edad', 'age', 'anos', 'annos'],
  },
  {
    key: 'gender', label: 'Sexo', grupo: 'paciente', tipo: 'sexo',
    alias: ['sexo', 'genero', 'gender', 'sex'],
  },
  {
    key: 'phone', label: 'Teléfono', grupo: 'paciente', tipo: 'telefono',
    // Las abreviaturas cortas ('cel', 'tel', 'fono') solo valen por coincidencia
    // EXACTA — la segunda pasada las descarta por longitud — así que aquí no
    // pueden provocar falsos positivos, y sin ellas una hoja hecha a mano con la
    // columna «Cel» se importaba con todos los teléfonos vacíos.
    alias: ['telefono', 'tel', 'cel', 'cell', 'fono', 'celu', 'celular', 'movil', 'phone',
      'mobile', 'telefonocelular', 'telefono1', 'telefonoprincipal', 'contacto', 'numero'],
  },
  {
    key: 'whatsapp_number', label: 'WhatsApp', grupo: 'paciente', tipo: 'telefono',
    alias: ['whatsapp', 'wsp', 'whatsap', 'numerowhatsapp', 'telefonowhatsapp'],
  },

  // — Información crítica (banner de alerta médica) —
  {
    key: 'allergies', label: 'Alergias', grupo: 'critico',
    alias: ['alergias', 'alergia', 'allergies', 'alergiasconocidas', 'alergiaspaciente'],
  },
  {
    key: 'medications', label: 'Medicamentos', grupo: 'critico',
    alias: ['medicamentos', 'medicacion', 'medicamento', 'medications', 'tratamientoactual',
      'farmacos', 'medicacionactual'],
  },
  {
    key: 'conditions', label: 'Antecedentes / condiciones', grupo: 'critico',
    alias: ['condiciones', 'antecedentes', 'antecedentespatologicos', 'enfermedades',
      'padecimientos', 'conditions', 'historialmedico', 'antecedentesmedicos',
      'enfermedadesbase', 'patologias'],
  },

  // — Historia clínica (crea una consulta por fila) —
  {
    key: 'history_date', label: 'Fecha de la consulta', grupo: 'historia', tipo: 'fecha',
    ayuda: 'La fecha con la que quedará registrada la consulta migrada.',
    alias: ['fecha', 'fechaconsulta', 'fechadeconsulta', 'fechaatencion', 'fechavisita',
      'date', 'visitdate', 'fechaingreso', 'fecharegistro'],
  },
  {
    key: 'visit_reason', label: 'Motivo de consulta', grupo: 'historia',
    alias: ['motivo', 'motivoconsulta', 'motivodeconsulta', 'razon', 'reason', 'chiefcomplaint',
      'motivodevisita', 'consultapor'],
  },
  {
    key: 'diagnosis', label: 'Diagnóstico', grupo: 'historia',
    alias: ['diagnostico', 'diagnosticos', 'diagnosis', 'dx', 'impresiondiagnostica'],
  },
  {
    key: 'treatment', label: 'Tratamiento', grupo: 'historia',
    alias: ['tratamiento', 'tratamientos', 'treatment', 'plan', 'plandetratamiento',
      'indicaciones', 'receta', 'prescripcion'],
  },
  {
    key: 'procedures', label: 'Procedimientos', grupo: 'historia',
    alias: ['procedimiento', 'procedimientos', 'procedures', 'servicios', 'servicio',
      'prestacion', 'prestaciones'],
  },
  {
    key: 'notes', label: 'Notas / evolución', grupo: 'historia',
    multiple: true,
    alias: ['notas', 'nota', 'evolucion', 'observacionesclinicas', 'notasclinicas',
      'comentarios', 'comentario', 'notes', 'detalle', 'descripcion', 'anamnesis',
      'exploracion', 'examenfisico'],
  },
  {
    key: 'observations', label: 'Observaciones', grupo: 'historia',
    alias: ['observaciones', 'observacion', 'remarks', 'observations'],
  },
  {
    key: 'cost', label: 'Costo', grupo: 'historia', tipo: 'monto',
    alias: ['costo', 'monto', 'precio', 'total', 'valor', 'importe', 'cost', 'amount',
      'totalpagado', 'abono'],
  },
];

const POR_KEY = new Map(CAMPOS.map((c) => [c.key, c]));

// Índice alias → key. Se construye una vez.
const POR_ALIAS = new Map();
for (const campo of CAMPOS) {
  POR_ALIAS.set(clave(campo.label), campo.key);
  for (const a of campo.alias) POR_ALIAS.set(clave(a), campo.key);
}

// Cabeceras que aparecen en las exportaciones y NO deben mapearse a nada: si se
// dejaran sueltas, el mapeo automático las colocaría en el primer campo que se
// le parezca (típico: "Estado" cayendo en Diagnóstico).
const IGNORAR = new Set([
  'estado', 'status', 'activo', 'creadopor', 'createdby', 'usuario', 'sucursal',
  'clinica', 'convenio', 'aseguradora', 'seguro', 'saldo', 'deuda', 'email',
  'correo', 'correoelectronico', 'direccion', 'ciudad', 'departamento', 'pais',
  'ocupacion', 'profesion', 'estadocivil', 'referidopor', 'doctor', 'medico',
  'odontologo', 'profesional', 'especialidad', 'fechacreacion', 'ultimavisita',
].map((s) => clave(s)));

/**
 * Propone un mapeo a partir de las cabeceras del archivo.
 * Devuelve un array paralelo a `cabeceras`: cada posición lleva
 * `{ campo, confianza }` — campo `null` significa "sin asignar".
 *
 * Dos pasadas: primero coincidencia exacta de alias (confianza alta), luego
 * coincidencia por inclusión para cabeceras compuestas del tipo
 * "Fecha de nacimiento del paciente" (confianza media). Un mismo campo no se
 * asigna dos veces salvo que admita varias columnas (nombre/apellidos, notas).
 */
function sugerirMapeo(cabeceras) {
  const usados = new Set();
  const resultado = cabeceras.map(() => ({ campo: null, confianza: 0 }));

  const asignar = (i, key, confianza) => {
    const campo = POR_KEY.get(key);
    if (!campo) return false;
    if (usados.has(key) && !campo.multiple) return false;
    usados.add(key);
    resultado[i] = { campo: key, confianza };
    return true;
  };

  cabeceras.forEach((cab, i) => {
    const k = clave(cab);
    if (!k || IGNORAR.has(k)) return;
    const exacto = POR_ALIAS.get(k);
    if (exacto) asignar(i, exacto, 1);
  });

  cabeceras.forEach((cab, i) => {
    if (resultado[i].campo) return;
    const k = clave(cab);
    if (!k || IGNORAR.has(k)) return;
    let mejor = null;
    let mejorPuntos = 0;
    for (const [alias, key] of POR_ALIAS) {
      // Alias muy cortos ('id', 'dx') solo valen por coincidencia exacta: dentro
      // de una cabecera larga aparecen por casualidad.
      if (alias.length < 5) continue;
      if (!k.includes(alias)) continue;
      // El alias que ABRE la cabecera manda sobre el que aparece a mitad. Sin
      // esto, "Alergias del paciente" caía en Nombre —porque 'paciente' es alias
      // de nombre y mide lo mismo que 'alergias'— y el mapeo automático movía la
      // columna de alergias al nombre del paciente.
      const puntos = alias.length + (k.startsWith(alias) ? 100 : 0);
      if (puntos > mejorPuntos) {
        mejor = key;
        mejorPuntos = puntos;
      }
    }
    if (mejor) asignar(i, mejor, mejorPuntos >= 100 ? 0.75 : 0.5);
  });

  return resultado;
}

// ── Validación de una fila ya mapeada ───────────────────────────────────────
//
// Entra un objeto `{ campoKey: valorCrudo }` y sale la fila lista para escribir
// más las pegas encontradas. Se distingue a propósito entre:
//   errores → la fila NO se puede escribir (falta el nombre).
//   avisos  → la fila se escribe, pero algo se quedó fuera o se dedujo
//             (una fecha ilegible, un sexo que nadie reconoce).
// Un error para todo sería una migración que se planta con la primera celda
// rara de 3.000; un aviso para todo sería escribir expedientes sin nombre.

const CAMPOS_HISTORIA = ['visit_reason', 'diagnosis', 'treatment', 'procedures', 'notes', 'observations'];

function validarFila(crudo, opciones = {}) {
  const formatoFecha = opciones.formatoFecha || 'dmy';
  const errores = [];
  const avisos = [];
  const v = {};

  v.name = limpiar(crudo.name);
  if (opciones.corregirMayusculas && v.name && v.name === v.name.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{4}/.test(v.name)) {
    v.name = v.name.toLowerCase().replace(/(^|[\s'’-])([a-záéíóúñü])/g, (_, p, c) => p + c.toUpperCase());
  }
  if (!v.name) errores.push({ campo: 'name', mensaje: 'Falta el nombre del paciente' });
  else if (v.name.length > 120) { v.name = v.name.slice(0, 120); avisos.push({ campo: 'name', mensaje: 'Nombre recortado a 120 caracteres' }); }

  v.identity_number = normalizarIdentidad(crudo.identity_number);
  if (!v.identity_number) {
    if (opciones.generarIdentidad === false) {
      errores.push({ campo: 'identity_number', mensaje: 'Falta identidad o Nº de expediente' });
    } else {
      // Marca para que el servidor le ponga un consecutivo del lote. No se
      // rellena aquí porque el consecutivo depende del lote, no de la fila.
      v.identity_number = '';
      avisos.push({ campo: 'identity_number', mensaje: 'Sin identidad: se asignará un Nº de expediente provisional' });
    }
  }

  v.birth_date = '';
  if (crudo.birth_date != null && String(crudo.birth_date).trim() !== '') {
    const f = normalizarFecha(crudo.birth_date, formatoFecha);
    if (f) v.birth_date = f;
    else avisos.push({ campo: 'birth_date', mensaje: `Fecha de nacimiento ilegible ("${limpiar(crudo.birth_date).slice(0, 24)}"): se deja vacía` });
  }

  const edadDeclarada = parseInt(String(crudo.age == null ? '' : crudo.age).replace(/\D/g, ''), 10);
  const edadCalculada = edadDesde(v.birth_date);
  v.age = Number.isFinite(edadCalculada) && edadCalculada !== null
    ? edadCalculada
    : (Number.isFinite(edadDeclarada) && edadDeclarada >= 0 && edadDeclarada <= 130 ? edadDeclarada : 0);

  const sexo = normalizarSexo(crudo.gender);
  if (sexo === null) {
    v.gender = '';
    avisos.push({ campo: 'gender', mensaje: `Sexo no reconocido ("${limpiar(crudo.gender).slice(0, 16)}"): se deja vacío` });
  } else {
    v.gender = sexo;
  }

  v.phone = normalizarTelefono(crudo.phone);
  v.whatsapp_number = normalizarTelefono(crudo.whatsapp_number) || v.phone;
  // Excel guarda los teléfonos largos como número y al exportar los escribe
  // 5.04999e+10: los dígitos del final YA se perdieron en el archivo. Se
  // recupera lo que se puede, pero se avisa — un teléfono casi correcto es peor
  // que uno vacío, porque el recordatorio se manda igual y nunca llega.
  for (const campo of ['phone', 'whatsapp_number']) {
    if (/e\+?\d/i.test(String(crudo[campo] == null ? '' : crudo[campo]))) {
      avisos.push({ campo, mensaje: 'El origen traía el teléfono en notación científica: revísalo antes de usarlo' });
    }
  }

  v.allergies = limpiar(crudo.allergies);
  v.medications = limpiar(crudo.medications);
  v.conditions = limpiar(crudo.conditions);

  v.historia = normalizarHistoria(crudo, opciones, avisos);

  return { valores: v, errores, avisos };
}

/**
 * La parte CLÍNICA de un registro: lo que se convierte en una consulta.
 *
 * Va aparte de `validarFila` porque los dos orígenes cuentan cosas distintas.
 * Una fila de un archivo exportado trae, como mucho, una visita. Una ficha de
 * papel trae la vida entera del paciente: cinco visitas fechadas en la misma
 * hoja. Con la lógica metida dentro de `validarFila` no había forma de leer la
 * segunda sin volver a leer al paciente.
 *
 * Devuelve `null` cuando no hay nada clínico que guardar — no se crean consultas
 * vacías solo porque la fila exista.
 *
 * @param {object} crudo      valores sin normalizar
 * @param {object} opciones   { formatoFecha }
 * @param {Array}  [avisos]   si se pasa, se le añaden los avisos encontrados
 */
function normalizarHistoria(crudo, opciones = {}, avisos = []) {
  const formatoFecha = opciones.formatoFecha || 'dmy';
  const historia = {};
  let hayHistoria = false;

  for (const k of CAMPOS_HISTORIA) {
    const t = String(crudo[k] == null ? '' : crudo[k]).replace(/[ \t]+/g, ' ').trim();
    historia[k] = t;
    if (t) hayHistoria = true;
  }
  historia.cost = normalizarMonto(crudo.cost);
  if (historia.cost > 0) hayHistoria = true;

  historia.date = '';
  if (crudo.history_date != null && String(crudo.history_date).trim() !== '') {
    const f = normalizarFecha(crudo.history_date, formatoFecha);
    if (f) historia.date = f;
    else if (hayHistoria) avisos.push({ campo: 'history_date', mensaje: 'Fecha de consulta ilegible: se registra con la fecha de hoy' });
  }

  return hayHistoria ? historia : null;
}

/** Una consulta en blanco, para cuando hay que crearla igual (fotos sueltas). */
function historiaVacia() {
  const h = {};
  for (const k of CAMPOS_HISTORIA) h[k] = '';
  h.cost = 0;
  h.date = '';
  return h;
}

const API = {
  CAMPOS,
  clave,
  limpiar,
  normalizarFecha,
  edadDesde,
  normalizarTelefono,
  colaTelefono,
  normalizarSexo,
  normalizarIdentidad,
  claveIdentidad,
  claveNombre,
  normalizarMonto,
  sugerirMapeo,
  validarFila,
  normalizarHistoria,
  historiaVacia,
};

if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (raiz) raiz.MigracionCampos = API;

})(typeof window !== 'undefined' ? window : null);
