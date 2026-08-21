#!/usr/bin/env node
/**
 * ── Cuenta de DEMOSTRACIÓN de podología ──
 *
 * Crea una clínica podológica completa y creíble para enseñar el producto sin
 * abrir el expediente de nadie real. Está calcada, en FORMA, de cómo usa la
 * plataforma la clínica 5 (una sola podóloga, agenda cargada, la ficha
 * podológica como pantalla central, cobro por sesión en lempiras), pero TODO el
 * contenido es inventado: nombres, identidades, teléfonos y cuadros clínicos.
 *
 *     node tools/seed-demo-podologia.js            # sembrar
 *     node tools/seed-demo-podologia.js --purge    # borrarlo todo
 *
 * Reglas que se cumplen sí o sí:
 *
 *   · SOLO ESCRIBE DENTRO DE SU PROPIA CLÍNICA. No actualiza ni borra ninguna
 *     fila que no haya creado. El `--purge` se ata al id de la clínica cuyo
 *     nombre es exactamente NOMBRE_CLINICA, así que no puede llevarse por
 *     delante datos de una clínica real ni por accidente.
 *   · Identidades con prefijo 9999 y teléfonos 9999-XXXX: no pueden chocar con
 *     una identidad hondureña real ni acabar mandándole un WhatsApp de prueba a
 *     un desconocido. Además la clínica nace con WhatsApp apagado y fuera del
 *     mapa público.
 *   · La contraseña NO está en el código. Sale de DEMO_PASSWORD o se genera al
 *     azar y se imprime UNA vez. (Ver AUDITORIA-SEGURIDAD-2026-08-16: las
 *     cuentas demo con contraseña adivinable fueron un agujero real.)
 *   · Todo va en UNA transacción: o queda la clínica entera, o no queda nada.
 *
 * Lo que este script NO hace, a propósito: registrar la aceptación de los
 * términos legales. `legal_acceptances` es un registro append-only protegido
 * por trigger —no se puede editar ni borrar—, así que sembrar una aceptación
 * dejaría al usuario imposible de eliminar y metería un consentimiento falso en
 * un libro cuyo valor es que todo lo que hay dentro es verdad. La primera vez
 * que se guarde algo en la demo saldrá el modal de términos: un clic, y ese sí
 * es un consentimiento real de quien está enseñando la app.
 *
 * Datos deterministas: el generador va con semilla fija, así que purgar y
 * volver a sembrar reproduce exactamente la misma clínica.
 */

process.env.TZ = process.env.TZ || 'America/Tegucigalpa';
require('dotenv').config();

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

// ── Identidad de la cuenta ─────────────────────────────────────────────────
// El sufijo "(Demo)" es deliberado: en la consola de administración y en los
// reportes por clínica tiene que verse de un vistazo que esta no es una clínica
// que paga. Si algún día estorba en una captura se cambia aquí, pero entonces
// hay que acordarse de cuál es.
const NOMBRE_CLINICA = 'Podología Vista Hermosa (Demo)';

const CUENTAS = {
  admin:     { email: 'demo.admin@portalsaluddigital.com',     role: 'clinic_admin',  name: 'Ana Sofía Discua' },
  doctora:   { email: 'demo.podologa@portalsaluddigital.com',  role: 'doctor',        name: 'Dra. Marcela Zelaya' },
  recepcion: { email: 'demo.recepcion@portalsaluddigital.com', role: 'receptionist',  name: 'Keyla Amaya' },
};

