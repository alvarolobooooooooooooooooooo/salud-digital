#!/usr/bin/env node
/**
 * ── Cuenta de DEMOSTRACIÓN de medicina general ──
 *
 * Hermana de tools/seed-demo-podologia.js: crea un consultorio de medicina
 * general completo y creíble para enseñar el producto sin abrir el expediente de
 * nadie real. Mismo esqueleto, contenido clínico distinto — el de una consulta
 * de primer nivel hondureña: respiratorias, hipertensión, diabetes, gastro,
 * lumbalgia, dengue.
 *
 *     node tools/seed-demo-general.js            # sembrar
 *     node tools/seed-demo-general.js --purge    # borrarlo todo
 *
 * Reglas que se cumplen sí o sí:
 *
 *   · SOLO ESCRIBE DENTRO DE SU PROPIA CLÍNICA. El `--purge` se ata al id de la
 *     clínica cuyo nombre es exactamente NOMBRE_CLINICA, así que no puede tocar
 *     una clínica real ni por accidente.
 *   · Identidades con prefijo 9999 y teléfonos 9999-XXXX: no pueden chocar con
 *     una identidad hondureña real ni acabar mandándole un WhatsApp de prueba a
 *     un desconocido. La clínica nace con WhatsApp apagado y fuera del mapa.
 *   · La contraseña NO está en el código: sale de DEMO_PASSWORD o se genera al
 *     azar y se imprime UNA vez.
 *   · Todo va en UNA transacción: o queda el consultorio entero, o no queda nada.
 *
 * ── LO QUE MEDICINA GENERAL GUARDA DE VERDAD ──
 *
 * Importante para entender por qué este sembrador escribe lo que escribe:
 * `POST /api/consultations` NO acepta el objeto `structured` que manda
 * consultation-general.html (no está en el destructuring de routes/consultations.js),
 * así que de una consulta de medicina general la base solo conserva
 * `notes`, `diagnosis`, `treatment`, `observations`, `visit_reason`, `cost`,
 * `payment_status` y `payment_notes`. Los signos vitales, la exploración, los
 * medicamentos y las pruebas sobreviven ÚNICAMENTE como texto dentro de `notes`
 * y `treatment`, con el formato exacto que arma la propia página
 * (`[Signos vitales] PA … · FC …`, `Medicamentos:\n - …`).
 *
 * Este script reproduce ese formato letra por letra en vez de inventarse un
 * esquema propio: la demo tiene que enseñar lo que el producto hace hoy, no una
 * versión mejorada que luego no existe.
 *
 * Datos deterministas: semilla fija, así que purgar y volver a sembrar reproduce
 * exactamente el mismo consultorio.
 */

process.env.TZ = process.env.TZ || 'America/Tegucigalpa';
require('dotenv').config();

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

// ── Identidad de la cuenta ─────────────────────────────────────────────────
// El sufijo "(Demo)" es deliberado: en la consola de administración y en los
// reportes por clínica tiene que verse de un vistazo que esta no paga.
const NOMBRE_CLINICA = 'Centro Médico La Concordia (Demo)';

const CUENTAS = {
  admin:     { email: 'demo.medico.admin@portalsaluddigital.com',     role: 'clinic_admin', name: 'Rosa María Andino' },
  doctor:    { email: 'demo.medico@portalsaluddigital.com',           role: 'doctor',       name: 'Dr. Ernesto Padilla' },
  recepcion: { email: 'demo.medico.recepcion@portalsaluddigital.com', role: 'receptionist', name: 'Jazmín Rivera' },
};

// users.specialty se compara con === en media app (ver lib/especialidades.js).
// Tiene que ser esta cadena, con tilde y mayúsculas, o la doctora rebota de su
// propia página de consulta a la agenda sin explicación.
const ESPECIALIDAD = 'Medicina General';

