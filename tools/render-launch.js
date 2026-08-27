/* Renderiza el launch a un MP4, fotograma a fotograma.
   Se puede porque render(t) es una función PURA del tiempo: el fotograma
   número n es siempre el mismo, así que no hay que grabar la pantalla en
   tiempo real ni preocuparse por fps perdidos. Sale a 60 fps limpios
   aunque la máquina vaya lenta.

   Uso: node tools/render-launch.js [--out ruta.mp4] [--fps 60] [--h 1080]
        [--ss 2] [--vertical]        (--ss = supermuestreo: renderiza a
                                      ss× y reduce, para texto más nítido)
   Requiere el server en :3000 y `npm i --no-save puppeteer-core`. */
const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2);
const has = (f) => args.indexOf(f) >= 0;
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };

const FPS = Number(val('--fps', 60));
const VERTICAL = has('--vertical');
const H = Number(val('--h', VERTICAL ? 1920 : 1080));
const W = VERTICAL ? Math.round(H * 9 / 16) : Math.round(H * 16 / 9);
const SS = Number(val('--ss', 1.5));
const OUT = path.resolve(val('--out', path.join(__dirname, '..', '..', 'launch' + (VERTICAL ? '-vertical' : '') + '.mp4')));

(async () => {
  const t0 = Date.now();
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--force-color-profile=srgb', '--font-render-hinting=none',
           '--disable-lcd-text', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: SS });
  page.on('pageerror', (e) => console.error('  [error]', e.message));
  await page.goto('http://127.0.0.1:3000/launch.html?render=1&tier=high', { waitUntil: 'networkidle2', timeout: 40000 });

  // Esperar a que el film ARRANQUE (main.js lo lanza tras cargar las
  // fuentes) y solo entonces pausarlo: si se pausa antes, el arranque
  // diferido lo vuelve a poner en marcha.
  await page.waitForFunction('window.LX && window.LX.Engine && window.LX.Engine.playing === true', { timeout: 30000 });
  await page.evaluate(() => window.LX.Engine.pause());
  // Que las capturas del corredor estén descodificadas antes de empezar.
  await page.evaluate(() => Promise.all(
    [].slice.call(document.images).filter((i) => i.decode).map((i) => i.decode().catch(() => {}))
  ));
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 600));

  let duration = await page.evaluate(() => window.LX.Film.T.end + 0.6);
  if (val('--secs', null)) duration = Number(val('--secs'));
  const total = Math.round(duration * FPS);
  console.log('Renderizando ' + total + ' fotogramas · ' + W + '×' + H +
    ' @ ' + FPS + 'fps · supermuestreo ' + SS + '×\n→ ' + OUT + '\n');

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const ff = spawn('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-vf', 'scale=' + W + ':' + H + ':flags=lanczos',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    OUT,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  let done = 0;
  for (let i = 0; i < total; i++) {
    const t = i / FPS;
    await page.evaluate((tt) => { window.LX.Engine.render(tt, true); }, t);
    const buf = await page.screenshot({ type: 'png', optimizeForSpeed: true });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    done++;
    if (done % 60 === 0 || done === total) {
      const pct = ((done / total) * 100).toFixed(0);
      const el = (Date.now() - t0) / 1000;
      const eta = el / done * (total - done);
      process.stdout.write('\r  ' + pct.padStart(3) + '%  ' + done + '/' + total +
        '  ·  ' + el.toFixed(0) + 's transcurridos, ~' + eta.toFixed(0) + 's restantes   ');
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();

  const mb = (fs.statSync(OUT).size / 1048576).toFixed(1);
  console.log('\n\nListo · ' + mb + ' MB · ' + (duration).toFixed(1) + 's · ' +
    ((Date.now() - t0) / 1000).toFixed(0) + 's de render');
  console.log(OUT);
})().catch((e) => { console.error(e); process.exit(1); });
