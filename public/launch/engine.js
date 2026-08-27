/* ═══════════════════════════════════════════════════════════════════
   launch/engine.js — Núcleo del Launch Sequence de Salud Digital
   ─────────────────────────────────────────────────────────────────
   Una sola cámara, un solo reloj, un solo requestAnimationFrame.

   Todo el film es una FUNCIÓN PURA DEL TIEMPO: render(t) deja la
   escena exactamente igual venga de reproducir o de saltar con la
   barra del modo debug. Eso es lo que permite depurar el timing sin
   volver a verlo entero, y lo que hace que el motion blur sea
   correcto también al hacer scrub (la velocidad se obtiene evaluando
   la pista de cámara en t y en t-Δ, no de la diferencia entre frames
   reales, que dependería de los fps).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const LX = (window.LX = window.LX || {});

  /* ── Matemática básica ──────────────────────────────────────── */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const inv = (a, b, v) => (a === b ? 0 : clamp((v - a) / (b - a), 0, 1));
  // Rampa suave entre dos marcas de tiempo: la usan todas las escenas
  // para encadenar sub-beats sin escribir tres líneas cada vez.
  const ramp = (t, a, b, fn) => (fn || ease.smooth)(inv(a, b, t));

  /* Solucionador de cubic-bezier (Newton-Raphson, igual que el del
     navegador para transition-timing-function). Sin esto no se puede
     evaluar una curva CSS en un t arbitrario. */
  function bezier(x1, y1, x2, y2) {
    if (x1 === y1 && x2 === y2) return (t) => t;
    const A = (a, b) => 1 - 3 * b + 3 * a;
    const B = (a, b) => 3 * b - 6 * a;
    const C = (a) => 3 * a;
    const calc = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
    const slope = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
    return function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      let u = t;
      for (let i = 0; i < 8; i++) {
        const s = slope(u, x1, x2);
        if (s === 0) break;
        u -= (calc(u, x1, x2) - t) / s;
      }
      return calc(clamp(u, 0, 1), y1, y2);
    };
  }

  /* Curvas de la casa. Nada de `linear` salvo para valores que no se
     perciben como movimiento (opacidad de niebla, por ejemplo). */
  const ease = {
    linear: (t) => t,
    brand: bezier(0.22, 0.61, 0.36, 1),   // el mismo que usa la plataforma
    smooth: bezier(0.4, 0, 0.2, 1),
    out: bezier(0.16, 1, 0.3, 1),          // salida expo — entradas de UI
    outSoft: bezier(0.25, 1, 0.5, 1),
    inOut: bezier(0.65, 0, 0.35, 1),
    inOutSoft: bezier(0.5, 0, 0.2, 1),
    accel: bezier(0.85, 0, 0.95, 0.35),    // arranque de rampa de velocidad
    accelHard: bezier(0.95, 0.02, 1, 0.4), // tramo ULTRA
    brake: bezier(0.02, 0.8, 0.1, 1),      // frenazo cinematográfico
    brakeSoft: bezier(0.08, 0.7, 0.16, 1),
    drift: bezier(0.33, 0, 0.15, 1),       // deriva de cámara larga
    mask: bezier(0.62, 0.02, 0.16, 1),     // barridos de máscara
  };
  // Muelle sobreamortiguado: sensación de peso sin rebote de juguete.
  ease.spring = (t) => 1 - Math.exp(-6.2 * t) * Math.cos(3.1 * t);

  /* Ruido determinista (suma de senos). Se usa para el micro-temblor
     de cámara: hace falta que dependa SOLO de t para que el scrub
     siga siendo reproducible. */
  function noise(t, seed) {
    const s = seed || 0;
    return (
      Math.sin(t * 1.31 + s * 12.9) * 0.5 +
      Math.sin(t * 2.17 + s * 4.7) * 0.3 +
      Math.sin(t * 0.73 + s * 21.3) * 0.2
    );
  }

  /* ── Track: interpolación de keyframes multi-propiedad ──────────
     Cada keyframe declara solo lo que cambia; cada propiedad lleva su
     propio carril y su propia curva. `ease` pertenece al keyframe de
     DESTINO (como en CSS: describe cómo se llega a él). */
  function Track(keys) {
    const lanes = {};
    keys.forEach((k) => {
      for (const n in k) {
        if (n === 't' || n === 'ease') continue;
        (lanes[n] || (lanes[n] = [])).push({ t: k.t, v: k[n], e: k.ease || ease.smooth });
      }
    });
    for (const n in lanes) lanes[n].sort((a, b) => a.t - b.t);
    return {
      lanes,
      at(t, out) {
        out = out || {};
        for (const n in lanes) {
          const L = lanes[n];
          if (t <= L[0].t) { out[n] = L[0].v; continue; }
          const last = L[L.length - 1];
          if (t >= last.t) { out[n] = last.v; continue; }
          let i = 1;
          while (i < L.length && L[i].t <= t) i++;
          const a = L[i - 1], b = L[i];
          out[n] = lerp(a.v, b.v, b.e((t - a.t) / (b.t - a.t)));
        }
        return out;
      },
    };
  }

  /* ── Cámara ────────────────────────────────────────────────────
     Estado único para TODO el film. z es cuánto se empuja el mundo
     hacia el espectador (z↑ = avanzar). Los objetos llevan su propia
     translateZ; la profundidad efectiva de un objeto es objZ + cam.z. */
  const cam = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1, shake: 0 };
  const camPrev = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 };
  const vel = { x: 0, y: 0, z: 0, mag: 0, norm: 0 };

  // fit = ajuste global al ancho de la ventana. Va DENTRO de la cámara (no
  // en un contenedor aparte) para que el canvas de partículas y el DOM se
  // encojan exactamente igual.
  const VIEW = { w: 0, h: 0, cx: 0, cy: 0, persp: 1400, fit: 1 };

  /* Orden CRÍTICO: el punto se lleva primero al sistema de la cámara
     (incluida su Z) y solo DESPUÉS se rota. Con las rotaciones al final
     —a la izquierda en la cadena CSS— el giro ocurre alrededor del ojo,
     como en una cámara real. Al revés, el giro es alrededor del origen
     del mundo: 1,4° de cabeceo con el motivo a 13.600 unidades lo
     desplazaban 333px fuera de cuadro. */
  function camTransform(c) {
    return (
      'rotateX(' + c.rx.toFixed(4) + 'deg) rotateY(' + c.ry.toFixed(4) + 'deg) rotateZ(' + c.rz.toFixed(4) + 'deg) ' +
      'scale(' + (c.scale * VIEW.fit).toFixed(5) + ') ' +
      'translate3d(' + (-c.x).toFixed(2) + 'px,' + (-c.y).toFixed(2) + 'px,' + c.z.toFixed(2) + 'px)'
    );
  }

  /* Proyección idéntica a la que hace el navegador con camTransform,
     para que las partículas del canvas vivan en el MISMO espacio 3D
     que el DOM. Si esto se desincroniza, la ilusión se rompe. */
  const _p = { x: 0, y: 0, z: 0, s: 0, vis: false };
  function project(px, py, pz, c) {
    c = c || cam;
    // OJO: scale() de CSS es scale3d(s, s, 1) — no toca la Z. Si aquí se
    // escalara pz, el canvas y el DOM se separarían al cambiar de tamaño
    // la ventana, que es justo cuando nadie lo estaría mirando.
    const f = c.scale * VIEW.fit;
    let x = (px - c.x) * f;
    let y = (py - c.y) * f;
    let z = pz + c.z;   // al sistema de la cámara ANTES de rotar
    // rotateZ → rotateY → rotateX (orden en que el punto atraviesa la matriz)
    if (c.rz) { const a = c.rz * Math.PI / 180, s = Math.sin(a), co = Math.cos(a); const nx = x * co - y * s; y = x * s + y * co; x = nx; }
    if (c.ry) { const a = c.ry * Math.PI / 180, s = Math.sin(a), co = Math.cos(a); const nx = x * co + z * s; z = -x * s + z * co; x = nx; }
    if (c.rx) { const a = c.rx * Math.PI / 180, s = Math.sin(a), co = Math.cos(a); const ny = y * co - z * s; z = y * s + z * co; y = ny; }
    const P = VIEW.persp;
    if (z >= P - 1) { _p.vis = false; return _p; }       // detrás de la cámara
    const s = P / (P - z);
    _p.x = VIEW.cx + x * s;
    _p.y = VIEW.cy + y * s;
    _p.z = z;
    _p.s = s;
    _p.vis = true;
    return _p;
  }

  /* ── Gestor de calidad ─────────────────────────────────────────
     El film no baja de 60fps: si el equipo no da, se recorta trabajo
     (partículas, blur direccional, profundidad de campo) antes que
     dejar caer frames. Tres niveles, degradación en un solo sentido
     salvo recuperación sostenida. */
  const Quality = {
    tier: 'high',
    dpr: 1,
    mobile: false,
    fps: 60,
    _acc: 0, _n: 0, _lowSince: 0, _hiSince: 0,
    reduced: false,
    init() {
      const mq = window.matchMedia('(max-width: 860px)');
      this.mobile = mq.matches || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const cores = navigator.hardwareConcurrency || 4;
      const mem = navigator.deviceMemory || 4;
      this._forced = new URLSearchParams(location.search).get('tier');
      this.dpr = Math.min(window.devicePixelRatio || 1, this.mobile ? 2 : 2);
      if (this.mobile) this.tier = cores >= 6 && mem >= 4 ? 'med' : 'low';
      else this.tier = cores <= 4 || mem <= 4 ? 'med' : 'high';
      if (this._forced) this.tier = this._forced;
      this._t0 = performance.now();
      this.apply();
    },
    apply() {
      const r = document.documentElement;
      r.setAttribute('data-lx-tier', this.tier);
      if (this.tier === 'low') this.dpr = Math.min(this.dpr, 1.5);
      LX.emit('quality', this.tier);
    },
    sample(dt) {
      this._acc += dt; this._n++;
      if (this._acc < 0.5) return;
      const fps = this._n / this._acc;
      this.fps = this.fps * 0.5 + fps * 0.5;
      this._acc = 0; this._n = 0;
      const now = performance.now();
      // Los dos primeros segundos son compilación, fuentes y primer
      // rasterizado: degradar ahí castiga a equipos que van de sobra.
      if (this._forced || now - this._t0 < 2500) return;
      if (this.fps < 48) {
        if (!this._lowSince) this._lowSince = now;
        else if (now - this._lowSince > 1200 && this.tier !== 'low') {
          this.tier = this.tier === 'high' ? 'med' : 'low';
          this._lowSince = 0;
          this.apply();
        }
      } else this._lowSince = 0;
    },
  };

  /* ── Bus de señales (incluye las marcas para sound design) ────── */
  const listeners = {};
  LX.on = (ev, fn) => { (listeners[ev] || (listeners[ev] = [])).push(fn); return LX; };
  LX.emit = (ev, a, b) => { const l = listeners[ev]; if (l) for (let i = 0; i < l.length; i++) l[i](a, b); };

  /* ── Motor ─────────────────────────────────────────────────────── */
  const Engine = {
    scenes: [],
    cues: [],
    time: 0,
    playing: false,
    rate: 1,
    duration: 0,
    camTrack: null,
    _last: 0,
    _raf: 0,
    _cueIdx: 0,
    _hooks: [],

    scene(def) {
      const s = Object.assign(
        { enabled: true, delay: 0, speed: 1, lead: 0.35, lag: 0.35, ease: null, _on: false },
        def
      );
      this.scenes.push(s);
      this.duration = Math.max(this.duration, s.start + s.dur);
      return s;
    },
    get(id) { return this.scenes.filter((s) => s.id === id)[0]; },
    cue(t, name) { this.cues.push({ t, name }); this.cues.sort((a, b) => a.t - b.t); },
    hook(fn) { this._hooks.push(fn); },

    setCamera(keys) { this.camTrack = Track(keys); },

    play() {
      if (this.playing) return;
      this.playing = true;
      this._last = performance.now();
      LX.emit('play');
      if (!this._raf) this._raf = requestAnimationFrame(this._tick);
    },
    pause() { this.playing = false; LX.emit('pause'); },
    toggle() { this.playing ? this.pause() : this.play(); },
    seek(t, opts) {
      this.time = clamp(t, 0, this.duration + 6);
      this._cueIdx = 0;
      while (this._cueIdx < this.cues.length && this.cues[this._cueIdx].t <= this.time) this._cueIdx++;
      LX.emit('seek', this.time);
      this.render(this.time, true);
      if (!this.playing && !this._raf) this._raf = requestAnimationFrame(this._tick);
    },
    restart() { this.seek(0); this.play(); },

    _tick(now) {
      const E = Engine;
      let dt = (now - E._last) / 1000;
      E._last = now;
      /* Tope BAJO a propósito (dos frames a 60fps). Con un tope alto, un
         frame lento hacía avanzar la cámara el equivalente a seis frames;
         al frame siguiente todos los paneles habían cambiado de escala de
         golpe y había que rasterizarlos otra vez, lo que lo hacía más
         lento todavía. Es una espiral: una vez dentro, no se sale. Con el
         tope bajo el film se alarga unas décimas en un equipo justo, pero
         el movimiento no se rompe. */
      if (dt > 0.034) dt = 0.034;
      Quality.sample(dt);
      if (E.playing) {
        E.time += dt * E.rate;
        if (E.time > E.duration) { E.time = E.duration; E.playing = false; LX.emit('end'); }
        E.render(E.time, false);
      }
      E._raf = requestAnimationFrame(E._tick);
    },

    /* El corazón: estado completo del film en el instante t. */
    render(t, seeking) {
      // 1 — cámara + velocidad determinista (derivada de la pista, no de los frames)
      if (this.camTrack) {
        this.camTrack.at(t, cam);
        this.camTrack.at(Math.max(0, t - 1 / 60), camPrev);
        const f = 60;
        vel.x = (cam.x - camPrev.x) * f;
        vel.y = (cam.y - camPrev.y) * f;
        vel.z = (cam.z - camPrev.z) * f;
        // La velocidad Z se percibe mucho más que la lateral a igual magnitud.
        vel.mag = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z * 0.42);
        vel.norm = clamp(vel.mag / 4200, 0, 1.6);
      }
      // 2 — micro-temblor: la cámara nunca está del todo quieta
      const amp = (cam.shake === undefined ? 1 : cam.shake);
      const c = this._c || (this._c = {});
      c.x = cam.x + noise(t * 0.9, 1) * 3.2 * amp;
      c.y = cam.y + noise(t * 0.77, 2) * 2.4 * amp;
      c.z = cam.z + noise(t * 0.6, 3) * 2.0 * amp;
      c.rx = cam.rx + noise(t * 0.53, 4) * 0.06 * amp;
      c.ry = cam.ry + noise(t * 0.61, 5) * 0.08 * amp;
      c.rz = cam.rz + noise(t * 0.41, 6) * 0.035 * amp;
      c.scale = cam.scale;
      if (this.world) this.world.style.transform = camTransform(c);
      LX.camNow = c;

      // 3 — escenas activas
      const S = this.scenes;
      for (let i = 0; i < S.length; i++) {
        const s = S[i];
        if (!s.enabled) {
          if (s._on) {
            s._on = false;
            if (s.exit) s.exit();
            if (s.el) s.el.classList.remove('is-live');
            if (s.els) for (let k = 0; k < s.els.length; k++) s.els[k].classList.remove('is-live');
          }
          continue;
        }
        const st = s.start + s.delay;
        const dur = s.dur / (s.speed || 1);
        const live = t >= st - s.lead && t <= st + dur + s.lag;
        if (live !== s._on) {
          s._on = live;
          if (s.el) s.el.classList.toggle('is-live', live);
          if (s.els) for (let k = 0; k < s.els.length; k++) s.els[k].classList.toggle('is-live', live);
          if (live && s.enter) s.enter();
          if (!live && s.exit) s.exit();
        }
        if (!live) continue;
        let p = clamp((t - st) / dur, 0, 1);
        if (s.ease) p = s.ease(p);
        if (s.update) s.update(p, t - st, t, { cam: c, vel: vel, seeking: seeking });
      }

      // 4 — enganches globales (blur, profundidad de campo, partículas, HUD)
      for (let i = 0; i < this._hooks.length; i++) this._hooks[i](t, c, vel, seeking);

      // 5 — marcas de sonido (solo hacia delante y solo reproduciendo)
      if (!seeking) {
        while (this._cueIdx < this.cues.length && this.cues[this._cueIdx].t <= t) {
          LX.emit('cue', this.cues[this._cueIdx].name, this.cues[this._cueIdx].t);
          this._cueIdx++;
        }
      }
      LX.emit('frame', t);
    },
  };

  /* ── Medidas de la ventana ─────────────────────────────────────── */
  function measure() {
    VIEW.w = window.innerWidth;
    VIEW.h = window.innerHeight;
    VIEW.cx = VIEW.w / 2;
    VIEW.cy = VIEW.h / 2;
    VIEW.persp = Quality.mobile ? 1000 : 1400;
    // Móvil trabaja con secciones verticales de 430px; escritorio con
    // paneles de 1440. El encaje deja aire a los lados en ambos casos.
    VIEW.fit = Quality.mobile
      ? clamp(VIEW.w / 520, 0.5, 1.25)
      : clamp(Math.min(VIEW.w / 1620, VIEW.h / 1000), 0.52, 1.18);
    if (Engine.stage) Engine.stage.style.perspective = VIEW.persp + 'px';
    LX.emit('resize', VIEW);
  }

  /* ── API pública ───────────────────────────────────────────────── */
  LX.clamp = clamp; LX.lerp = lerp; LX.inv = inv; LX.ramp = ramp;
  LX.bezier = bezier; LX.ease = ease; LX.noise = noise; LX.Track = Track;
  LX.cam = cam; LX.vel = vel; LX.VIEW = VIEW; LX.project = project;
  LX.Quality = Quality; LX.Engine = Engine; LX.measure = measure;
  LX.camTransform = camTransform;

  /* Helper de DOM: crear elementos sin ceremonia. */
  LX.el = function (tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
})();
