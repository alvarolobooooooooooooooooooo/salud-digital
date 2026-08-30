/* Capturas señaladas para /tutoriales.html
   ────────────────────────────────────────────────────────────────────────────
   Fotografía la aplicación REAL y le dibuja encima el círculo numerado sobre el
   botón del que habla cada paso. El número del círculo es el número del paso en
   la guía, así que si se reordena un `pasos`, hay que ajustar aquí las `marcas`
   y volver a correr esto.

   Por qué la aplicación real y no un dibujo: una captura reconstruida a mano
   envejece mal y enseña una pantalla que no existe. Esto se regenera en un
   minuto cada vez que la interfaz cambie.

   QUÉ CUENTA SALE EN LAS FOTOS. La clínica 15, `Podología Vista Hermosa (Demo)`:
   sembrada a propósito, identidades y teléfonos `9999-…` sintéticos. La 5 es una
   clínica REAL y sus pacientes no salen en ninguna imagen. Igual que en
   tools/shoot-launch-real.js, el JWT se firma SIN `jti` para saltarse la
   comprobación de `user_sessions`, y los dos muros (el legal y el aviso de solo
   lectura) se quitan del DOM: aceptarlos dejaría rastro en la base de verdad.

   Uso:
     node tools/shoot-tutoriales.js --probe     → /tmp/sd-tut (revisar a ojo)
     node tools/shoot-tutoriales.js             → public/tutoriales/
     node tools/shoot-tutoriales.js crear-paciente   (solo esa)
   ──────────────────────────────────────────────────────────────────────────── */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const puppeteer = require('puppeteer-core');
const { execFileSync } = require('child_process');

const SECRET = process.env.JWT_SECRET;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://localhost:3000';
const PROBE = process.argv.includes('--probe');
const SOLO = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const OUT = PROBE ? '/tmp/sd-tut' : path.join(__dirname, '..', 'public', 'tutoriales');

const USER = { id: 42, email: 'demo.podologa@portalsaluddigital.com', role: 'doctor', clinic_id: 15 };
const PACIENTE = 391; // Gabriela Alvarenga Nájera (demo) · 6 consultas

// Ancho final de la imagen en píxeles. Se captura al doble y se reduce: en
// pantallas normales entra nítida y pesa un tercio.
const ANCHO_FINAL = 1100;

/* ── Un texto de ejemplo limpio en el cuadro del mensaje ───────────────────
   La plantilla sembrada de la clínica demo trae `\n\n` literales (los escapes
   se guardaron como texto), y una foto de tutorial no puede enseñar eso. Se
   escribe SOLO en el cuadro y se dispara `input` para que se repinte la vista
   previa: no se llama a ninguna API, no se guarda nada. */
const ESCRIBIR = (id, texto) =>
  `(() => { const t = document.getElementById('${id}');
            t.value = ${JSON.stringify(texto)};
            t.dispatchEvent(new Event('input', { bubbles: true })); })()`;

const EJEMPLO_RECORDATORIO =
  'Hola {{patientName}} \uD83D\uDC4B\n\n' +
  'Le recordamos su cita en {{clinicName}} con {{doctorName}}.\n\n' +
  '\uD83D\uDDD3\uFE0F {{appointmentDate}}\n' +
  '\uD83D\uDD50 {{appointmentTime}}\n' +
  '\uD83D\uDCCD {{clinicAddress}}\n\n' +
  'Si no puede asistir, avísenos por este mismo medio.';

const EJEMPLO_CONFIRMACION =
  'Hola {{patientName}} \uD83D\uDC4B\n\n' +
  'Tiene cita en {{clinicName}} con {{doctorName}}:\n\n' +
  '\uD83D\uDDD3\uFE0F {{appointmentDate}}\n' +
  '\uD83D\uDD50 {{appointmentTime}}\n\n' +
  '¿Nos confirma si podrá asistir? Solo toque aquí:\n{{confirmLink}}';

