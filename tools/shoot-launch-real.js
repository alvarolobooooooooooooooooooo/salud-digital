/* Captura pantallas REALES de la plataforma para el corredor del launch.
   Antes esas dos secciones estaban reconstruidas a mano y no se parecían
   a la aplicación; esto fotografía la aplicación de verdad, en oscuro y
   autenticado, y le pega encima la barra de ventana del film para que el
   panel encaje con los demás.

   node tools/shoot-launch-real.js --probe        → /tmp/sd-real (revisar)
   node tools/shoot-launch-real.js                → public/launch/frames  */
require('dotenv').config({ quiet: true });
const fs = require('fs'), path = require('path'), jwt = require('jsonwebtoken');
const puppeteer = require('puppeteer-core');
const { execFileSync } = require('child_process');

const SECRET = process.env.JWT_SECRET;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:3000';
const DPR = 1.5, W = 1440, BODY = 880, CHROME_H = 40;
const MW = 430, MBODY = 860;   // variante vertical
const PROBE = process.argv.includes('--probe');
const OUT = PROBE ? '/tmp/sd-real' : path.join(__dirname, '..', 'public', 'launch', 'frames');

/* Clínica 15, "Podología Vista Hermosa (Demo)": está sembrada a propósito
   para demostraciones (68 pacientes, 154 consultas) y NO tiene pacientes
   reales. La clínica 1 se descartó porque su lista es basura de pruebas
   —"Alvaro" repetido ocho veces— y la 5 es una clínica real: sus datos no
   salen en ningún vídeo. */
const USER = { id: 42, email: 'demo.podologa@portalsaluddigital.com', role: 'doctor', clinic_id: 15 };
const PATIENT = 391;   // Gabriela Alvarenga Nájera · 6 consultas
const mint = (u) => jwt.sign({ id: u.id, email: u.email, role: u.role, clinic_id: u.clinic_id },
  SECRET, { expiresIn: '2h' });

async function auth(page, user) {
  const t = mint(user);
  await page.evaluateOnNewDocument((tok, role) => {
    try {
      localStorage.setItem('sd_token', tok);
      localStorage.setItem('sd_role', role);
      localStorage.setItem('sd_theme', 'dark');       // el film es oscuro
      localStorage.setItem('sd_theme_pref', 'dark');
    } catch (e) {}
  }, t, user.role);
  await page.setCookie({ name: 'sd_token', value: t, domain: 'localhost', path: '/' });
}

async function chromeBar(browser, urlText, width) {
  const p = await browser.newPage();
  await p.setViewport({ width: width || W, height: CHROME_H, deviceScaleFactor: DPR });
  await p.setContent(`<style>
    html,body{margin:0;background:#0b0c0e}
    .b{height:${CHROME_H}px;display:flex;align-items:center;gap:7px;padding:0 16px;
       border-bottom:1px solid rgba(255,255,255,.045);background:#0c0d10;
       font-family:Poppins,-apple-system,sans-serif}
    .d{width:9px;height:9px;border-radius:50%}
    .u{margin-left:14px;display:inline-flex;align-items:center;gap:6px;font-size:11px;
       color:#64748b;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.045);
       padding:4px 12px;border-radius:999px}
    svg{color:#06b6d4}
  </style><div class="b"><span class="d" style="background:#ff5f57"></span>
    <span class="d" style="background:#febc2e"></span><span class="d" style="background:#28c840"></span>
    <span class="u"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
      stroke-width="1.9"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/></svg>${urlText}</span></div>`,
    { waitUntil: 'load' });
  const buf = await p.screenshot({ type: 'png' });
  await p.close();
  return buf;
}

/* Las tres secciones del corredor que ahora salen de la aplicación real.
   Se descartó clinical-record.html: su tema oscuro está roto —el nombre
   del paciente sale blanco sobre blanco— y eso en un vídeo de lanzamiento
   se lee como un fallo, no como el producto. */
