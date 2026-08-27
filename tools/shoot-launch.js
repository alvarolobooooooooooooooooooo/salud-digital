/* Banco de pruebas del launch: congela el film en instantes concretos y
   guarda un fotograma de cada uno. Como render(t) es puro, lo que sale
   aquí es exactamente lo que verá el navegador en ese segundo.
   Uso:  node tools/shoot-launch.js [--mobile] [--out DIR] [--t 12.4] */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const args = process.argv.slice(2);
const has = (f) => args.indexOf(f) >= 0;
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const MOBILE = has('--mobile');
const OUT = path.resolve(val('--out', '/tmp/sd-launch'));
const ONE = val('--t', null);

const SHOTS = ONE ? [[parseFloat(ONE), 'frame-' + ONE]] : [
  [0.9, '01-vacio'],
  [4.4, '02a-convergencia'],
  [5.45, '02b-logo'],
  [7.6, '03-ecosistema'],
  [10.5, '04a-morph'],
  [11.9, '04b-dashboard'],
  [13.45, '05a-rampa'],
  [14.65, '05b-ultra'],
  [18.3, '06a-macro'],
  [19.1, '06b-confirmada'],
  [20.5, '07-flujo'],
  [22.75, '08a-tablet'],
  [23.85, '08b-movil'],
  [26.0, '09-heroe'],
  [29.3, '10-cta'],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--force-color-profile=srgb', '--enable-gpu', '--font-render-hinting=none'],
  });
  const p = await b.newPage();
  await p.setViewport(MOBILE
    ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { width: 1600, height: 1000, deviceScaleFactor: 2 });
  p.on('console', (m) => { if (m.type() === 'error') console.log('  [console]', m.text()); });
  p.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await p.goto('http://127.0.0.1:3000/launch.html?tier=' + (MOBILE ? 'med' : 'high') + '', { waitUntil: 'networkidle2', timeout: 30000 });
  // Esperar a que main.js haya ARRANCADO el film antes de pausarlo: si se
  // pausa antes, el arranque diferido lo vuelve a poner en marcha y se
  // acaba fotografiando un instante que no es el pedido.
  await p.waitForFunction('window.LX && window.LX.Engine && window.LX.Engine.playing === true', { timeout: 20000 });
  await p.evaluate(() => window.LX.Engine.pause());
  await new Promise((r) => setTimeout(r, 400));

  for (const [t, name] of SHOTS) {
    await p.evaluate((tt) => {
      window.LX.Engine.seek(tt);
      window.LX.Engine.render(tt, true);
    }, t);
    await new Promise((r) => setTimeout(r, 260));
    const file = path.join(OUT, (MOBILE ? 'm-' : '') + name + '.png');
    await p.screenshot({ path: file });
    console.log('·', name, t + 's');
  }

  // Medición de fps reproduciendo de verdad, no en pausa.
  const perf = await p.evaluate(() => new Promise((res) => {
    const E = window.LX.Engine;
    E.seek(0); E.play();
    const marks = []; let last = performance.now();
    const seen = {};
    function tick() {
      const now = performance.now();
      marks.push(now - last); last = now;
      const t = E.time;
      const key = t < 6 ? 'intro' : t < 9.2 ? 'eco' : t < 12.3 ? 'dash' : t < 15.7 ? 'rampa' : t < 18.5 ? 'macro' : t < 20.9 ? 'flujo' : t < 23 ? 'dev' : 'hero';
      (seen[key] || (seen[key] = [])).push(now - last === 0 ? 16 : marks[marks.length - 1]);
      if (t < E.duration - 0.1) requestAnimationFrame(tick);
      else {
        const stat = (a) => { const s = a.slice().sort((x, y) => x - y); return { avg: (a.reduce((p, c) => p + c, 0) / a.length), p95: s[Math.floor(s.length * .95)] || 0 }; };
        const out = {};
        for (const k in seen) { const st = stat(seen[k]); out[k] = { fps: (1000 / st.avg).toFixed(1), worstMs: st.p95.toFixed(1) }; }
        res({ perScene: out, tier: window.LX.Quality.tier });
      }
    }
    requestAnimationFrame(tick);
  }));
  console.log('\nfps por tramo (' + perf.tier + '):');
  Object.keys(perf.perScene).forEach((k) => console.log('  ' + k.padEnd(7), perf.perScene[k].fps + ' fps', ' peor frame ' + perf.perScene[k].worstMs + 'ms'));
  await b.close();
  console.log('\n→', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