// ── Azar reproducible ──────────────────────────────────────────────────────
let _semilla = 0x5add1610;
function rnd() {
  _semilla |= 0; _semilla = (_semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(_semilla ^ (_semilla >>> 15), 1 | _semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ent = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const uno = (arr) => arr[Math.floor(rnd() * arr.length)];
const dado = (p) => rnd() < p;

// ── Nombres ────────────────────────────────────────────────────────────────
const NOMBRES_F = ['María José', 'Ana Lucía', 'Gabriela', 'Sandra', 'Karla', 'Wendy', 'Iris', 'Doris',
  'Marlen', 'Suyapa', 'Fernanda', 'Rosa Elena', 'Claudia', 'Jessica', 'Nohemí', 'Alejandra', 'Mirna',
  'Yolanda', 'Kenia', 'Dilcia', 'Ada Luz', 'Belkis', 'Sofía', 'Xiomara', 'Reina', 'Lourdes', 'Elsa',
  'Norma', 'Julissa', 'Astrid', 'Heydi', 'Lesly'];
const NOMBRES_M = ['José Luis', 'Carlos', 'Óscar', 'Marvin', 'Denis', 'Elmer', 'Rigoberto', 'Wilmer',
  'Fredy', 'Josué', 'Edwin', 'Nelson', 'Rolando', 'Héctor', 'Julio César', 'Mauricio', 'Allan',
  'Bayron', 'Erick', 'Santos', 'Ramón', 'Iván', 'Gustavo', 'Roberto'];
const APELLIDOS = ['Discua', 'Zelaya', 'Mejía', 'Cárcamo', 'Bustillo', 'Rivera', 'Padilla', 'Bonilla',
  'Andino', 'Ferrera', 'Interiano', 'Lagos', 'Munguía', 'Ochoa', 'Pineda', 'Sabillón', 'Turcios',
  'Valladares', 'Amaya', 'Baquedano', 'Chirinos', 'Erazo', 'Fajardo', 'Guifarro', 'Handal', 'Izaguirre',
  'Maldonado', 'Nájera', 'Osorio', 'Portillo', 'Quezada', 'Reyes', 'Suazo', 'Tábora', 'Umanzor',
  'Velásquez', 'Zúniga', 'Alvarenga', 'Banegas', 'Colindres'];

const OFICIOS_F = ['Maestra', 'Enfermera', 'Comerciante', 'Ama de casa', 'Contadora', 'Estilista',
  'Cajera', 'Costurera', 'Secretaria', 'Vendedora', 'Cocinera', 'Jubilada', 'Administradora',
  'Operaria de maquila', 'Estudiante'];
const OFICIOS_M = ['Motorista', 'Albañil', 'Guardia de seguridad', 'Comerciante', 'Agricultor',
  'Mecánico', 'Docente', 'Jubilado', 'Panadero', 'Ingeniero', 'Soldador', 'Repartidor',
  'Operario de maquila', 'Estudiante'];

// ── Catálogo clínico ───────────────────────────────────────────────────────
// Cada caso trae el motivo tal como lo contaría el paciente, el juicio
// diagnóstico, el plan y los procedimientos. `hist` marca los antecedentes que
// deben quedar coherentes con el cuadro: un pie diabético con la casilla de
// diabetes en blanco delata al instante que los datos son de mentira.
const CASOS = [
  {
    id: 'onicocriptosis', tipo: 'onicocriptosis', costo: 1200,
    motivo: 'Dolor punzante en el borde interno de la uña del primer dedo del pie derecho desde hace tres semanas. Empeora con zapato cerrado y al caminar rápido.',
    dx: 'Onicocriptosis grado II en hallux derecho, borde medial, con tejido de granulación incipiente y eritema perilesional.',
    tx: 'Espiculectomía del canal medial bajo anestesia local, curación con antiséptico y apósito no adherente. Control en 8 días. Se indica corte recto de la lámina y calzado de horma ancha.',
    proc: 'Espiculectomía borde medial hallux derecho · curación · apósito',
    hist: {}, edadMin: 15, edadMax: 55,
  },
  {
    id: 'onicomicosis', tipo: 'pedicure_onicomicosis', costo: 900,
    motivo: 'Uñas de ambos pies engrosadas y amarillentas desde hace más de un año. No duelen; le incomoda el aspecto.',
    dx: 'Onicomicosis subungueal distal y lateral en 1.º, 3.º y 5.º dedos de ambos pies. Afectación menor del 50% de la lámina.',
    tx: 'Fresado mecánico de la lámina afectada y aplicación de amorolfina 5% en laca una vez por semana durante seis meses. Registro fotográfico de control cada seis semanas. Medidas de higiene y calzado transpirable.',
    proc: 'Fresado de lámina ungueal · aplicación de antimicótico tópico',
    hist: {}, edadMin: 35, edadMax: 80,
  },
  {
    id: 'heloma', tipo: 'pedicure_hiperqueratosis', costo: 800,
    motivo: 'Callosidad dolorosa en la planta del pie izquierdo; dice que camina como si tuviera una piedra en el zapato.',
    dx: 'Heloma plantar bajo la 2.ª cabeza metatarsiana izquierda, secundario a sobrecarga por metatarsalgia mecánica.',
    tx: 'Deslaminado con bisturí y fresado de la queratosis. Descarga de fieltro adhesivo en herradura. Se recomienda soporte plantar con oliva retrocapital y control en cuatro semanas.',
    proc: 'Deslaminado de heloma · fresado · descarga de fieltro',
    hist: {}, edadMin: 30, edadMax: 75,
  },
  {
    id: 'pie-diabetico', tipo: 'seguimiento', costo: 700, diabetico: true,
    motivo: 'Paciente con diabetes tipo 2 de larga evolución. Refiere hormigueo y sensación de quemazón en ambos pies, sobre todo por la noche.',
    dx: 'Pie de riesgo grado 1 (IWGDF): polineuropatía sensitiva distal simétrica, sin deformidad significativa ni antecedente de úlcera. Sin datos de enfermedad arterial periférica.',
    tx: 'Quiropodia de mantenimiento cada ocho semanas. Educación en inspección diaria, secado interdigital y elección de calzado. Hidratación con urea al 10% en talón y planta, evitando los espacios interdigitales. Se entrega hoja de autocuidado.',
    proc: 'Quiropodia · monofilamento 10 g · diapasón 128 Hz · toma de ITB',
    hist: { diabetes: 'DM2, 12 años de evolución. Control con médico internista.', vascular: 'Sin claudicación intermitente.' },
    edadMin: 48, edadMax: 82,
  },
  {
    id: 'fascitis', tipo: 'nuevo_paciente', costo: 800,
    motivo: 'Dolor en el talón derecho al dar los primeros pasos de la mañana, de unos dos meses de evolución. Mejora al rato y vuelve al final del día.',
    dx: 'Fascitis plantar derecha con punto doloroso selectivo en la inserción calcánea medial. Retropié pronado y acortamiento del tríceps sural.',
    tx: 'Estiramientos de fascia plantar y tríceps sural tres veces al día, taloneras de silicona y crioterapia 10 minutos tras la actividad. Control en cuatro semanas; si no cede, valorar soporte plantar a medida.',
    proc: 'Exploración biomecánica · test de Windlass · pauta de estiramientos',
    hist: { otros: 'Aumento reciente de la carga de caminata.' }, edadMin: 28, edadMax: 62,
  },
  {
    id: 'papiloma', tipo: 'procedimiento', costo: 1500,
    motivo: 'Lesión dolorosa en la planta del pie izquierdo que apareció hace dos meses y ha ido creciendo. Duele al pellizcarla, no al presionarla de frente.',
    dx: 'Papiloma plantar (verruga vírica) único en talón izquierdo, de 6 mm, con puntilleo hemorrágico e interrupción de los dermatoglifos.',
    tx: 'Deslaminado de la hiperqueratosis y cauterización química. Sesiones cada quince días hasta la resolución. Se advierte de la contagiosidad: chancletas en duchas compartidas y no compartir toalla.',
    proc: 'Deslaminado · cauterización química · apósito oclusivo',
    hist: {}, edadMin: 12, edadMax: 45,
  },
  {
    id: 'hallux-valgus', tipo: 'nuevo_paciente', costo: 800,
    motivo: 'Deformidad del dedo gordo en ambos pies, con un bulto que le roza y le duele con el zapato cerrado.',
    dx: 'Hallux valgus bilateral, de mayor grado en el pie derecho, con bursitis reactiva en la primera articulación metatarsofalángica.',
    tx: 'Separador interdigital nocturno y protección de silicona sobre la bursa. Calzado de horma ancha y tacón bajo. Se explica que el tratamiento conservador alivia la molestia pero no corrige el ángulo; si el dolor progresa, valoración por traumatología.',
    proc: 'Adaptación de ortesis de silicona · protección de bursa',
    hist: { arthritis: 'Familiares de primer grado con la misma deformidad.' }, edadMin: 35, edadMax: 78,
  },
  {
    id: 'hematoma', tipo: 'urgencia', costo: 1000,
    motivo: 'Golpe en la uña del primer dedo izquierdo jugando fútbol hace dos días. La uña se puso oscura y le late.',
    dx: 'Hematoma subungueal en hallux izquierdo que ocupa cerca del 40% de la lámina, con onicólisis parcial. Sin signos de fractura de la falange.',
    tx: 'Drenaje por trepanación, apósito estéril y control en siete días. Se advierte de la posible caída de la lámina en las próximas semanas. Calzado deportivo media talla mayor.',
    proc: 'Trepanación y drenaje de hematoma subungueal',
    hist: {}, edadMin: 15, edadMax: 45,
  },
  {
    id: 'mantenimiento', tipo: 'pedicure_clinico', costo: 700,
    motivo: 'Acude a su mantenimiento habitual. No refiere dolor.',
    dx: 'Pies sin patología activa. Xerosis leve en talones y ligera hiperqueratosis en el borde lateral del 5.º dedo.',
    tx: 'Quiropodia de mantenimiento e hidratación con urea al 10% dos veces al día. Próxima cita en ocho semanas.',
    proc: 'Quiropodia de mantenimiento · deslaminado suave · hidratación',
    hist: {}, edadMin: 25, edadMax: 80,
  },
  {
    id: 'spa', tipo: 'pedicure_spa', costo: 550,
    motivo: 'Viene por estética antes de un viaje. Sin molestias.',
    dx: 'Pies sanos. Cutícula exuberante y descamación fina en el antepié.',
    tx: 'Pedicura spa: exfoliación, hidratación profunda y masaje. Se recomienda mantener la hidratación diaria.',
    proc: 'Exfoliación · hidratación profunda · masaje podal',
    hist: {}, edadMin: 18, edadMax: 60,
  },
  {
    id: 'pie-plano', tipo: 'nuevo_paciente', costo: 800,
    motivo: 'Cansancio en los pies al final del día y desgaste desigual del calzado, que se le vence por dentro.',
    dx: 'Pie plano flexible bilateral grado II con valgo de retropié y descenso del arco longitudinal medial en carga.',
    tx: 'Soportes plantares termoconformados a medida. Ejercicios de fortalecimiento del tibial posterior y de la musculatura intrínseca. Control a los tres meses con el soporte puesto.',
    proc: 'Estudio de la huella · exploración en carga · molde para soporte plantar',
    hist: {}, edadMin: 16, edadMax: 55,
  },
  {
    id: 'metatarsalgia', tipo: 'seguimiento', costo: 600,
    motivo: 'Ardor en la planta del antepié derecho tras estar de pie toda la jornada.',
    dx: 'Metatarsalgia mecánica de radios centrales del pie derecho, con hiperqueratosis difusa bajo 2.ª y 3.ª cabezas. Antepié en descenso.',
    tx: 'Deslaminado de la queratosis, descarga retrocapital provisional y pauta de descanso. Se valora el soporte plantar definitivo en la próxima visita.',
    proc: 'Deslaminado · descarga retrocapital',
    hist: {}, edadMin: 30, edadMax: 70,
  },
  {
    id: 'onicogrifosis', tipo: 'pedicure_clinico', costo: 900,
    motivo: 'No puede cortarse las uñas por sí misma; están muy gruesas y curvadas.',
    dx: 'Onicogrifosis en primer dedo de ambos pies, con onicauxis del resto de las láminas. Limitación funcional para el autocuidado.',
    tx: 'Corte y fresado de las láminas hasta grosor funcional. Programa de quiropodia cada ocho semanas por incapacidad para el autocuidado. Hidratación periungueal.',
    proc: 'Corte y fresado de láminas engrosadas',
    hist: { otros: 'Vive sola; dificultad para alcanzar los pies.' }, edadMin: 65, edadMax: 88,
  },
  {
    id: 'tinea', tipo: 'seguimiento', costo: 600,
    motivo: 'Picazón y piel blanquecina entre los dedos del pie derecho desde hace un mes.',
    dx: 'Tinea pedis interdigital en 3.º y 4.º espacio del pie derecho, con maceración. Sin afectación ungueal.',
    tx: 'Terbinafina crema dos veces al día durante cuatro semanas, prolongando siete días tras la desaparición de las lesiones. Secado interdigital cuidadoso y cambio diario de calcetín de algodón.',
    proc: 'Limpieza y desbridamiento de la maceración · pauta antifúngica',
    hist: { otros: 'Usa botas de trabajo cerradas nueve horas al día.' }, edadMin: 20, edadMax: 60,
  },
];

// Motivo corto para la columna "razón" de la agenda.
const RAZON_POR_TIPO = {
  nuevo_paciente: 'Primera consulta podológica',
  seguimiento: 'Control de tratamiento',
  urgencia: 'Dolor agudo, atención el mismo día',
  procedimiento: 'Procedimiento programado',
  pedicure_clinico: 'Quiropodia de mantenimiento',
  onicocriptosis: 'Uña encarnada',
  pedicure_onicomicosis: 'Tratamiento de onicomicosis',
  pedicure_hiperqueratosis: 'Callosidades / hiperqueratosis',
  pedicure_spa: 'Pedicura spa',
};

// ── Fechas ─────────────────────────────────────────────────────────────────
const dosD = (n) => String(n).padStart(2, '0');
const aFecha = (d) => `${d.getFullYear()}-${dosD(d.getMonth() + 1)}-${dosD(d.getDate())}`;
const aFechaHora = (d) => `${aFecha(d)}T${dosD(d.getHours())}:${dosD(d.getMinutes())}:00`;
const masDias = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
const conHora = (d, h, m) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x; };

const HOY = conHora(new Date(), 0, 0);

// Horario de la clínica: L-V 08:00-17:00 y sábado 08:00-12:00, en tramos de 45'.
const esLaborable = (d) => d.getDay() >= 1 && d.getDay() <= 6;
function tramosDe(d) {
  const sabado = d.getDay() === 6;
  const fin = sabado ? 12 * 60 : 17 * 60;
  const out = [];
  for (let m = 8 * 60; m + 45 <= fin; m += 45) {
    if (!sabado && m >= 12 * 60 && m < 13 * 60) continue; // almuerzo
    out.push(m);
  }
  return out;
}

// ── Utilidades de datos ────────────────────────────────────────────────────
const identidad = (anio, n) => `9999-${anio}-${String(n).padStart(5, '0')}`;
const telefono = (n) => `9999-${String(1000 + (n * 37) % 9000)}`;
const imc = (kg, m) => (kg / (m * m)).toFixed(1);

const CLAVES_PERSONAL = ['diabetes', 'hypertension', 'cardiopathy', 'vascular', 'psoriasis', 'arthritis',
  'cancer', 'dermatological', 'hiv', 'renal', 'otros', 'allergies', 'aspirin'];
const CLAVES_NO_PATOLOGICO = ['fuma', 'alcohol', 'toxins', 'otros', 'exercise'];
const CLAVES_CALZADO = ['deportivo', 'tacones', 'flat', 'cerrados', 'sandalias', 'botas', 'otros'];

// {clave: {checked, obs}} — la forma exacta que lee y escribe la ficha
// (public/consultation-podiatry.html → collectHistoryGroup).
function grupoHistorial(claves, marcadas) {
  const out = {};
  for (const k of claves) {
    const v = marcadas[k];
    out[k] = { checked: !!v, obs: v && v !== true ? String(v) : '' };
  }
  return out;
}

// La exploración del pie diabético, en la forma que guarda el widget
// (public/diabetic-foot-exam.js → getState): sub / mono / vib / itb.
function exploracionPieDiabetico({ neuropatia }) {
  const sub = {
    'marcha.A': { status: 'normal', note: '' },
    'marcha.B': { status: 'normal', note: '' },
    'marcha.C': { status: 'normal', note: '' },
    'marcha.D': { status: neuropatia ? 'abnormal' : 'normal', note: neuropatia ? 'Inestabilidad leve en tándem.' : '' },
    'fuerza.A': { status: 'normal', score: '5', note: '' },
    'fuerza.B': { status: 'normal', score: '5', note: '' },
    'fuerza.C': { status: 'normal', score: '5', note: '' },
    'fuerza.D': { status: neuropatia ? 'abnormal' : 'normal', score: neuropatia ? '4' : '5', note: '' },
    'sens-sup.A': { status: neuropatia ? 'abnormal' : 'normal', note: neuropatia ? 'Hipoestesia en calcetín hasta el tercio distal de la pierna.' : '' },
    'sens-sup.B': { status: neuropatia ? 'abnormal' : 'normal', note: '' },
    'sens-sup.C': { status: 'normal', note: '' },
    'trofismo.A': { status: 'normal', note: '' },
    'reflejos.A': { status: 'normal', note: '' },
    'reflejos.B': { status: neuropatia ? 'abnormal' : 'normal', note: neuropatia ? 'Arreflexia aquílea bilateral.' : '' },
    'plantar.A': { status: 'normal', note: '' },
    'plantar.B': { status: 'normal', note: '' },
  };

  const mono = {};
  const perdidos = neuropatia ? ['p1', 'p4', 'p5'] : [];
  for (let i = 1; i <= 10; i++) {
    const p = 'p' + i;
    mono['R-' + p] = perdidos.includes(p) ? 'miss' : 'hit';
    mono['L-' + p] = perdidos.includes(p) && dado(0.7) ? 'miss' : 'hit';
  }

  const vib = {
    'R-v1': neuropatia ? 'miss' : 'hit', 'R-v2': 'hit',
    'L-v1': neuropatia ? 'miss' : 'hit', 'L-v2': 'hit',
  };

  const brazo = ent(118, 134);
  const itb = {
    vR: 'DP', vL: 'DP',
    armR: brazo, armL: brazo - ent(0, 6),
    dpR: Math.round(brazo * (neuropatia ? 1.02 : 1.06)),
    tpR: Math.round(brazo * 1.0),
    dpL: Math.round(brazo * (neuropatia ? 0.99 : 1.04)),
    tpL: Math.round(brazo * 0.98),
  };

  return { sub, mono, vib, itb };
}

// Termografía: las etiquetas son las que genera el clic sobre el SVG de la
// ficha ("Derecho - Dedo 1"), con foot/zoneId explícitos para que el mapa de
// los pies se pinte con los colores de temperatura.
const ZONAS_TERMO = [
  ['sole', 'Dedo 1'], ['toe1', 'Dedo 2'], ['toe2', 'Dedo 3'],
  ['toe3', 'Dedo 4'], ['toe4', 'Dedo 5'], ['arch', 'Planta'],
];
function termografia({ neuropatia }) {
  const tipo = neuropatia ? 'type4' : uno(['type1', 'type2', 'type3', 'type6']);
  const base = neuropatia ? 29.8 : 32.4;
  const medidas = [];
  for (const pie of ['right', 'left']) {
    const etiquetaPie = pie === 'right' ? 'Derecho' : 'Izquierdo';
    for (const [zoneId, etiqueta] of ZONAS_TERMO) {
      if (!neuropatia && dado(0.45)) continue; // en el pie sano no se miden las 12 zonas
      const delta = zoneId === 'arch' ? 1.6 : (zoneId === 'sole' ? 0.4 : 0);
      medidas.push({
        zone: `${etiquetaPie} - ${etiqueta}`,
        temp: Number((base + delta + (rnd() * 1.4 - 0.7)).toFixed(1)),
        type: tipo, foot: pie, zoneId,
      });
    }
  }
  return {
    type: tipo,
    measurements: medidas,
    observations: neuropatia
      ? 'Patrón hipotérmico distal simétrico, con gradiente descendente hacia los dedos. Diferencia entre zonas homólogas menor de 1 °C: no hay asimetría sugestiva de proceso inflamatorio focal.'
      : 'Distribución térmica simétrica entre ambos pies, sin puntos calientes. Diferencia máxima entre zonas homólogas de 0,6 °C.',
  };
}

// ── Siembra ────────────────────────────────────────────────────────────────
async function sembrar(cli) {
  const ya = await cli.query('SELECT id FROM clinics WHERE name = $1', [NOMBRE_CLINICA]);
  if (ya.rows.length) {
    throw new Error(
      `la clínica "${NOMBRE_CLINICA}" ya existe (id=${ya.rows[0].id}).\n` +
      '  Para rehacerla:  node tools/seed-demo-podologia.js --purge && node tools/seed-demo-podologia.js',
    );
  }

  const clave = process.env.DEMO_PASSWORD || crypto.randomBytes(9).toString('base64url');
  const hash = bcrypt.hashSync(clave, 10);

  // ── Clínica ──
  const rc = await cli.query(
    `INSERT INTO clinics
       (name, address, city, phone, email, specialties, chairs, currency, brand_color, type, info,
        whatsapp_enabled, landing_published, show_on_public_map)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, FALSE, FALSE, FALSE)
     RETURNING id`,
    [
      NOMBRE_CLINICA,
      'Col. Vista Hermosa, 3.ª calle, casa 1420',
      'Tegucigalpa',
      '2239-4180',
      'contacto@vistahermosa.demo',
      'Podología',
      2,
      'HNL',
      '#0891b2',
      'Consultorio',
      'CUENTA DE DEMOSTRACIÓN. Pacientes, citas y consultas ficticios (identidades con prefijo 9999). ' +
      'Se crea y se borra con tools/seed-demo-podologia.js. No cuenta para los reportes del negocio.',
    ],
  );
  const clinicId = rc.rows[0].id;

  // ── Usuarios ──
  const nuevoUsuario = async (c, extra = {}) => {
    const r = await cli.query(
      `INSERT INTO users
         (email, password, role, name, clinic_id, specialty, phone, license, experience, bio, shift,
          languages, focus, approval_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'approved')
       RETURNING id`,
      [
        c.email, hash, c.role, c.name, clinicId,
        extra.specialty || '', extra.phone || '', extra.license || '', extra.experience || 0,
        extra.bio || '', extra.shift || '',
        JSON.stringify(extra.languages || ['Español']),
        JSON.stringify(extra.focus || []),
      ],
    );
    return r.rows[0].id;
  };

  const adminId = await nuevoUsuario(CUENTAS.admin, { phone: '9999-2001', shift: 'Matutino' });
  const doctoraId = await nuevoUsuario(CUENTAS.doctora, {
    specialty: 'Podología',
    phone: '9999-2002',
    license: 'CMH-POD-4417',
    experience: 9,
    shift: 'Completo',
    bio: 'Podóloga clínica con nueve años de ejercicio. Atiende quiropodia, uña encarnada, onicomicosis y pie diabético, con especial dedicación al cribado neurovascular del paciente diabético.',
    focus: ['Pie diabético', 'Onicocriptosis', 'Biomecánica'],
  });
  const recepcionId = await nuevoUsuario(CUENTAS.recepcion, { phone: '9999-2003', shift: 'Completo' });

  // ── Salas ──
  const salas = [];
  for (const nombre of ['Sala 1 · Quiropodia', 'Sala 2 · Termografía']) {
    const r = await cli.query(
      'INSERT INTO clinic_rooms (clinic_id, name, status) VALUES ($1,$2,$3) RETURNING id',
      [clinicId, nombre, 'free'],
    );
    salas.push(r.rows[0].id);
  }

  // ── Horario de la doctora ──
  for (const dow of [1, 2, 3, 4, 5, 6]) {
    await cli.query(
      `INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, slot_duration, enabled)
       VALUES ($1,$2,$3,$4,45,TRUE)`,
      [doctoraId, dow, '08:00', dow === 6 ? '12:00' : '17:00'],
    );
  }

  // ── Plantillas de consentimiento ──
  const plantillas = [];
  const CONSENTIMIENTOS = [
    ['procedimiento', 'Consentimiento informado para procedimiento podológico',
      'Autorizo a la clínica a realizar el procedimiento podológico que se me ha explicado (quiropodia, espiculectomía, deslaminado, cauterización química o drenaje ungueal), habiendo comprendido en qué consiste, sus alternativas y sus riesgos más frecuentes: dolor leve durante y después del procedimiento, sangrado escaso, infección local y, en el caso de la matricectomía, recidiva de la uña encarnada. Se me ha explicado que puedo retirar este consentimiento en cualquier momento antes de comenzar.'],
    ['imagenes', 'Autorización para registro fotográfico clínico',
      'Autorizo la toma de fotografías de mis pies con fines exclusivamente clínicos: documentar la evolución del tratamiento y comparar los resultados entre visitas. Las imágenes se guardan en mi expediente y no se publican ni se comparten fuera del equipo tratante sin una autorización mía adicional y por escrito.'],
    ['datos', 'Tratamiento de datos personales de salud',
      'Autorizo el tratamiento de mis datos personales y de salud para la prestación del servicio, la gestión de mis citas y el envío de recordatorios al número que he proporcionado. Conozco mi derecho a acceder a mis datos, rectificarlos, solicitar su eliminación y revocar esta autorización.'],
  ];
  for (const [tipo, titulo, texto] of CONSENTIMIENTOS) {
    const r = await cli.query(
      'INSERT INTO consent_templates (clinic_id, doctor_id, type, title, description) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [clinicId, doctoraId, tipo, titulo, texto],
    );
    plantillas.push(r.rows[0].id);
  }

  // ── Pacientes ──
  const N_PACIENTES = 68;
  const pacientes = [];
  const identidadesUsadas = new Set();

  for (let i = 0; i < N_PACIENTES; i++) {
    const femenino = dado(0.66); // la consulta podológica se feminiza mucho
    const caso = CASOS[i % CASOS.length];
    const edad = ent(caso.edadMin, caso.edadMax);
    const nombre = `${femenino ? uno(NOMBRES_F) : uno(NOMBRES_M)} ${uno(APELLIDOS)} ${uno(APELLIDOS)}`;
    const anio = HOY.getFullYear() - edad;

    let ident = identidad(anio, i + 1);
    while (identidadesUsadas.has(ident)) ident = identidad(anio, ent(1, 99999));
    identidadesUsadas.add(ident);

    const r = await cli.query(
      `INSERT INTO patients
         (name, identity_number, age, birth_date, gender, phone, whatsapp_number, clinic_id, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9) RETURNING id`,
      [
        nombre, ident, edad,
        `${anio}-${dosD(ent(1, 12))}-${dosD(ent(1, 28))}`,
        femenino ? 'Femenino' : 'Masculino',
        telefono(i + 1), clinicId, recepcionId,
        aFechaHora(conHora(masDias(HOY, -ent(20, 320)), ent(8, 16), ent(0, 59))),
      ],
    );

    // Antecedentes: manda el caso, y encima se añade el ruido propio de la edad.
    const diabetico = !!caso.diabetico || (edad > 55 && dado(0.22));
    const hipertenso = edad > 50 && dado(0.38);
    const alergico = dado(0.14);

    await cli.query(
      'INSERT INTO critical_info (patient_id, allergies, medications, conditions) VALUES ($1,$2,$3,$4)',
      [
        r.rows[0].id,
        alergico ? uno(['Penicilina', 'Sulfas', 'AINEs (ibuprofeno)', 'Látex', 'Lidocaína — reacción local']) : '',
        [
          diabetico ? uno(['Metformina 850 mg c/12 h', 'Metformina 500 mg c/12 h + glibenclamida', 'Insulina NPH nocturna']) : '',
          hipertenso ? uno(['Losartán 50 mg c/día', 'Enalapril 10 mg c/12 h', 'Amlodipino 5 mg c/día']) : '',
        ].filter(Boolean).join(' · '),
        [
          diabetico ? 'Diabetes mellitus tipo 2' : '',
          hipertenso ? 'Hipertensión arterial' : '',
          edad > 65 && dado(0.3) ? 'Osteoartrosis' : '',
        ].filter(Boolean).join(' · '),
      ],
    );

    pacientes.push({
      id: r.rows[0].id, nombre, edad, femenino, caso, diabetico, hipertenso, alergico,
      oficio: femenino ? uno(OFICIOS_F) : uno(OFICIOS_M),
      pesoKg: femenino ? ent(52, 92) : ent(62, 108),
      tallaM: femenino ? (1.48 + rnd() * 0.18) : (1.6 + rnd() * 0.2),
    });
  }

  // Consentimientos firmados. El de datos lo firma todo el que firma algo; los
  // otros dos, solo quien pasó por procedimiento o por foto.
  for (const p of pacientes) {
    if (!dado(0.55)) continue;
    const firmadas = plantillas.filter((_, idx) => idx === 2 || dado(0.6));
    for (const tpl of firmadas) {
      await cli.query(
        `INSERT INTO patient_consents (patient_id, template_id, clinic_id, signed_by, signature_date, status)
         VALUES ($1,$2,$3,$4,$5,'signed')`,
        [p.id, tpl, clinicId, p.nombre, aFechaHora(conHora(masDias(HOY, -ent(20, 280)), ent(8, 16), 0))],
      );
    }
  }

  // ── Agenda ──
  const ocupados = new Set(); // 'YYYY-MM-DDTHH:MM:SS' → no se solapan dos citas
  const citas = [];

  function agendar(dia, paciente, opciones = {}) {
    const tramos = tramosDe(dia);
    for (let intento = 0; intento < tramos.length + 3; intento++) {
      const min = opciones.minuto != null && intento === 0 ? opciones.minuto : uno(tramos);
      const cuando = conHora(dia, Math.floor(min / 60), min % 60);
      const llave = aFechaHora(cuando);
      if (ocupados.has(llave)) continue;
      ocupados.add(llave);
      citas.push({ cuando, paciente, ...opciones });
      return true;
    }
    return false;
  }

  // 1 · Historia: entre una y seis visitas por paciente en los últimos 10 meses.
  for (const p of pacientes) {
    const nVisitas = dado(0.3) ? ent(4, 6) : ent(1, 3);
    let dia = masDias(HOY, -ent(20, 300));
    for (let v = 0; v < nVisitas; v++) {
      if (dia >= masDias(HOY, -2)) break;
      while (!esLaborable(dia)) dia = masDias(dia, 1);
      agendar(dia, p, { estado: dado(0.09) ? 'cancelled' : 'completed' });
      dia = masDias(dia, ent(21, 62));
    }
  }

  // 2 · Hoy: una agenda que se vea viva al abrir la app — la mañana ya atendida,
  //     alguien esperando en sala y la tarde por delante.
  if (esLaborable(HOY)) {
    const tope = HOY.getDay() === 6 ? 12 * 60 : 17 * 60;
    const guion = [
      { minuto: 8 * 60, estado: 'completed' },
      { minuto: 8 * 60 + 45, estado: 'completed' },
      { minuto: 9 * 60 + 30, estado: 'completed' },
      { minuto: 10 * 60 + 15, estado: 'completed' },
      { minuto: 11 * 60, estado: 'waiting', sala: salas[0] },
      { minuto: 13 * 60, estado: 'confirmed' },
      { minuto: 13 * 60 + 45, estado: 'confirmed' },
      { minuto: 14 * 60 + 30, estado: 'pending' },
      { minuto: 15 * 60 + 15, estado: 'confirmed' },
      { minuto: 16 * 60, estado: 'pending' },
    ];
    for (const g of guion) {
      if (g.minuto + 45 > tope) continue;
      agendar(HOY, uno(pacientes), g);
    }
  }

  // 3 · Las próximas tres semanas.
  for (let d = 1; d <= 21; d++) {
    const dia = masDias(HOY, d);
    if (!esLaborable(dia)) continue;
    const cuantas = dia.getDay() === 6 ? ent(2, 4) : ent(3, 6);
    for (let i = 0; i < cuantas; i++) {
      agendar(dia, uno(pacientes), { estado: dado(0.62) ? 'confirmed' : 'pending' });
    }
  }

  citas.sort((a, b) => a.cuando - b.cuando);

  // Cuál es la PRIMERA cita de cada paciente: la que se marca como "primera vez"
  // en la ficha. Se calcula una vez, no buscando dentro del bucle.
  const primeraDe = new Map();
  for (const c of citas) if (!primeraDe.has(c.paciente.id)) primeraDe.set(c.paciente.id, c);

  // ── Citas y consultas ──
  let nConsultas = 0;
  let ingresos = 0;

  for (const c of citas) {
    const p = c.paciente;
    const caso = p.caso;
    const esPrimera = primeraDe.get(p.id) === c;
    const tipo = esPrimera && caso.tipo !== 'urgencia' ? 'nuevo_paciente' : caso.tipo;
    const costo = tipo === 'nuevo_paciente' ? 800 : caso.costo;
    const completada = c.estado === 'completed';
    const pagada = completada && dado(0.88);

    const inicio = c.cuando;
    const fin = new Date(inicio.getTime() + ent(30, 45) * 60000);

    const ra = await cli.query(
      `INSERT INTO appointments
         (patient_id, doctor_id, clinic_id, specialty, scheduled_at, status, source, reason,
          appointment_type, room_id, checked_in_at, started_at, ended_at,
          cost, payment_status, payment_method, paid_at, paid_by, created_at)
       VALUES ($1,$2,$3,'Podología',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id`,
      [
        p.id, doctoraId, clinicId,
        aFechaHora(inicio),
        c.estado,
        dado(0.22) ? 'online' : 'manual',
        RAZON_POR_TIPO[tipo] || 'Consulta podológica',
        tipo,
        c.sala || (completada ? salas[ent(0, 1)] : null),
        completada || c.estado === 'waiting' ? aFechaHora(new Date(inicio.getTime() - ent(4, 14) * 60000)) : null,
        completada ? aFechaHora(inicio) : null,
        completada ? aFechaHora(fin) : null,
        // La cita lleva su tarifa desde que se agenda; solo la cancelada vale 0.
        // (Si se deja en 0 hasta atender, el tablero de recepción enseña "L. 0"
        // junto al paciente que está esperando en sala.)
        c.estado === 'cancelled' ? 0 : costo,
        pagada ? 'paid' : 'pending',
        pagada ? uno(['efectivo', 'efectivo', 'tarjeta', 'transferencia']) : '',
        pagada ? aFechaHora(fin) : null,
        pagada ? recepcionId : null,
        aFechaHora(conHora(masDias(inicio, -ent(1, 12)), ent(8, 17), ent(0, 59))),
      ],
    );
    const citaId = ra.rows[0].id;

    if (!completada) continue;

    // ── La ficha podológica ──
    const neuropatia = p.diabetico && caso.id === 'pie-diabetico';

    const extra = {
      visit_type: esPrimera ? 'primera_vez' : 'seguimiento',
      seen_podologist_before: esPrimera ? (dado(0.35) ? 'si' : 'no') : 'si',
      prev_podologist_details: esPrimera && dado(0.2)
        ? 'Atención previa en otra clínica hace más de dos años, sin seguimiento.' : '',
      age: String(p.edad),
      occupation: p.oficio,
      weight: String(p.pesoKg),
      height: String(Math.round(p.tallaM * 100)),
      imc: imc(p.pesoKg, p.tallaM),
      foot_type_right: uno(['Espiguio', 'Romano', 'Griego', 'Germánico', 'Celta']),
      foot_shape_right: caso.id === 'pie-plano' ? 'Plano' : uno(['Normal', 'Normal', 'Plano', 'Cavo']),
      personal_history: grupoHistorial(CLAVES_PERSONAL, {
        diabetes: p.diabetico ? (caso.hist.diabetes || 'Diabetes mellitus tipo 2 en control con médico internista.') : false,
        hypertension: p.hipertenso ? 'En tratamiento, cifras controladas.' : false,
        allergies: p.alergico ? 'Ver alergias registradas en la ficha del paciente.' : false,
        vascular: caso.hist.vascular || false,
        arthritis: caso.hist.arthritis || false,
        otros: caso.hist.otros || false,
      }),
      non_pathological_history: grupoHistorial(CLAVES_NO_PATOLOGICO, {
        fuma: dado(0.16) ? `${ent(3, 15)} cigarrillos al día.` : false,
        alcohol: dado(0.2) ? 'Ocasional, fines de semana.' : false,
        exercise: dado(0.42) ? uno([
          'Caminata de 30 minutos, tres veces por semana.',
          'Gimnasio dos veces por semana.',
          'Fútbol los domingos.',
          'Sedentaria por trabajo.',
        ]) : false,
      }),
      // El calzado NUNCA puede salir todo en blanco: todo el mundo calza algo, y
      // en una ficha podológica ese apartado vacío canta que el dato es falso.
      // Por eso `deportivo` es el que queda de respaldo si no cae ningún otro.
      footwear_type: (() => {
        const marcas = {
          cerrados: p.femenino ? false : 'Zapato de trabajo cerrado, nueve horas al día.',
          tacones: p.femenino && dado(0.5) ? `Tacón de ${ent(4, 9)} cm a diario.` : false,
          deportivo: dado(0.5) ? 'Tenis para las actividades diarias.' : false,
          sandalias: p.femenino && dado(0.4) ? 'Sandalia plana en casa.' : false,
          botas: !p.femenino && dado(0.3) ? 'Bota de seguridad en el trabajo.' : false,
        };
        if (!Object.values(marcas).some(Boolean)) {
          marcas.deportivo = 'Tenis para las actividades diarias.';
        }
        return grupoHistorial(CLAVES_CALZADO, marcas);
      })(),
      obstetric_history: { pregnancy: { checked: false, obs: '' }, sg: '', tx: '' },
      thermography: termografia({ neuropatia }),
      diabetic_foot_exam: p.diabetico ? exploracionPieDiabetico({ neuropatia }) : null,
    };

    // Los dos pies suelen compartir tipo y forma; se copian tras elegir el derecho.
    extra.foot_type_left = dado(0.85) ? extra.foot_type_right : uno(['Espiguio', 'Romano', 'Griego']);
    extra.foot_shape_left = dado(0.8) ? extra.foot_shape_right : 'Normal';

    if (p.femenino && p.edad < 45 && dado(0.18)) {
      extra.obstetric_history = {
        pregnancy: { checked: true, obs: 'Edema maleolar vespertino. Se evita el uso de tópicos queratolíticos.' },
        sg: String(ent(12, 36)),
        tx: 'Ninguno.',
      };
    }

    const motivo = esPrimera ? caso.motivo : `Control de ${caso.dx.split(',')[0].toLowerCase()}. ${uno([
      'Refiere mejoría del dolor desde la última visita.',
      'Cumple el tratamiento indicado; queda una molestia leve al final del día.',
      'Sin dolor. Acude al mantenimiento programado.',
      'Mejoría parcial; se ajusta el plan.',
    ])}`;
    const planTexto = esPrimera
      ? caso.tx
      : `${caso.tx.split('.')[0]}. Se mantiene la pauta y se cita en ${ent(4, 10)} semanas.`;

    await cli.query(
      `INSERT INTO consultations
         (patient_id, doctor_id, clinic_id, appointment_id, specialty, created_at,
          visit_reason, notes, diagnosis, treatment, procedures,
          radiography_notes, observations, cost, payment_status, payment_notes)
       VALUES ($1,$2,$3,$4,'Podología',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        p.id, doctoraId, clinicId, citaId,
        aFechaHora(fin),
        RAZON_POR_TIPO[tipo] || 'Consulta podológica',
        motivo, caso.dx, planTexto, caso.proc,
        JSON.stringify(extra),
        JSON.stringify({ dermatological: motivo, neurological: planTexto }),
        costo,
        pagada ? 'paid' : 'pending',
        pagada && dado(0.15) ? uno([
          'Descuento del 10% por paquete de tres sesiones.',
          'Paquete de dos procedimientos.',
          'Descuento de adulto mayor.',
        ]) : '',
      ],
    );
    nConsultas++;
    if (pagada) ingresos += costo;
  }

  // ── Suscripción ──
  // Sin esto la cuenta queda en SOLO LECTURA (BILLING_ENFORCEMENT=on) y, en
  // mitad de la demostración, cualquier "Guardar" contesta 402. No es un cobro:
  // es una fila local con proveedor 'demo' que nunca pasa por PayPal, con
  // importe 0 para que no ensucie ningún reporte de ingresos de la plataforma.
  const plan = await cli.query('SELECT id, currency FROM plans WHERE is_active = TRUE ORDER BY amount ASC LIMIT 1');
  const finDePeriodo = new Date(HOY);
  finDePeriodo.setFullYear(finDePeriodo.getFullYear() + 5);
  await cli.query(
    `INSERT INTO subscriptions
       (clinic_id, user_id, provider, provider_subscription_id, status, plan_id, amount, currency,
        subscriber_email, subscriber_name, current_period_start, current_period_end, metadata)
     VALUES ($1,$2,'demo',$3,'active',$4,0,$5,$6,$7,$8,$9,$10)`,
    [
      clinicId, adminId,
      `demo-${clinicId}-${Date.now()}`,
      plan.rows[0] ? plan.rows[0].id : null,
      plan.rows[0] ? plan.rows[0].currency : 'USD',
      CUENTAS.admin.email, CUENTAS.admin.name,
      aFechaHora(HOY), aFechaHora(finDePeriodo),
      JSON.stringify({ demo: true, motivo: 'cuenta de demostración — no corresponde a ningún cobro real' }),
    ],
  );

  return {
    clinicId, clave,
    nPacientes: pacientes.length, nCitas: citas.length, nConsultas, ingresos,
  };
}

// ── Purga ──────────────────────────────────────────────────────────────────
async function purgar(cli) {
  const r = await cli.query('SELECT id FROM clinics WHERE name = $1', [NOMBRE_CLINICA]);
  if (!r.rows.length) return null;
  const clinicId = r.rows[0].id;

  const usuarios = (await cli.query('SELECT id FROM users WHERE clinic_id = $1', [clinicId])).rows.map((x) => x.id);
  const pacientes = (await cli.query('SELECT id FROM patients WHERE clinic_id = $1', [clinicId])).rows.map((x) => x.id);

  const borrados = {};
  // Cada borrado va atado a clinic_id, o a un id de usuario/paciente de ESTA
  // clínica. Ninguna sentencia puede alcanzar filas de otra.
  const borrar = async (tabla, columna, valores, tipo = 'int') => {
    const existe = await cli.query('SELECT to_regclass($1) AS t', ['public.' + tabla]);
    if (!existe.rows[0].t) return;
    if (Array.isArray(valores)) {
      if (!valores.length) return;
      const res = await cli.query(`DELETE FROM ${tabla} WHERE ${columna} = ANY($1::${tipo}[])`, [valores]);
      if (res.rowCount) borrados[tabla] = (borrados[tabla] || 0) + res.rowCount;
    } else {
      const res = await cli.query(`DELETE FROM ${tabla} WHERE ${columna} = $1`, [valores]);
      if (res.rowCount) borrados[tabla] = (borrados[tabla] || 0) + res.rowCount;
    }
  };

  // Hojas primero, raíces al final.
  await borrar('consultation_images', 'clinic_id', clinicId);
  await borrar('consultation_inventory_usage', 'clinic_id', clinicId);
  await borrar('appointment_confirmations', 'clinic_id', clinicId);
  await borrar('appointment_reminders', 'clinic_id', clinicId);
  await borrar('consultations', 'clinic_id', clinicId);
  await borrar('clinic_rooms', 'clinic_id', clinicId);          // antes que appointments (current_appointment_id)
  await borrar('appointments', 'clinic_id', clinicId);
  await borrar('patient_consents', 'clinic_id', clinicId);
  await borrar('consents', 'clinic_id', clinicId);
  await borrar('consent_templates', 'clinic_id', clinicId);
  await borrar('critical_info', 'patient_id', pacientes);
  await borrar('chat_messages', 'conversation_id',
    (await cli.query('SELECT id FROM chat_conversations WHERE clinic_id = $1', [clinicId])).rows.map((x) => x.id));
  await borrar('chat_members', 'conversation_id',
    (await cli.query('SELECT id FROM chat_conversations WHERE clinic_id = $1', [clinicId])).rows.map((x) => x.id));
  await borrar('chat_conversations', 'clinic_id', clinicId);
  // conversation_sessions.id es UUID, no int: el cast tiene que ser distinto.
  await borrar('conversation_messages', 'session_id',
    (await cli.query('SELECT id FROM conversation_sessions WHERE clinic_id = $1', [clinicId])).rows.map((x) => x.id),
    'uuid');
  await borrar('conversation_sessions', 'clinic_id', clinicId);
  await borrar('social_reviews', 'clinic_id', clinicId);
  await borrar('social_stories', 'clinic_id', clinicId);
  await borrar('social_posts', 'clinic_id', clinicId);
  await borrar('patients', 'clinic_id', clinicId);
  await borrar('inventory_movements', 'clinic_id', clinicId);
  await borrar('inventory_items', 'clinic_id', clinicId);
  await borrar('clinic_landing_leads', 'clinic_id', clinicId);
  await borrar('growth_campaigns', 'clinic_id', clinicId);
  await borrar('clinic_integrations', 'clinic_id', clinicId);
  await borrar('invitations', 'clinic_id', clinicId);
  await borrar('audit_logs', 'clinic_id', clinicId);
  await borrar('payments', 'clinic_id', clinicId);
  await borrar('payment_methods', 'clinic_id', clinicId);
  await borrar('subscriptions', 'clinic_id', clinicId);
  await borrar('doctor_availability', 'doctor_id', usuarios);
  await borrar('doctor_day_overrides', 'doctor_id', usuarios);
  await borrar('user_sessions', 'user_id', usuarios);
  await borrar('account_closure_requests', 'user_id', usuarios);

  // Los usuarios que ya aceptaron los términos NO se pueden borrar:
  // legal_acceptances es append-only por trigger y su FK apunta a users(id).
  // A esos se les cierra la puerta igual que hace tools/disable-demo-accounts.js
  // —contraseña aleatoria irrecuperable, approval_status='rejected'— y se les
  // saca de la clínica para que la clínica sí pueda desaparecer.
  const conLegal = usuarios.length
    ? (await cli.query(
        'SELECT DISTINCT user_id FROM legal_acceptances WHERE user_id = ANY($1::int[])', [usuarios],
      )).rows.map((x) => x.user_id)
    : [];

  if (conLegal.length) {
    for (const uid of conLegal) {
      await cli.query(
        `UPDATE users
            SET email = $2, password = $3, approval_status = 'rejected',
                approval_notes = $4, clinic_id = NULL
          WHERE id = $1`,
        [
          uid,
          `demo-borrada-${uid}@invalid.local`,
          bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10),
          'Cuenta de demostración retirada. No se borra porque conserva una aceptación legal, que es un registro inmutable.',
        ],
      );
    }
    borrados['users (neutralizados por registro legal)'] = conLegal.length;
  }

  const aBorrar = usuarios.filter((u) => !conLegal.includes(u));
  await borrar('users', 'id', aBorrar);
  await borrar('clinics', 'id', clinicId);

  return { clinicId, borrados };
}

// ── Entrada ────────────────────────────────────────────────────────────────
(async () => {
  const purga = process.argv.includes('--purge');
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');

    if (purga) {
      const res = await purgar(cli);
      await cli.query('COMMIT');
      if (!res) {
        console.log(`\n  No existe ninguna clínica llamada "${NOMBRE_CLINICA}". Nada que borrar.\n`);
      } else {
        console.log(`\n✔ Cuenta demo borrada (clínica id=${res.clinicId}).`);
        for (const [k, v] of Object.entries(res.borrados)) console.log(`    ${String(v).padStart(5)}  ${k}`);
        console.log('');
      }
      return;
    }

    const r = await sembrar(cli);
    await cli.query('COMMIT');

    console.log(`
✔ Cuenta de demostración creada · clínica id=${r.clinicId}

  ${NOMBRE_CLINICA}
  Tegucigalpa · Podología · lempiras · WhatsApp apagado · fuera del mapa público

  ${r.nPacientes} pacientes · ${r.nCitas} citas · ${r.nConsultas} consultas podológicas
  L. ${r.ingresos.toLocaleString('es-HN')} cobrados en el histórico

  Entrar en /login.html con:
    ${CUENTAS.doctora.email}   → ${CUENTAS.doctora.name} · podóloga (ESTA es la que se enseña)
    ${CUENTAS.admin.email}      → ${CUENTAS.admin.name} · administradora
    ${CUENTAS.recepcion.email}  → ${CUENTAS.recepcion.name} · recepción

  Contraseña (las tres):  ${r.clave}
  Se imprime UNA sola vez. Guárdala ahora.

  Nota: la primera vez que se guarde algo saldrá el modal de Términos y
  Privacidad. Es un clic y no vuelve a salir; a propósito no se siembra la
  aceptación (ver la cabecera de este archivo).

  Para deshacerlo entero:  node tools/seed-demo-podologia.js --purge
`);
  } catch (err) {
    await cli.query('ROLLBACK').catch(() => {});
    console.error(`\n✖ ${purga ? 'La purga' : 'La siembra'} falló: ${err.message}\n`);
    process.exitCode = 1;
  } finally {
    cli.release();
    await pool.end().catch(() => {});
  }
})();