/* ── Las tomas ───────────────────────────────────────────────────────────────
   id      → nombre del archivo y guía a la que pertenece
   url     → dónde
   listo   → expresión que debe ser cierta antes de tocar nada (datos cargados)
   prep    → código a ejecutar en la página (abrir un modal, cambiar de pestaña)
   zona    → qué se recorta (el modal, la tarjeta…)
   marcas  → [{ sel, n }] el círculo numerado sobre cada elemento
   alto    → recorte máximo desde arriba de la zona, para no fotografiar
             media pantalla vacía                                              */
const TOMAS = [
  {
    id: 'crear-paciente-boton',
    url: '/patients.html',
    listo: 'document.querySelectorAll(".patient-card").length > 4',
    zona: '.patient-queue',
    alto: 560,
    marcas: [{ sel: '.btn-add-patient', n: 2, pos: 'izq' }],
  },
  {
    id: 'crear-paciente-modal',
    url: '/patients.html',
    listo: 'document.querySelectorAll(".patient-card").length > 2',
    prep: 'openModal()',
    zona: '#overlay .modal',
    marcas: [
      { sel: '#fName', n: 3 },
      { sel: '#fId', n: 4 },
      { sel: '#fPhone', n: 5 },
      { sel: '#createForm .btn-save', n: 7 },
    ],
  },
  {
    id: 'crear-paciente-recepcion',
    rol: 'receptionist',
    url: '/recepcion-citas.html',
    listo: '!!document.getElementById("btnSchedule")',
    prep: 'openApptModal()',
    zona: '#apptOverlay .modal',
    alto: 430,
    marcas: [{ sel: '.btn-add-patient-label', n: 3 }],
  },
  {
    id: 'crear-paciente-en-cita',
    url: '/citas.html',
    listo: '!!document.getElementById("btnNewAppointment")',
    prep: 'openModal()',
    zona: '#overlay .modal',
    alto: 430,
    marcas: [{ sel: '.btn-add-patient-label', n: 2 }],
  },
  {
    id: 'buscar-paciente',
    url: '/patients.html',
    listo: 'document.querySelectorAll(".patient-card").length > 4',
    zona: '.patient-queue',
    alto: 620,
    marcas: [
      { sel: '#searchInput', n: 1 },
      { sel: '.patient-card', n: 3, pos: 'izq' },
    ],
  },
  {
    id: 'editar-paciente',
    url: '/patient.html?id=' + PACIENTE,
    listo: 'document.getElementById("pPhone") && document.getElementById("pPhone").textContent.trim() !== "—"',
    zona: '.tabs-nav',
    alto: 560,
    marcas: [
      { sel: '.tabs-nav .tab-btn:nth-child(1)', n: 2, pos: 'izq' },
      { sel: '#editPersonalBtn', n: 3 },
    ],
  },
  {
    id: 'ficha-medica',
    url: '/patient.html?id=' + PACIENTE,
    listo: 'document.getElementById("mAllergies")',
    prep: 'document.querySelectorAll(".tab-btn")[1].click()',
    zona: '.tabs-nav',
    alto: 520,
    marcas: [
      { sel: '.tabs-nav .tab-btn:nth-child(2)', n: 2, pos: 'izq' },
      { sel: '[onclick="openMedicalEditModal()"]', n: 3 },
    ],
  },
  {
    id: 'migrar-pacientes',
    url: '/migracion.html',
    listo: 'document.querySelectorAll("#railIzq *").length > 3',
    zona: '.mg-page',
    alto: 560,
    marcas: [{ sel: '#btnPlantilla', n: 3 }],
  },
  {
    id: 'whatsapp-numero',
    ventanaAlto: 1300,
    url: '/recordatorios.html',
    listo: '!!document.getElementById("openConfigBtn")',
    prep: 'openConfigModal()',
    zona: '#configModal .modal',
    alto: 520,
    marcas: [
      { sel: '#waEnabledToggle', n: 3 },
      { sel: '#waNumber', n: 4 },
    ],
  },
  {
    id: 'plantilla-recordatorios',
    desde: 'label[for="waTemplate"]',
    ventanaAlto: 1560,
    url: '/recordatorios.html',
    listo: '!!document.getElementById("openConfigBtn")',
    prep: 'openConfigModal(); ' + ESCRIBIR('waTemplate', EJEMPLO_RECORDATORIO),
    zona: '#configModal .modal',
    marcas: [
      { sel: '#waTemplate', n: 2 },
      { sel: '.var-chips', n: 3 },
      { sel: '#templatePreview', n: 4 },
    ],
  },
  {
    id: 'plantilla-confirmaciones',
    desde: 'label[for="waTemplate"]',
    ventanaAlto: 1560,
    url: '/confirmaciones.html',
    listo: '!!document.getElementById("openConfigBtn")',
    prep: 'openConfigModal(); ' + ESCRIBIR('waTemplate', EJEMPLO_CONFIRMACION),
    zona: '#configModal .modal',
    marcas: [
      { sel: '#configModal [data-var="confirmLink"]', n: 3 },
      { sel: '#waTemplate', n: 2 },
    ],
  },
  {
    id: 'tarjeta-confirmacion',
    desde: 'label[for="cardTemplate"]',
    ventanaAlto: 1560,
    url: '/confirmaciones.html',
    listo: '!!document.getElementById("sendPendingBtn")',
    prep: 'openCardModal()',
    zona: '#cardModal .modal',
    marcas: [
      { sel: '#cardTemplate', n: 3 },
      { sel: '.card-preview', n: 5 },
    ],
  },
  {
    id: 'direccion-y-mapa',
    url: '/configuracion.html#location',
    listo: 'document.querySelector(\'[data-panel="location"]\')',
    prep: 'activateTab("location")',
    zona: '[data-panel="location"] .glass-card',
    alto: 720,
    marcas: [
      { sel: '#fldClinicAddress', n: 3 },
      { sel: '#locMapa, #locMap, .loc-map, [id*="locMap"]', n: 4, pos: 'izq' },
    ],
  },
];

