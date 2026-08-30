// ── audit-responsive.js — busca contenido recortado y desbordes horizontales ──
//
// Carga páginas autenticadas de la demo (clínica 15) a varios anchos y reporta:
//   · PAGE OVERFLOW → la página entera scrollea en horizontal
//   · SE SALE       → un elemento pasa del borde derecho del viewport
//   · RECORTADO     → un contenedor con overflow:hidden está cortando a un hijo
//
// Ignora lo que se corta A PROPÓSITO: text-overflow:ellipsis, adornos
// absolutos/pointer-events:none, y todo lo que cuelga de algo fijo o
// transformado (cajones off-canvas).
//
// El modo del sidebar importa: expandido le quita 278px a la columna de
// contenido sin que cambie el viewport, y ahí es donde se rompen las cosas.
//
//   node tools/audit-responsive.js --pages dashboard.html,citas.html \
//        --widths 1440,1122,900,390 --sidebar both [--shots]
//
// Requiere el server local levantado (npm start) y Chrome instalado.
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const puppeteer = require('puppeteer-core');

const SECRET = process.env.JWT_SECRET;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:3000';
const OUT = process.env.AUDIT_OUT || '/tmp/sd-responsive';
fs.mkdirSync(OUT, { recursive: true });

// clínica 15 — Podología Vista Hermosa (Demo)
const USER = { id: 42, email: 'demo.podologa@portalsaluddigital.com', role: 'doctor', clinic_id: 15 };
const token = jwt.sign({ id: USER.id, email: USER.email, role: USER.role, clinic_id: USER.clinic_id }, SECRET, { expiresIn: '2h' });

const arg = (k, d) => { const i = process.argv.indexOf(k); return i !== -1 ? process.argv[i + 1] : d; };
const PAGES = (arg('--pages', 'dashboard.html')).split(',');
const WIDTHS = (arg('--widths', '1440,1280,1180,1122,1024,900,768,390')).split(',').map(Number);
const EXPANDED = arg('--sidebar', 'expanded'); // expanded | collapsed | both
const SHOT = process.argv.includes('--shots');

const PROBE = () => {
  const out = { pageOverflow: null, clipped: [], escaping: [] };
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw + 1) {
    out.pageOverflow = { scrollWidth: document.documentElement.scrollWidth, clientWidth: vw };
  }
  const label = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.');
    const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 45);
    return s + (t ? ` \u00ab${t}\u00bb` : '');
  };
  const all = Array.from(document.querySelectorAll('body *'));
  const info = new Map();
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') { info.set(el, null); continue; }
    const r = el.getBoundingClientRect();
    info.set(el, { cs, r, clipsX: cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.overflowX === 'auto' || cs.overflowX === 'scroll' });
  }
  const worst = new Map(); // clipper -> {over, who}
  for (const el of all) {
    const i = info.get(el);
    if (!i || i.r.width === 0 || i.r.height === 0) continue;
    const { cs, r } = i;
    if (cs.position === 'absolute' || cs.position === 'fixed') continue;
    if (cs.textOverflow === 'ellipsis') continue;
    if (cs.pointerEvents === 'none') continue;
    // ancestro que recorta más cercano (sin cruzar contextos posicionados raros)
    let anc = el.parentElement, guard = 0;
    while (anc && anc !== document.body && guard++ < 40) {
      const ai = info.get(anc);
      if (ai && ai.clipsX) {
        if ((ai.cs.overflowX === 'hidden' || ai.cs.overflowX === 'clip') && ai.cs.textOverflow !== 'ellipsis') {
          const limit = ai.r.left + anc.clientWidth + 2;
          const over = Math.round(r.right - limit);
          if (over > 2) {
            const prev = worst.get(anc);
            if (!prev || over > prev.over) worst.set(anc, { over, who: el });
          }
        }
        break; // el primer contenedor que recorta manda
      }
      const acs = ai && ai.cs;
      if (acs && (acs.position === 'absolute' || acs.position === 'fixed')) break;
      anc = anc.parentElement;
    }
    // se sale del viewport
    if (r.right > vw + 2) {
      let hidden = false;
      for (let a2 = el.parentElement, g = 0; a2 && g++ < 40; a2 = a2.parentElement) {
        const ai = info.get(a2);
        if (!ai) { hidden = true; break; }
        if (ai.cs.position === 'fixed' || ai.cs.transform !== 'none' || ai.clipsX) { hidden = true; break; }
      }
      if (!hidden) out.escaping.push({ el: label(el), right: Math.round(r.right), vw });
    }
  }
  out.clipped = Array.from(worst.entries())
    .map(([el, v]) => ({ el: label(el), over: v.over, by: label(v.who) }))
    .sort((a, b) => b.over - a.over).slice(0, 10);
  out.escaping = out.escaping.slice(0, 6);
  return out;
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true, protocolTimeout: 180000,
    args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb'],
  });
  const modes = EXPANDED === 'both' ? ['expanded', 'collapsed'] : [EXPANDED];
  for (const pg of PAGES) {
    for (const mode of modes) {
      for (const w of WIDTHS) {
        const page = await browser.newPage();
        page.on('dialog', async (d) => { console.log(`   [dialog ${d.type()}] ${d.message().slice(0, 90)}`); try { await d.dismiss(); } catch (_) {} });
        await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1 });
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
        await page.evaluateOnNewDocument((tok, role, exp) => {
          try {
            localStorage.setItem('sd_token', tok);
            localStorage.setItem('sd_role', role);
            localStorage.setItem('sd_sidebar_expanded', exp);
          } catch (_) {}
        }, token, USER.role, mode === 'expanded' ? 'true' : 'false');
        await page.setCookie({ name: 'sd_token', value: token, domain: 'localhost', path: '/', httpOnly: true });
        try {
          await page.goto(BASE + '/' + pg, { waitUntil: 'networkidle2', timeout: 45000 });
        } catch (e) { /* sigue */ }
        await new Promise((r) => setTimeout(r, 2500));
        // quitar muros que tapan (nunca aceptarlos)
        await page.evaluate(() => {
          document.querySelectorAll('.sdl-overlay').forEach((n) => n.remove());
        });
        await new Promise((r) => setTimeout(r, 400));
        const res = await page.evaluate(PROBE);
        const tag = `${pg} @${w} ${mode}`;
        const bad = res.pageOverflow || res.clipped.length || res.escaping.length;
        console.log(`\n── ${tag} ${bad ? '✗' : '✓'}`);
        if (res.pageOverflow) console.log(`   PAGE OVERFLOW: scroll ${res.pageOverflow.scrollWidth} > ${res.pageOverflow.clientWidth}`);
        res.escaping.forEach((e) => console.log(`   SE SALE  right=${e.right}/${e.vw}  ${e.el}`));
        res.clipped.forEach((c) => console.log(`   RECORTADO -${c.over}px  ${c.el}${c.by ? '   <- ' + c.by : ''}`));
        if (SHOT) {
          const f = path.join(OUT, `${pg.replace(/\W+/g, '_')}-${w}-${mode}.png`);
          await page.screenshot({ path: f });
        }
        await page.close();
      }
    }
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
