/* Hoja de señales del launch: los instantes EXACTOS en que suena cada
   SFX, derivados de la pista de cámara real (no escritos a mano).
   Es lo que necesita quien diseñe el sonido para trabajar contra el vídeo.

   Uso: node tools/sfx-cuesheet.js  [--json]      (server en :3000) */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(__dirname, '..', 'public', 'audio', 'sfx', 'cuesheet.txt');

const SCENE_OF = (t, T) =>
  t < T.logo ? '01 vacío' : t < T.eco ? '02 logotipo' : t < T.dash ? '03 ecosistema' :
  t < T.speed ? '04 interfaz' : t < T.macro ? '05 rampa' : t < T.flow ? '06 macro' :
  t < T.dev ? '07 flujo' : t < T.whip ? '08 dispositivos' : t < T.final ? '09 héroe' : '10 cierre';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
  await p.goto('http://127.0.0.1:3000/launch.html?tier=high', { waitUntil: 'networkidle2' });
  await p.waitForFunction('window.LX && window.LX.SFX && window.LX.SFX.schedule.length > 0', { timeout: 20000 });
  const d = await p.evaluate(() => ({
    T: window.LX.Film.T,
    duration: window.LX.Engine.duration,
    schedule: window.LX.SFX.schedule,
    registry: window.LX.SFX.registry(),
    categories: window.LX.SFX.categories(),
    master: 0.9,
    // Velocidad de cámara a 60 Hz: la mezcla fuera de línea necesita la
    // misma curva que hace respirar a la cama del flujo de datos.
    velocity: (() => {
      const E = window.LX.Engine, out = [];
      const wasT = E.time;
      for (let i = 0; i <= Math.round(E.duration * 60); i++) {
        E.render(i / 60, true);
        out.push(+window.LX.vel.norm.toFixed(3));
      }
      E.render(wasT, true);
      return out;
    })(),
    passes: window.LX.SFX.analysis.passes.map((x) => ({ t: +x.t.toFixed(3), mag: Math.round(x.mag) })),
    brake: { t: +window.LX.SFX.analysis.brake.t.toFixed(3) },
    peakMax: Math.round(window.LX.SFX.analysis.peakMax),
  }));
  await b.close();

  if (process.argv.indexOf('--json') >= 0) {
    console.log(JSON.stringify(d, null, 1));
    return;
  }
  const L = [];
  L.push('HOJA DE SEÑALES — Launch de Salud Digital');
  L.push('Duración del film: ' + d.duration.toFixed(2) + ' s · derivada de la implementación, no escrita a mano.');
  L.push('Regenerar con: node tools/sfx-cuesheet.js');
  L.push('');
  L.push('  TIEMPO   ESCENA            SFX                    NIVEL  TONO   NOTA');
  L.push('  ' + '-'.repeat(78));
  d.schedule.forEach((c) => {
    const nota = c.bed === 'start' ? 'inicia cama (loop)' : c.bed === 'stop' ? 'cierra cama' : '';
    L.push('  ' + (c.t.toFixed(2) + 's').padStart(7) + '   ' +
      SCENE_OF(c.t, d.T).padEnd(16) + '  ' + c.sfx.padEnd(22) +
      (c.gain != null ? c.gain.toFixed(2) : '1.00').padStart(5) + '  ' +
      (c.rate != null ? c.rate.toFixed(2) : '1.00').padStart(5) + '  ' + nota);
  });
  L.push('');
  L.push('PASES RÁPIDOS DE LA RAMPA (velocidad medida de la cámara; pico del tramo = ' + d.peakMax + ')');
  d.passes.forEach((x, i) => L.push('  pase ' + (i + 1) + ':  ' + x.t.toFixed(2) + 's   velocidad ' + x.mag +
    '   (' + Math.round(x.mag / d.peakMax * 100) + '% del pico)'));
  L.push('  frenazo: ' + d.brake.t.toFixed(2) + 's');
  L.push('');
  L.push('El nivel y el tono de cada pase salen de su velocidad real, así que');
  L.push('los cuatro suenan parecidos pero no idénticos: el sonido sigue a la cámara.');
  const txt = L.join('\n') + '\n';
  fs.writeFileSync(OUT, txt);
  console.log(txt);
  console.log('→ ' + OUT);
})().catch((e) => { console.error(e); process.exit(1); });