// ── Azar reproducible ──────────────────────────────────────────────────────
let _semilla = 0x3ed1c0de;
function rnd() {
  _semilla |= 0; _semilla = (_semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(_semilla ^ (_semilla >>> 15), 1 | _semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ent = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const uno = (arr) => arr[Math.floor(rnd() * arr.length)];
const dado = (p) => rnd() < p;
const dec = (a, b, d = 1) => (a + rnd() * (b - a)).toFixed(d);

// ── Nombres ────────────────────────────────────────────────────────────────
const NOMBRES_F = ['María José', 'Ana Lucía', 'Gabriela', 'Sandra', 'Karla', 'Wendy', 'Iris', 'Doris',
  'Marlen', 'Suyapa', 'Fernanda', 'Rosa Elena', 'Claudia', 'Jessica', 'Nohemí', 'Alejandra', 'Mirna',
  'Yolanda', 'Kenia', 'Dilcia', 'Ada Luz', 'Belkis', 'Sofía', 'Xiomara', 'Reina', 'Lourdes', 'Elsa',
  'Norma', 'Julissa', 'Astrid', 'Heydi', 'Lesly', 'Glenda', 'Vilma', 'Emma', 'Paola'];
const NOMBRES_M = ['José Luis', 'Carlos', 'Óscar', 'Marvin', 'Denis', 'Elmer', 'Rigoberto', 'Wilmer',
  'Fredy', 'Josué', 'Edwin', 'Nelson', 'Rolando', 'Héctor', 'Julio César', 'Mauricio', 'Allan',
  'Bayron', 'Erick', 'Santos', 'Ramón', 'Iván', 'Gustavo', 'Roberto', 'Jorge Alberto', 'Wilfredo'];
const APELLIDOS = ['Discua', 'Zelaya', 'Mejía', 'Cárcamo', 'Bustillo', 'Rivera', 'Padilla', 'Bonilla',
  'Andino', 'Ferrera', 'Interiano', 'Lagos', 'Munguía', 'Ochoa', 'Pineda', 'Sabillón', 'Turcios',
  'Valladares', 'Amaya', 'Baquedano', 'Chirinos', 'Erazo', 'Fajardo', 'Guifarro', 'Handal', 'Izaguirre',
  'Maldonado', 'Nájera', 'Osorio', 'Portillo', 'Quezada', 'Reyes', 'Suazo', 'Tábora', 'Umanzor',
  'Velásquez', 'Zúniga', 'Alvarenga', 'Banegas', 'Colindres', 'Milla', 'Rápalo', 'Vásquez'];

// ── Catálogo clínico ───────────────────────────────────────────────────────
//
// Cada caso lleva TODO lo que la ficha de medicina general pide, para que el
// texto guardado tenga la misma densidad que el de una consulta de verdad:
// queja, duración, inicio, intensidad, factores, síntomas asociados, historia,
// signos vitales coherentes con el cuadro, exploración, diagnóstico con
// diferencial y CIE-10, medicamentos, pruebas, indicaciones, seguimiento y
// signos de alarma.
//
// `vitales` es una función porque las cifras tienen que ir con el cuadro: un
// hipertenso descontrolado no puede salir con 118/74, ni un asmático con
// SpO₂ de 99%.
const CASOS = [
  {
    id: 'ira', tipo: 'urgencia', costo: 600, edad: [16, 70],
    queja: 'Dolor de garganta y fiebre desde hace tres días',
    duracion: '3 días, continuo', inicio: 'subito', intensidad: 6,
    factores: ['Frío'],
    sintomas: [['Fiebre', 'hasta 38.6 °C, cede con acetaminofén'], ['Odinofagia', 'dificultad para tragar'], ['Malestar general', '']],
    historia: 'Un compañero de trabajo con el mismo cuadro la semana pasada. Sin viajes recientes.',
    vitales: () => ({ bp: `${ent(108, 124)}/${ent(68, 80)}`, hr: ent(88, 104), temp: dec(37.8, 38.8), rr: ent(16, 20), spo2: ent(96, 99) }),
    exploracion: 'Faringe hiperémica con exudado amigdalino bilateral. Adenopatías cervicales anteriores dolorosas. Sin dificultad respiratoria. Ruidos cardíacos rítmicos.',
    dx: 'Faringoamigdalitis aguda, probablemente estreptocócica (Centor 3/4)',
    ddx: 'Faringitis viral · mononucleosis infecciosa',
    cie: 'J02.9',
    medicamentos: [
      ['Amoxicilina', '500 mg', 'c/8 h por 7 días'],
      ['Acetaminofén', '500 mg', 'c/6 h si fiebre o dolor'],
    ],
    pruebas: ['Hisopado faríngeo'],
    indicaciones: 'Reposo relativo 48 h, hidratación abundante, gárgaras con agua tibia y sal. Dieta blanda mientras dure la odinofagia.',
    seguimiento: 'Control en 72 h si no hay mejoría; completar el antibiótico aunque desaparezca la fiebre.',
    alarma: 'Dificultad para respirar o tragar saliva, babeo, fiebre que no cede a las 48 h de antibiótico, salpullido.',
    observaciones: 'Se explica la importancia de completar el esquema completo para prevenir complicaciones.',
  },
  {
    id: 'hta', tipo: 'control', costo: 400, edad: [45, 82], cronico: 'hta',
    queja: 'Viene a control de presión arterial',
    duracion: 'Diagnóstico hace 6 años', inicio: 'gradual', intensidad: 0,
    factores: ['Estrés', 'Alimentos'],
    sintomas: [['Cefalea occipital', 'ocasional, matutina']],
    historia: 'Toma su medicamento a diario pero reconoce que sala mucho la comida. Padre y hermana hipertensos.',
    vitales: () => ({ bp: `${ent(138, 156)}/${ent(86, 98)}`, hr: ent(72, 86), temp: dec(36.3, 36.9), rr: ent(14, 18), spo2: ent(96, 99) }),
    exploracion: 'Buen estado general. Ruidos cardíacos rítmicos, sin soplos. Sin edema en miembros inferiores. Pulsos periféricos presentes y simétricos.',
    dx: 'Hipertensión arterial esencial, control subóptimo',
    ddx: 'Hipertensión de bata blanca',
    cie: 'I10',
    medicamentos: [
      ['Losartán', '50 mg', 'c/12 h'],
      ['Hidroclorotiazida', '25 mg', 'c/día por la mañana'],
    ],
    pruebas: ['Química sanguínea', 'Examen general de orina', 'Perfil lipídico', 'Electrocardiograma'],
    indicaciones: 'Dieta baja en sodio (menos de 5 g de sal al día), caminata de 30 minutos cinco días por semana, control de peso. Registro de presión en casa dos veces por semana.',
    seguimiento: 'Control en 4 semanas con la libreta de presiones y los resultados de laboratorio.',
    alarma: 'Presión mayor de 180/110, dolor de pecho, visión borrosa, dificultad para hablar o debilidad de un lado del cuerpo.',
    observaciones: 'Se ajusta la dosis por cifras persistentemente sobre la meta. Se refuerza la adherencia.',
  },
  {
    id: 'dm2', tipo: 'control', costo: 400, edad: [42, 80], cronico: 'dm2',
    queja: 'Control de diabetes, trae resultados de laboratorio',
    duracion: 'Diagnóstico hace 9 años', inicio: 'gradual', intensidad: 0,
    factores: ['Alimentos'],
    sintomas: [['Poliuria', 'nocturna, 2 veces'], ['Parestesias en pies', 'ardor nocturno']],
    historia: 'Cumple el tratamiento. Dieta irregular por horario de trabajo. Madre diabética.',
    vitales: () => ({ bp: `${ent(126, 142)}/${ent(78, 90)}`, hr: ent(74, 88), temp: dec(36.2, 36.8), rr: ent(14, 18), spo2: ent(96, 99) }),
    exploracion: 'Piel de miembros inferiores seca, sin lesiones. Pulsos pedios presentes. Sensibilidad al monofilamento conservada en 9 de 10 puntos. Fondo de ojo no valorado en consulta.',
    dx: 'Diabetes mellitus tipo 2 con control metabólico inadecuado (HbA1c 8.1%)',
    ddx: 'Neuropatía diabética incipiente',
    cie: 'E11.9',
    medicamentos: [
      ['Metformina', '850 mg', 'c/12 h con las comidas'],
      ['Glimepirida', '2 mg', 'c/día antes del desayuno'],
    ],
    pruebas: ['Química sanguínea', 'Glicemia en ayunas', 'Perfil lipídico', 'Examen general de orina'],
    indicaciones: 'Plan alimentario con conteo de carbohidratos, actividad física 150 minutos por semana repartidos en cinco días. Revisión diaria de los pies e hidratación de la piel. Automonitoreo de glicemia en ayunas tres veces por semana.',
    seguimiento: 'Control en 3 meses con HbA1c. Referencia a nutrición y valoración oftalmológica anual.',
    alarma: 'Glicemia mayor de 300 mg/dL, vómito persistente, herida en el pie que no cierra, visión borrosa de aparición súbita.',
    observaciones: 'Se refuerza educación sobre el cuidado del pie diabético y se entrega hoja de autocuidado.',
    referencia: 'Nutrición · Oftalmología (fondo de ojo anual)',
  },
  {
    id: 'eda', tipo: 'urgencia', costo: 600, edad: [16, 65],
    queja: 'Diarrea y dolor abdominal desde ayer',
    duracion: '36 horas', inicio: 'subito', intensidad: 7,
    factores: ['Alimentos'],
    sintomas: [['Diarrea', '6 evacuaciones líquidas sin sangre'], ['Náusea', ''], ['Fiebre', '37.9 °C']],
    historia: 'Comió en la calle hace dos días. Nadie más en casa con síntomas.',
    vitales: () => ({ bp: `${ent(100, 116)}/${ent(62, 74)}`, hr: ent(92, 108), temp: dec(37.4, 38.3), rr: ent(16, 20), spo2: ent(96, 99) }),
    exploracion: 'Mucosas algo secas, llenado capilar menor de 2 segundos. Abdomen blando, doloroso difusamente a la palpación profunda, ruidos hidroaéreos aumentados. Sin signos de irritación peritoneal.',
    dx: 'Gastroenteritis aguda con deshidratación leve',
    ddx: 'Intoxicación alimentaria · parasitosis intestinal',
    cie: 'A09',
    medicamentos: [
      ['Suero oral', '1 sobre en 1 L', 'a libre demanda tras cada evacuación'],
      ['Loperamida', '2 mg', 'después de cada evacuación líquida, máx. 8 mg/día'],
      ['Butilhioscina', '10 mg', 'c/8 h si cólico'],
    ],
    pruebas: ['Hemograma completo', 'Examen general de orina'],
    indicaciones: 'Hidratación oral abundante, dieta astringente (arroz, manzana, pan tostado) por 48 h. Lavado de manos y evitar comida de la calle.',
    seguimiento: 'Regresar en 48 h si persiste la diarrea.',
    alarma: 'Sangre en las heces, fiebre mayor de 39 °C, vómito que impide tomar líquidos, orina muy escasa o mareo al ponerse de pie.',
    observaciones: 'Tolera la vía oral en consulta; no requiere hidratación intravenosa.',
  },
  {
    id: 'ivu', tipo: 'nuevo_paciente', costo: 600, edad: [18, 68], soloMujer: true,
    queja: 'Ardor al orinar y ganas frecuentes de ir al baño',
    duracion: '4 días', inicio: 'gradual', intensidad: 6,
    factores: [],
    sintomas: [['Disuria', ''], ['Polaquiuria', ''], ['Dolor suprapúbico', 'leve']],
    historia: 'Segundo episodio este año. Sin fiebre ni dolor lumbar.',
    vitales: () => ({ bp: `${ent(106, 122)}/${ent(66, 78)}`, hr: ent(74, 88), temp: dec(36.4, 37.3), rr: ent(14, 18), spo2: ent(97, 99) }),
    exploracion: 'Abdomen blando, dolor leve a la palpación suprapúbica. Puñopercusión lumbar negativa bilateral. Sin fiebre en consulta.',
    dx: 'Infección de vías urinarias baja no complicada',
    ddx: 'Cistitis intersticial · vaginitis',
    cie: 'N39.0',
    medicamentos: [
      ['Nitrofurantoína', '100 mg', 'c/12 h por 5 días'],
      ['Fenazopiridina', '100 mg', 'c/8 h por 2 días'],
    ],
    pruebas: ['Examen general de orina'],
    indicaciones: 'Tomar al menos dos litros de agua al día, no retener la orina, higiene de adelante hacia atrás y orinar después de las relaciones.',
    seguimiento: 'Control con examen de orina al terminar el tratamiento.',
    alarma: 'Fiebre con escalofríos, dolor en la espalda baja, vómito o sangre en la orina.',
    observaciones: 'Se advierte que la fenazopiridina tiñe la orina de color naranja.',
  },
  {
    id: 'lumbalgia', tipo: 'nuevo_paciente', costo: 600, edad: [25, 70],
    queja: 'Dolor en la espalda baja después de cargar peso',
    duracion: '5 días', inicio: 'subito', intensidad: 7,
    factores: ['Esfuerzo físico', 'Movimiento', 'Posición'],
    sintomas: [['Dolor lumbar', 'aumenta al inclinarse'], ['Contractura muscular', 'paravertebral derecha']],
    historia: 'Trabajo con carga física. Sin irradiación a la pierna, sin pérdida de fuerza ni alteraciones para orinar.',
    vitales: () => ({ bp: `${ent(114, 132)}/${ent(72, 84)}`, hr: ent(70, 86), temp: dec(36.2, 36.8), rr: ent(14, 18), spo2: ent(97, 99) }),
    exploracion: 'Contractura de la musculatura paravertebral lumbar derecha. Lasègue negativo bilateral. Fuerza y reflejos conservados en miembros inferiores. Marcha normal.',
    dx: 'Lumbalgia mecánica aguda sin datos de radiculopatía',
    ddx: 'Hernia discal lumbar',
    cie: 'M54.5',
    medicamentos: [
      ['Ibuprofeno', '400 mg', 'c/8 h por 5 días con alimentos'],
      ['Metocarbamol', '750 mg', 'c/8 h por 5 días'],
    ],
    pruebas: [],
    indicaciones: 'Evitar reposo absoluto: mantener actividad ligera dentro del dolor tolerable. Calor local 15 minutos dos veces al día. Técnica correcta de levantamiento de carga.',
    seguimiento: 'Control en 2 semanas; si persiste, valorar fisioterapia e imagen.',
    alarma: 'Dolor que baja por la pierna hasta el pie, debilidad, pérdida del control de esfínteres o fiebre.',
    observaciones: 'No se solicitan radiografías: cuadro mecánico sin banderas rojas.',
  },
  {
    id: 'cefalea', tipo: 'nuevo_paciente', costo: 600, edad: [18, 60],
    queja: 'Dolor de cabeza casi diario desde hace tres semanas',
    duracion: '3 semanas, casi diario', inicio: 'gradual', intensidad: 5,
    factores: ['Estrés', 'Sueño'],
    sintomas: [['Cefalea opresiva', 'en banda, bilateral'], ['Tensión cervical', ''], ['Insomnio de conciliación', '']],
    historia: 'Carga laboral alta y sueño de cinco horas. Sin aura, sin náusea, sin fotofobia. Toma analgésicos casi a diario.',
    vitales: () => ({ bp: `${ent(112, 128)}/${ent(70, 82)}`, hr: ent(68, 84), temp: dec(36.2, 36.8), rr: ent(14, 18), spo2: ent(97, 99) }),
    exploracion: 'Consciente y orientada. Sin focalización neurológica. Pares craneales sin alteraciones. Puntos dolorosos en trapecios y musculatura suboccipital.',
    dx: 'Cefalea tensional episódica frecuente, con sospecha de cefalea por abuso de analgésicos',
    ddx: 'Migraña sin aura · cefalea cervicogénica',
    cie: 'G44.2',
    medicamentos: [
      ['Naproxeno', '550 mg', 'c/12 h por 5 días, no más de 2 días por semana después'],
      ['Amitriptilina', '10 mg', 'c/día por la noche'],
    ],
    pruebas: [],
    indicaciones: 'Higiene del sueño: horario fijo, sin pantallas la última hora. Pausas activas cada dos horas de trabajo. Diario de cefalea. Limitar los analgésicos a dos días por semana.',
    seguimiento: 'Control en 6 semanas con el diario de cefalea.',
    alarma: 'Dolor de instalación súbita e intensísimo, fiebre con rigidez de nuca, alteración del habla o de la fuerza, o dolor que despierta de noche.',
    observaciones: 'Se explica que el uso diario de analgésicos puede estar perpetuando el dolor.',
  },
  {
    id: 'dengue', tipo: 'urgencia', costo: 800, edad: [14, 65],
    queja: 'Fiebre alta, dolor de cuerpo y dolor detrás de los ojos',
    duracion: '4 días', inicio: 'subito', intensidad: 8,
    factores: [],
    sintomas: [['Fiebre', 'hasta 39.2 °C'], ['Mialgias y artralgias', 'intensas'], ['Dolor retroocular', ''], ['Exantema', 'macular en tronco']],
    historia: 'Vecinos del barrio con casos confirmados. Criaderos de zancudo cerca de la vivienda.',
    vitales: () => ({ bp: `${ent(100, 114)}/${ent(60, 72)}`, hr: ent(94, 110), temp: dec(38.4, 39.3), rr: ent(18, 22), spo2: ent(95, 98) }),
    exploracion: 'Exantema macular en tronco, prueba del torniquete negativa. Abdomen blando, sin dolor en hipocondrio derecho. Sin sangrado de mucosas. Llenado capilar menor de 2 segundos.',
    dx: 'Dengue sin signos de alarma, cuarto día de fiebre',
    ddx: 'Chikungunya · zika · leptospirosis',
    cie: 'A90',
    medicamentos: [
      ['Acetaminofén', '500 mg', 'c/6 h si fiebre o dolor'],
      ['Suero oral', '1 sobre en 1 L', 'a libre demanda'],
    ],
    pruebas: ['Hemograma completo'],
    indicaciones: 'PROHIBIDOS los antiinflamatorios (ibuprofeno, naproxeno, aspirina) por riesgo de sangrado. Hidratación abundante, reposo, medios físicos para la fiebre. Uso de mosquitero y eliminación de criaderos en casa.',
    seguimiento: 'Hemograma diario y control en 24 h. La fase crítica es cuando baja la fiebre: hay que vigilarla de cerca.',
    alarma: 'Dolor abdominal intenso y continuo, vómito persistente, sangrado de encías o nariz, somnolencia o irritabilidad, manos y pies fríos.',
    observaciones: 'Se notifica el caso conforme a la vigilancia epidemiológica. Se entrega hoja de signos de alarma.',
  },
  {
    id: 'asma', tipo: 'urgencia', costo: 900, edad: [12, 55],
    queja: 'Dificultad para respirar y silbido en el pecho desde anoche',
    duracion: '12 horas', inicio: 'progresivo', intensidad: 7,
    factores: ['Frío', 'Esfuerzo físico'],
    sintomas: [['Disnea', 'al hablar frases largas'], ['Sibilancias', ''], ['Tos seca', 'nocturna']],
    historia: 'Asmática desde la infancia. Dejó el inhalador de control hace dos meses. Cambio de clima esta semana.',
    vitales: () => ({ bp: `${ent(116, 130)}/${ent(72, 84)}`, hr: ent(96, 112), temp: dec(36.3, 37.0), rr: ent(22, 28), spo2: ent(91, 94) }),
    exploracion: 'Sibilancias espiratorias diseminadas en ambos campos pulmonares. Uso leve de musculatura accesoria. Habla en frases. Sin cianosis. Mejora tras nebulización: sibilancias escasas, SpO₂ 97%.',
    dx: 'Crisis asmática leve-moderada, con buena respuesta al broncodilatador',
    ddx: 'Bronquitis aguda · EPOC',
    cie: 'J45.9',
    medicamentos: [
      ['Salbutamol', '2 puff', 'c/4-6 h con aerocámara por 48 h'],
      ['Prednisona', '40 mg', 'c/día por 5 días'],
      ['Budesonida/formoterol', '160/4.5 mcg', 'c/12 h como tratamiento de control'],
    ],
    pruebas: [],
    indicaciones: 'Se realizan tres nebulizaciones con salbutamol en consulta, con mejoría clínica y saturación. Retomar el inhalador de control a diario, no solo en crisis. Evitar humo, polvo y cambios bruscos de temperatura. Uso de aerocámara.',
    seguimiento: 'Control en 5 días. Plan de acción escrito para crisis.',
    alarma: 'Dificultad para hablar o caminar, labios morados, que el inhalador de rescate no alivie, o somnolencia.',
    observaciones: 'Se enseña la técnica de inhalación con aerocámara y se verifica que la ejecute correctamente.',
    procedimiento: true,
  },
  {
    id: 'dislipidemia', tipo: 'seguimiento', costo: 400, edad: [35, 70],
    queja: 'Trae resultados de laboratorio de chequeo',
    duracion: 'Hallazgo de laboratorio', inicio: 'gradual', intensidad: 0,
    factores: ['Alimentos'],
    sintomas: [],
    historia: 'Sin síntomas. Sedentario, come fuera de casa a diario. Padre con infarto a los 58 años.',
    vitales: () => ({ bp: `${ent(120, 136)}/${ent(76, 88)}`, hr: ent(70, 84), temp: dec(36.2, 36.8), rr: ent(14, 18), spo2: ent(97, 99) }),
    exploracion: 'Sobrepeso, perímetro abdominal aumentado. Ruidos cardíacos rítmicos sin soplos. Sin xantomas ni arco corneal.',
    dx: 'Dislipidemia mixta con riesgo cardiovascular intermedio',
    ddx: 'Síndrome metabólico',
    cie: 'E78.5',
    medicamentos: [['Atorvastatina', '20 mg', 'c/día por la noche']],
    pruebas: ['Perfil lipídico', 'Química sanguínea', 'Glicemia en ayunas'],
    indicaciones: 'Dieta mediterránea, reducir frituras y bebidas azucaradas. Actividad aeróbica 150 minutos por semana. Meta de reducción de peso del 7% en seis meses.',
    seguimiento: 'Perfil lipídico y transaminasas en 3 meses.',
    alarma: 'Dolor muscular intenso y generalizado, orina oscura o coloración amarilla de la piel.',
    observaciones: 'Se calcula el riesgo cardiovascular y se comenta con el paciente antes de iniciar la estatina.',
  },
  {
    id: 'gastritis', tipo: 'nuevo_paciente', costo: 600, edad: [20, 65],
    queja: 'Ardor en la boca del estómago que empeora en las noches',
    duracion: '6 semanas, intermitente', inicio: 'gradual', intensidad: 5,
    factores: ['Alimentos', 'Estrés', 'Medicamentos'],
    sintomas: [['Pirosis', 'nocturna'], ['Regurgitación ácida', ''], ['Llenura precoz', '']],
    historia: 'Toma antiinflamatorios con frecuencia por dolor de rodilla. Café en ayunas, cena tarde.',
    vitales: () => ({ bp: `${ent(112, 128)}/${ent(70, 82)}`, hr: ent(68, 84), temp: dec(36.2, 36.8), rr: ent(14, 18), spo2: ent(97, 99) }),
    exploracion: 'Abdomen blando, doloroso a la palpación en epigastrio, sin masas ni visceromegalias. Sin datos de irritación peritoneal.',
    dx: 'Enfermedad por reflujo gastroesofágico con gastropatía por AINEs',
    ddx: 'Úlcera péptica · infección por H. pylori',
    cie: 'K21.0',
    medicamentos: [
      ['Omeprazol', '20 mg', 'c/día en ayunas por 8 semanas'],
      ['Hidróxido de aluminio/magnesio', '10 mL', 'si hay ardor, hasta 3 veces al día'],
    ],
    pruebas: ['Hemograma completo'],
    indicaciones: 'Suspender los antiinflamatorios; se cambia el analgésico. Cenar tres horas antes de acostarse, elevar la cabecera de la cama, evitar café en ayunas, picante, cítricos y alcohol.',
    seguimiento: 'Control en 8 semanas. Si no mejora, prueba de H. pylori y valorar endoscopia.',
    alarma: 'Vómito con sangre, heces negras, dificultad para tragar, pérdida de peso no buscada o anemia.',
    observaciones: 'Se explica la relación entre el uso de AINEs y el cuadro actual.',
  },
  {
    id: 'anemia', tipo: 'seguimiento', costo: 400, edad: [16, 50], soloMujer: true,
    queja: 'Cansancio y palidez, trae hemograma',
    duracion: '2 meses', inicio: 'gradual', intensidad: 4,
    factores: ['Esfuerzo físico'],
    sintomas: [['Fatiga', 'al subir gradas'], ['Palidez', ''], ['Caída de cabello', '']],
    historia: 'Menstruaciones abundantes y prolongadas. Dieta baja en carne roja.',
    vitales: () => ({ bp: `${ent(100, 114)}/${ent(60, 72)}`, hr: ent(86, 100), temp: dec(36.2, 36.8), rr: ent(14, 18), spo2: ent(97, 99) }),
    exploracion: 'Palidez de conjuntivas y lechos ungueales. Ruidos cardíacos rítmicos con soplo sistólico funcional grado I/VI. Sin visceromegalias.',
    dx: 'Anemia ferropénica moderada (Hb 9.4 g/dL) secundaria a pérdidas menstruales',
    ddx: 'Anemia por enfermedad crónica · talasemia menor',
    cie: 'D50.9',
    medicamentos: [
      ['Sulfato ferroso', '325 mg', 'c/día en ayunas con jugo de naranja'],
      ['Ácido fólico', '5 mg', 'c/día'],
    ],
    pruebas: ['Hemograma completo', 'Química sanguínea'],
    indicaciones: 'Tomar el hierro en ayunas, separado del café, té y lácteos al menos dos horas. Aumentar el consumo de carnes rojas, frijoles y hojas verdes. Se advierte que las heces se pondrán oscuras.',
    seguimiento: 'Hemograma de control en 4 semanas; el tratamiento sigue 3 meses después de normalizar la hemoglobina.',
    alarma: 'Desmayo, dolor de pecho, falta de aire en reposo o sangrado menstrual que empape más de una toalla por hora.',
    observaciones: 'Se refiere a ginecología para estudio del sangrado menstrual.',
    referencia: 'Ginecología',
  },
  {
    id: 'chequeo', tipo: 'nuevo_paciente', costo: 600, edad: [30, 65],
    queja: 'Chequeo médico general, sin molestias',
    duracion: 'Sin síntomas', inicio: '', intensidad: 0,
    factores: [],
    sintomas: [],
    historia: 'Último chequeo hace más de tres años. Solicita evaluación por requisito de trabajo.',
    vitales: () => ({ bp: `${ent(110, 126)}/${ent(68, 80)}`, hr: ent(64, 80), temp: dec(36.2, 36.8), rr: ent(14, 18), spo2: ent(97, 99) }),
    exploracion: 'Buen estado general. Cardiopulmonar sin alteraciones. Abdomen blando, no doloroso. Sin adenopatías. Agudeza visual conservada.',
    dx: 'Examen médico general sin hallazgos patológicos',
    ddx: '',
    cie: 'Z00.0',
    medicamentos: [],
    pruebas: ['Hemograma completo', 'Química sanguínea', 'Examen general de orina', 'Perfil lipídico', 'Glicemia en ayunas'],
    indicaciones: 'Actividad física regular, dieta equilibrada, evitar tabaco y limitar el alcohol. Se actualiza el esquema de vacunación.',
    seguimiento: 'Revisión de resultados en 1 semana. Chequeo anual.',
    alarma: 'Pérdida de peso no buscada, fiebre prolongada, sangrados o dolor persistente en cualquier parte.',
    observaciones: 'Se emite constancia médica para el trabajo tras revisar los resultados.',
  },
  {
    id: 'ansiedad', tipo: 'seguimiento', costo: 400, edad: [18, 55],
    queja: 'Nerviosismo constante y dificultad para dormir',
    duracion: '4 meses', inicio: 'gradual', intensidad: 6,
    factores: ['Estrés', 'Sueño'],
    sintomas: [['Insomnio de conciliación', ''], ['Palpitaciones', 'sin relación con el esfuerzo'], ['Tensión muscular', '']],
    historia: 'Situación laboral y familiar estresante. Sin ideación suicida. Consumo alto de café.',
    vitales: () => ({ bp: `${ent(114, 130)}/${ent(72, 84)}`, hr: ent(82, 96), temp: dec(36.2, 36.8), rr: ent(16, 20), spo2: ent(97, 99) }),
    exploracion: 'Consciente, orientado, colaborador. Discurso coherente. Ruidos cardíacos rítmicos, sin soplos. Tiroides no palpable. Sin temblor.',
    dx: 'Trastorno de ansiedad generalizada',
    ddx: 'Hipertiroidismo · trastorno depresivo',
    cie: 'F41.1',
    medicamentos: [['Sertralina', '50 mg', 'c/día por la mañana']],
    pruebas: ['Química sanguínea', 'Hemograma completo'],
    indicaciones: 'Higiene del sueño, ejercicio aeróbico regular, reducir el café a una taza al día. Técnicas de respiración diafragmática. Se explica que el efecto del medicamento tarda de dos a cuatro semanas.',
    seguimiento: 'Control en 4 semanas para ajustar dosis.',
    alarma: 'Ideas de hacerse daño, incapacidad para trabajar o dolor de pecho.',
    observaciones: 'Se descarta causa orgánica antes de iniciar el tratamiento. Se ofrece referencia a psicología.',
    referencia: 'Psicología',
  },
  {
    id: 'hipotiroidismo', tipo: 'control', costo: 400, edad: [28, 70], soloMujer: true,
    queja: 'Control de tiroides, trae TSH',
    duracion: 'Diagnóstico hace 3 años', inicio: 'gradual', intensidad: 0,
    factores: [],
    sintomas: [['Fatiga', 'matutina'], ['Intolerancia al frío', ''], ['Estreñimiento', '']],
    historia: 'Toma levotiroxina a diario pero a veces con el desayuno. Madre con hipotiroidismo.',
    vitales: () => ({ bp: `${ent(108, 124)}/${ent(68, 80)}`, hr: ent(58, 72), temp: dec(36.0, 36.6), rr: ent(14, 18), spo2: ent(97, 99) }),
    exploracion: 'Piel seca. Tiroides de tamaño normal, sin nódulos palpables. Reflejos osteotendinosos con fase de relajación normal. Sin edema.',
    dx: 'Hipotiroidismo primario con TSH sobre la meta (6.8 mUI/L)',
    ddx: 'Mala absorción del fármaco por toma incorrecta',
    cie: 'E03.9',
    medicamentos: [['Levotiroxina', '100 mcg', 'c/día en ayunas, 30-60 min antes del desayuno']],
    pruebas: ['Química sanguínea'],
    indicaciones: 'Tomar la levotiroxina en ayunas, separada del calcio, hierro y café al menos cuatro horas. No cambiar de marca sin avisar.',
    seguimiento: 'TSH de control en 8 semanas.',
    alarma: 'Palpitaciones, temblor, pérdida de peso rápida o insomnio marcado (podría ser exceso de dosis).',
    observaciones: 'La TSH elevada se explica probablemente por la toma junto al desayuno; se corrige la indicación antes de subir la dosis.',
  },
  {
    id: 'sinusitis', tipo: 'seguimiento', costo: 400, edad: [16, 65],
    queja: 'Congestión nasal y dolor en la cara que no cede tras diez días',
    duracion: '11 días', inicio: 'progresivo', intensidad: 6,
    factores: ['Frío'],
    sintomas: [['Rinorrea purulenta', ''], ['Dolor facial', 'maxilar bilateral, aumenta al inclinarse'], ['Cefalea frontal', ''], ['Hiposmia', '']],
    historia: 'Empezó como resfriado, mejoró al quinto día y volvió a empeorar. Antecedente de rinitis alérgica.',
    vitales: () => ({ bp: `${ent(112, 128)}/${ent(70, 82)}`, hr: ent(76, 90), temp: dec(37.2, 38.1), rr: ent(14, 18), spo2: ent(96, 99) }),
    exploracion: 'Mucosa nasal congestiva con secreción purulenta en meato medio. Dolor a la palpación de senos maxilares. Orofaringe con descarga posterior. Otoscopia normal.',
    dx: 'Rinosinusitis aguda bacteriana (empeoramiento tras mejoría inicial)',
    ddx: 'Rinosinusitis viral prolongada · rinitis alérgica sobreinfectada',
    cie: 'J01.9',
    medicamentos: [
      ['Amoxicilina/ácido clavulánico', '875/125 mg', 'c/12 h por 10 días'],
      ['Solución salina nasal', '2 aplicaciones', 'c/6 h'],
      ['Loratadina', '10 mg', 'c/día'],
    ],
    pruebas: [],
    indicaciones: 'Lavados nasales con solución salina antes del aerosol, hidratación abundante, vapor de agua. No usar descongestivos nasales más de tres días.',
    seguimiento: 'Control en 7 días si no hay mejoría clara.',
    alarma: 'Hinchazón o enrojecimiento alrededor del ojo, visión doble, dolor de cabeza intenso con vómito, o rigidez de nuca.',
    observaciones: 'Se indica antibiótico por el patrón de doble empeoramiento y la duración mayor de diez días.',
  },
];

// ── Fechas ─────────────────────────────────────────────────────────────────
const dosD = (n) => String(n).padStart(2, '0');
const aFecha = (d) => `${d.getFullYear()}-${dosD(d.getMonth() + 1)}-${dosD(d.getDate())}`;
const aFechaHora = (d) => `${aFecha(d)}T${dosD(d.getHours())}:${dosD(d.getMinutes())}:00`;
const masDias = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
const conHora = (d, h, m) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x; };

const HOY = conHora(new Date(), 0, 0);

// Horario: L-V 07:30-17:00 y sábado 08:00-12:00, en tramos de 20'. Medicina
// general mueve mucho más volumen por hora que una consulta podológica.
const esLaborable = (d) => d.getDay() >= 1 && d.getDay() <= 6;
function tramosDe(d) {
  const sabado = d.getDay() === 6;
  const inicio = sabado ? 8 * 60 : 7 * 60 + 30;
  const fin = sabado ? 12 * 60 : 17 * 60;
  const out = [];
  for (let m = inicio; m + 20 <= fin; m += 20) {
    if (!sabado && m >= 12 * 60 && m < 13 * 60) continue; // almuerzo
    out.push(m);
  }
  return out;
}

// ── Utilidades ─────────────────────────────────────────────────────────────
const identidad = (anio, n) => `9999-${anio}-${String(n).padStart(5, '0')}`;
const telefono = (n) => `9999-${String(1000 + (n * 53) % 9000)}`;

/**
 * Arma el bloque `notes` EXACTAMENTE como lo arma consultation-general.html
 * (buildConsultationPayload): secciones entre corchetes separadas por línea en
 * blanco. Si se toca el formato allí, hay que tocarlo aquí.
 */
function construirNotas({ vitales, caso, observaciones }) {
  const linea = [
    `PA ${vitales.bp} mmHg`,
    `FC ${vitales.hr} lpm`,
    `T° ${vitales.temp} °C`,
    `FR ${vitales.rr} rpm`,
    `SpO₂ ${vitales.spo2}%`,
    `P/T ${vitales.wh}`,
  ].join(' · ');

  return [
    `[Signos vitales] ${linea}`,
    `[Queja principal] ${caso.queja}`,
    caso.duracion ? `[Duración] ${caso.duracion}` : '',
    caso.inicio ? `[Inicio] ${caso.inicio}` : '',
    caso.intensidad ? `[Intensidad] ${caso.intensidad}/10` : '',
    caso.factores.length ? `[Factores] ${caso.factores.join(', ')}` : '',
    caso.sintomas.length
      ? `[Síntomas asociados] ${caso.sintomas.map(([n, d]) => n + (d ? ` (${d})` : '')).join('; ')}`
      : '',
    caso.historia ? `[Historia] ${caso.historia}` : '',
    observaciones ? `[Observaciones] ${observaciones}` : '',
  ].filter(Boolean).join('\n\n');
}

/** Igual: el bloque `treatment` con el formato de la página. */
function construirTratamiento(caso) {
  return [
    caso.medicamentos.length
      ? `Medicamentos:\n${caso.medicamentos.map(([n, dosis, pauta]) => ` - ${n} ${dosis ? '— ' + dosis : ''} ${pauta ? '· ' + pauta : ''}`).join('\n')}`
      : '',
    caso.indicaciones ? `Indicaciones: ${caso.indicaciones}` : '',
    caso.pruebas.length ? `Pruebas solicitadas: ${caso.pruebas.join(', ')}` : '',
    caso.seguimiento ? `Seguimiento: ${caso.seguimiento}` : '',
    caso.referencia ? `Referencia: ${caso.referencia}` : '',
    caso.alarma ? `Signos de alarma: ${caso.alarma}` : '',
  ].filter(Boolean).join('\n\n');
}

/** `diagnosis`: principal · DDx · CIE-10, como los une la página. */
function construirDiagnostico(caso) {
  return [caso.dx, caso.ddx && `DDx: ${caso.ddx}`, caso.cie && `CIE-10: ${caso.cie}`]
    .filter(Boolean).join(' · ');
}

// Cuadros que se resuelven. En su visita de CONTROL el paciente ya viene
// mejorando, así que arrastrar los signos vitales del día agudo —un control de
// dengue con 39.2 °C de fiebre— delata que los datos están inventados.
const AGUDOS = ['ira', 'eda', 'ivu', 'dengue', 'asma', 'sinusitis', 'lumbalgia'];

/** Los signos vitales de una visita de control de un cuadro agudo: ya normales. */
function vitalesEnMejoria() {
  return {
    bp: `${ent(108, 126)}/${ent(66, 80)}`,
    hr: ent(66, 84),
    temp: dec(36.2, 36.9),
    rr: ent(14, 18),
    spo2: ent(96, 99),
  };
}

// ── Siembra ────────────────────────────────────────────────────────────────
async function sembrar(cli) {
  const ya = await cli.query('SELECT id FROM clinics WHERE name = $1', [NOMBRE_CLINICA]);
  if (ya.rows.length) {
    throw new Error(
      `la clínica "${NOMBRE_CLINICA}" ya existe (id=${ya.rows[0].id}).\n` +
      '  Para rehacerla:  node tools/seed-demo-general.js --purge && node tools/seed-demo-general.js',
    );
  }

  const clave = process.env.DEMO_PASSWORD || crypto.randomBytes(9).toString('base64url');
  const hash = bcrypt.hashSync(clave, 10);

  // ── Clínica ──
  const rc = await cli.query(
    `INSERT INTO clinics
       (name, address, city, country, phone, email, specialties, chairs, currency, brand_color, type, info,
        whatsapp_enabled, landing_published, show_on_public_map)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, FALSE, FALSE, FALSE)
     RETURNING id`,
    [
      NOMBRE_CLINICA,
      'Barrio La Concordia, 5.ª avenida entre 8.ª y 9.ª calle',
      'Tegucigalpa',
      'HN',
      '2237-6640',
      'contacto@laconcordia.demo',
      ESPECIALIDAD,
      2,
      'HNL',
      '#0891b2',
      'Consultorio',
      'CUENTA DE DEMOSTRACIÓN. Pacientes, citas y consultas ficticios (identidades con prefijo 9999). ' +
      'Se crea y se borra con tools/seed-demo-general.js. No cuenta para los reportes del negocio.',
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

  const adminId = await nuevoUsuario(CUENTAS.admin, { phone: '9999-4001', shift: 'Matutino' });
  const doctorId = await nuevoUsuario(CUENTAS.doctor, {
    specialty: ESPECIALIDAD,
    phone: '9999-4002',
    license: 'CMH-14820',
    experience: 14,
    shift: 'Completo',
    bio: 'Médico general con catorce años de ejercicio en atención primaria. Consulta de adultos, control de enfermedad crónica (hipertensión y diabetes), atención de cuadros agudos y chequeos preventivos.',
    focus: ['Enfermedad crónica', 'Atención de agudos', 'Medicina preventiva'],
  });
  const recepcionId = await nuevoUsuario(CUENTAS.recepcion, { phone: '9999-4003', shift: 'Completo' });

  // ── Salas ──
  const salas = [];
  for (const nombre of ['Consultorio 1', 'Consultorio 2 · Procedimientos']) {
    const r = await cli.query(
      'INSERT INTO clinic_rooms (clinic_id, name, status) VALUES ($1,$2,$3) RETURNING id',
      [clinicId, nombre, 'free'],
    );
    salas.push(r.rows[0].id);
  }

  // ── Horario del doctor ──
  for (const dow of [1, 2, 3, 4, 5, 6]) {
    await cli.query(
      `INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, slot_duration, enabled)
       VALUES ($1,$2,$3,$4,20,TRUE)`,
      [doctorId, dow, dow === 6 ? '08:00' : '07:30', dow === 6 ? '12:00' : '17:00'],
    );
  }

  // ── Plantillas de consentimiento ──
  const plantillas = [];
  const CONSENTIMIENTOS = [
    ['atencion', 'Consentimiento informado para atención médica',
      'Autorizo al personal médico de este centro a realizar la evaluación clínica, la exploración física y los procedimientos ambulatorios que sean necesarios para mi atención (toma de signos vitales, curaciones, nebulizaciones, suturas y aplicación de inyecciones), habiendo comprendido en qué consisten y sus riesgos más frecuentes. Se me ha explicado que puedo hacer preguntas en cualquier momento y negarme a cualquier procedimiento.'],
    ['datos', 'Tratamiento de datos personales de salud',
      'Autorizo el tratamiento de mis datos personales y de salud para la prestación del servicio, la gestión de mis citas y el envío de recordatorios al número que he proporcionado. Conozco mi derecho a acceder a mis datos, rectificarlos, solicitar su eliminación y revocar esta autorización.'],
    ['imagenes', 'Autorización para registro fotográfico clínico',
      'Autorizo la toma de fotografías de lesiones o hallazgos con fines exclusivamente clínicos: documentar la evolución y comparar los resultados entre visitas. Las imágenes se guardan en mi expediente y no se publican ni se comparten fuera del equipo tratante sin una autorización mía adicional y por escrito.'],
  ];
  for (const [tipo, titulo, texto] of CONSENTIMIENTOS) {
    const r = await cli.query(
      'INSERT INTO consent_templates (clinic_id, doctor_id, type, title, description) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [clinicId, doctorId, tipo, titulo, texto],
    );
    plantillas.push(r.rows[0].id);
  }

  // ── Pacientes ──
  const N_PACIENTES = 96;
  const pacientes = [];
  const identidadesUsadas = new Set();

  for (let i = 0; i < N_PACIENTES; i++) {
    const caso = CASOS[i % CASOS.length];
    const femenino = caso.soloMujer ? true : dado(0.56);
    const edad = ent(caso.edad[0], caso.edad[1]);
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
        aFechaHora(conHora(masDias(HOY, -ent(15, 330)), ent(7, 16), ent(0, 59))),
      ],
    );

    // Antecedentes: manda el caso, y encima el ruido propio de la edad.
    const hipertenso = caso.cronico === 'hta' || (edad > 48 && dado(0.3));
    const diabetico = caso.cronico === 'dm2' || (edad > 52 && dado(0.18));
    const alergico = dado(0.16);
    const asmatico = caso.id === 'asma';

    await cli.query(
      'INSERT INTO critical_info (patient_id, allergies, medications, conditions) VALUES ($1,$2,$3,$4)',
      [
        r.rows[0].id,
        alergico ? uno(['Penicilina', 'Sulfas', 'AINEs (ibuprofeno)', 'Dipirona', 'Mariscos']) : '',
        [
          hipertenso ? uno(['Losartán 50 mg c/12 h', 'Enalapril 10 mg c/12 h', 'Amlodipino 5 mg c/día']) : '',
          diabetico ? uno(['Metformina 850 mg c/12 h', 'Metformina + glimepirida']) : '',
          asmatico ? 'Salbutamol inhalado de rescate' : '',
        ].filter(Boolean).join(' · '),
        [
          hipertenso ? 'Hipertensión arterial' : '',
          diabetico ? 'Diabetes mellitus tipo 2' : '',
          asmatico ? 'Asma bronquial' : '',
          edad > 62 && dado(0.25) ? 'Osteoartrosis' : '',
        ].filter(Boolean).join(' · '),
      ],
    );

    pacientes.push({
      id: r.rows[0].id, nombre, edad, femenino, caso, hipertenso, diabetico, alergico,
      pesoKg: femenino ? ent(52, 96) : ent(62, 112),
      tallaM: Number((femenino ? (1.48 + rnd() * 0.18) : (1.6 + rnd() * 0.2)).toFixed(2)),
    });
  }

  // Consentimientos firmados.
  for (const p of pacientes) {
    if (!dado(0.6)) continue;
    const firmadas = plantillas.filter((_, idx) => idx <= 1 || dado(0.3));
    for (const tpl of firmadas) {
      await cli.query(
        `INSERT INTO patient_consents (patient_id, template_id, clinic_id, signed_by, signature_date, status)
         VALUES ($1,$2,$3,$4,$5,'signed')`,
        [p.id, tpl, clinicId, p.nombre, aFechaHora(conHora(masDias(HOY, -ent(15, 300)), ent(8, 16), 0))],
      );
    }
  }

  // ── Agenda ──
  const ocupados = new Set();
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

  // 1 · Historia. Los crónicos vuelven cada 1-3 meses; los agudos, una o dos veces.
  for (const p of pacientes) {
    const esCronico = ['hta', 'dm2', 'hipotiroidismo', 'dislipidemia'].includes(p.caso.id);
    const nVisitas = esCronico ? ent(4, 7) : ent(1, 3);
    let dia = masDias(HOY, -ent(15, 300));
    for (let v = 0; v < nVisitas; v++) {
      if (dia >= masDias(HOY, -2)) break;
      while (!esLaborable(dia)) dia = masDias(dia, 1);
      agendar(dia, p, { estado: dado(0.08) ? 'cancelled' : 'completed' });
      dia = masDias(dia, esCronico ? ent(28, 95) : ent(12, 40));
    }
  }

  // 2 · Hoy: una agenda de medicina general se ve llena. Mañana ya atendida,
  //     alguien en sala y la tarde por delante.
  if (esLaborable(HOY)) {
    const tope = HOY.getDay() === 6 ? 12 * 60 : 17 * 60;
    const guion = [
      { minuto: 7 * 60 + 30, estado: 'completed' },
      { minuto: 7 * 60 + 50, estado: 'completed' },
      { minuto: 8 * 60 + 10, estado: 'completed' },
      { minuto: 8 * 60 + 30, estado: 'completed' },
      { minuto: 8 * 60 + 50, estado: 'completed' },
      { minuto: 9 * 60 + 10, estado: 'completed' },
      { minuto: 9 * 60 + 30, estado: 'completed' },
      { minuto: 9 * 60 + 50, estado: 'cancelled' },
      { minuto: 10 * 60 + 10, estado: 'completed' },
      { minuto: 10 * 60 + 30, estado: 'waiting', sala: salas[0] },
      { minuto: 10 * 60 + 50, estado: 'confirmed' },
      { minuto: 11 * 60 + 10, estado: 'confirmed' },
      { minuto: 13 * 60, estado: 'confirmed' },
      { minuto: 13 * 60 + 20, estado: 'pending' },
      { minuto: 13 * 60 + 40, estado: 'confirmed' },
      { minuto: 14 * 60, estado: 'confirmed' },
      { minuto: 14 * 60 + 20, estado: 'pending' },
      { minuto: 15 * 60, estado: 'confirmed' },
      { minuto: 15 * 60 + 40, estado: 'pending' },
      { minuto: 16 * 60 + 20, estado: 'confirmed' },
    ];
    for (const g of guion) {
      if (g.minuto + 20 > tope) continue;
      agendar(HOY, uno(pacientes), g);
    }
  }

  // 3 · Las próximas tres semanas.
  for (let d = 1; d <= 21; d++) {
    const dia = masDias(HOY, d);
    if (!esLaborable(dia)) continue;
    const cuantas = dia.getDay() === 6 ? ent(4, 7) : ent(7, 13);
    for (let i = 0; i < cuantas; i++) {
      agendar(dia, uno(pacientes), { estado: dado(0.6) ? 'confirmed' : 'pending' });
    }
  }

  citas.sort((a, b) => a.cuando - b.cuando);

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
    const costo = tipo === 'nuevo_paciente' ? 600 : caso.costo;
    const completada = c.estado === 'completed';
    const pagada = completada && dado(0.9);

    const inicio = c.cuando;
    const fin = new Date(inicio.getTime() + ent(15, 25) * 60000);

    const ra = await cli.query(
      `INSERT INTO appointments
         (patient_id, doctor_id, clinic_id, specialty, scheduled_at, status, source, reason,
          appointment_type, room_id, checked_in_at, started_at, ended_at,
          cost, payment_status, payment_method, paid_at, paid_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING id`,
      [
        p.id, doctorId, clinicId, ESPECIALIDAD,
        aFechaHora(inicio),
        c.estado,
        dado(0.25) ? 'online' : 'manual',
        caso.queja.length > 60 ? caso.queja.slice(0, 57) + '…' : caso.queja,
        tipo,
        c.sala || (completada ? salas[caso.procedimiento ? 1 : 0] : null),
        completada || c.estado === 'waiting' ? aFechaHora(new Date(inicio.getTime() - ent(3, 15) * 60000)) : null,
        completada ? aFechaHora(inicio) : null,
        completada ? aFechaHora(fin) : null,
        c.estado === 'cancelled' ? 0 : costo,
        pagada ? 'paid' : 'pending',
        pagada ? uno(['efectivo', 'efectivo', 'efectivo', 'tarjeta', 'transferencia']) : '',
        pagada ? aFechaHora(fin) : null,
        pagada ? recepcionId : null,
        aFechaHora(conHora(masDias(inicio, -ent(1, 10)), ent(7, 17), ent(0, 59))),
      ],
    );
    const citaId = ra.rows[0].id;

    if (!completada) continue;

    // ── La consulta ──
    // Solo se escriben las columnas que la API de verdad persiste para
    // Medicina General (ver la cabecera de este archivo). Nada de inventarse un
    // esquema que la app no lee: la demo enseña lo que el producto hace hoy.
    const esAgudo = AGUDOS.includes(caso.id);
    const v = (!esPrimera && esAgudo) ? vitalesEnMejoria() : caso.vitales();
    const vitales = { ...v, wh: `${p.pesoKg} kg / ${p.tallaM.toFixed(2)} m` };

    const observaciones = esPrimera
      ? caso.observaciones
      : uno([
          'Evolución favorable respecto a la visita anterior; se mantiene el plan.',
          'Buena adherencia al tratamiento. Se resuelven dudas sobre los medicamentos.',
          'Mejoría parcial. Se ajusta la dosis y se refuerzan las indicaciones.',
          caso.observaciones,
        ]);

    // En la visita de control cambia lo que cambia de verdad: el motivo por el
    // que viene y desde cuándo. El cuadro agudo se reevalúa; el crónico
    // conserva su "diagnóstico hace N años", que es lo correcto.
    const casoDeHoy = esPrimera ? caso : {
      ...caso,
      queja: esAgudo
        ? `Reevaluación por ${caso.dx.split(/[,(]/)[0].trim().toLowerCase()}`
        : `Control de ${caso.dx.split(/[,(]/)[0].trim().toLowerCase()}`,
      duracion: esAgudo
        ? `${ent(3, 10)} días desde la consulta anterior`
        : caso.duracion,
      intensidad: esAgudo ? Math.max(1, caso.intensidad - ent(2, 4)) : caso.intensidad,
      // Los síntomas del día agudo tampoco pueden repetirse tal cual: si los
      // vitales ya son normales, la lista no puede seguir diciendo "Fiebre
      // (hasta 39.2 °C)". Se sustituyen por el estado en el que llega hoy.
      sintomas: esAgudo
        ? [[uno([
            'Síntomas en resolución',
            'Mejoría clínica evidente',
            'Molestia residual leve',
          ]), uno([
            'sin fiebre en las últimas 48 h',
            'tolera la vía oral, actividad habitual reanudada',
            'cede con el tratamiento indicado',
          ])]]
        : caso.sintomas,
    };

    await cli.query(
      `INSERT INTO consultations
         (patient_id, doctor_id, clinic_id, appointment_id, specialty, created_at,
          visit_reason, notes, diagnosis, treatment, observations,
          cost, payment_status, payment_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        p.id, doctorId, clinicId, citaId, ESPECIALIDAD,
        aFechaHora(fin),
        casoDeHoy.queja,
        construirNotas({ vitales, caso: casoDeHoy, observaciones }),
        construirDiagnostico(caso),
        construirTratamiento(caso),
        observaciones,
        costo,
        pagada ? 'paid' : 'pending',
        pagada && dado(0.12) ? uno([
          'Descuento de adulto mayor.',
          'Consulta de control incluida en el paquete de seguimiento.',
          'Descuento del 10% por pago de contado.',
        ]) : '',
      ],
    );
    nConsultas++;
    if (pagada) ingresos += costo;
  }

  // ── Suscripción ──
  // Sin esto la cuenta queda en SOLO LECTURA por BILLING_ENFORCEMENT=on y
  // cualquier "Guardar" contesta 402 en mitad de la demostración. No es un
  // cobro: fila local con proveedor 'demo' e importe 0, nunca pasa por PayPal.
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

  return { clinicId, clave, nPacientes: pacientes.length, nCitas: citas.length, nConsultas, ingresos };
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

  await borrar('consultation_images', 'clinic_id', clinicId);
  await borrar('consultation_inventory_usage', 'clinic_id', clinicId);
  await borrar('appointment_confirmations', 'clinic_id', clinicId);
  await borrar('appointment_reminders', 'clinic_id', clinicId);
  await borrar('consultations', 'clinic_id', clinicId);
  await borrar('clinic_rooms', 'clinic_id', clinicId);   // antes que appointments
  await borrar('appointments', 'clinic_id', clinicId);
  await borrar('patient_consents', 'clinic_id', clinicId);
  await borrar('consents', 'clinic_id', clinicId);
  await borrar('consent_templates', 'clinic_id', clinicId);
  await borrar('critical_info', 'patient_id', pacientes);
  const convs = (await cli.query('SELECT id FROM chat_conversations WHERE clinic_id = $1', [clinicId])).rows.map((x) => x.id);
  await borrar('chat_messages', 'conversation_id', convs);
  await borrar('chat_members', 'conversation_id', convs);
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
  // y se les saca de la clínica para que la clínica sí pueda desaparecer.
  const conLegal = usuarios.length
    ? (await cli.query('SELECT DISTINCT user_id FROM legal_acceptances WHERE user_id = ANY($1::int[])', [usuarios]))
        .rows.map((x) => x.user_id)
    : [];

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
  if (conLegal.length) borrados['users (neutralizados por registro legal)'] = conLegal.length;

  await borrar('users', 'id', usuarios.filter((u) => !conLegal.includes(u)));
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
  Tegucigalpa · ${ESPECIALIDAD} · lempiras · WhatsApp apagado · fuera del mapa público

  ${r.nPacientes} pacientes · ${r.nCitas} citas · ${r.nConsultas} consultas
  L. ${r.ingresos.toLocaleString('es-HN')} cobrados en el histórico

  Entrar en /login.html con:
    ${CUENTAS.doctor.email}           → ${CUENTAS.doctor.name} · médico general (ESTA es la que se enseña)
    ${CUENTAS.admin.email}     → ${CUENTAS.admin.name} · administradora
    ${CUENTAS.recepcion.email} → ${CUENTAS.recepcion.name} · recepción

  Contraseña (las tres):  ${r.clave}
  Se imprime UNA sola vez. Guárdala ahora.

  Nota: la primera vez que se guarde algo saldrá el modal de Términos y
  Privacidad. Es un clic y no vuelve a salir; a propósito no se siembra la
  aceptación (es un registro inmutable y dejaría la cuenta sin poder borrarse).

  Para deshacerlo entero:  node tools/seed-demo-general.js --purge
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