const SHOTS = [
  // con un paciente elegido: el panel derecho vacío no cuenta nada
  { name: 'pacientes', url: '/patients.html', label: 'portalsaluddigital.com/patients.html',
    settle: 4200, pick: true },
  { name: 'citas', url: '/citas.html', label: 'portalsaluddigital.com/citas.html', settle: 2500,
    // el calendario está listo cuando tiene citas dentro
    ready: 'document.querySelectorAll(\'[class*="cal"] [class*="chip"],[class*="cal"] [class*="event"],[class*="cal"] [class*="cita"]\').length > 3' },
  { name: 'finanzas', url: '/finanzas.html', label: 'portalsaluddigital.com/finanzas.html', settle: 2500,
    // las cifras están cuando alguna deja de ser 0,00
    ready: '/L\\.\\s*[1-9]/.test(document.body.innerText)' },
];

(async () => {
  if (!SECRET) { console.error('Falta JWT_SECRET en .env'); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--force-color-profile=srgb', '--font-render-hinting=none'] });

  for (const V of [{ k: '', w: W, h: BODY }, { k: 'm-', w: MW, h: MBODY }])
  for (const s of SHOTS) {
    const p = await b.newPage();
    await p.setViewport({ width: V.w, height: V.h, deviceScaleFactor: DPR,
      isMobile: V.k === 'm-', hasTouch: V.k === 'm-' });
    await auth(p, USER);
    const url = BASE + s.url + (s.needsPatient ? '?id=' + PATIENT : '');
    await p.goto(url, { waitUntil: 'networkidle2', timeout: 40000 });
    await p.evaluate(() => document.querySelectorAll('.sdl-overlay').forEach((e) => e.remove()));
    /* Esperar a que los DATOS estén, no a un temporizador: con un settle
       fijo las capturas salían con "L. 0.00" y "Cargando…", que es lo peor
       que puede enseñar un vídeo de lanzamiento. */
    try {
      await p.waitForFunction(s.ready || '!/Cargando|Cargando\\.\\.\\./.test(document.body.innerText)',
        { timeout: 25000, polling: 400 });
    } catch (e) { console.log('   (aviso: ' + s.name + ' no confirmó carga, se captura igual)'); }
    await new Promise((r) => setTimeout(r, s.settle));
    // En vertical NO se elige paciente: la app navega a la ficha y la
    // captura salía en "Cargando paciente…". La cola de pacientes es
    // además lo que un móvil enseña de verdad.
    if (s.pick && V.k !== 'm-') {
      await p.evaluate(() => {
        document.querySelectorAll('.sdl-overlay').forEach((e) => e.remove());
        const c = document.querySelector('.patient-card');
        if (c) c.click();
      });
      await new Promise((r) => setTimeout(r, 3000));
    }
    await p.evaluate(() => {
      /* El muro legal se RETIRA del DOM, no se acepta: aceptarlo dejaría
         una firma en la base de producción a nombre de una cuenta real.
         Para una captura basta con quitarlo de la vista. */
      document.querySelectorAll('.sdl-overlay').forEach((e) => e.remove());
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      // El aviso de solo lectura es de la cuenta de demostración (sin
      // suscripción), no del producto: fuera de la foto.
      document.querySelectorAll('[class*="readonly"],[id*="readonly"],[class*="sd-readonly"]')
        .forEach((e) => e.remove());
      const l = document.getElementById('pageLoader'); if (l) l.style.display = 'none';
      window.scrollTo(0, 0);
    });
    await new Promise((r) => setTimeout(r, 400));
    const body = '/tmp/_body_' + V.k + s.name + '.png';
    await p.screenshot({ path: body });
    await p.close();

    const bar = '/tmp/_bar_' + V.k + s.name + '.png';
    fs.writeFileSync(bar, await chromeBar(b, s.label, V.w));
    const out = path.join(OUT, V.k + s.name + (PROBE ? '.png' : '.webp'));
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', bar, '-i', body,
      '-filter_complex', '[0][1]vstack=2', ...(PROBE ? [] : ['-quality', '92']), out]);
    console.log('· ' + V.k + s.name + '  →  ' + out + '  (' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB)');
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