/* ── Dibujo de las marcas, dentro de la página ─────────────────────────────── */
// Van con position:fixed y coordenadas de viewport: así el recorte y las marcas
// hablan el mismo idioma aunque el modal esté fijo y el fondo desplazado.
function pintarMarcas(marcas) {
  const estilo = document.createElement('style');
  estilo.textContent = `
    .sd-mk { position: fixed; z-index: 2147483000; pointer-events: none;
             border: 2.5px solid #06b6d4; border-radius: 11px;
             box-shadow: 0 0 0 4px rgba(6,182,212,.20), 0 0 0 1px rgba(255,255,255,.55) inset; }
    .sd-mk-n { position: fixed; z-index: 2147483001; pointer-events: none;
               width: 30px; height: 30px; border-radius: 50%;
               background: #0891b2; color: #fff; text-align: center;
               font: 800 15px/30px Poppins, -apple-system, sans-serif;
               box-shadow: 0 3px 10px rgba(8,145,178,.45), 0 0 0 3px #fff; }`;
  document.head.appendChild(estilo);

  const faltan = [];
  marcas.forEach((m) => {
    const el = document.querySelector(m.sel);
    if (!el) { faltan.push(m.sel); return; }
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) { faltan.push(m.sel + ' (sin tamaño)'); return; }

    const aro = document.createElement('div');
    aro.className = 'sd-mk';
    aro.style.left = (r.left - 5) + 'px';
    aro.style.top = (r.top - 5) + 'px';
    aro.style.width = (r.width + 10) + 'px';
    aro.style.height = (r.height + 10) + 'px';
    document.body.appendChild(aro);

    const num = document.createElement('div');
    num.className = 'sd-mk-n';
    num.textContent = m.n;
    // Esquina SUPERIOR DERECHA del aro. A la izquierda tapaba la etiqueta del
    // campo ("NOMBRE COMPLETO" salía "OMBRE COMPLETO"), y a la derecha de un
    // input a lo ancho casi siempre hay sitio libre. `pos` lo mueve a mano
    // cuando esa esquina está ocupada.
    const pos = m.pos || 'der';
    const x = pos === 'izq' ? r.left - 22 : r.right - 8;
    num.style.left = Math.max(6, Math.min(window.innerWidth - 36, x)) + 'px';
    num.style.top = Math.max(6, r.top - 20) + 'px';
    document.body.appendChild(num);
  });
  return faltan;
}

