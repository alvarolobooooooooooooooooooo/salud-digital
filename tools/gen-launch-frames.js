/* Genera las capturas del corredor del launch.
   Cada sección se monta plana (?capture=…), se fotografía a 2× y se guarda
   como WebP en public/launch/frames/. El corredor vuela sobre esas texturas:
   una imagen no se re-rasteriza al cambiarle la escala, y ahí estaba el
   coste que hundía los fps.
   Uso: node tools/gen-launch-frames.js   (con el server en :3000) */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(__dirname, '..', 'public', 'launch', 'frames');
/* Solo el Inicio: las otras tres secciones del corredor salen de la
   aplicación real, con tools/shoot-launch-real.js. */
const SECS = ['inicio'];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--force-color-profile=srgb', '--font-render-hinting=none'],
  });
  let total = 0;
  /* Tres proporciones reales del producto. La tablet solo hace falta para
     el Inicio, que es lo que se enseña en la escena de dispositivos. */
  const VARIANTS = [
    { key: '', mobile: false, tab: false, w: 1520, h: 1020, secs: SECS },
    { key: 't-', mobile: false, tab: true, w: 900, h: 1120, secs: ['inicio'] },
    { key: 'm-', mobile: true, tab: false, w: 520, h: 1000, secs: SECS },
  ];
  for (const V of VARIANTS) {
    const mobile = V.mobile;
    for (const sec of V.secs) {
      const p = await b.newPage();
      await p.setViewport({
        width: V.w, height: V.h,
        /* 1,5× basta: la captura solo se ve en movimiento (parado manda
           el DOM vivo), y a 2× la textura pesa el doble de ancho de banda
           justo en la escena más cara del film. */
        deviceScaleFactor: 1.5,
      });
      await p.goto('http://127.0.0.1:3000/launch.html?capture=' + sec +
        (mobile ? '&mobile=1' : '') + (V.tab ? '&tab=1' : ''),
        { waitUntil: 'networkidle2', timeout: 30000 });
      await p.waitForFunction('window.__lxCaptureReady === true', { timeout: 15000 });
      if (p.evaluateHandle) await p.evaluate(() => document.fonts.ready);
      await new Promise((r) => setTimeout(r, 350));
      const elh = await p.$('#lx-cap .lx-app');
      const file = path.join(OUT, V.key + sec + '.webp');
      await elh.screenshot({ path: file, type: 'webp', quality: 92, omitBackground: false });
      const kb = (fs.statSync(file).size / 1024).toFixed(0);
      total += Number(kb);
      console.log('·', (V.key === 't-' ? 'tablet ' : V.key === 'm-' ? 'móvil  ' : 'escrit.'), sec.padEnd(11), kb + ' KB');
      await p.close();
    }
  }
  await b.close();
  console.log('\ntotal ' + total + ' KB →', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
