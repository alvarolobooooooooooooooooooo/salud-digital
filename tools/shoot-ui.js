// ── shoot-ui.js — capture real-platform screenshots for the launch film ──
// Renders authenticated pages in LIGHT mode at 1600×1000 @2x (→3200×2000)
// to match launch-video/public/ui/*.png. Uses the system Chrome via
// puppeteer-core and a minted JWT (no jti → skips the session check).
//
//   node tools/shoot-ui.js            # → /tmp/sd-shots (staging, review first)
//   node tools/shoot-ui.js --out launch-video/public/ui   # write final
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const puppeteer = require('puppeteer-core');

const SECRET = process.env.JWT_SECRET;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.SHOOT_BASE || 'http://localhost:3000';

const outArg = process.argv.indexOf('--out');
const OUT = outArg !== -1 ? path.resolve(process.argv[outArg + 1]) : '/tmp/sd-shots';
fs.mkdirSync(OUT, { recursive: true });

const onlyArg = process.argv.indexOf('--only');
const ONLY = onlyArg !== -1 ? process.argv[onlyArg + 1].split(',') : null;

const mint = (u) =>
  jwt.sign({ id: u.id, email: u.email, role: u.role, clinic_id: u.clinic_id }, SECRET, { expiresIn: '2h' });

// clinic 1 (Clinica Norte) demo accounts + records
const USERS = {
  admin: { id: 2, email: 'admin@clinicanorte.com', role: 'clinic_admin', clinic_id: 1 },
  orto: { id: 27, email: 'orto@clinicanorte.com', role: 'doctor', clinic_id: 1 },
  nutri: { id: 24, email: 'dra.nutricion@clinicanorte.com', role: 'doctor', clinic_id: 1 },
};

const SHOTS = [
  { name: 'facturacion', url: '/facturacion.html', user: USERS.admin, settle: 3500 },
  { name: 'ortodoncia', url: '/consultation-orthodontics.html?view=78', user: USERS.orto, settle: 4000 },
  { name: 'nutricion', url: '/consultation-nutrition.html?id=72', user: USERS.nutri, settle: 4000 },
  // Variant: orthodontics with the arch diagram expanded + scrolled into the frame.
  {
    name: 'ortodoncia-diagram',
    url: '/consultation-orthodontics.html?view=78',
    user: USERS.orto,
    settle: 3000,
    prep: async (page) => {
      // Expand "Diagrama Ortodóncico" (group idx 1), collapse Anamnesis (idx 0).
      await page.evaluate(() => {
        const grp = (i) => document.querySelector(`.pod-group[data-group-idx="${i}"]`);
        const g1 = grp(1);
        if (g1 && g1.classList.contains('is-collapsed')) g1.click();
        const g0 = grp(0);
        if (g0 && !g0.classList.contains('is-collapsed')) g0.click();
      });
      await new Promise((r) => setTimeout(r, 2500));
      // Bring the diagram frame to the top of the content viewport.
      await page.evaluate(() => {
        const f = document.getElementById('ortoFrame');
        if (f) {
          const wrap = f.closest('.form-section') || f;
          const y = wrap.getBoundingClientRect().top + window.scrollY - 96;
          window.scrollTo(0, Math.max(0, y));
        }
      });
      await new Promise((r) => setTimeout(r, 1500));
    },
  },
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb'],
    defaultViewport: { width: 1600, height: 1000, deviceScaleFactor: 2 },
  });

  for (const s of SHOTS) {
    if (ONLY && !ONLY.includes(s.name)) continue;
    const page = await browser.newPage();
    const token = mint(s.user);
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await page.evaluateOnNewDocument((tok, role) => {
      try {
        localStorage.setItem('sd_theme', 'light');
        localStorage.setItem('sd_token', tok);
        localStorage.setItem('sd_role', role);
      } catch (_) {}
    }, token, s.user.role);
    await page.setCookie({ name: 'sd_token', value: token, domain: 'localhost', path: '/', httpOnly: true });
    try {
      await page.goto(BASE + s.url, { waitUntil: 'networkidle2', timeout: 60000 });
    } catch (e) {
      console.warn(`  (${s.name}) navigation warning: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, s.settle));
    if (s.prep) {
      try { await s.prep(page); } catch (e) { console.warn(`  (${s.name}) prep warning: ${e.message}`); }
    }
    const file = path.join(OUT, `${s.name}.png`);
    await page.screenshot({ path: file, type: 'png' });
    console.log('✓', s.name, '→', file);
    await page.close();
  }

  await browser.close();
  console.log('done →', OUT);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
