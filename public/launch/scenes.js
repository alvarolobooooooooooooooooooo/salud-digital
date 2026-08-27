/* ═══════════════════════════════════════════════════════════════════
   launch/scenes.js — El film: mundo, pista de cámara y 11 escenas
   ─────────────────────────────────────────────────────────────────
   Todo lo que se ve vive en UN espacio 3D y lo recorre UNA cámara.
   Las "transiciones" no son cortes: son tramos de la misma pista de
   keyframes. Por eso el corredor de secciones está colocado a
   profundidades reales y la rampa de velocidad es, literalmente, la
   curva con la que la cámara recorre esa Z.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const LX = window.LX;
  const { Engine, ease, clamp, lerp, inv, ramp, el } = LX;
  const UI = LX.UI;

  const M = LX.Quality.mobile;

  /* ── Geometría del mundo ──────────────────────────────────────── */
  /* Cuatro paradas y separación amplia: así casi siempre hay UNA sección
     en cuadro. Antes eran seis a 2200 y se solapaban tres, que es lo que
     obligaba a degradarlas — y una interfaz a medio dibujar se lee como
     un fallo, no como profundidad. */
  const SEC_Z = M ? [-760, -3100, -5440, -7780] : [-900, -3700, -6500, -9300];
  const MACRO_Z = M ? -9100 : -11400;
  const FLOW_Z = MACRO_Z - 1200;
  const DEV_Z = M ? -12300 : -16400;
  /* zEff a partir del cual la sección se retira. Es BAJO a propósito: un
     panel a punto de engullir la cámara se rasteriza a diez veces el
     tamaño de la pantalla (medido: 180 ms por frame). Retirándolo cuando
     apenas duplica el encuadre —y en pleno motion blur— no se nota nada
     y el coste desaparece. */
  const PASS = 260;

  /* Cuatro paradas. Solo el Inicio se reconstruye aquí: hace falta vivo
     para el revelado (contadores, donut, tarjetas). Las otras tres son
     CAPTURAS DE LA APLICACIÓN REAL —tools/shoot-launch-real.js— porque las
     versiones reconstruidas a mano no se parecían al producto. */
  const SECTIONS = [
    ['Inicio', 'inicio', ''],
    ['Pacientes', 'pacientes', 'patients.html', 'real'],
    ['Citas', 'citas', 'citas.html', 'real'],
    ['Finanzas', 'finanzas', 'finanzas.html', 'real'],
  ];

  /* ── Construcción del DOM del mundo ───────────────────────────── */
  const W = {};
  function build() {
    const world = document.getElementById('lx-world');
    W.world = world;
    Engine.world = world;
    Engine.stage = document.getElementById('lx-stage');

    /* Logotipo nítido — releva a las partículas en el instante exacto
       en que la forma queda definida (no es un fundido: las partículas
       siguen ahí, se apagan por dentro mientras el vector toma el filo). */
    W.logoLayer = el('div', 'lx-layer lx-logo-layer');
    W.logoLayer.innerHTML =
      '<div class="lx-logo-hold">' + UI.logoSVG(M ? 210 : 330) +
      '<div class="lx-logo-ring"></div></div>';
    world.appendChild(W.logoLayer);
    W.logoSvg = W.logoLayer.querySelector('svg');
    W.logoBlocks = [].slice.call(W.logoLayer.querySelectorAll('.lx-logo-blk'));
    W.logoRing = W.logoLayer.querySelector('.lx-logo-ring');

    /* Secciones reales del producto, colocadas en profundidad. */
    W.secs = SECTIONS.map((s, i) => {
      const d = el('div', 'lx-layer lx-sec');
      d.dataset.sec = s[1];
      d.style.setProperty('--z', SEC_Z[i] + 'px');
      const real = s[3] === 'real';
      if (real) {
        // Sin DOM: esta sección es la captura de la aplicación y nada más.
        d._real = true;
        d.classList.add('is-shot');
      } else {
        d.innerHTML = UI.frame(s[0], UI[s[1]](), { path: s[2] });
      }
      /* La captura de esta misma sección, generada por
         tools/gen-launch-frames.js. Vuela como textura; el DOM vivo solo
         entra cuando la cámara se para. */
      const shot = el('img', 'lx-shot');
      shot.decoding = 'async';
      shot.fetchPriority = 'high';
      shot.src = '/launch/frames/' + (M ? 'm-' : '') + s[1] + '.webp';
      shot.alt = '';
      /* Descodificar YA, no la primera vez que se vea: si no, la sección
         entra en cuadro y el hilo se para medio segundo a descomprimir
         un WebP de 2880×1840 justo en mitad de la rampa. */
      if (shot.decode) shot.decode().catch(function () {});
      d.appendChild(shot);
      world.appendChild(d);
      return { el: d, z: SEC_Z[i], name: s[0], inner: real ? null : d.firstChild };
    });
    W.inicio = W.secs[0];

    /* Tarjeta macro: una cita real a tamaño de lectura. Se para la
       cámara justo delante (zEff = 0 → escala 1) para que el texto sea
       nítido de verdad; el "macro" lo da la tipografía, no un zoom. */
    W.macro = el('div', 'lx-layer lx-macro');
    W.macro.style.setProperty('--z', MACRO_Z + 'px');
    W.macro.innerHTML =
      '<div class="lx-mcard">' +
        '<div class="lx-mcard-top"><span class="lx-mcard-kick">Confirmaciones</span>' +
        '<span class="lx-badge s-pending lx-mstatus"><i></i><span>Pendiente</span></span></div>' +
        '<div class="lx-mcard-main"><span class="lx-av xl">MF</span>' +
          '<div><h3>María Fernanda López</h3><p>Curación · 30 min · Consultorio 2</p></div>' +
          '<div class="lx-mcard-time"><b>10:00</b><span>Lunes 21 ago</span></div>' +
        '</div>' +
        '<div class="lx-mcard-rail">' +
          '<div class="lx-step done"><i></i><span>Agendada</span></div>' +
          '<div class="lx-step done"><i></i><span>Recordatorio enviado</span></div>' +
          '<div class="lx-step" data-step="3"><i></i><span>Confirmada</span></div>' +
        '</div>' +
        '<div class="lx-mcard-foot">' +
          '<div class="lx-mcard-kv"><span>Última visita</span><b>14 ago 2026</b></div>' +
          '<div class="lx-mcard-kv"><span>Consultas</span><b data-count="mc">0</b></div>' +
          '<div class="lx-mcard-kv"><span>Saldo</span><b>L. 0.00</b></div>' +
          '<button class="lx-mbtn"><span class="lx-mbtn-ink">Confirmar cita</span></button>' +
        '</div>' +
        '<div class="lx-toast"><span class="lx-toast-ic">' + UI.svg('check', 14, 2.6) + '</span>' +
        'Confirmación enviada por WhatsApp</div>' +
      '</div>';
    world.appendChild(W.macro);
    W.mStatus = W.macro.querySelector('.lx-mstatus');
    W.mStatusTxt = W.mStatus.querySelector('span');
    W.mBtn = W.macro.querySelector('.lx-mbtn');
    W.mStep3 = W.macro.querySelector('[data-step="3"]');
    W.mToast = W.macro.querySelector('.lx-toast');
    W.mCard = W.macro.querySelector('.lx-mcard');

    /* Flujo de datos: UNA pieza que se transforma. Va anclada delante
       de la cámara, así la cámara "la sigue" mientras el fondo pasa. */
    const FLOW = [
      ['fileText', 'Dato clínico', 'glucosa 112 mg/dL'],
      ['archive', 'Expediente', 'Andrea Guardado'],
      ['calendar', 'Cita', 'jueves 10:00'],
      ['staff', 'Médico', 'Dra. Rivera'],
      ['users', 'Paciente', 'notificado'],
      ['home', 'Clínica', 'todo conectado'],
    ];
    W.flow = el('div', 'lx-layer lx-flow');
    W.flow.innerHTML = '<div class="lx-chip">' + FLOW.map((f, i) =>
      '<div class="lx-chip-face" data-face="' + i + '">' +
      '<span class="lx-chip-ic">' + UI.svg(f[0], 22) + '</span>' +
      '<span class="lx-chip-t"><b>' + f[1] + '</b><i>' + f[2] + '</i></span></div>').join('') +
      '<div class="lx-chip-glow"></div></div>';
    world.appendChild(W.flow);
    W.chip = W.flow.querySelector('.lx-chip');
    W.faces = [].slice.call(W.flow.querySelectorAll('.lx-chip-face'));
    W.FLOWN = FLOW.length;

    /* Escena de dispositivos: un solo bastidor SVG que cambia de
       proporción y seis tarjetas que se recolocan. No son tres
       maquetas: es la misma composición reflowing. */
    W.dev = el('div', 'lx-layer lx-dev');
    W.dev.style.setProperty('--z', DEV_Z + 'px');
    const CARDS = [
      { t: 'Citas de Hoy', v: '6', ic: 'calendar' },
      { t: 'Pacientes', v: '428', ic: 'users' },
      { t: 'Ingresos', v: 'L. 84,250', ic: 'wallet' },
      { t: 'Confirmadas', v: '4', ic: 'check' },
      { t: 'Expedientes', v: '1,204', ic: 'archive' },
      { t: 'Personal', v: '6', ic: 'staff' },
    ];
    /* Tres capturas REALES del Inicio: escritorio, tablet y móvil. No es
       una maqueta con cajas: es la misma pantalla del producto en sus tres
       proporciones, que es exactamente lo que la escena tiene que contar. */
    W.dev.innerHTML =
      '<div class="lx-devframe"></div>' +
      ['', 't-', 'm-'].map((k, i) =>
        '<img class="lx-devshot" data-i="' + i + '" alt="" decoding="async" src="/launch/frames/' + k + 'inicio.webp">').join('') +
      '<div class="lx-devlabel"><span data-dev="0">Escritorio</span><span data-dev="1">Tablet</span><span data-dev="2">Móvil</span></div>';
    world.appendChild(W.dev);
    W.devFrame = W.dev.querySelector('.lx-devframe');
    W.devShots = [].slice.call(W.dev.querySelectorAll('.lx-devshot'));
    W.devShots.forEach((im) => { if (im.decode) im.decode().catch(function () {}); });
    W.devLabels = [].slice.call(W.dev.querySelectorAll('.lx-devlabel span'));

    /* Héroe final: vuelve al origen del mundo, justo donde se formó
       el logotipo. El film cierra el círculo en el mismo punto. */
    W.hero = el('div', 'lx-layer lx-hero');
    W.hero.innerHTML =
      '<div class="lx-hero-in">' +
        '<div class="lx-hero-logo">' + UI.logoSVG(M ? 96 : 134) + '</div>' +
        '<div class="lx-hero-word"><span>SALUD</span><b>DIGITAL</b></div>' +
        '<h1 class="lx-hero-line"><span>El futuro de la salud, conectado.</span></h1>' +
        '<div class="lx-hero-sub"><span>Pacientes, médicos, clínicas, laboratorios y farmacias · un solo sistema</span></div>' +
        '<div class="lx-hero-cta">' +
          '<a class="lx-cta" href="/registro.html"><span>Conoce SaludDigital</span>' +
          '<i>' + UI.svg('check', 16, 2.4) + '</i></a>' +
          '<a class="lx-cta ghost" href="/login.html"><span>Entrar</span></a>' +
        '</div>' +
        '<div class="lx-hero-url">portalsaluddigital.com</div>' +
      '</div>';
    world.appendChild(W.hero);
    W.heroIn = W.hero.querySelector('.lx-hero-in');
    W.heroLogo = W.hero.querySelector('.lx-hero-logo');
    W.heroWord = W.hero.querySelector('.lx-hero-word');
    W.heroLine = W.hero.querySelector('.lx-hero-line span');
    W.heroSub = W.hero.querySelector('.lx-hero-sub span');
    W.heroCta = W.hero.querySelector('.lx-hero-cta');
    W.heroUrl = W.hero.querySelector('.lx-hero-url');

    /* HUD (fuera de la cámara): etiquetas del ecosistema, cursor,
       destellos y estelas de velocidad. */
    const hud = document.getElementById('lx-hud');
    W.hud = hud;
    W.labels = LX.FAMILIES.map((f) => {
      const d = el('div', 'lx-eco-label', '<i></i><span>' + f.label + '</span>');
      hud.appendChild(d);
      return d;
    });
    W.cursor = el('div', 'lx-cursor', '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 3l14 8.5-6.2 1.4L10 20z" fill="#fff" stroke="rgba(0,0,0,.35)" stroke-width="1"/></svg><i></i>');
    hud.appendChild(W.cursor);
    W.streaks = el('div', 'lx-streaks');
    hud.appendChild(W.streaks);
    W.flash = el('div', 'lx-flash');
    hud.appendChild(W.flash);
    W.vig = document.getElementById('lx-grain');
    W.blurEl = document.getElementById('lx-blur');
    W.gauss = document.getElementById('lx-mblur-g');

    /* Referencias del Inicio para las microinteracciones. */
    const I0 = W.inicio.el;
    W.counters = [].slice.call(I0.querySelectorAll('[data-count]'));
    W.bars = [].slice.call(I0.querySelectorAll('[data-bar]'));
    W.donutArc = I0.querySelector('.lx-donut-arc');
    W.sparkLine = I0.querySelector('.lx-spark-line');
    W.sparkFill = I0.querySelector('.lx-spark-fill');
    W.apptRows = [].slice.call(I0.querySelectorAll('.lx-appt'));
    W.cards = [].slice.call(I0.querySelectorAll('.lx-stat, .lx-card'));
    W.rules = W.cards.map((c) => {
      const r = el('i', 'lx-rule');
      c.appendChild(r);
      return r;
    });
    W.sbItems = [].slice.call(I0.querySelectorAll('.lx-sb-item'));
    W.sb = I0.querySelector('.lx-sb');
    W.banner = I0.querySelector('.lx-banner');
    if (W.sparkLine) {
      const L = W.sparkLine.getTotalLength();
      W.sparkLen = L;
      W.sparkLine.style.strokeDasharray = L;
      W.sparkLine.style.strokeDashoffset = L;
    }
    W.mCount = W.macro.querySelector('[data-count="mc"]');

    /* Dónde aterriza el logotipo: la posición EXACTA del logo del
       sidebar, en coordenadas del panel. Se mide una sola vez aquí
       (los elementos ya tienen layout aunque estén en visibility:hidden)
       para no leer geometría en ningún frame del film. */
    // OJO: se mide el <span> contenedor, no el <svg>. Los elementos SVG
    // no implementan offsetLeft/offsetTop (son de HTMLElement), así que
    // medir el propio svg daba NaN y el navegador tiraba la transformada
    // entera: el logotipo se quedaba clavado en el centro del panel.
    const logoSize = M ? 210 : 330;
    const target = I0.querySelector('.lx-sb-logo-i');
    let ox = 0, oy = 0, n = target;
    while (n && n !== W.inicio.el) { ox += n.offsetLeft || 0; oy += n.offsetTop || 0; n = n.offsetParent; }
    W.sbLogo = {
      x: ox + target.offsetWidth / 2 - 1440 / 2,
      y: oy + target.offsetHeight / 2 - W.inicio.el.offsetHeight / 2,
      scale: (target.offsetWidth || 30) / logoSize,
    };
    if (!isFinite(W.sbLogo.x) || !isFinite(W.sbLogo.y)) W.sbLogo = { x: -673, y: -346, scale: 30 / logoSize };
  }

  /* Coloca un rótulo junto a su nodo y, si al crecer el ecosistema se
     saliera por la derecha, lo pasa al otro lado del nodo — como una
     llamada de plano bien hecha. Nunca se recorta contra el borde. */
  function placeLabel(L, pos, q) {
    if (!L._w) { L.style.width = 'auto'; L._w = L.offsetWidth || 120; }
    const margin = 22;
    let x = pos.x + 16;
    if (x + L._w > LX.VIEW.w - margin) x = pos.x - L._w - 16;
    x = clamp(x, margin, Math.max(margin, LX.VIEW.w - L._w - margin));
    const y = clamp(pos.y - 10, margin, LX.VIEW.h - 40);
    tf(L, 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + (0.92 + q * 0.08).toFixed(3) + ')');
    /* El barrido va por ancho + overflow. Con clip-path, seis rótulos
       animándose a la vez costaban ~20 ms por frame: cada cambio de
       forma crea una superficie de composición nueva. */
    const w = Math.round(L._w * clamp(q, 0, 1));
    if (L._cw !== w) { L._cw = w; L.style.width = w + 'px'; }
    /* Zona franca central: donde vive el mensaje no entra ningún rótulo.
       En vertical el anillo cae justo encima de los botones. */
    const sw = Math.min(LX.VIEW.w * 0.9, M ? 460 : 900) / 2;
    const sh = (M ? 560 : 380) / 2;
    const over = Math.abs(x + L._w / 2 - LX.VIEW.cx) < sw + L._w / 2 &&
                 Math.abs(y + 14 - LX.VIEW.cy) < sh;
    return over ? 0 : 1;
  }

  /* ── Utilidades de escena ─────────────────────────────────────── */
  function setCount(node, from, to, p, prefix, sep) {
    const v = Math.round(lerp(from, to, p));
    if (node._v === v) return;
    node._v = v;
    node.textContent = (prefix || '') + (sep ? v.toLocaleString('es-HN') : v);
  }
  function tf(node, s) { if (node._t !== s) { node._t = s; node.style.transform = s; } }
  /* Poner opacity a 0 NO libera nada: el elemento sigue siendo una
     superficie de composición que el GPU compone en cada frame — y las
     que llevan máscara o filtro (estelas, cursor) cuestan una pasada
     entera. Apagarlas con visibility las saca del árbol de composición. */
  function op(node, v) {
    const r = Math.round(v * 1000) / 1000;
    if (node._o !== r) {
      node._o = r;
      node.style.opacity = r;
      const vis = r > 0.001;
      if (node._vz !== vis) { node._vz = vis; node.style.visibility = vis ? 'visible' : 'hidden'; }
    }
  }
  function clip(node, s) { if (node._c !== s) { node._c = s; node.style.clipPath = s; } }
  const show = (n, v) => { if (n._s !== v) { n._s = v; n.style.display = v ? '' : 'none'; } };

  /* ═══════════════════════════════════════════════════════════════
     PISTA DE CÁMARA — una sola, para los 28 segundos.
     z: avance (↑ = adelante). dof: apertura (0 = todo nítido).
     mb: multiplicador de motion blur. shake: micro-temblor.
     ═══════════════════════════════════════════════════════════════ */
  const T = {
    intro: 0, logo: 3.0, hold: 5.5, eco: 6.2, dash: 9.2,
    speed: 12.3, macro: 16.6, flow: 19.4, dev: 21.8,
    whip: 24.3, hero: 24.75, final: 26.8, cta: 28.8, end: 30.0,
  };

  function cameraKeys() {
    const z0 = M ? -1700 : -2600;
    return [
      // ── 01 vacío: avance casi imperceptible, cámara casi quieta
      { t: 0, x: 0, y: 0, z: z0, rx: 0, ry: 0, rz: 0, scale: 1, dof: 0.15, mb: 0.5, shake: 1 },
      { t: T.logo, z: -1180, ry: 2.2, dof: 0.3, ease: ease.inOutSoft },
      // ── 02 el logotipo se forma y la cámara entra a él
      { t: T.hold, z: -210, ry: 0, rx: 0, dof: 0.05, mb: 0.35, ease: ease.brakeSoft },
      { t: T.eco, z: -250, ease: ease.smooth },
      // ── 03 retroceso amplísimo: aparece el ecosistema
      { t: T.eco + 1.5, z: -900, ry: -3.4, rx: 1.4, dof: 0.22, ease: ease.drift },
      { t: T.dash - 0.5, z: -1560, ry: -5.2, rx: 2.1, ease: ease.smooth },
      // ── 04 la red se convierte en la interfaz: la cámara se acerca
            /* El plano se SOSTIENE mientras la interfaz se revela: la cámara
         llega, se para y deja trabajar a la microinteracción. Además de
         ser el encuadre correcto, evita que el panel se rasterice de
         nuevo en cada frame por un cambio continuo de escala. */
      { t: T.dash + 1.1, z: 300, ry: -1.2, rx: 0.5, dof: 0.12, mb: 0.45, shake: 0.3, ease: ease.brake },
      { t: T.speed - 0.35, z: 300, ry: 0, rx: 0, y: 0, dof: 0.06, shake: 0.3, ease: ease.smooth },
      // ── 05 RAMPA: lento → medio → rápido → extremo
      /* No es una rampa lisa: es acelerar, ROZAR una pantalla a velocidad
         media —con el desenfoque abajo, para que se lea de verdad— y
         volver a acelerar. Una rampa continua convertía el corredor en un
         borrón en el que no se distinguía ni qué eran las ventanas. */
      { t: T.speed + 0.55, z: 1450, dof: 0.1, mb: 0.85, shake: 1.1, ease: ease.accel },
      { t: T.speed + 1.15, z: 3250, ry: 1.8, dof: 0.06, mb: 0.4, shake: 0.9, ease: ease.brakeSoft },
      { t: T.speed + 1.7, z: 4350, ry: 0.6, dof: 0.12, mb: 1.15, shake: 1.2, ease: ease.accel },
      { t: T.speed + 2.3, z: 6050, ry: -1.6, dof: 0.06, mb: 0.42, shake: 0.9, ease: ease.brakeSoft },
      { t: T.speed + 2.85, z: 7200, ry: -0.5, rz: 0.6, dof: 0.12, mb: 1.35, shake: 1.3, ease: ease.accel },
      { t: T.speed + 3.45, z: 8850, ry: 1.2, rz: 0, dof: 0.06, mb: 0.45, shake: 0.9, ease: ease.brakeSoft },
      { t: T.speed + 3.95, z: 10050, ry: 0.4, rz: -0.4, mb: 1.5, shake: 1.35, ease: ease.accel },
      // ── 06 FRENAZO en seco sobre la tarjeta macro
      { t: T.macro + 0.55, z: -MACRO_Z - 120, ry: 0, rz: 0, mb: 0.5, dof: 0.5, shake: 0.7, ease: ease.brake },
      { t: T.macro + 1.15, z: -MACRO_Z, x: 0, y: 0, dof: 0.72, mb: 0.18, shake: 0.5, ease: ease.outSoft },
      { t: T.flow - 0.35, z: -MACRO_Z + 40, x: 90, y: -26, ease: ease.smooth },
      // ── 07 la cámara sigue al dato
      { t: T.flow + 0.5, z: -MACRO_Z + 900, x: 40, y: 0, ry: 6.5, dof: 0.55, mb: 0.9, shake: 0.9, ease: ease.accel },
      { t: T.flow + 1.5, z: -MACRO_Z + 2600, x: -60, ry: -7.5, rx: -1.6, mb: 1.15, ease: ease.inOutSoft },
      { t: T.dev - 0.25, z: -DEV_Z - 1500, x: 0, ry: -3, rx: 0, mb: 0.85, ease: ease.smooth },
      // ── 08 dispositivos: órbita corta y controlada
      { t: T.dev + 0.55, z: -DEV_Z - 620, ry: 13, rx: 2.4, dof: 0.3, mb: 0.4, shake: 0.8, ease: ease.brake },
      { t: T.dev + 1.5, z: -DEV_Z - 470, ry: -9, rx: -1.2, ease: ease.inOutSoft },
      { t: T.whip, z: -DEV_Z - 430, ry: -2, rx: 0, dof: 0.2, ease: ease.smooth },
      // ── 09 latigazo: 0,45 s de puro barrido. Bajo ese borrón la
      //     cámara vuelve al origen del mundo (mismo truco que un
      //     whip pan de cine: el corte existe, pero no se ve).
      { t: T.whip + 0.22, ry: -46, rz: 4.5, z: -DEV_Z + 900, mb: 3.2, dof: 0.9, shake: 1.6, ease: ease.accelHard },
      { t: T.whip + 0.23, ry: 40, rz: -4, z: -2100, ease: ease.linear },
      { t: T.hero, ry: 0, rz: 0, z: -520, mb: 0.6, dof: 0.35, shake: 0.7, ease: ease.brake },
      { t: T.hero + 0.9, z: -300, dof: 0.06, mb: 0.15, shake: 0.45, ease: ease.outSoft },
      // ── 10 apertura final: el ecosistema, ahora a otra escala
      { t: T.final + 1.4, z: -1250, ry: 3.2, rx: -1.1, dof: 0.3, mb: 0.35, shake: 0.6, ease: ease.drift },
      { t: T.cta, z: -320, ry: 0, rx: 0, dof: 0.12, mb: 0.2, ease: ease.brakeSoft },
      { t: T.end + 4, z: -260, ry: -1.2, shake: 0.5, ease: ease.linear },
    ];
  }

  /* ═══════════════════════════════════════════════════════════════
     ESCENAS
     ═══════════════════════════════════════════════════════════════ */
  function register() {
    const FX = LX.FX;

    /* ── 01 · Intro — el vacío ─────────────────────────────────── */
    Engine.scene({
      id: 'intro', label: '01 · Vacío',
      start: 0, dur: T.logo, lead: 0, lag: 0.2,
      update(p) {
        FX.modes.dust = ramp(p, 0.02, 0.42, ease.outSoft) * (1 - ramp(p, 0.97, 1, ease.linear) * 0.0);
      },
    });

    /* ── 02 · LogoReveal — las partículas convergen ────────────── */
    Engine.scene({
      id: 'logo', label: '02 · Logotipo',
      start: T.logo, dur: T.eco - T.logo, lead: 0.1, lag: 0.6,
      update(p, local, t) {
        // convergencia
        const conv = ease.inOutSoft(clamp(local / 2.05, 0, 1));
        FX.modes.logo = conv;
        FX.modes.dust = 1 - conv * 0.55;
        // el vector toma el relevo justo cuando la silueta ya está
        const lock = ramp(local, 1.85, 2.45, ease.outSoft);
        op(W.logoLayer, lock);
        const s = lerp(1.035, 1, ease.out(lock));
        tf(W.logoLayer, 'translate3d(-50%,-50%,0) scale(' + s.toFixed(4) + ')');
        // cada bloque encaja con un desfase mínimo — "las líneas se alinean"
        W.logoBlocks.forEach((b, i) => {
          const q = ramp(local, 1.8 + i * 0.055, 2.35 + i * 0.055, ease.out);
          b.style.opacity = q;
          const d = (1 - q) * 26;
          const ang = [-90, 0, 90, 180][i] * Math.PI / 180;
          b.style.transform = 'translate(' + (Math.cos(ang) * d).toFixed(2) + 'px,' + (Math.sin(ang) * d).toFixed(2) + 'px)';
        });
        // pulso de contorno en el instante del bloqueo
        const ring = ramp(local, 2.25, 2.95, ease.out);
        op(W.logoRing, Math.sin(ring * Math.PI) * 0.55);
        tf(W.logoRing, 'translate3d(-50%,-50%,0) scale(' + (0.6 + ring * 1.5).toFixed(3) + ')');
        // destello contenido (no un flash de plantilla: 3% de blanco)
        op(W.flash, Math.pow(Math.sin(clamp(inv(2.0, 2.28, local), 0, 1) * Math.PI), 2) * 0.05);
      },
    });

    /* ── 03 · Ecosystem — desde el logo salen las conexiones ───── */
    Engine.scene({
      id: 'eco', label: '03 · Ecosistema',
      start: T.eco, dur: T.dash - T.eco + 0.9, lead: 0.2, lag: 0.3,
      update(p, local, t) {
        const grow = ease.outSoft(clamp(local / 2.1, 0, 1));
        FX.modes.network = grow;
        FX.modes.netScale = lerp(0.72, 1, ease.out(clamp(local / 2.6, 0, 1)));
        FX.modes.logo = 1;
        FX.modes.dust = 0.45;
        // el logotipo se mantiene como núcleo y se va replegando
        const fold = ramp(local, 2.45, 3.5, ease.inOutSoft);
        op(W.logoLayer, 1);
        tf(W.logoLayer, 'translate3d(-50%,-50%,0) scale(' + lerp(1, 0.44, fold).toFixed(4) + ')');
        // etiquetas: entran por máscara, en el orden del anillo
        W.labels.forEach((L, i) => {
          const q = ramp(local, 0.75 + i * 0.13, 1.5 + i * 0.13, ease.out) * (1 - ramp(local, 2.5, 3.2, ease.smooth));
          const pos = FX.labelPos(i);
          if (!pos || q < 0.01) { op(L, 0); return; }
          op(L, q * placeLabel(L, pos, q));
        });
      },
      exit() { W.labels.forEach((L) => op(L, 0)); },
    });

    /* ── 04 · DashboardReveal — la red SE CONVIERTE en interfaz ── */
    Engine.scene({
      id: 'dash', label: '04 · Interfaz',
      start: T.dash, dur: T.speed - T.dash + 0.5, lead: 0.5, lag: 0.4,
      update(p, local) {
        // la red se contrae hacia el panel mientras el panel se dibuja
        const morph = ease.inOutSoft(clamp(local / 1.35, 0, 1));
        FX.modes.network = 1 - morph * 0.86;
        FX.modes.netScale = lerp(1, 0.3, morph);
        FX.modes.dust = lerp(0.45, 0.18, morph);
        FX.modes.logo = 1 - morph;

        /* El logotipo no se desvanece: vuela hasta su sitio en el
           sidebar y allí entrega el relevo al que ya vive en la
           interfaz. Es la misma marca, no dos copias. */
        const L = W.sbLogo;
        const land = ease.inOutSoft(clamp((local - 0.15) / 1.25, 0, 1));
        tf(W.logoLayer,
          'translate3d(calc(-50% + ' + (L.x * land).toFixed(1) + 'px), calc(-50% + ' + (L.y * land).toFixed(1) + 'px), ' +
          (SEC_Z[0] * land).toFixed(0) + 'px) scale(' + lerp(0.44, L.scale, land).toFixed(4) + ')');
        op(W.logoLayer, 1 - ramp(local, 1.2, 1.42, ease.smooth));

        /* TODO el revelado va con transform + opacity. Se probó con
           clip-path (una tarjeta que se abre desde su línea central se
           lee mejor) y hundía la escena a 5 fps: cada cambio de forma
           obliga a Chrome a rasterizar de nuevo un panel de 1440×920
           con sus sombras, quince veces por frame. La misma idea —la
           línea de conexión que se convierte en línea de interfaz— la
           cuenta ahora un filete de 1px que se estira en scaleX, que sí
           vive en el compositor. */
        /* El contenido no empieza a revelarse hasta que la cámara ha
           llegado y se ha detenido: primero el movimiento, luego la
           interfaz. Además de ser mejor plano, evita revelar mientras el
           panel cambia de escala, que es cuando hay que rasterizarlo de
           nuevo entero en cada frame. */
        const lc = (local - 1.05) * 1.55;
        const inicio = W.inicio.inner;
        op(W.inicio.el, ramp(lc, 0.05, 0.75, ease.outSoft));
        const open = ramp(lc, 0.1, 1.0, ease.brake);
        tf(inicio, 'scale(' + (0.955 + open * 0.045).toFixed(4) + ',' + (0.12 + open * 0.88).toFixed(4) + ')');

        const sbP = ramp(lc, 0.45, 1.25, ease.out);
        if (W.sb) { op(W.sb, Math.min(1, sbP * 1.4)); tf(W.sb, 'translate3d(' + ((1 - sbP) * -46).toFixed(1) + 'px,0,0)'); }
        W.sbItems.forEach((it, i) => {
          const q = ramp(lc, 0.7 + i * 0.028, 1.05 + i * 0.028, ease.out);
          op(it, q); tf(it, 'translate3d(' + ((1 - q) * -16).toFixed(1) + 'px,0,0)');
        });
        if (W.banner) {
          const q = ramp(lc, 0.62, 1.15, ease.brake);
          op(W.banner, q);
          tf(W.banner, 'translate3d(0,' + ((1 - q) * 18).toFixed(1) + 'px,0) scale(' + (0.985 + q * 0.015).toFixed(4) + ')');
        }
        W.cards.forEach((c, i) => {
          const q = ramp(lc, 0.78 + i * 0.075, 1.42 + i * 0.075, ease.brake);
          op(c, q);
          tf(c, 'translate3d(0,' + ((1 - q) * 20).toFixed(1) + 'px,0) scale(' + (0.976 + q * 0.024).toFixed(4) + ')');
          const r = W.rules[i];
          if (r) { tf(r, 'scaleX(' + clamp(q * 1.35, 0, 1).toFixed(3) + ')'); op(r, Math.sin(clamp(q * 1.35, 0, 1) * Math.PI) * 0.9); }
        });
        // microinteracciones: cifras, donut, barras, sparkline, filas
        const mic = clamp((lc - 1.25) / 1.55, 0, 1);
        const me = ease.out(mic);
        W.counters.forEach((c) => {
          const to = { pac: 428, hoy: 6, pac2: 428, hoy2: 6, ing: 84250, donut: 6 }[c.dataset.count];
          if (to == null) return;
          if (c.dataset.count === 'ing') setCount(c, 0, to, me, 'L. ', true);
          else setCount(c, 0, to, me, '', to > 999);
        });
        if (W.donutArc) W.donutArc.style.strokeDashoffset = (502.65 * (1 - ease.out(clamp((lc - 1.35) / 1.5, 0, 1)) * 0.986)).toFixed(1);
        W.bars.forEach((b, i) => {
          const q = ease.out(clamp((lc - 1.5 - i * 0.12) / 1.1, 0, 1));
          b.style.width = (q * parseFloat(b.dataset.bar)).toFixed(1) + '%';
        });
        if (W.sparkLine) {
          const q = ease.inOutSoft(clamp((lc - 1.6) / 1.5, 0, 1));
          W.sparkLine.style.strokeDashoffset = (W.sparkLen * (1 - q)).toFixed(1);
          op(W.sparkFill, q * q);
        }
        W.apptRows.forEach((r, i) => {
          const q = ramp(lc, 1.35 + i * 0.1, 1.85 + i * 0.1, ease.out);
          op(r, q); tf(r, 'translate3d(' + ((1 - q) * 22).toFixed(1) + 'px,0,0)');
        });
        // el ítem activo del sidebar se enciende justo antes de arrancar
        const on = ramp(lc, 2.4, 2.8, ease.out);
        if (W.sbItems[0]) W.sbItems[0].style.setProperty('--on', on.toFixed(3));
      },
    });

    /* ── 05 · SpeedRamp — la cámara atraviesa el producto ──────── */
    Engine.scene({
      id: 'speed', label: '05 · Rampa',
      // El lead largo NO es un descuido: esta escena es la dueña de la
      // visibilidad de las seis secciones, y el Inicio tiene que estar
      // en pie desde que la red empieza a convertirse en interfaz.
      start: T.speed, dur: T.macro - T.speed + 0.9, lead: 3.4, lag: 0.3,
      els: W.secs.map((s) => s.el),
      update(p, local) {
        if (local < 0) return;
        // En los micro-frenazos la velocidad cae; sin esto el panel se
        // cambiaba a DOM vivo y volvía a captura varias veces por segundo.
        LX.forceShot = true;
        const v = clamp(LX.vel.norm, 0, 1.6);
        LX.FX.modes.streak = clamp((v - 0.28) * 0.95, 0, 0.85);
        LX.FX.modes.warp = clamp(v * 0.9, 0, 1);
        // En el corredor la escena la llevan los paneles: el polvo solo
        // acompaña, así que se mantiene bajo y no compite por relleno.
        LX.FX.modes.dust = clamp(0.14 + v * 0.3, 0, 0.46);
        LX.FX.modes.network = 0;
      },
      exit() { LX.forceShot = false; LX.FX.modes.streak = 0; LX.FX.modes.warp = 0; },
    });

    /* ── 06 · MacroUI — frenazo y detalle ──────────────────────── */
    Engine.scene({
      id: 'macro', label: '06 · Macro',
      start: T.macro, dur: T.flow - T.macro + 0.6, lead: 1.1, lag: 0.4,
      el: W.macro,
      update(p, local) {
        op(W.macro, ramp(local, -0.7, 0.35, ease.outSoft));
        LX.FX.modes.dust = lerp(0.35, 0.12, clamp(local, 0, 1));

        // cursor: recorrido con curva propia, nada de línea recta
        const cur = clamp((local - 0.85) / 1.05, 0, 1);
        const ce = ease.inOutSoft(cur);
        const cx = LX.VIEW.cx + lerp(360, 176, ce) + Math.sin(ce * Math.PI) * 54;
        const cy = LX.VIEW.cy + lerp(300, 158, ce) - Math.sin(ce * Math.PI) * 30;
        op(W.cursor, ramp(local, 0.8, 1.05, ease.out) * (1 - ramp(local, 2.5, 2.9, ease.smooth)));
        tf(W.cursor, 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)');

        // hover → pulsación → confirmación
        const hov = ramp(local, 1.62, 1.9, ease.out);
        const press = Math.sin(clamp(inv(1.92, 2.08, local), 0, 1) * Math.PI);
        W.mBtn.style.setProperty('--hov', hov.toFixed(3));
        tf(W.mBtn, 'translate3d(0,' + (-hov * 2 + press * 2.4).toFixed(2) + 'px,0) scale(' + (1 + hov * 0.018 - press * 0.03).toFixed(4) + ')');
        W.cursor.style.setProperty('--click', press.toFixed(3));

        const done = ramp(local, 2.06, 2.42, ease.brake);
        if (done > 0.5 !== W.mStatus._done) {
          W.mStatus._done = done > 0.5;
          W.mStatus.classList.toggle('s-confirmed', done > 0.5);
          W.mStatus.classList.toggle('s-pending', done <= 0.5);
          W.mStatusTxt.textContent = done > 0.5 ? 'Confirmada' : 'Pendiente';
        }
        // el badge cambia por barrido vertical, no por fundido
        clip(W.mStatus, done > 0.02 && done < 0.98 ? 'inset(' + ((1 - done) * 100).toFixed(1) + '% 0 0 0 round 999px)' : 'none');
        W.mStep3.style.setProperty('--on', done.toFixed(3));
        const toast = ramp(local, 2.3, 2.62, ease.out) * (1 - ramp(local, 3.3, 3.6, ease.smooth));
        op(W.mToast, toast);
        tf(W.mToast, 'translate3d(0,' + ((1 - toast) * 16).toFixed(1) + 'px,0) scale(' + (0.97 + toast * 0.03).toFixed(3) + ')');
        setCount(W.mCount, 0, 12, ease.out(clamp((local - 0.6) / 1.2, 0, 1)));
        // ligerísima respiración de la tarjeta: nunca está muerta
        tf(W.mCard, 'translate3d(0,' + (-hov * 3).toFixed(2) + 'px,0)');
      },
      exit() { op(W.cursor, 0); },
    });

    /* ── 07 · DataFlow — el dato se transforma en el camino ────── */
    Engine.scene({
      id: 'flow', label: '07 · Flujo',
      start: T.flow, dur: T.dev - T.flow + 0.35, lead: 0.5, lag: 0.3,
      update(p, local, t, ctx) {
        const vis = ramp(local, -0.35, 0.3, ease.out) * (1 - ramp(local, 2.05, 2.45, ease.smooth));
        op(W.flow, vis);
        // anclada delante de la cámara: la cámara la "sigue"
        const z = -(ctx.cam.z) - (M ? 330 : 430);
        W.flow.style.setProperty('--z', z.toFixed(0) + 'px');
        const sway = Math.sin(local * 2.1) * (M ? 26 : 46);
        tf(W.flow, 'translate3d(calc(-50% + ' + sway.toFixed(1) + 'px), calc(-50% + ' + (Math.cos(local * 1.7) * 22).toFixed(1) + 'px), var(--z))');

        // morfología: una cara sale por arriba mientras la siguiente
        // entra por abajo, ambas recortadas — es un barrido, no un fundido
        const n = W.FLOWN;
        const prog = clamp(local / 2.15, 0, 1) * (n - 1);
        const idx = Math.min(n - 2, Math.floor(prog));
        const f = ease.mask(clamp(prog - idx, 0, 1));
        W.faces.forEach((face, i) => {
          if (i < idx || i > idx + 1) { op(face, 0); show(face, false); return; }
          show(face, true);
          /* Sin clip-path: .lx-chip ya lleva overflow:hidden, así que
             basta con desplazarlas. El recorte sale gratis. */
          if (i === idx) {
            op(face, 1 - f * 0.85);
            tf(face, 'translate3d(0,' + (-f * 100).toFixed(1) + 'px,0)');
          } else {
            op(face, 0.15 + f * 0.85);
            tf(face, 'translate3d(0,' + ((1 - f) * 100).toFixed(1) + 'px,0)');
          }
        });
        LX.FX.modes.dust = 0.78;
        LX.FX.modes.warp = clamp(0.35 + LX.vel.norm * 0.7, 0, 1);
        LX.FX.modes.stream = vis;
        LX.FX.modes.streak = clamp((LX.vel.norm - 0.55) * 0.45, 0, 0.32);
      },
      exit() { op(W.flow, 0); LX.FX.modes.streak = 0; LX.FX.modes.stream = 0; },
    });

    /* ── 08 · DeviceTransition — una sola composición que se adapta ── */
    /* Las tres proporciones reales, con la MISMA anatomía que la
       plataforma: cromo arriba, sidebar que se repliega, banner de
       bienvenida y rejilla de tarjetas. Lo que cambia es el reflow, no
       las piezas — que es justo lo que hay que enseñar. */
    /* Las proporciones reales de los tres paneles capturados. */
    const LAYOUTS = [
      { w: 1440, h: 920, r: 22 },
      { w: 830, h: 1040, r: 28 },
      { w: 430, h: 900, r: 34 },
    ];
    Engine.scene({
      id: 'dev', label: '08 · Dispositivos',
      start: T.dev, dur: T.whip - T.dev + 0.2, lead: 0.8, lag: 0.1,
      el: W.dev,
      update(p, local) {
        const vis = ramp(local, -0.5, 0.28, ease.out) * (1 - ramp(local, 2.42, 2.62, ease.smooth));
        op(W.dev, vis);
        /* Dos tramos con reposo: cada formato se sostiene lo justo para
           leerse antes de que empiece el siguiente. */
        const kA = ease.inOutSoft(clamp((local - 0.45) / 0.62, 0, 1));
        const kB = ease.inOutSoft(clamp((local - 1.45) / 0.62, 0, 1));
        const k = kA + kB;
        const i = Math.min(1, Math.floor(k)), f = clamp(k - i, 0, 1);
        const A = LAYOUTS[i], B = LAYOUTS[Math.min(2, i + 1)];
        const fw = lerp(A.w, B.w, f), fh = lerp(A.h, B.h, f), fr = lerp(A.r, B.r, f);

        // Cuantizado a 2px: por debajo no se ve y sí obliga a rehacer el
        // layout y el rasterizado del bastidor y de las capturas.
        const q2 = (v) => (Math.round(v / 2) * 2) + 'px';
        const fs = W.devFrame.style;
        fs.width = q2(fw);
        fs.height = q2(fh);
        fs.borderRadius = Math.round(fr) + 'px';

        /* La captura entrante releva a la saliente justo en el punto en
           que el bastidor cambia más deprisa: el cambio queda debajo del
           propio movimiento. Entre medias el recorte (object-fit: cover)
           hace de "la interfaz se está estrechando". */
        const sw = clamp((f - 0.42) / 0.2, 0, 1);
        W.devShots.forEach((im, idx) => {
          let a = 0;
          if (idx === i) a = 1 - sw;
          else if (idx === i + 1) a = sw;
          op(im, a * clamp(vis * 1.3, 0, 1));
          if (a > 0.001) {
            im.style.width = q2(fw);
            im.style.height = q2(fh);
            im.style.borderRadius = Math.round(fr) + 'px';
          }
        });
        W.devLabels.forEach((sp, idx) => {
          const d = Math.abs(k - idx);
          const q = clamp(1 - d * 1.6, 0, 1);
          op(sp, q);
          tf(sp, 'translate3d(0,' + ((q - 1) * 10).toFixed(1) + 'px,0)');
        });
        tf(W.dev.querySelector('.lx-devlabel'), 'translate3d(-50%,' + (fh / 2 + 44).toFixed(0) + 'px,0)');
        LX.FX.modes.dust = 0.3;
      },
    });

    Engine.scene({
      id: 'hero', label: '09 · Héroe',
      start: T.hero, dur: T.final - T.hero + 1.2, lead: 0.4, lag: 8,
      update(p, local) {
        op(W.hero, 1);
        // entrada por máscara + microescala. Ni rebote ni typewriter.
        const l = ramp(local, 0.05, 0.85, ease.brake);
        op(W.heroLogo, l);
        tf(W.heroLogo, 'translate3d(0,' + ((1 - l) * 14).toFixed(1) + 'px,0) scale(' + (0.94 + l * 0.06).toFixed(4) + ')');
        const w = ramp(local, 0.3, 1.1, ease.brake);
        op(W.heroWord, w);
        clip(W.heroWord, 'inset(0 ' + ((1 - w) * 100).toFixed(1) + '% -20% 0)');
        tf(W.heroWord, 'translate3d(0,' + ((1 - w) * 8).toFixed(1) + 'px,0)');
        const h = ramp(local, 0.62, 1.55, ease.brake);
        op(W.heroLine, h);
        clip(W.heroLine, 'inset(0 0 ' + ((1 - h) * 118).toFixed(1) + '% 0)');
        tf(W.heroLine, 'translate3d(0,' + ((1 - h) * 22).toFixed(1) + 'px,0)');
        const s = ramp(local, 1.05, 1.9, ease.outSoft);
        op(W.heroSub, s * 0.92);
        tf(W.heroSub, 'translate3d(0,' + ((1 - s) * 12).toFixed(1) + 'px,0)');
        const c = ramp(local, T.cta - T.hero - 0.35, T.cta - T.hero + 0.55, ease.brake);
        // Mientras el mensaje está solo, el bloque se centra ópticamente;
        // al aparecer los botones sube a su sitio. El peso visual manda.
        tf(W.heroIn, 'translate3d(0,' + lerp(48, 0, ease.inOutSoft(c)).toFixed(1) + 'px,0)');
        op(W.heroCta, c);
        tf(W.heroCta, 'translate3d(0,' + ((1 - c) * 16).toFixed(1) + 'px,0)');
        W.heroCta.style.pointerEvents = c > 0.9 ? 'auto' : 'none';
        op(W.heroUrl, ramp(local, T.cta - T.hero, T.cta - T.hero + 0.7, ease.out) * 0.55);
        LX.FX.modes.dust = lerp(0.18, 0.5, clamp(local / 2.5, 0, 1));
      },
    });

    /* ── 10 · EcosystemFinal — la misma red, otra escala ───────── */
    Engine.scene({
      id: 'final', label: '10 · Ecosistema final',
      start: T.final, dur: T.end - T.final + 6, lead: 0.3, lag: 0,
      update(p, local) {
        const g = ease.outSoft(clamp(local / 2.2, 0, 1));
        LX.FX.modes.network = g;
        LX.FX.modes.netScale = lerp(1.6, M ? 3.0 : 4.4, ease.drift(clamp(local / 3.4, 0, 1)));
        LX.FX.modes.dust = lerp(0.4, 0.62, g);
        W.labels.forEach((L, i) => {
          const q = ramp(local, 0.85 + i * 0.14, 1.6 + i * 0.14, ease.out);
          const pos = LX.FX.labelPos(i);
          if (!pos || q < 0.01) { op(L, 0); return; }
          op(L, q * 0.85 * placeLabel(L, pos, q));
        });
      },
    });

    /* ── 11 · CTA — estado de reposo, ya interactivo ───────────── */
    Engine.scene({
      id: 'cta', label: '11 · CTA',
      start: T.cta, dur: 2.6, lead: 0.2, lag: 999,
      update(p, local) {
        document.documentElement.classList.toggle('lx-rest', local > 0.4);
      },
    });

    /* ── Marcas para sound design ─────────────────────────────── */
    Engine.cue(0.4, 'sub-drone-in');
    Engine.cue(T.logo + 1.8, 'particles-converge');
    Engine.cue(T.logo + 2.28, 'logo-lock · low bass hit');
    Engine.cue(T.eco + 0.7, 'network-bloom');
    Engine.cue(T.dash + 0.65, 'ui-materialize · soft whoosh');
    Engine.cue(T.speed + 0.1, 'ramp-start');
    Engine.cue(T.speed + 2.3, 'ultra-speed · whoosh');
    Engine.cue(T.macro + 0.5, 'hard-brake · impact');
    Engine.cue(T.macro + 2.0, 'ui-click');
    Engine.cue(T.macro + 2.35, 'confirm-chime');
    Engine.cue(T.flow + 0.1, 'data-stream');
    Engine.cue(T.dev + 0.4, 'device-morph');
    Engine.cue(T.whip + 0.05, 'whip · transition impact');
    Engine.cue(T.hero + 0.1, 'hero · cinematic hit + silence');
    Engine.cue(T.final + 0.2, 'ecosystem-open · swell');
    Engine.cue(T.cta, 'final-note');
  }

  /* ═══════════════════════════════════════════════════════════════
     ENGANCHES GLOBALES — el mundo reacciona a la cámara
     ═══════════════════════════════════════════════════════════════ */
  function hooks() {
    const P = () => LX.VIEW.persp;

    /* Niebla, descarte y profundidad de campo por distancia real.
       El desenfoque se cuantiza a 0,5px: sin eso, el navegador
       re-rasteriza la capa en cada frame y se van los 60fps. */
    /* Niebla + descarte. El desenfoque por distancia NO se aplica a los
       paneles: un filter que cambia de valor cada frame invalida la
       textura de una superficie de 2880×1840 y la vuelve a pintar con
       todas sus sombras — medido, costaba 400 ms por frame. La
       profundidad la dan ahora la niebla, la escala en perspectiva y el
       motion blur global. El único desenfoque real que queda es el de
       la tarjeta macro, y solo cuando la cámara está casi parada. */
    function depth(t, cam, vel) {
      const dof = cam.dof === undefined ? 0.15 : cam.dof;
      const items = W.secs;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const zEff = it.z + cam.z;
        // Niebla corta a propósito: cada panel vivo cuesta ~22 ms de
        // composición aunque esté en silueta, así que el corredor se
        // sostiene con dos a la vez y atmósfera detrás.
        const far = clamp(inv(-1500, -3900, zEff), 0, 1);
        const near = clamp(inv(PASS, PASS - 560, zEff), 0, 1);
        const fog = (1 - far * 0.9) * near;
        // por debajo de este umbral el panel no aporta nada y sí cuesta
        /* Se DESMONTAN del DOM, no basta con ocultarlas: dentro de un
           contexto preserve-3d cada capa es una superficie de composición
           con su propia textura en la GPU, y mantener seis reservadas
           mientras la cámara mueve el mundo bloquea la presentación.
           Con histéresis para que un panel en el umbral no entre y salga
           en frames consecutivos. */
        const want = it.el._vis ? fog > 0.05 : fog > 0.11;
        /* A toda velocidad la sección se retira antes: cuando ya engulle
           el encuadre solo aporta relleno borroso, y el relleno es
           exactamente lo que falta en ese momento. */
        const pass = vel.norm > 0.5 ? 40 : PASS;
        const live = want && zEff < pass && it.el.classList.contains('is-live');
        if (!live) {
          if (it.el._vis !== false) {
            it.el._vis = false;
            if (it.el.parentNode) it.el.parentNode.removeChild(it.el);
          }
          continue;
        }
        if (it.el._vis !== true) {
          it.el._vis = true;
          if (!it.el.parentNode) W.world.appendChild(it.el);
        }
        if (it.el._fog !== fog) { it.el._fog = fog; it.el.style.setProperty('--fog', fog.toFixed(3)); }
        /* En movimiento el panel se enseña como CAPTURA (una textura no
           se vuelve a rasterizar al cambiar de escala); parado, como DOM
           vivo, que es cuando hay que leerlo y cuando corren las
           microinteracciones. El cambio ocurre bajo motion blur y la
           captura es idéntica píxel a píxel, así que no se ve. */
        const wasShot = it.el._shot === true;
        const shot = it.el._real || LX.forceShot || vel.norm > (wasShot ? 0.06 : 0.14);
        if (it.el._shot !== shot) { it.el._shot = shot; it.el.classList.toggle('is-shot', shot); }
      }
      // macro: desenfoque solo con la cámara quieta y en pasos gruesos
      const mz = MACRO_Z + cam.z;
      let mb = vel.norm < 0.12 ? Math.min(dof * Math.abs(mz) / 380, 12) : 0;
      mb = Math.round(mb / 3) * 3;
      if (W.macro._blur !== mb) { W.macro._blur = mb; W.macro.style.setProperty('--dof', mb + 'px'); }
      if (W.macro._fog !== 1) { W.macro._fog = 1; W.macro.style.setProperty('--fog', '1'); }
    }

    /* Motion blur real: gaussiana direccional cuya desviación sale de
       la velocidad de la propia pista de cámara. Al frenar, baja sola.
       En equipos flojos se sustituye por las estelas, que no cuestan. */
    let lastStd = -1;
    function mblur(t, cam, vel) {
      const tier = LX.Quality.tier;
      const mult = cam.mb === undefined ? 1 : cam.mb;
      /* El desenfoque direccional es una gaussiana SVG sobre TODA la
         escena: solo se paga donde sobra músculo. En los demás niveles
         la velocidad la cuentan las estelas del lienzo, que van gratis. */
      const cap = tier === 'high' ? 7 : 0;
      let s = clamp(vel.norm * 4.6 * mult, 0, cap);
      // el barrido lateral emborrona en horizontal; el avance, casi radial
      const lat = clamp(Math.abs(vel.x) / 900 + Math.abs(cam.ry - (cam._pry || 0)) * 6, 0, 3);
      cam._pry = cam.ry;
      let sx = Math.round((s + lat) * 4) / 4;
      let sy = Math.round(s * 0.55 * 4) / 4;
      if (sx < 0.3) { sx = 0; sy = 0; }
      const key = sx + ':' + sy;
      if (key === lastStd) return;
      lastStd = key;
      if (!sx && !sy) {
        W.blurEl.style.filter = 'none';
        W.blurEl.style.willChange = 'auto';
        return;
      }
      W.gauss.setAttribute('stdDeviation', sx + ' ' + sy);
      if (W.blurEl.style.willChange !== 'filter') W.blurEl.style.willChange = 'filter';
      W.blurEl.style.filter = 'url(#lx-mblur)';
    }

    /* Lo mismo para las capas sueltas: macro, dispositivos, flujo,
       logotipo y héroe salen del árbol 3D cuando su escena no está viva. */
    const SOLO = [];
    function mountSolo() {
      if (!SOLO.length) SOLO.push(W.macro, W.dev, W.flow, W.logoLayer, W.hero);
      for (let i = 0; i < SOLO.length; i++) {
        const e = SOLO[i];
        const want = e.style.visibility !== 'hidden' && (e._o === undefined || e._o > 0.001);
        if (want && !e.parentNode) W.world.appendChild(e);
        else if (!want && e.parentNode) e.parentNode.removeChild(e);
      }
    }

    function fx(t, cam, vel) { mountSolo(); if (LX.FX.ready) LX.FX.draw(t, cam, vel); }

    Engine.hook(depth);
    Engine.hook(mblur);
    Engine.hook(fx);
  }

  LX.Film = {
    build() {
      build();
      Engine.setCamera(cameraKeys());
      register();
      hooks();
      Engine.duration = T.end;
      return W;
    },
    W: W, T: T,
  };
})();