function limpiarMuros() {
  // El muro legal se RETIRA del DOM, nunca se acepta: aceptarlo dejaría una
  // firma en la base de producción a nombre de una cuenta real.
  document.querySelectorAll('.sdl-overlay, .sd-ro-bar, .sd-pw-scrim, .page-loader').forEach((e) => e.remove());
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
}

/* ── Captura ─────────────────────────────────────────────────────────────── */
async function capturar(browser, toma, tema) {
  const page = await browser.newPage();
  // Ventana alta a propósito en los modales largos: si no entran enteros, la
  // foto corta la vista previa, que es justo lo que la guía manda mirar.
  await page.setViewport({ width: 1440, height: toma.ventanaAlto || 1100, deviceScaleFactor: 2 });

  const rol = toma.rol || USER.role;
  const token = jwt.sign(
    { id: USER.id, email: USER.email, role: rol, clinic_id: USER.clinic_id },
    SECRET, { expiresIn: '2h' },
  );
  await page.evaluateOnNewDocument((tok, rol, th) => {
    try {
      localStorage.setItem('sd_token', tok);
      localStorage.setItem('sd_role', rol);
      localStorage.setItem('sd_theme', th);
      localStorage.setItem('sd_theme_pref', th);
    } catch (e) {}
  }, token, rol, tema);
  await page.setCookie({ name: 'sd_token', value: token, domain: 'localhost', path: '/' });

  await page.goto(BASE + toma.url, { waitUntil: 'networkidle2', timeout: 45000 });

  // Esperar a los DATOS, no a un temporizador: con un settle fijo las capturas
  // salen con "Cargando…" y listas vacías.
  try {
    await page.waitForFunction(toma.listo, { timeout: 20000, polling: 300 });
  } catch (e) {
    console.log(`   aviso: ${toma.id}/${tema} no confirmó carga`);
  }
  await page.evaluate(limpiarMuros);
  if (toma.prep) {
    await page.evaluate(toma.prep);
    await new Promise((r) => setTimeout(r, 700));
  }
  await new Promise((r) => setTimeout(r, 600));
  await page.evaluate(limpiarMuros);

  const faltan = await page.evaluate(pintarMarcas, toma.marcas);
  if (faltan.length) console.log(`   ojo: ${toma.id}/${tema} sin objetivo → ${faltan.join(', ')}`);

  const rect = await page.evaluate((sel, alto, desde) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const pad = 14;
    const arranque = desde ? document.querySelector(desde) : null;
    const x = Math.max(0, r.left - pad);
    const y = Math.max(0, (arranque ? arranque.getBoundingClientRect().top : r.top) - pad);
    return {
      x, y,
      width: Math.min(window.innerWidth - x, r.width + pad * 2),
      height: Math.min(window.innerHeight - y, alto ? alto : r.bottom + pad - y),
    };
  }, toma.zona, toma.alto, toma.desde);

  if (!rect) { console.log(`   ✗ ${toma.id}/${tema}: no existe la zona ${toma.zona}`); await page.close(); return null; }

  const tmp = `/tmp/_tut_${toma.id}_${tema}.png`;
  await page.screenshot({ path: tmp, clip: rect });
  await page.close();
  return tmp;
}

(async () => {
  if (!SECRET) { console.error('Falta JWT_SECRET en .env'); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--force-color-profile=srgb', '--font-render-hinting=none'],
  });

  const tomas = SOLO.length ? TOMAS.filter((t) => SOLO.includes(t.id)) : TOMAS;
  for (const toma of tomas) {
    for (const [tema, sufijo] of [['light', 'claro'], ['dark', 'oscuro']]) {
      const png = await capturar(browser, toma, tema);
      if (!png) continue;
      const destino = path.join(OUT, `${toma.id}-${sufijo}.${PROBE ? 'png' : 'webp'}`);
      if (PROBE) {
        fs.copyFileSync(png, destino);
      } else {
        // Reducido al ancho final y a WebP: la misma imagen pesa un tercio y
        // estas fotos se cargan dentro de una pantalla de la aplicación.
        execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png,
          '-vf', `scale='min(${ANCHO_FINAL},iw)':-2:flags=lanczos`,
          '-quality', '80', destino]);
      }
      console.log('✓', path.basename(destino));
    }
  }

  await browser.close();
  console.log('\nEn', OUT);
})();
