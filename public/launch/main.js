/* ═══════════════════════════════════════════════════════════════════
   launch/main.js — Arranque
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const LX = window.LX;
  const { Engine, Quality, clamp } = LX;

  /* Grano de película: 128×128 de ruido monocromo generado una vez y
     usado como textura repetida. Ver la nota en launch.css. */
  function grainTexture() {
    const N = 128;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const x = c.getContext('2d');
    const img = x.createImageData(N, N);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      // El ruido lleva su propio alfa. Con píxeles opacos haría falta un
      // background-blend-mode, y mezclar a pantalla completa cuesta más
      // que el grano entero.
      const v = Math.random();
      d[i] = d[i + 1] = d[i + 2] = v > 0.5 ? 255 : 0;
      d[i + 3] = Math.random() * 7;
    }
    x.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }

  /* Modo captura (?capture=inicio&mobile=1): monta UNA sección plana, a
     escala 1, sin film ni cámara, para que el generador de fotogramas la
     fotografíe. No forma parte de la experiencia. */
  function captureMode(name) {
    const q = new URLSearchParams(location.search);
    const mob = q.has('mobile');
    document.documentElement.setAttribute('data-lx-mobile', mob ? '1' : '0');
    if (q.has('tab')) document.documentElement.setAttribute('data-lx-tab', '1');
    document.documentElement.setAttribute('data-lx-tier', 'high');
    const titles = { inicio: 'Inicio', pacientes: 'Pacientes', citas: 'Citas',
      expediente: 'Expediente', personal: 'Personal', finanzas: 'Finanzas' };
    const paths = { inicio: '', pacientes: 'patients.html', citas: 'citas.html',
      expediente: 'expediente', personal: 'doctors.html', finanzas: 'finanzas.html' };
    const host = document.createElement('div');
    host.id = 'lx-cap';
    host.innerHTML = LX.UI.frame(titles[name] || 'Inicio', LX.UI[name](), { path: paths[name] || '' });
    document.body.appendChild(host);
    // Estado FINAL de las animaciones: la captura tiene que enseñar la
    // interfaz ya cargada, no a medio contar.
    const root = host;
    const vals = { pac: '428', hoy: '6', pac2: '428', hoy2: '6', ing: 'L. 84,250', donut: '6' };
    [].forEach.call(root.querySelectorAll('[data-count]'), (c) => {
      if (vals[c.dataset.count]) c.textContent = vals[c.dataset.count];
    });
    [].forEach.call(root.querySelectorAll('[data-bar]'), (b) => { b.style.width = b.dataset.bar + '%'; });
    const arc = root.querySelector('.lx-donut-arc');
    if (arc) arc.style.strokeDashoffset = (502.65 * 0.014).toFixed(1);
    const line = root.querySelector('.lx-spark-line');
    if (line) { line.style.strokeDasharray = 'none'; line.style.strokeDashoffset = '0'; }
    const fill = root.querySelector('.lx-spark-fill');
    if (fill) fill.style.opacity = '1';
    window.__lxCaptureReady = true;
  }

  function boot() {
    Quality.init();
    const params = new URLSearchParams(location.search);
    const cap = params.get('capture');
    if (cap) return captureMode(cap);
    // Modo render: fuera la barra de progreso y los controles, que no son
    // parte del film sino de la página.
    if (params.has('render')) document.documentElement.classList.add('lx-render');
    /* El grano va al FONDO, no encima: como superposición era una mezcla
       de pantalla completa en cada frame, y ahí es donde se veían los
       últimos milisegundos que separaban 30 de 60 fps. Detrás sigue
       cumpliendo su función (matar el banding de los degradados) y se
       compone una sola vez. */
    const bg = document.getElementById('lx-bg');
    if (bg && !Quality.reduced && Quality.tier !== 'low') {
      const tex = grainTexture();
      bg.style.backgroundImage = 'url(' + tex + '), ' + getComputedStyle(bg).backgroundImage;
      bg.style.backgroundRepeat = 'repeat, no-repeat, no-repeat, no-repeat';
    }
    document.documentElement.setAttribute('data-lx-mobile', Quality.mobile ? '1' : '0');
    if (Quality.reduced) document.documentElement.classList.add('lx-reduced');

    LX.measure();
    LX.FX.init(document.getElementById('lx-fx-back'), document.getElementById('lx-fx-front'));
    LX.Film.build();
    // El sonido se engancha DESPUÉS del film: necesita la pista de cámara
    // ya montada para poder derivar de ella sus propios tiempos.
    if (LX.SFX) LX.SFX.init();

    const bar = document.querySelector('.lx-progress i');
    const ctrl = document.getElementById('lx-ctrl');
    const btnReplay = document.getElementById('lx-replay');
    const btnSkip = document.getElementById('lx-skip');

    LX.on('frame', (t) => {
      if (bar) bar.style.width = ((t / Engine.duration) * 100).toFixed(2) + '%';
    });
    LX.on('cue', (name) => { if (LX.debugOn) console.log('%c♪ cue', 'color:#22d3ee', name); });

    // Los controles aparecen solos: al llegar al reposo y al mover el ratón.
    let hideT = 0;
    function flash() {
      ctrl.classList.add('show');
      clearTimeout(hideT);
      hideT = setTimeout(() => { if (!document.documentElement.classList.contains('lx-rest')) ctrl.classList.remove('show'); }, 2400);
    }
    window.addEventListener('mousemove', flash, { passive: true });
    LX.on('frame', () => { if (document.documentElement.classList.contains('lx-rest')) ctrl.classList.add('show'); });

    btnReplay.addEventListener('click', () => {
      document.documentElement.classList.remove('lx-rest');
      Engine.restart();
    });
    btnSkip.addEventListener('click', () => Engine.seek(LX.Film.T.cta + 0.6));

    window.addEventListener('resize', () => {
      LX.measure();
      LX.FX.resize();
      Engine.render(Engine.time, true);
    }, { passive: true });

    document.addEventListener('keydown', (e) => {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); Engine.toggle(); }
      else if (e.code === 'ArrowRight') Engine.seek(Engine.time + (e.shiftKey ? 1 : 0.2));
      else if (e.code === 'ArrowLeft') Engine.seek(Engine.time - (e.shiftKey ? 1 : 0.2));
      else if (e.key === 'r' || e.key === 'R') { document.documentElement.classList.remove('lx-rest'); Engine.restart(); }
      else if (e.key === 'd' || e.key === 'D') LX.Debug.toggle();
      else if (e.key >= '1' && e.key <= '9') {
        const s = Engine.scenes[parseInt(e.key, 10) - 1];
        if (s) Engine.seek(s.start);
      }
    });

    // Primer fotograma antes de nada, para que no haya un salto al iniciar.
    Engine.render(0, true);

    if (Quality.reduced) {
      // Sin movimiento: se entrega el mensaje, no el viaje.
      Engine.seek(LX.Film.T.cta + 0.8);
      document.documentElement.classList.add('lx-rest');
      ctrl.classList.add('show');
    } else {
      const start = () => { Engine.seek(0); Engine.play(); };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(start, 90));
      else setTimeout(start, 220);
      // Si la pestaña no está visible, no se malgasta el arranque.
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && Engine.playing) { Engine.pause(); Engine._resume = true; }
        else if (!document.hidden && Engine._resume) { Engine._resume = false; Engine.play(); }
      });
    }

    LX.Debug.init(new URLSearchParams(location.search).has('debug'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
