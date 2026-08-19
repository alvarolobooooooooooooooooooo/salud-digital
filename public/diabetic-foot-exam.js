/**
 * DiabeticFootExam — Tamizaje neurológico y vascular del pie diabético.
 *
 * Renderiza un acordeón de 9 pasos dentro del contenedor `#dfeRoot`: las 7
 * maniobras neurológicas (con vibración y monofilamento integrados en la
 * sensibilidad profunda), el índice tobillo-brazo y la termografía. Serializa
 * el estado en `#consDFEState` para que ConsultationDraft autoguarde y
 * submitConsult() lo incluya en el payload.
 *
 * API:
 *   DiabeticFootExam.init();        // monta una vez (idempotente)
 *   DiabeticFootExam.getState();    // estado serializable
 *   DiabeticFootExam.setState(s);   // restaurar desde borrador
 *
 * Diseño: ver `Exploración del pie diabético.html` (Claude Design).
 */
(function () {
  'use strict';

  // ─── Pasos del wizard ──────────────────────────────────────────────────
  const STEPS = [
    {
      id: 'marcha', num: 1, title: 'Marcha', eyebrow: 'Neurológico · 1 de 7',
      subtitle: 'Evaluar equilibrio, coordinación, fuerza y sensibilidad globales mientras el paciente camina.',
      alarm: 'Incapacidad y dolor',
      substeps: [
        { id: 'A', name: 'Normal', hint: 'Equilibrio, coordinación, fuerza y sensibilidad — observación general.' },
        { id: 'B', name: 'Marcha en puntas', hint: 'Fuerza de músculos gastrocnemios.' },
        { id: 'C', name: 'Marcha en talones', hint: 'Fuerza de músculos tibiales anteriores.' },
        { id: 'D', name: 'Marcha en tándem', hint: 'Coordinación y equilibrio.' }
      ]
    },
    {
      id: 'fuerza', num: 2, title: 'Fuerza muscular', eyebrow: 'Neurológico · 2 de 7',
      subtitle: 'Escala MRC (0-5). Comparar siempre con el lado contralateral. Hallazgo de alarma: debilidad.',
      alarm: 'Debilidad muscular focal o difusa',
      scale: { values: ['0', '1', '2', '3', '4', '5'], normalValue: '5', unit: '/5', short: 'MRC' },
      reference: {
        eye: 'Escala MRC',
        title: 'Fuerza muscular 0 – 5',
        body: '0: sin contracción · 1: contracción palpable · 2: movimiento sin gravedad · 3: contra gravedad · 4: contra resistencia parcial · 5: fuerza normal.'
      },
      substeps: [
        { id: 'A', name: 'Bíceps crural', root: 'L2 – L3' },
        { id: 'B', name: 'Cuádriceps', root: 'L3 – L4' },
        { id: 'C', name: 'Tibiales anteriores', root: 'L4 – L5' },
        { id: 'D', name: 'Gastrocnemios', root: 'L5 – S1' }
      ]
    },
    {
      id: 'sens-sup', num: 3, title: 'Sensibilidad superficial', eyebrow: 'Neurológico · 3 de 7',
      subtitle: 'Comparar zonas simétricas. Signos de alarma: hipoestesia, hiperestesia, hiperalgesia — frecuentes en diabetes mellitus.',
      alarm: 'Hipoestesia / hiperestesia / hiperalgesia',
      substeps: [
        { id: 'A', name: 'Tacto', hint: 'Algodón o pincel suave en zonas simétricas.' },
        { id: 'B', name: 'Dolor', hint: 'Estímulo punzante (palillo) sin lesionar la piel.' },
        { id: 'C', name: 'Temperatura', hint: 'Frío vs tibio en tubos de ensayo / lateral del diapasón.' }
      ]
    },
    {
      id: 'sens-prof', num: 4, title: 'Sensibilidad profunda', eyebrow: 'Neurológico · 4 de 7',
      subtitle: 'Vibración con diapasón 128 Hz y monofilamento 5.07 (10 g). Hallazgos de alarma: compromiso de fibras largas en neuropatía diabética.',
      alarm: 'Compromiso de fibras largas',
      interactive: ['vib', 'mono']
    },
    {
      id: 'trofismo', num: 5, title: 'Trofismo muscular', eyebrow: 'Neurológico · 5 de 7',
      subtitle: 'Palpar las masas musculares y compararlas con el lado contralateral. Hallazgo de alarma: hipotrofia, atrofia o hipertrofia.',
      alarm: 'Hipotrofia / atrofia / hipertrofia',
      substeps: [
        { id: 'A', name: 'Palpar masas musculares (gemelos, sóleo, cuádriceps)', hint: 'Comparar bulto y consistencia con lado contralateral.' }
      ]
    },
    {
      id: 'reflejos', num: 6, title: 'Reflejos osteotendinosos', eyebrow: 'Neurológico · 6 de 7',
      subtitle: 'Escala 0-4+. Comparar derecha-izquierda. La arreflexia aquilea es un signo temprano de neuropatía diabética.',
      reference: {
        eye: 'Escala de reflejos 0 – 4+',
        title: 'Hiperreflexia / hiporreflexia',
        body: '0: ausente · 1+: hipoactivo · 2+: normal · 3+: hiperactivo sin clonus · 4+: hiperactivo con clonus. Arreflexia aquilea bilateral es signo temprano de neuropatía diabética.'
      },
      substeps: [
        { id: 'A', name: 'Patelar (rotuliano)', root: 'L3 – L4' },
        { id: 'B', name: 'Aquileo', root: 'S1' }
      ]
    },
    {
      id: 'plantar', num: 7, title: 'Respuesta plantar', eyebrow: 'Neurológico · 7 de 7',
      subtitle: 'Estimular el borde lateral de la planta. Respuesta normal: flexión. Signo de Babinski (extensión del 1er dedo) = vía piramidal afectada.',
      alarm: 'Babinski positivo — extensión del 1er dedo',
      abnormalLabel: 'Babinski +',
      substeps: [
        { id: 'A', name: 'Reflejo cutáneo-plantar — pie derecho', hint: 'Esperar flexión. Extensión = Babinski +.' },
        { id: 'B', name: 'Reflejo cutáneo-plantar — pie izquierdo', hint: 'Esperar flexión. Extensión = Babinski +.' }
      ]
    },
    {
      id: 'itb', num: 8, title: 'Índice Tobillo-Brazo', eyebrow: 'Tamizaje · Vascular',
      subtitle: 'Medir presión sistólica en ambos brazos y en ambos tobillos (DP y TP) con Doppler portátil. ITB = presión tobillo ÷ presión brazo de referencia (la más alta de los dos brazos).',
      alarm: 'ITB < 0.91 o > 1.30',
      interactive: 'itb'
    },
    {
      id: 'termografia', num: 9, title: 'Termografía', eyebrow: 'Tamizaje · Vascular',
      subtitle: 'Registrar la temperatura de cada zona y compararla con el punto simétrico del pie contralateral. La asimetría térmica sostenida mayor a 2.2 °C anticipa ulceración aun con la piel íntegra.',
      alarm: 'Asimetría térmica > 2.2 °C entre zonas simétricas',
      abnormalLabel: 'Fuera de rango',
      scale: {
        values: ['<30', '30-32', '32-35', '35-37', '>37'],
        normalValue: '32-35',
        unit: ' °C',
        short: 'Temp'
      },
      reference: {
        eye: 'Patrones térmicos',
        title: 'Lectura de la termografía plantar',
        body: 'Rangos: muy fría <30 °C · fría 30-32 °C · normal 32-35 °C · cálida 35-37 °C · muy cálida >37 °C. Patrones descritos: mariposa, alto completo, alto interno, antepié bajo, bajo completo y dedos bajos. Una zona caliente sugiere inflamación o neuroartropatía de Charcot; una zona fría sugiere isquemia.'
      },
      substeps: [
        { id: 'A', name: 'Dedos — hallux y pulpejos', hint: 'Comparar cada dedo con su simétrico contralateral.' },
        { id: 'B', name: 'Antepié — cabezas metatarsianas', hint: 'Zona de mayor presión plantar y de úlcera más frecuente.' },
        { id: 'C', name: 'Mediopié — arco', hint: 'El calor localizado aquí obliga a descartar Charcot.' },
        { id: 'D', name: 'Talón — retropié', hint: 'Comparar con el talón contralateral.' }
      ]
    }
  ];

  // ─── Puntos del diapasón (vibración 128 Hz) ────────────────────────────
  const VIB_POINTS = [
    { id: 'v1', name: 'Hallux — falange distal',  L: { x: 456, y: 110 }, R: { x: 824, y: 110 } },
    { id: 'v2', name: '1ª cabeza metatarsiana',   L: { x: 500, y: 400 }, R: { x: 780, y: 400 } }
  ];

  // ─── 10 puntos del monofilamento (coords sobre viewBox 1280×1190) ──────
  const FOOT_POINTS = [
    { id: 'p1',  name: 'Pulpejo 1er dedo (hallux)',  L: { x: 456,  y: 110  }, R: { x: 824,  y: 110  } },
    { id: 'p2',  name: 'Pulpejo 3er dedo',           L: { x: 216,  y: 180  }, R: { x: 1064, y: 180  } },
    { id: 'p3',  name: 'Pulpejo 5to dedo',           L: { x: 60,   y: 350  }, R: { x: 1220, y: 350  } },
    { id: 'p4',  name: 'Cabeza 1er metatarsiano',    L: { x: 500,  y: 400  }, R: { x: 780,  y: 400  } },
    { id: 'p5',  name: 'Cabeza 3er metatarsiano',    L: { x: 340,  y: 430  }, R: { x: 940,  y: 430  } },
    { id: 'p6',  name: 'Cabeza 5to metatarsiano',    L: { x: 140,  y: 470  }, R: { x: 1140, y: 470  } },
    { id: 'p7',  name: 'Mediopié — borde lateral',   L: { x: 130,  y: 760  }, R: { x: 1150, y: 760  } },
    { id: 'p8',  name: 'Mediopié — borde medial',    L: { x: 480,  y: 760  }, R: { x: 800,  y: 760  } },
    { id: 'p9',  name: 'Talón — central',            L: { x: 330,  y: 1080 }, R: { x: 950,  y: 1080 } },
    { id: 'p10', name: 'Dorso — 1er–2do espacio',    L: { x: 386,  y: 200  }, R: { x: 894,  y: 200  } }
  ];

  // Foot silhouette paths (potrace export, scale(0.1,-0.1) inside <g>)
  const FOOT_PATHS = [
    'M4406 11884 c-207 -50 -395 -235 -497 -490 -172 -430 -103 -959 166 -1272 70 -82 127 -127 220 -173 334 -165 707 47 868 496 54 152 70 255 70 450 0 194 -16 297 -70 450 -141 393 -450 613 -757 539z',
    'M8200 11890 c-131 -20 -246 -85 -355 -201 -123 -130 -211 -309 -256 -519 -29 -134 -32 -399 -7 -525 66 -325 227 -578 438 -689 404 -213 834 105 946 699 23 121 23 349 0 475 -67 374 -285 672 -546 743 -74 21 -154 27 -220 17z',
    'M3078 11410 c-173 -29 -323 -193 -385 -420 -26 -95 -26 -377 1 -475 62 -228 192 -407 353 -487 63 -31 74 -33 168 -33 93 0 105 2 167 33 176 86 292 305 305 572 22 463 -280 865 -609 810z',
    'M9545 11392 c-194 -68 -341 -256 -407 -518 -18 -72 -22 -117 -22 -234 0 -173 14 -241 81 -378 98 -200 268 -304 445 -272 104 19 164 54 258 149 71 71 94 103 132 181 67 135 89 227 95 391 6 150 -4 227 -42 340 -50 148 -148 268 -264 323 -83 39 -197 47 -276 18z',
    'M1888 10941 c-71 -29 -113 -57 -162 -112 -185 -206 -194 -608 -19 -919 60 -106 182 -232 269 -278 34 -17 90 -39 125 -48 217 -56 422 96 495 366 23 86 24 296 1 398 -58 253 -217 479 -401 567 -70 34 -90 38 -170 42 -72 3 -101 0 -138 -16z',
    'M10696 10950 c-21 -6 -69 -26 -106 -46 -179 -94 -316 -289 -381 -541 -32 -125 -32 -315 0 -428 62 -220 199 -351 376 -363 313 -20 610 342 632 768 14 273 -96 507 -274 587 -65 28 -181 39 -247 23z',
    'M964 10303 c-146 -63 -236 -207 -251 -404 -21 -269 133 -590 352 -731 164 -107 345 -102 470 13 56 52 86 101 117 194 19 59 23 90 22 195 -1 105 -5 139 -28 213 -71 237 -211 414 -393 499 -58 28 -81 33 -158 35 -68 2 -100 -1 -131 -14z',
    'M11600 10302 c-200 -66 -370 -264 -446 -519 -37 -122 -40 -304 -7 -409 42 -131 129 -232 234 -269 62 -22 177 -19 246 6 205 76 369 280 439 545 25 95 25 286 0 369 -25 84 -51 131 -103 186 -91 97 -235 133 -363 91z',
    'M3714 9830 c-654 -59 -1441 -341 -2014 -723 -475 -317 -758 -638 -903 -1027 -107 -288 -123 -556 -51 -848 62 -250 168 -452 438 -826 126 -175 133 -189 226 -422 169 -422 308 -840 489 -1474 125 -439 163 -620 297 -1425 184 -1106 264 -1484 374 -1761 242 -608 891 -1175 1490 -1300 116 -24 291 -22 441 5 385 68 663 240 865 537 204 297 287 629 287 1139 0 492 -50 695 -376 1530 -257 658 -278 734 -321 1155 -30 287 -39 470 -39 780 -1 320 8 472 44 750 26 205 46 298 129 590 128 449 161 638 210 1190 18 200 31 590 25 735 -15 352 -57 578 -140 752 -104 221 -245 349 -542 493 -147 72 -263 112 -393 134 -111 20 -403 28 -536 16z',
    'M8707 9829 c-212 -15 -346 -53 -562 -159 -169 -83 -247 -134 -338 -219 -170 -160 -260 -357 -303 -658 -45 -324 -36 -837 26 -1408 32 -291 76 -508 169 -838 87 -305 117 -439 141 -630 68 -544 62 -1108 -20 -1732 -33 -252 -77 -392 -316 -1002 -155 -397 -262 -710 -298 -874 -89 -401 -81 -927 19 -1298 100 -370 340 -684 645 -845 204 -108 513 -176 730 -162 281 18 624 169 927 408 106 84 299 274 387 383 136 166 258 372 322 540 104 276 190 676 349 1635 171 1031 196 1144 421 1895 144 480 297 917 439 1254 36 85 70 144 136 235 307 421 431 658 491 939 31 147 31 400 0 544 -48 222 -146 448 -270 623 -96 137 -353 391 -522 517 -638 475 -1512 804 -2268 853 -81 5 -158 9 -172 8 -14 0 -74 -4 -133 -9z',
    'M196 9480 c-271 -109 -255 -555 31 -832 117 -113 233 -164 362 -156 91 6 140 28 198 90 59 65 86 142 87 253 1 106 -14 173 -60 273 -72 158 -181 274 -322 344 -73 37 -92 42 -165 45 -64 3 -93 -1 -131 -17z',
    'M12413 9490 c-335 -71 -589 -544 -450 -839 67 -144 238 -203 402 -141 190 73 332 232 407 456 32 96 32 254 0 335 -58 147 -201 223 -359 189z'
  ];

  // ITB silhouette
  const BODY_PATH = 'M286.166,286.154c-1.301-1.601-3.927-7.737-5.1-9.769-1.172-2.032-5.549-8.89-8.91-12.094-.829-.791-1.663-1.355-2.449-1.757-2.431-5.577-5.384-28.014-7.046-45.077-1.758-18.054-7.503-25.205-7.503-25.205.821-14.771-4.103-30.129-3.947-33.763.156-3.634,0-14.967,0-14.967-.86-18.601-10.707-22.196-21.414-25.635-10.707-3.439-23.759-10.004-25.713-11.723-1.954-1.719-1.954-4.533-2.032-9.144-.076-4.462,1.823-9.218,3.362-14.618,4.144-.098,6.586-12.54,4.531-13.674-.742-.409-1.298-.441-1.713-.299.651-6.329.378-13.456-2.664-19.005-5.783-10.551-17.038-10.16-17.038-10.16h-.987s-11.254-.391-17.038,10.16c-3.042,5.549-3.315,12.676-2.664,19.005-.414-.141-.971-.11-1.712.299-2.055,1.134.388,13.575,4.531,13.674,1.539,5.401,3.438,10.157,3.362,14.618-.078,4.611-.078,7.425-2.032,9.144-1.954,1.719-15.006,8.284-25.713,11.723s-20.555,7.034-21.414,25.635c0,0-.156,11.333,0,14.967.156,3.634-4.767,18.992-3.947,33.763,0,0-5.744,7.151-7.503,25.205-1.662,17.064-4.616,39.5-7.046,45.077-.786.402-1.62.966-2.45,1.757-3.361,3.204-7.737,10.062-8.91,12.094s-3.798,8.168-5.1,9.769c-1.524,1.876-1.315,4.643,1.407,3.341,2.696-1.29,5.412-4.435,6.506-6.311,1.094-1.876,1.876-2.345,1.876-2.345,0,0-1.454,12.29-1.859,16.023-.449,4.142-2.009,9.807.14,10.393,2.362.644,2.97-2.501,3.361-4.924.391-2.423,2.816-14.069,3.587-14.771.96-.875.538.482.321,3.282-.073.948-.391,5.705-.86,8.753-.469,3.048-2.032,9.848,1.251,9.457,3.282-.391,4.064-18.757,4.611-20.086.547-1.329,1.016-.781.703,2.501-.099,1.038-1.798,13.364-1.172,15.865.625,2.501,3.048,2.11,3.83-1.094.781-3.204,1.563-16.178,2.11-17.116.547-.938.703.782.547,3.126-.115,1.716-1.094,11.098.782,11.489,1.876.391,2.638-.762,3.158-7.62.456-6.005.515-9.34.828-13.169.313-3.83.703-15.084-1.172-18.523,0,0,2.345-11.567,7.19-21.571,4.846-10.004,12.036-27.511,11.723-36.108-.26-7.139,5.732-31.953,7.951-40.344.21,2.092.517,4.307.959,6.581,2.188,11.254,5.471,24.853,5.002,33.294-.469,8.441-1.407,21.258-2.345,26.26-.938,5.002-6.565,24.384-6.409,48.3s3.439,52.129,5.002,58.069c1.563,5.94,2.013,11.827,1.544,15.891-.469,4.064-1.388,13.104-.45,19.2,0,0-3.751,15.944-.781,37.671,2.97,21.727,8.284,45.642,8.284,48.143v.994c-.255,1.166-.539,2.326-.795,3.493-.31,1.41-.518,2.82-.557,4.266-.038,1.429.042,2.854.067,4.282.017,1.001-.01,2.002-.107,2.995-.718,1.458-1.584,2.86-2.472,4.201-1.205,1.82-2.568,3.53-3.954,5.215-1.399,1.7-2.827,3.378-4.161,5.13-.663.871-1.303,1.76-1.903,2.676-.626.955-1.333,1.959-1.556,3.1-.206,1.052.093,2.114,1.095,2.615.2.1.412.163.625.191-.027.322-.008.652.085.992.34,1.245,1.607,2.14,2.882,2.176.173.594.609,1.045,1.286,1.238.829.237,1.729-.011,2.469-.44.037.19.098.376.19.555.462.903,1.493,1.29,2.462,1.26,1.146-.035,2.117-.709,2.88-1.518.395-.419.753-.867,1.111-1.314-.15.603-.164,1.232.06,1.819.417,1.093,1.605,1.644,2.697,1.799,1.036.147,2.083-.06,3.016-.526.357-.179.724-.407,1.064-.674.638-.314,1.219-.769,1.716-1.262,1.103-1.095,1.864-2.457,2.437-3.89,1.27-3.171,1.679-6.616,2.341-9.945.125-.626.254-1.258.398-1.888.082.057.213.05.325-.063,1.422-1.443,1.97-3.776,2.14-5.729.208-2.395-.156-4.784-.6-7.132-.47-2.492-.935-4.975-1.23-7.496-.294-2.518-.456-5.049-.576-7.581-.066-1.391-.126-2.783-.185-4.175-.004-.102-.01-.204-.015-.306.285-3.865.614-7.629.988-10.847,1.563-13.443,7.034-35.795,5.627-47.362-1.407-11.567.307-41.109,1.797-49.55,1.49-8.441,8.675-55.959,7.112-69.558l1.744-.158,1.744.158c-1.563,13.599,5.622,61.117,7.112,69.558,1.49,8.441,3.204,37.983,1.797,49.55s4.064,33.919,5.627,47.362c.374,3.218.703,6.982.988,10.847-.005.102-.011.204-.015.306-.06,1.392-.119,2.783-.185,4.175-.12,2.532-.282,5.063-.576,7.581-.294,2.521-.759,5.004-1.23,7.496-.443,2.348-.808,4.737-.6,7.132.17,1.953.718,4.287,2.14,5.729.112.113.242.12.325.063.143.63.273,1.262.398,1.888.663,3.329,1.072,6.775,2.341,9.945.574,1.432,1.334,2.795,2.437,3.89.497.493,1.078.949,1.716,1.262.34.267.706.495,1.064.674.932.466,1.979.673,3.016.526,1.092-.155,2.279-.707,2.697-1.799.224-.587.21-1.216.06-1.819.358.447.716.895,1.111,1.314.763.808,1.734,1.483,2.88,1.518.969.03,2-.357,2.462-1.26.091-.179.152-.365.19-.555.74.429,1.64.676,2.469.44.677-.193,1.114-.644,1.286-1.238,1.275-.036,2.542-.931,2.882-2.176.093-.34.112-.67.085-.992.213-.029.425-.091.625-.191,1.002-.5,1.301-1.562,1.095-2.615-.223-1.141-.93-2.145-1.556-3.1-.6-.916-1.24-1.805-1.903-2.676-1.334-1.753-2.762-3.43-4.161-5.13-1.386-1.685-2.749-3.394-3.954-5.215-.888-1.341-1.754-2.743-2.472-4.201-.096-.994-.124-1.994-.107-2.995.024-1.428.105-2.853.067-4.282-.039-1.445-.247-2.855-.557-4.266-.256-1.166-.539-2.326-.795-3.493v-.994c0-2.501,5.314-26.416,8.284-48.143,2.97-21.727-.782-37.671-.782-37.671.938-6.096.019-15.136-.45-19.2-.469-4.064-.019-9.951,1.544-15.891,1.563-5.94,4.846-34.154,5.002-58.069.156-23.915-5.471-43.298-6.409-48.3-.938-5.002-1.876-17.819-2.345-26.26-.469-8.441,2.813-22.04,5.002-33.294.442-2.274.748-4.489.959-6.581,2.219,8.391,8.21,33.205,7.951,40.344-.313,8.597,6.878,26.104,11.723,36.108s7.19,21.571,7.19,21.571c-1.876,3.439-1.485,14.693-1.172,18.523.313,3.83.372,7.164.828,13.169.52,6.858,1.282,8.011,3.158,7.62,1.876-.391.897-9.773.782-11.489-.157-2.345,0-4.064.547-3.126.547.938,1.329,13.912,2.11,17.116.782,3.204,3.204,3.595,3.83,1.094.625-2.501-1.073-14.827-1.172-15.865-.313-3.282.156-3.83.703-2.501.547,1.329,1.329,19.695,4.611,20.086s1.719-6.409,1.25-9.457c-.469-3.048-.786-7.805-.86-8.753-.217-2.8-.64-4.157.321-3.282.771.702,3.196,12.348,3.587,14.771.391,2.423.999,5.568,3.361,4.924,2.149-.586.589-6.251.14-10.393-.405-3.734-1.859-16.023-1.859-16.023,0,0,.782.469,1.876,2.345,1.094,1.876,3.81,5.021,6.506,6.311,2.722,1.302,2.931-1.466,1.407-3.341Z';

  const KEY_RANGES = [
    { rng: '> 1.30',       nm: 'Incolapsable',            cls: 'warn' },
    { rng: '1.00 – 1.29',  nm: 'Normal',                  cls: 'ok'   },
    { rng: '0.91 – 0.99',  nm: 'Borderline',              cls: 'warn' },
    { rng: '0.41 – 0.90',  nm: 'EAOC leve a moderada',    cls: 'crit' },
    { rng: '0.00 – 0.40',  nm: 'EAOC severa',             cls: 'crit' }
  ];

  function interpret(v) {
    if (v == null || isNaN(v)) return { label: '—', cls: '' };
    if (v > 1.30) return { label: 'Incolapsable', cls: 'warn', note: 'Posible calcificación arterial — interpretar con precaución.' };
    if (v >= 1.00) return { label: 'Normal', cls: 'ok' };
    if (v >= 0.91) return { label: 'Borderline', cls: 'warn', note: 'Vigilar — repetir en 3–6 meses.' };
    if (v >= 0.41) return { label: 'EAOC leve a moderada', cls: 'crit', note: 'Considerar valoración por angiología.' };
    if (v >= 0.00) return { label: 'EAOC severa', cls: 'crit', note: 'Referencia urgente a angiología.' };
    return { label: '—', cls: '' };
  }
  function matchKey(v) {
    if (v == null || isNaN(v)) return -1;
    if (v > 1.30) return 0;
    if (v >= 1.00) return 1;
    if (v >= 0.91) return 2;
    if (v >= 0.41) return 3;
    return 4;
  }

  // ─── State ─────────────────────────────────────────────────────────────
  let state = blankState();
  let openStepId = null;
  let mounted = false;

  function blankState() {
    return { sub: {}, mono: {}, vib: {}, itb: { vR: 'DP', vL: 'DP' } };
  }

  function svgIcon(name, size) {
    size = size || 14;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.4');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const paths = {
      check: '<polyline points="20 6 9 17 4 12"/>',
      alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
      chev:  '<polyline points="6 9 12 15 18 9"/>',
      info:  '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
    };
    svg.innerHTML = paths[name] || '';
    return svg;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function hasInteractive(step, type) {
    if (!step.interactive) return false;
    if (Array.isArray(step.interactive)) return step.interactive.indexOf(type) !== -1;
    return step.interactive === type;
  }

  // ─── Step status computation ───────────────────────────────────────────
  function stepStatus(step) {
    let touched = false;
    let alarm = false;
    if (step.substeps) {
      step.substeps.forEach(sub => {
        const v = state.sub[step.id + '.' + sub.id];
        if (v && v.status && v.status !== 'untested') touched = true;
        if (v && v.status === 'abnormal') alarm = true;
      });
    }
    if (hasInteractive(step, 'vib')) {
      const any = Object.values(state.vib).some(v => v && v !== 'untested');
      if (any) touched = true;
      const missR = VIB_POINTS.filter(p => state.vib['R-' + p.id] === 'miss').length;
      const missL = VIB_POINTS.filter(p => state.vib['L-' + p.id] === 'miss').length;
      if (missR > 0 || missL > 0) alarm = true;
    }
    if (hasInteractive(step, 'mono')) {
      const any = Object.values(state.mono).some(v => v && v !== 'untested');
      if (any) touched = true;
      const missR = FOOT_POINTS.filter(p => state.mono['R-' + p.id] === 'miss').length;
      const missL = FOOT_POINTS.filter(p => state.mono['L-' + p.id] === 'miss').length;
      if (missR >= 4 || missL >= 4) alarm = true;
    }
    if (hasInteractive(step, 'itb')) {
      const itb = state.itb || {};
      if (itb.armR != null && itb.armL != null) touched = true;
      const armRef = Math.max(itb.armR || 0, itb.armL || 0);
      const ankleR = Math.max(itb.dpR || 0, itb.tpR || 0);
      const ankleL = Math.max(itb.dpL || 0, itb.tpL || 0);
      const itbR = armRef && ankleR ? ankleR / armRef : null;
      const itbL = armRef && ankleL ? ankleL / armRef : null;
      if (itbR != null && (itbR < 0.91 || itbR > 1.30)) alarm = true;
      if (itbL != null && (itbL < 0.91 || itbL > 1.30)) alarm = true;
    }
    return { touched: touched, alarm: alarm };
  }

  function totalCounts() {
    let total = 0, filled = 0, alarms = 0;
    STEPS.forEach(s => {
      if (s.substeps) {
        total += s.substeps.length;
        s.substeps.forEach(sub => {
          const v = state.sub[s.id + '.' + sub.id];
          if (v && v.status && v.status !== 'untested') filled += 1;
          if (v && v.status === 'abnormal') alarms += 1;
        });
      }
      if (hasInteractive(s, 'vib')) {
        total += 1;
        const tested = Object.values(state.vib).some(v => v && v !== 'untested');
        if (tested) filled += 1;
        const missR = VIB_POINTS.filter(p => state.vib['R-' + p.id] === 'miss').length;
        const missL = VIB_POINTS.filter(p => state.vib['L-' + p.id] === 'miss').length;
        if (missR > 0) alarms += 1;
        if (missL > 0) alarms += 1;
      }
      if (hasInteractive(s, 'mono')) {
        total += 1;
        const tested = Object.values(state.mono).some(v => v && v !== 'untested');
        if (tested) filled += 1;
        const missR = FOOT_POINTS.filter(p => state.mono['R-' + p.id] === 'miss').length;
        const missL = FOOT_POINTS.filter(p => state.mono['L-' + p.id] === 'miss').length;
        if (missR >= 4) alarms += 1;
        if (missL >= 4) alarms += 1;
      }
      if (hasInteractive(s, 'itb')) {
        total += 1;
        const itb = state.itb || {};
        const ok = itb.armR != null && itb.armL != null &&
                   ((itb.dpR != null || itb.tpR != null)) &&
                   ((itb.dpL != null || itb.tpL != null));
        if (ok) filled += 1;
        const armRef = Math.max(itb.armR || 0, itb.armL || 0);
        const ankleR = Math.max(itb.dpR || 0, itb.tpR || 0);
        const ankleL = Math.max(itb.dpL || 0, itb.tpL || 0);
        const itbR = armRef && ankleR ? ankleR / armRef : null;
        const itbL = armRef && ankleL ? ankleL / armRef : null;
        if (itbR != null && (itbR < 0.91 || itbR > 1.30)) alarms += 1;
        if (itbL != null && (itbL < 0.91 || itbL > 1.30)) alarms += 1;
      }
    });
    return { total: total, filled: filled, alarms: alarms };
  }

  // ─── Render: step body builders ────────────────────────────────────────
  function renderSubstepsHTML(step) {
    return step.substeps.map(sub => {
      const v = state.sub[step.id + '.' + sub.id] || {};
      const status = v.status || 'untested';
      const note = v.note || '';
      const noteVisible = status === 'abnormal' || (note && note.length > 0);
      const abnormalLabel = step.abnormalLabel || 'Anormal';
      let controlHTML;
      if (step.scale) {
        const score = v.score != null ? String(v.score) : null;
        const normalVal = step.scale.normalValue;
        const scaleBtns = step.scale.values.map(val => {
          const isOn = score === val;
          const cls = isOn ? (val === normalVal ? 'on-normal' : 'on-abnormal') : '';
          return '<button type="button" data-action="scale" data-value="' + val + '" class="' + cls + '">' + val + '</button>';
        }).join('');
        controlHTML =
          '<div class="dfe-tri is-scale">' +
            scaleBtns +
            '<button type="button" data-action="status" data-value="skip" class="' + (status === 'skip' ? 'on-skip' : '') + '">No realizada</button>' +
          '</div>';
      } else {
        controlHTML =
          '<div class="dfe-tri">' +
            '<button type="button" data-action="status" data-value="normal"   class="' + (status === 'normal' ? 'on-normal' : '') + '"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Normal</button>' +
            '<button type="button" data-action="status" data-value="abnormal" class="' + (status === 'abnormal' ? 'on-abnormal' : '') + '"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' + esc(abnormalLabel) + '</button>' +
            '<button type="button" data-action="status" data-value="skip"     class="' + (status === 'skip' ? 'on-skip' : '') + '">No realizada</button>' +
          '</div>';
      }
      return (
        '<div class="dfe-sub" data-key="' + step.id + '.' + sub.id + '">' +
          '<div>' +
            '<div class="dfe-sub-name">' +
              '<span class="dfe-sub-id">' + sub.id + '.</span>' +
              '<span class="dfe-sub-label">' + esc(sub.name) + '</span>' +
              (sub.root ? '<span class="dfe-sub-tag">' + esc(sub.root) + '</span>' : '') +
            '</div>' +
            (sub.hint ? '<div class="dfe-sub-hint">' + esc(sub.hint) + '</div>' : '') +
            (noteVisible ? (
              '<div class="dfe-sub-note">' +
                '<div class="dfe-sub-note-lbl">Nota clínica · ' + esc(sub.name) + '</div>' +
                '<textarea data-action="note" placeholder="' +
                  (status === 'abnormal'
                    ? 'Describir el hallazgo (lateralidad, intensidad, característica…)'
                    : 'Nota opcional') + '">' + esc(note) + '</textarea>' +
              '</div>'
            ) : '') +
          '</div>' +
          controlHTML +
        '</div>'
      );
    }).join('');
  }

  function renderVibFootSVG() {
    const labels =
      '<text x="320" y="-50" text-anchor="middle" font-family="Manrope, sans-serif" font-size="40" font-weight="700" fill="#606A7C" letter-spacing="4">PIE IZQUIERDO</text>' +
      '<text x="960" y="-50" text-anchor="middle" font-family="Manrope, sans-serif" font-size="40" font-weight="700" fill="#606A7C" letter-spacing="4">PIE DERECHO</text>';

    const paths = FOOT_PATHS.map(d => '<path d="' + d + '" fill="url(#dfe-foot-skin)" stroke="#9E6B3E" stroke-width="40"/>').join('');

    let points = '';
    ['L', 'R'].forEach(side => {
      VIB_POINTS.forEach((p, i) => {
        const pt = p[side];
        const key = side + '-' + p.id;
        const s = state.vib[key] || 'untested';
        let fill = '#FFFFFF', stroke = '#002A60', textFill = '#002A60';
        if (s === 'ok')   { fill = '#16a34a'; stroke = '#15803d'; textFill = '#fff'; }
        if (s === 'miss') { fill = '#dc2626'; stroke = '#b91c1c'; textFill = '#fff'; }
        const r = s === 'untested' ? 36 : 40;
        points +=
          '<g class="dfe-vib-pt" data-key="' + key + '" style="cursor:pointer">' +
            '<circle cx="' + pt.x + '" cy="' + pt.y + '" r="' + (r + 5) + '" fill="white" opacity="0.85"/>' +
            '<circle cx="' + pt.x + '" cy="' + pt.y + '" r="' + r + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="5"/>' +
            '<text x="' + pt.x + '" y="' + (pt.y + 11) + '" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="32" font-weight="700" fill="' + textFill + '" pointer-events="none">' + (i + 1) + '</text>' +
          '</g>';
      });
    });

    return (
      '<svg viewBox="0 -140 1280 1330" preserveAspectRatio="xMidYMid meet">' +
        '<defs>' +
          '<linearGradient id="dfe-foot-skin-vib" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#FFE7CF"/>' +
            '<stop offset="0.65" stop-color="#F4CFA8"/>' +
            '<stop offset="1" stop-color="#E2B284"/>' +
          '</linearGradient>' +
        '</defs>' +
        labels +
        '<g transform="translate(0,1190) scale(0.1,-0.1)">' + paths + '</g>' +
        points +
      '</svg>'
    );
  }

  function renderVibHTML() {
    const missR = VIB_POINTS.filter(p => state.vib['R-' + p.id] === 'miss').length;
    const missL = VIB_POINTS.filter(p => state.vib['L-' + p.id] === 'miss').length;
    const alarmR = missR > 0;
    const alarmL = missL > 0;
    const totalPts = VIB_POINTS.length;

    const rows = VIB_POINTS.map((p, i) => {
      const sR = state.vib['R-' + p.id] || 'untested';
      const sL = state.vib['L-' + p.id] || 'untested';
      const rowCls = (sR === 'miss' || sL === 'miss') ? 'miss' : '';
      return (
        '<div class="dfe-mp-row ' + rowCls + '">' +
          '<span class="dfe-mp-ix">' + (i + 1) + '</span>' +
          '<span class="dfe-mp-name">' + esc(p.name) + '</span>' +
          '<span class="dfe-mp-side">' +
            '<button type="button" data-vib-key="R-' + p.id + '" data-vib-value="ok"   class="' + (sR === 'ok'   ? 'on-y' : '') + '" title="Pie derecho — percibido">D✓</button>' +
            '<button type="button" data-vib-key="R-' + p.id + '" data-vib-value="miss" class="' + (sR === 'miss' ? 'on-n' : '') + '" title="Pie derecho — no percibido">D✗</button>' +
            '<button type="button" data-vib-key="L-' + p.id + '" data-vib-value="ok"   class="' + (sL === 'ok'   ? 'on-y' : '') + '" title="Pie izquierdo — percibido">I✓</button>' +
            '<button type="button" data-vib-key="L-' + p.id + '" data-vib-value="miss" class="' + (sL === 'miss' ? 'on-n' : '') + '" title="Pie izquierdo — no percibido">I✗</button>' +
          '</span>' +
        '</div>'
      );
    }).join('');

    return (
      '<div class="dfe-mono">' +
        '<div class="dfe-mono-foot">' +
          renderVibFootSVG() +
          '<div class="dfe-mono-legend">' +
            '<span><i style="background:#fff; color:#002A60;"></i> Sin probar</span>' +
            '<span><i style="background:#16a34a; color:#16a34a;"></i> Percibido</span>' +
            '<span><i style="background:#dc2626; color:#dc2626;"></i> No percibido</span>' +
          '</div>' +
        '</div>' +
        '<div class="dfe-mono-side">' +
          '<div class="dfe-mono-side-head">' +
            '<div>' +
              '<div class="lbl">Pie derecho · ' + missR + '/' + totalPts + ' no percibidos</div>' +
              '<div class="v ' + (alarmR ? 'danger' : '') + '">' + (totalPts - missR) + '<em>/' + totalPts + '</em></div>' +
            '</div>' +
            '<div class="right">' +
              '<div class="lbl">Pie izquierdo · ' + missL + '/' + totalPts + ' no percibidos</div>' +
              '<div class="v ' + (alarmL ? 'danger' : '') + '">' + (totalPts - missL) + '<em>/' + totalPts + '</em></div>' +
            '</div>' +
          '</div>' +
          rows +
        '</div>' +
      '</div>' +
      '<div class="dfe-ref">' +
        '<div class="dfe-ref-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div>' +
        '<div>' +
          '<div class="dfe-ref-eye">Técnica · Diapasón 128 Hz</div>' +
          '<h4>Vibración con diapasón sobre prominencias óseas</h4>' +
          '<p>Hacer vibrar el diapasón y apoyarlo sobre la falange distal del hallux y la 1ª cabeza metatarsiana. El paciente, con ojos cerrados, indica cuándo siente y cuándo deja de sentir la vibración. La ausencia de percepción en cualquier punto sugiere compromiso de fibras largas.</p>' +
        '</div>' +
      '</div>'
    );
  }

  function renderMonoFootSVG() {
    const labels =
      '<text x="320" y="-50" text-anchor="middle" font-family="Manrope, sans-serif" font-size="40" font-weight="700" fill="#606A7C" letter-spacing="4">PIE IZQUIERDO</text>' +
      '<text x="960" y="-50" text-anchor="middle" font-family="Manrope, sans-serif" font-size="40" font-weight="700" fill="#606A7C" letter-spacing="4">PIE DERECHO</text>';

    const paths = FOOT_PATHS.map(d => '<path d="' + d + '" fill="url(#dfe-foot-skin)" stroke="#9E6B3E" stroke-width="40"/>').join('');

    let points = '';
    ['L', 'R'].forEach(side => {
      FOOT_POINTS.forEach((p, i) => {
        const pt = p[side];
        const key = side + '-' + p.id;
        const s = state.mono[key] || 'untested';
        let fill = '#FFFFFF', stroke = '#002A60', textFill = '#002A60';
        if (s === 'ok')   { fill = '#16a34a'; stroke = '#15803d'; textFill = '#fff'; }
        if (s === 'miss') { fill = '#dc2626'; stroke = '#b91c1c'; textFill = '#fff'; }
        const r = s === 'untested' ? 36 : 40;
        points +=
          '<g class="dfe-mono-pt" data-key="' + key + '" style="cursor:pointer">' +
            '<circle cx="' + pt.x + '" cy="' + pt.y + '" r="' + (r + 5) + '" fill="white" opacity="0.85"/>' +
            '<circle cx="' + pt.x + '" cy="' + pt.y + '" r="' + r + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="5"/>' +
            '<text x="' + pt.x + '" y="' + (pt.y + 11) + '" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="32" font-weight="700" fill="' + textFill + '" pointer-events="none">' + (i + 1) + '</text>' +
          '</g>';
      });
    });

    return (
      '<svg viewBox="0 -140 1280 1330" preserveAspectRatio="xMidYMid meet">' +
        '<defs>' +
          '<linearGradient id="dfe-foot-skin" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#FFE7CF"/>' +
            '<stop offset="0.65" stop-color="#F4CFA8"/>' +
            '<stop offset="1" stop-color="#E2B284"/>' +
          '</linearGradient>' +
        '</defs>' +
        labels +
        '<g transform="translate(0,1190) scale(0.1,-0.1)">' + paths + '</g>' +
        '<path d="M 70 470 Q 270 410, 500 420" fill="none" stroke="#A36A45" stroke-width="3" opacity="0.35"/>' +
        '<path d="M 200 850 Q 320 870, 440 850" fill="none" stroke="#A36A45" stroke-width="3" opacity="0.25" stroke-dasharray="6 8"/>' +
        '<path d="M 1210 470 Q 1010 410, 780 420" fill="none" stroke="#A36A45" stroke-width="3" opacity="0.35"/>' +
        '<path d="M 1080 850 Q 960 870, 840 850" fill="none" stroke="#A36A45" stroke-width="3" opacity="0.25" stroke-dasharray="6 8"/>' +
        points +
      '</svg>'
    );
  }

  function renderMonoHTML(step) {
    const missR = FOOT_POINTS.filter(p => state.mono['R-' + p.id] === 'miss').length;
    const missL = FOOT_POINTS.filter(p => state.mono['L-' + p.id] === 'miss').length;
    const neuropathyR = missR >= 4;
    const neuropathyL = missL >= 4;

    const rows = FOOT_POINTS.map((p, i) => {
      const sR = state.mono['R-' + p.id] || 'untested';
      const sL = state.mono['L-' + p.id] || 'untested';
      const rowCls = (sR === 'miss' || sL === 'miss') ? 'miss' : '';
      return (
        '<div class="dfe-mp-row ' + rowCls + '">' +
          '<span class="dfe-mp-ix">' + (i + 1) + '</span>' +
          '<span class="dfe-mp-name">' + esc(p.name) + '</span>' +
          '<span class="dfe-mp-side">' +
            '<button type="button" data-mono-key="R-' + p.id + '" data-mono-value="ok"   class="' + (sR === 'ok'   ? 'on-y' : '') + '" title="Pie derecho — percibido">D✓</button>' +
            '<button type="button" data-mono-key="R-' + p.id + '" data-mono-value="miss" class="' + (sR === 'miss' ? 'on-n' : '') + '" title="Pie derecho — no percibido">D✗</button>' +
            '<button type="button" data-mono-key="L-' + p.id + '" data-mono-value="ok"   class="' + (sL === 'ok'   ? 'on-y' : '') + '" title="Pie izquierdo — percibido">I✓</button>' +
            '<button type="button" data-mono-key="L-' + p.id + '" data-mono-value="miss" class="' + (sL === 'miss' ? 'on-n' : '') + '" title="Pie izquierdo — no percibido">I✗</button>' +
          '</span>' +
        '</div>'
      );
    }).join('');

    return (
      '<div class="dfe-mono">' +
        '<div class="dfe-mono-foot">' +
          renderMonoFootSVG() +
          '<div class="dfe-mono-legend">' +
            '<span><i style="background:#fff; color:#002A60;"></i> Sin probar</span>' +
            '<span><i style="background:#16a34a; color:#16a34a;"></i> Percibido</span>' +
            '<span><i style="background:#dc2626; color:#dc2626;"></i> No percibido</span>' +
          '</div>' +
        '</div>' +
        '<div class="dfe-mono-side">' +
          '<div class="dfe-mono-side-head">' +
            '<div>' +
              '<div class="lbl">Pie derecho · ' + missR + '/10 no percibidos</div>' +
              '<div class="v ' + (neuropathyR ? 'danger' : '') + '">' + (10 - missR) + '<em>/10</em></div>' +
            '</div>' +
            '<div class="right">' +
              '<div class="lbl">Pie izquierdo · ' + missL + '/10 no percibidos</div>' +
              '<div class="v ' + (neuropathyL ? 'danger' : '') + '">' + (10 - missL) + '<em>/10</em></div>' +
            '</div>' +
          '</div>' +
          rows +
        '</div>' +
      '</div>' +
      ((neuropathyR || neuropathyL) ? (
        '<div class="dfe-alarm-banner">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
          '<div>' +
            '<b>Neuropatía de fibras largas — probable</b>' +
            '<span>' +
              (neuropathyR && neuropathyL
                ? 'Falla en ≥4 puntos en ambos pies. Asociado significativamente a polineuropatía diabética.'
                : neuropathyR
                  ? 'Falla en ≥4 puntos en el pie derecho.'
                  : 'Falla en ≥4 puntos en el pie izquierdo.') +
            '</span>' +
          '</div>' +
        '</div>'
      ) : '') +
      '<div class="dfe-ref">' +
        '<div class="dfe-ref-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div>' +
        '<div>' +
          '<div class="dfe-ref-eye">Técnica · Monofilamento 5.07 (10 g)</div>' +
          '<h4>Aplicar el monofilamento hasta doblarse — no deslizar</h4>' +
          '<p>Contacto durante 2 segundos por punto. Preguntar al paciente si siente la presión y en qué parte (con los ojos cerrados). La incapacidad de percibir 4 o más puntos por pie se asocia significativamente a neuropatía con compromiso de fibras largas.</p>' +
        '</div>' +
      '</div>'
    );
  }

  function renderBodySVG() {
    return (
      '<svg viewBox="0 0 376 545" preserveAspectRatio="xMidYMid meet">' +
        '<defs>' +
          '<linearGradient id="dfe-body-skin" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#1A2540"/>' +
            '<stop offset="1" stop-color="#0E1A30"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<path d="' + BODY_PATH + '" fill="url(#dfe-body-skin)"/>' +
        '<g style="opacity:0.55">' +
          '<path d="M 188 150 Q 178 155, 168 162 Q 148 172, 130 185" fill="none" stroke="#54B0DD" stroke-width="2.2" stroke-linecap="round"/>' +
          '<path d="M 188 150 Q 198 155, 208 162 Q 228 172, 246 185" fill="none" stroke="#54B0DD" stroke-width="2.2" stroke-linecap="round"/>' +
          '<path d="M 130 185 Q 122 220, 120 250 Q 118 280, 124 305" fill="none" stroke="#54B0DD" stroke-width="2" stroke-linecap="round"/>' +
          '<path d="M 246 185 Q 254 220, 256 250 Q 258 280, 252 305" fill="none" stroke="#54B0DD" stroke-width="2" stroke-linecap="round"/>' +
          '<path d="M 188 160 L 188 300" fill="none" stroke="#54B0DD" stroke-width="2.4" stroke-linecap="round"/>' +
          '<path d="M 188 300 Q 178 320, 174 360 Q 170 410, 170 460 Q 170 480, 172 500" fill="none" stroke="#54B0DD" stroke-width="2" stroke-linecap="round"/>' +
          '<path d="M 188 300 Q 198 320, 202 360 Q 206 410, 206 460 Q 206 480, 204 500" fill="none" stroke="#54B0DD" stroke-width="2" stroke-linecap="round"/>' +
        '</g>' +
        '<g transform="translate(188, 168)">' +
          '<path d="M 0 4 C -8 -6, -22 -4, -22 6 C -22 18, 0 32, 0 32 C 0 32, 22 18, 22 6 C 22 -4, 8 -6, 0 4 Z" fill="#DA453A" opacity="0.85" transform="scale(0.7)"/>' +
        '</g>' +
        '<g><rect x="108" y="190" width="36" height="42" rx="5" fill="#0B1424"/><rect x="111" y="193" width="30" height="3" fill="#fff" opacity="0.4"/><rect x="111" y="226" width="30" height="3" fill="#fff" opacity="0.25"/><text x="126" y="216" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" fill="white" letter-spacing="0.05em">DER</text></g>' +
        '<g><rect x="232" y="190" width="36" height="42" rx="5" fill="#0B1424"/><rect x="235" y="193" width="30" height="3" fill="#fff" opacity="0.4"/><rect x="235" y="226" width="30" height="3" fill="#fff" opacity="0.25"/><text x="250" y="216" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" fill="white" letter-spacing="0.05em">IZQ</text></g>' +
        '<g><rect x="156" y="470" width="32" height="34" rx="4" fill="#0B1424"/><rect x="159" y="472" width="26" height="3" fill="#fff" opacity="0.4"/><text x="172" y="491" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700" fill="white" letter-spacing="0.05em">DER</text></g>' +
        '<g><rect x="188" y="470" width="32" height="34" rx="4" fill="#0B1424"/><rect x="191" y="472" width="26" height="3" fill="#fff" opacity="0.4"/><text x="204" y="491" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700" fill="white" letter-spacing="0.05em">IZQ</text></g>' +
      '</svg>'
    );
  }

  function renderITBHTML() {
    const itb = state.itb || {};
    const vR = itb.vR || 'DP';
    const vL = itb.vL || 'DP';
    const armRef = Math.max(itb.armR || 0, itb.armL || 0);
    const ankleR = Math.max(itb.dpR || 0, itb.tpR || 0);
    const ankleL = Math.max(itb.dpL || 0, itb.tpL || 0);
    const itbR = armRef && ankleR ? ankleR / armRef : null;
    const itbL = armRef && ankleL ? ankleL / armRef : null;
    const iR = interpret(itbR);
    const iL = interpret(itbL);
    const keyR = matchKey(itbR);
    const keyL = matchKey(itbL);
    const fmt = v => v == null ? '—' : v.toFixed(2);
    const num = v => v == null ? '' : v;

    const armBoxR =
      '<div class="dfe-bp" style="top: 184px; left: -10px;">' +
        '<div class="lbl">Brazo der · sistólica</div>' +
        '<div style="display:flex; align-items:baseline; gap:4px;">' +
          '<input type="number" inputmode="numeric" placeholder="—" data-itb-field="armR" value="' + num(itb.armR) + '">' +
          '<span class="unit">mmHg</span>' +
        '</div>' +
      '</div>';
    const armBoxL =
      '<div class="dfe-bp" style="top: 184px; right: -10px;">' +
        '<div class="lbl">Brazo izq · sistólica</div>' +
        '<div style="display:flex; align-items:baseline; gap:4px;">' +
          '<input type="number" inputmode="numeric" placeholder="—" data-itb-field="armL" value="' + num(itb.armL) + '">' +
          '<span class="unit">mmHg</span>' +
        '</div>' +
      '</div>';
    const ankleBoxR =
      '<div class="dfe-bp" style="top: 432px; left: -10px;">' +
        '<div class="lbl"><span>Tobillo der</span>' +
          '<span class="sw">' +
            '<button type="button" data-itb-vessel-side="R" data-itb-vessel="DP" class="' + (vR === 'DP' ? 'on' : '') + '">DP</button>' +
            '<button type="button" data-itb-vessel-side="R" data-itb-vessel="TP" class="' + (vR === 'TP' ? 'on' : '') + '">TP</button>' +
          '</span>' +
        '</div>' +
        '<div style="display:flex; align-items:baseline; gap:4px;">' +
          '<input type="number" inputmode="numeric" placeholder="—" data-itb-field="' + (vR === 'DP' ? 'dpR' : 'tpR') + '" value="' + num(vR === 'DP' ? itb.dpR : itb.tpR) + '">' +
          '<span class="unit">mmHg</span>' +
        '</div>' +
        '<div class="meta">DP ' + (itb.dpR != null ? itb.dpR : '—') + ' · TP ' + (itb.tpR != null ? itb.tpR : '—') + '</div>' +
      '</div>';
    const ankleBoxL =
      '<div class="dfe-bp" style="top: 432px; right: -10px;">' +
        '<div class="lbl"><span>Tobillo izq</span>' +
          '<span class="sw">' +
            '<button type="button" data-itb-vessel-side="L" data-itb-vessel="DP" class="' + (vL === 'DP' ? 'on' : '') + '">DP</button>' +
            '<button type="button" data-itb-vessel-side="L" data-itb-vessel="TP" class="' + (vL === 'TP' ? 'on' : '') + '">TP</button>' +
          '</span>' +
        '</div>' +
        '<div style="display:flex; align-items:baseline; gap:4px;">' +
          '<input type="number" inputmode="numeric" placeholder="—" data-itb-field="' + (vL === 'DP' ? 'dpL' : 'tpL') + '" value="' + num(vL === 'DP' ? itb.dpL : itb.tpL) + '">' +
          '<span class="unit">mmHg</span>' +
        '</div>' +
        '<div class="meta">DP ' + (itb.dpL != null ? itb.dpL : '—') + ' · TP ' + (itb.tpL != null ? itb.tpL : '—') + '</div>' +
      '</div>';

    const armRefBox = '<div class="dfe-itb-armref">Brazo ref · ' + (armRef || '—') + ' mmHg</div>';

    const keyRows = KEY_RANGES.map((r, i) => {
      const active = (i === keyR || i === keyL) ? 'active' : '';
      return '<div class="row ' + r.cls + ' ' + active + '"><span class="rng">' + r.rng + '</span><span class="nm">' + r.nm + '</span><span class="pip"></span></div>';
    }).join('');

    return (
      '<div class="dfe-itb">' +
        '<div class="dfe-itb-body">' +
          renderBodySVG() +
          armBoxR + armBoxL + ankleBoxR + ankleBoxL + armRefBox +
        '</div>' +
        '<div class="dfe-itb-result">' +
          '<div class="dfe-itb-card">' +
            '<div class="side"><b>ITB Derecho</b><span class="v ' + (itbR == null ? 'placeholder' : '') + '">' + fmt(itbR) + '</span></div>' +
            '<div class="interp ' + iR.cls + '"><span class="dot"></span>' + iR.label + '</div>' +
            '<div class="formula">max(DP ' + (itb.dpR != null ? itb.dpR : '—') + ', TP ' + (itb.tpR != null ? itb.tpR : '—') + ') ÷ ' + (armRef || '—') + ' = ' + fmt(itbR) + '</div>' +
            (iR.note && itbR != null ? '<div class="note">' + esc(iR.note) + '</div>' : '') +
          '</div>' +
          '<div class="dfe-itb-card">' +
            '<div class="side"><b>ITB Izquierdo</b><span class="v ' + (itbL == null ? 'placeholder' : '') + '">' + fmt(itbL) + '</span></div>' +
            '<div class="interp ' + iL.cls + '"><span class="dot"></span>' + iL.label + '</div>' +
            '<div class="formula">max(DP ' + (itb.dpL != null ? itb.dpL : '—') + ', TP ' + (itb.tpL != null ? itb.tpL : '—') + ') ÷ ' + (armRef || '—') + ' = ' + fmt(itbL) + '</div>' +
            (iL.note && itbL != null ? '<div class="note">' + esc(iL.note) + '</div>' : '') +
          '</div>' +
          '<div class="dfe-itb-key">' +
            '<h4>Interpretación del ITB</h4>' + keyRows +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="dfe-ref">' +
        '<div class="dfe-ref-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div>' +
        '<div>' +
          '<div class="dfe-ref-eye">Técnica · Índice Tobillo-Brazo</div>' +
          '<h4>Doppler portátil + esfigmomanómetro</h4>' +
          '<p>Medir presión sistólica en ambos brazos (referencia: la más alta) y en ambos tobillos por arteria pedia (DP) y tibial posterior (TP). ITB = presión sistólica de tobillo ÷ presión sistólica de brazo de referencia.</p>' +
        '</div>' +
      '</div>'
    );
  }

  function renderStepBody(step) {
    if (hasInteractive(step, 'itb')) return renderITBHTML();
    let html = '';
    if (step.substeps) html += renderSubstepsHTML(step);
    if (hasInteractive(step, 'vib')) html += renderVibHTML();
    if (hasInteractive(step, 'mono')) html += renderMonoHTML(step);
    if (step.reference) {
      html +=
        '<div class="dfe-ref">' +
          '<div class="dfe-ref-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div>' +
          '<div>' +
            '<div class="dfe-ref-eye">' + esc(step.reference.eye) + '</div>' +
            '<h4>' + esc(step.reference.title) + '</h4>' +
            '<p>' + esc(step.reference.body) + '</p>' +
          '</div>' +
        '</div>';
    }
    return html;
  }

  function renderStepHTML(step) {
    const st = stepStatus(step);
    const cls = ['dfe-step'];
    if (openStepId === step.id) cls.push('is-open');
    if (st.touched) cls.push('is-touched');
    if (st.alarm) cls.push('is-alarm');
    const statusLabel = st.alarm ? 'Hallazgo' : (st.touched ? 'Completo' : 'Pendiente');
    const statusCls = st.alarm ? 'alarm' : (st.touched ? 'ok' : '');

    return (
      '<div class="' + cls.join(' ') + '" data-step="' + step.id + '">' +
        '<button type="button" class="dfe-step-head" data-action="toggle">' +
          '<span class="dfe-step-num">' + step.num + '</span>' +
          '<span class="dfe-step-titles">' +
            '<span class="dfe-step-eye">' + esc(step.eyebrow) + '</span>' +
            '<span class="dfe-step-title">' + esc(step.title) + '</span>' +
          '</span>' +
          '<span class="dfe-step-status ' + statusCls + '">' + statusLabel + '</span>' +
          '<span class="dfe-step-chev"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>' +
        '</button>' +
        '<div class="dfe-step-body">' +
          '<div class="dfe-step-subtitle">' + esc(step.subtitle) +
          (step.alarm ? '<div><span class="dfe-step-alarm-tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Alarma: ' + esc(step.alarm) + '</span></div>' : '') +
          '</div>' +
          renderStepBody(step) +
        '</div>' +
      '</div>'
    );
  }

  // ─── Findings collector ────────────────────────────────────────────────
  function collectFindings() {
    const out = [];
    STEPS.forEach(step => {
      if (!step.substeps) return;
      step.substeps.forEach(sub => {
        const v = state.sub[step.id + '.' + sub.id];
        if (v && v.status === 'abnormal') {
          const scoreTxt = (step.scale && v.score != null)
            ? ' — ' + (step.scale.short ? step.scale.short + ' ' : '') + v.score + (step.scale.unit || '')
            : '';
          out.push({
            src: step.title.replace(/^Reflejos.*/, 'Reflejos'),
            txt: sub.id + '. ' + sub.name + scoreTxt + (v.note ? ' — ' + v.note : ''),
            severity: step.id === 'plantar' ? 'crit' : 'alarm'
          });
        }
      });
    });
    const vibMissR = VIB_POINTS.filter(p => state.vib['R-' + p.id] === 'miss').length;
    const vibMissL = VIB_POINTS.filter(p => state.vib['L-' + p.id] === 'miss').length;
    if (vibMissR > 0) out.push({ src: 'Vibración', txt: 'Falla en ' + vibMissR + '/' + VIB_POINTS.length + ' puntos del pie derecho — disminución de sensibilidad vibratoria.', severity: 'alarm' });
    if (vibMissL > 0) out.push({ src: 'Vibración', txt: 'Falla en ' + vibMissL + '/' + VIB_POINTS.length + ' puntos del pie izquierdo — disminución de sensibilidad vibratoria.', severity: 'alarm' });

    const missR = FOOT_POINTS.filter(p => state.mono['R-' + p.id] === 'miss').length;
    const missL = FOOT_POINTS.filter(p => state.mono['L-' + p.id] === 'miss').length;
    if (missR >= 4) out.push({ src: 'Monofilamento', txt: 'Falla en ' + missR + '/10 puntos del pie derecho — neuropatía probable de fibras largas.', severity: 'alarm', action: 'Educación en autocuidado podológico. Considerar electromiografía.' });
    if (missL >= 4) out.push({ src: 'Monofilamento', txt: 'Falla en ' + missL + '/10 puntos del pie izquierdo — neuropatía probable de fibras largas.', severity: 'alarm', action: 'Educación en autocuidado podológico. Considerar electromiografía.' });

    const itb = state.itb || {};
    const armRef = Math.max(itb.armR || 0, itb.armL || 0);
    const ankleR = Math.max(itb.dpR || 0, itb.tpR || 0);
    const ankleL = Math.max(itb.dpL || 0, itb.tpL || 0);
    const itbR = armRef && ankleR ? ankleR / armRef : null;
    const itbL = armRef && ankleL ? ankleL / armRef : null;
    if (itbR != null) {
      const iR = interpret(itbR);
      if (iR.cls === 'crit') out.push({ src: 'ITB', txt: 'ITB derecho ' + itbR.toFixed(2) + ' — ' + iR.label + '.', severity: 'alarm', action: iR.note });
      else if (iR.cls === 'warn') out.push({ src: 'ITB', txt: 'ITB derecho ' + itbR.toFixed(2) + ' — ' + iR.label + '.', severity: 'warn', action: iR.note });
    }
    if (itbL != null) {
      const iL = interpret(itbL);
      if (iL.cls === 'crit') out.push({ src: 'ITB', txt: 'ITB izquierdo ' + itbL.toFixed(2) + ' — ' + iL.label + '.', severity: 'alarm', action: iL.note });
      else if (iL.cls === 'warn') out.push({ src: 'ITB', txt: 'ITB izquierdo ' + itbL.toFixed(2) + ' — ' + iL.label + '.', severity: 'warn', action: iL.note });
    }
    return out;
  }

  // ─── Summary tiles ─────────────────────────────────────────────────────
  function buildVibTile() {
    const total = VIB_POINTS.length;
    const missR = VIB_POINTS.filter(p => state.vib['R-' + p.id] === 'miss').length;
    const missL = VIB_POINTS.filter(p => state.vib['L-' + p.id] === 'miss').length;
    const testedR = VIB_POINTS.filter(p => state.vib['R-' + p.id]).length;
    const testedL = VIB_POINTS.filter(p => state.vib['L-' + p.id]).length;
    const alarm = missR > 0 || missL > 0;
    const tested = testedR > 0 || testedL > 0;
    return {
      title: 'Vibración (diapasón 128 Hz)',
      det: tested ? ('Pie der: ' + (total - missR) + '/' + total + ' percibidos · Pie izq: ' + (total - missL) + '/' + total + ' percibidos') : 'Sin realizar.',
      pill: alarm ? 'alarm' : (tested ? 'ok' : ''),
      pillTxt: alarm ? 'Hipopalestesia' : (tested ? 'Normal' : 'Pendiente')
    };
  }

  function buildMonoTile() {
    const missR = FOOT_POINTS.filter(p => state.mono['R-' + p.id] === 'miss').length;
    const missL = FOOT_POINTS.filter(p => state.mono['L-' + p.id] === 'miss').length;
    const testedR = FOOT_POINTS.filter(p => state.mono['R-' + p.id]).length;
    const testedL = FOOT_POINTS.filter(p => state.mono['L-' + p.id]).length;
    const alarm = missR >= 4 || missL >= 4;
    const tested = testedR > 0 || testedL > 0;
    return {
      title: 'Monofilamento',
      det: tested ? ('Pie der: ' + (10 - missR) + '/10 percibidos · Pie izq: ' + (10 - missL) + '/10 percibidos') : 'Sin realizar.',
      pill: alarm ? 'alarm' : (tested ? 'ok' : ''),
      pillTxt: alarm ? 'Neuropatía probable' : (tested ? 'Normal' : 'Pendiente')
    };
  }

  function renderSummary() {
    const tiles = [];
    STEPS.forEach(s => {
      if (hasInteractive(s, 'itb')) {
        const itb = state.itb || {};
        const armRef = Math.max(itb.armR || 0, itb.armL || 0);
        const ankleR = Math.max(itb.dpR || 0, itb.tpR || 0);
        const ankleL = Math.max(itb.dpL || 0, itb.tpL || 0);
        const itbR = armRef && ankleR ? ankleR / armRef : null;
        const itbL = armRef && ankleL ? ankleL / armRef : null;
        const iR = interpret(itbR);
        const iL = interpret(itbL);
        const alarm = iR.cls === 'crit' || iL.cls === 'crit';
        const warn = iR.cls === 'warn' || iL.cls === 'warn';
        tiles.push({
          title: 'ITB',
          det: itbR != null && itbL != null
            ? ('ITB der ' + itbR.toFixed(2) + ' (' + iR.label + ') · ITB izq ' + itbL.toFixed(2) + ' (' + iL.label + ')')
            : 'Sin calcular.',
          pill: alarm ? 'alarm' : (warn ? 'warn' : (itbR != null ? 'ok' : '')),
          pillTxt: alarm ? 'EAOC probable' : (warn ? 'Vigilar' : (itbR != null ? 'Normal' : 'Pendiente'))
        });
        return;
      }
      if (s.substeps) {
        const subs = s.substeps;
        const abnormal = subs.filter(sub => (state.sub[s.id + '.' + sub.id] || {}).status === 'abnormal').map(sub => sub.name);
        const normalCount = subs.filter(sub => (state.sub[s.id + '.' + sub.id] || {}).status === 'normal').length;
        const tested = abnormal.length + normalCount;
        tiles.push({
          title: s.title.length > 28 ? s.title.slice(0, 28) + '…' : s.title,
          det: abnormal.length
            ? ('Hallazgo en: ' + abnormal.join(', '))
            : (tested ? (tested + '/' + subs.length + ' maniobras: todas normales') : 'Sin realizar.'),
          pill: abnormal.length ? 'alarm' : (tested ? 'ok' : ''),
          pillTxt: abnormal.length
            ? (abnormal.length + ' hallazgo' + (abnormal.length === 1 ? '' : 's'))
            : (tested ? 'Normal' : 'Pendiente')
        });
      }
      if (hasInteractive(s, 'vib')) tiles.push(buildVibTile());
      if (hasInteractive(s, 'mono')) tiles.push(buildMonoTile());
    });

    const html = tiles.map(t => (
      '<div class="dfe-summary-tile">' +
        '<div class="h"><b>' + esc(t.title) + '</b><span class="dfe-pill ' + t.pill + '">' + esc(t.pillTxt) + '</span></div>' +
        '<div class="det">' + esc(t.det) + '</div>' +
      '</div>'
    )).join('');

    const grid = document.getElementById('dfeSummaryGrid');
    if (grid) grid.innerHTML = html;

    const findings = collectFindings();
    const alarmCount = findings.filter(f => f.severity === 'alarm' || f.severity === 'crit').length;
    const conclusion = document.getElementById('dfeConclusion');
    if (conclusion) {
      const tone = alarmCount === 0
        ? 'Sin hallazgos de alarma — exploración dentro de límites normales.'
        : alarmCount === 1
          ? '1 hallazgo requiere atención.'
          : (alarmCount + ' hallazgos requieren atención.');
      conclusion.innerHTML =
        '<p><b>Conclusión y plan.</b> ' + esc(tone) + '</p>' +
        (findings.length
          ? '<ul>' + findings.slice(0, 6).map(f => (
              '<li><b>' + esc(f.src) + '.</b> ' + esc(f.txt) + (f.action ? ' — <i>' + esc(f.action) + '</i>' : '') + '</li>'
            )).join('') + '</ul>'
          : '');
    }

    const pill = document.getElementById('dfeSummaryPill');
    if (pill) {
      const counts = totalCounts();
      const allTouched = counts.filled === counts.total;
      let label = 'Pendiente'; let cls = '';
      if (alarmCount > 0) { label = alarmCount + ' hallazgo' + (alarmCount === 1 ? '' : 's'); cls = 'alarm'; }
      else if (allTouched && counts.total > 0) { label = 'Sin alarmas'; cls = 'ok'; }
      else if (counts.filled > 0) { label = counts.filled + '/' + counts.total + ' realizados'; cls = ''; }
      pill.className = 'dfe-pill ' + cls;
      pill.textContent = label;
    }
  }

  // ─── Render whole module ───────────────────────────────────────────────
  function renderSteps() {
    const container = document.getElementById('dfeSteps');
    if (!container) return;
    container.innerHTML = STEPS.map(renderStepHTML).join('');
  }

  function renderHeader() {
    const counts = totalCounts();
    const pct = counts.total === 0 ? 0 : Math.round((counts.filled / counts.total) * 100);
    const bar = document.getElementById('dfeProgressBar');
    const pctEl = document.getElementById('dfeProgressPct');
    if (bar) bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
    const alarmEl = document.getElementById('dfeAlarmsPill');
    const alarmTxt = document.getElementById('dfeAlarmsText');
    if (alarmEl && alarmTxt) {
      if (counts.alarms > 0) {
        alarmEl.classList.add('has-alarms');
        alarmEl.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
          '<span>' + counts.alarms + ' alarma' + (counts.alarms === 1 ? '' : 's') + '</span>';
      } else {
        alarmEl.classList.remove('has-alarms');
        alarmEl.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
          '<span>Sin alarmas</span>';
      }
    }
  }

  function persist() {
    const hidden = document.getElementById('consDFEState');
    if (!hidden) return;
    try { hidden.value = JSON.stringify(state); } catch (e) { hidden.value = ''; }
    // Trigger event so ConsultationDraft marks dirty and autosaves.
    hidden.dispatchEvent(new Event('input', { bubbles: true }));
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function refresh(opts) {
    opts = opts || {};
    renderHeader();
    renderSummary();
    if (!opts.skipSteps) renderSteps();
    persist();
  }

  // ─── Event delegation ──────────────────────────────────────────────────
  function bind() {
    const root = document.getElementById('dfeRoot');
    if (!root) return;

    root.addEventListener('click', e => {
      // Step toggle
      const head = e.target.closest('[data-action="toggle"]');
      if (head) {
        const stepEl = head.closest('.dfe-step');
        if (!stepEl) return;
        const stepId = stepEl.getAttribute('data-step');
        openStepId = (openStepId === stepId) ? null : stepId;
        renderSteps();
        return;
      }
      // Tri-state status
      const triBtn = e.target.closest('[data-action="status"]');
      if (triBtn) {
        const sub = triBtn.closest('.dfe-sub');
        const key = sub && sub.getAttribute('data-key');
        if (!key) return;
        const want = triBtn.getAttribute('data-value');
        const cur = (state.sub[key] && state.sub[key].status) || 'untested';
        const next = cur === want ? 'untested' : want;
        const patch = { status: next };
        if (want === 'skip') patch.score = null;
        state.sub[key] = Object.assign({}, state.sub[key], patch);
        refresh();
        return;
      }
      // Scale (e.g., MRC 0-5) — sets score + derived status
      const scaleBtn = e.target.closest('[data-action="scale"]');
      if (scaleBtn) {
        const sub = scaleBtn.closest('.dfe-sub');
        const key = sub && sub.getAttribute('data-key');
        if (!key) return;
        const stepId = key.split('.')[0];
        const step = STEPS.find(s => s.id === stepId);
        if (!step || !step.scale) return;
        const want = scaleBtn.getAttribute('data-value');
        const curScore = state.sub[key] && state.sub[key].score;
        if (String(curScore) === String(want)) {
          state.sub[key] = Object.assign({}, state.sub[key], { score: null, status: 'untested' });
        } else {
          const isNormal = want === step.scale.normalValue;
          state.sub[key] = Object.assign({}, state.sub[key], {
            score: want,
            status: isNormal ? 'normal' : 'abnormal'
          });
        }
        refresh();
        return;
      }
      // Vibration cycle (svg)
      const vibPt = e.target.closest('.dfe-vib-pt');
      if (vibPt) {
        const key = vibPt.getAttribute('data-key');
        const cur = state.vib[key] || 'untested';
        const next = cur === 'untested' ? 'ok' : (cur === 'ok' ? 'miss' : 'untested');
        state.vib[key] = next;
        refresh();
        return;
      }
      // Vibration side mini-buttons
      const vibBtn = e.target.closest('[data-vib-key]');
      if (vibBtn) {
        const key = vibBtn.getAttribute('data-vib-key');
        const val = vibBtn.getAttribute('data-vib-value');
        const cur = state.vib[key] || 'untested';
        state.vib[key] = cur === val ? 'untested' : val;
        refresh();
        return;
      }
      // Monofilament cycle (svg)
      const monoPt = e.target.closest('.dfe-mono-pt');
      if (monoPt) {
        const key = monoPt.getAttribute('data-key');
        const cur = state.mono[key] || 'untested';
        const next = cur === 'untested' ? 'ok' : (cur === 'ok' ? 'miss' : 'untested');
        state.mono[key] = next;
        refresh();
        return;
      }
      // Monofilament side mini-buttons
      const monoBtn = e.target.closest('[data-mono-key]');
      if (monoBtn) {
        const key = monoBtn.getAttribute('data-mono-key');
        const val = monoBtn.getAttribute('data-mono-value');
        const cur = state.mono[key] || 'untested';
        state.mono[key] = cur === val ? 'untested' : val;
        refresh();
        return;
      }
      // ITB vessel toggle
      const vessel = e.target.closest('[data-itb-vessel]');
      if (vessel) {
        const side = vessel.getAttribute('data-itb-vessel-side');
        const v = vessel.getAttribute('data-itb-vessel');
        state.itb = state.itb || {};
        if (side === 'R') state.itb.vR = v;
        else state.itb.vL = v;
        refresh();
        return;
      }
    });

    // Inputs (notes + ITB numeric fields)
    root.addEventListener('input', e => {
      const ta = e.target.closest('[data-action="note"]');
      if (ta) {
        const sub = ta.closest('.dfe-sub');
        const key = sub && sub.getAttribute('data-key');
        if (!key) return;
        state.sub[key] = Object.assign({}, state.sub[key], { note: ta.value });
        // Don't full-rerender; only persist + summary
        refresh({ skipSteps: true });
        return;
      }
      const itbField = e.target.closest('[data-itb-field]');
      if (itbField) {
        const field = itbField.getAttribute('data-itb-field');
        const raw = itbField.value.trim();
        const num = raw === '' ? null : Number(raw);
        state.itb = state.itb || {};
        state.itb[field] = (raw === '' || isNaN(num)) ? null : num;
        refresh({ skipSteps: true });
        return;
      }
    });
  }

  // ─── Public API ────────────────────────────────────────────────────────
  function init() {
    if (mounted) return;
    if (!document.getElementById('dfeRoot')) return;
    mounted = true;
    bind();
    refresh();
  }

  function getState() {
    return JSON.parse(JSON.stringify(state));
  }

  function setState(s) {
    if (!s || typeof s !== 'object') return;
    state = {
      sub:  (s.sub && typeof s.sub === 'object') ? s.sub : {},
      mono: (s.mono && typeof s.mono === 'object') ? s.mono : {},
      vib:  (s.vib && typeof s.vib === 'object') ? s.vib : {},
      itb:  Object.assign({ vR: 'DP', vL: 'DP' }, (s.itb && typeof s.itb === 'object') ? s.itb : {})
    };
    refresh();
  }

  function reset() {
    state = blankState();
    openStepId = null;
    refresh();
  }

  window.DiabeticFootExam = { init: init, getState: getState, setState: setState, reset: reset };

  // Auto-init when DOM is ready (idempotent).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
