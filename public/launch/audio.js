/* ═══════════════════════════════════════════════════════════════════
   launch/audio.js — Capa de sound design del Launch
   ─────────────────────────────────────────────────────────────────
   MOTION → SOUND. Este archivo no toca NADA del visual: se limita a
   leer la pista de cámara y las escenas ya existentes y a disparar
   sonido cuando el movimiento lo pide.

   Dos decisiones que sostienen todo lo demás:

   1) Los tiempos NO están escritos a mano. Se derivan muestreando la
      propia pista de cámara al arrancar (analyze()): dónde cruza cada
      pantalla, dónde están los picos de velocidad y dónde el frenazo.
      Si mañana se retoca el timing del film, el sonido se recoloca
      solo. Escribir los segundos a mano habría durado hasta el primer
      cambio de una escena.

   2) Nada de setTimeout. Las señales salen del reloj del film
      (evento 'frame' del motor), así que pausar, hacer scrub o
      reiniciar se comportan como debe ser.

   Los archivos de audio NO se inventan: si un .wav no está, su
   disparador queda montado y en silencio, y el panel de desarrollo lo
   marca como ausente. Ver public/audio/sfx/README.md.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const LX = window.LX;
  const BASE = '/audio/sfx/';

  /* ── Catálogo ───────────────────────────────────────────────────
     cat: canal de mezcla. gain: nivel propio del sonido dentro de su
     canal (headroom: ningún sonido llega a 1 salvo el impacto final). */
  const REGISTRY = {
    'logo-pulse':          { file: 'logo-pulse.m4a',          cat: 'logo',        gain: 0.85 },
    'connection-bloom':    { file: 'connection-bloom.m4a',    cat: 'logo',        gain: 0.70 },
    'data-activation':     { file: 'data-activation.m4a',     cat: 'transitions', gain: 0.75 },
    'ui-morph':            { file: 'ui-morph.m4a',            cat: 'transitions', gain: 0.75 },
    'camera-acceleration': { file: 'camera-acceleration.m4a', cat: 'transitions', gain: 0.80 },
    'high-speed-pass':     { file: 'high-speed-pass.m4a',     cat: 'transitions', gain: 0.75 },
    'cinematic-brake':     { file: 'cinematic-brake.m4a',     cat: 'impacts',     gain: 0.90 },
    // El único que sigue en WAV: es un bucle, y el relleno que mete el
    // codificador AAC al principio y al final le abriría una costura.
    'data-flow':           { file: 'data-flow.wav',           cat: 'ui',          gain: 0.40, loop: true },
    'ui-click':            { file: 'ui-click.m4a',            cat: 'ui',          gain: 0.65 },
    'device-shift':        { file: 'device-shift.m4a',        cat: 'transitions', gain: 0.65 },
    'final-riser':         { file: 'final-riser.m4a',         cat: 'impacts',     gain: 0.75 },
    'final-impact':        { file: 'final-impact.m4a',        cat: 'impacts',     gain: 1.00 },
    // Opcional: cama de fondo para el vacío inicial. Si no existe, el
    // film suena igual de bien; por eso no cuenta como asset pendiente.
    'ambience':            { file: 'ambience.m4a',            cat: 'ambience',    gain: 0.28, loop: true, optional: true },
    // La banda sonora vive fuera de sfx/ porque no es un efecto: es una
    // pista de 35 s que corre pegada al reloj del film.
    'score':               { file: '/audio/launch-score.m4a',  cat: 'music',       gain: 0.80, optional: true },
  };

  const CATEGORIES = { music: 0.85, logo: 0.9, transitions: 0.85, ui: 0.8, impacts: 1.0, ambience: 0.6 };

  /* ── Análisis del movimiento ────────────────────────────────────
     Se muestrea la pista de cámara (no las escenas: es una función
     pura, sin efectos secundarios) y se sacan los instantes que el
     sonido necesita. Misma fórmula de velocidad que usa el motor. */
  function analyze() {
    const E = LX.Engine, T = LX.Film.T;
    const tr = E.camTrack;
    if (!tr) return null;
    const HZ = 120, N = Math.round(E.duration * HZ);
    const a = {}, b = {};
    const prof = new Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const t = i / HZ;
      tr.at(t, a);
      tr.at(Math.max(0, t - 1 / 60), b);
      const vx = (a.x - b.x) * 60, vy = (a.y - b.y) * 60, vz = (a.z - b.z) * 60;
      prof[i] = { t: t, z: a.z, mag: Math.sqrt(vx * vx + vy * vy + vz * vz * 0.42) };
    }

    const between = (t0, t1) => prof.filter((o) => o.t >= t0 && o.t <= t1);
    const ramp = between(T.speed, T.macro + 0.4);

    // Picos locales de velocidad = los pases rápidos por delante de
    // cada pantalla. El umbral sale del propio perfil, no de un número
    // inventado: la mitad del pico máximo del tramo.
    const peakMax = ramp.reduce((m, o) => Math.max(m, o.mag), 0);
    const thr = peakMax * 0.28;
    const passes = [];
    for (let i = 12; i < ramp.length - 12; i++) {
      const v = ramp[i].mag;
      if (v < thr) continue;
      let top = true;
      for (let k = i - 12; k <= i + 12; k++) if (ramp[k].mag > v) { top = false; break; }
      if (top && (!passes.length || ramp[i].t - passes[passes.length - 1].t > 0.4)) {
        passes.push({ t: ramp[i].t, mag: v });
      }
    }
    // Frenazo: la caída de velocidad más brusca del tramo.
    let brake = { t: T.macro, d: 0 };
    for (let i = 16; i < ramp.length; i++) {
      const d = ramp[i - 16].mag - ramp[i].mag;
      if (d > brake.d) brake = { t: ramp[i - 8].t, d: d };
    }
    // Arranque de la rampa: primer instante en que despega de la parada.
    let rampStart = T.speed;
    for (let i = 0; i < ramp.length; i++) {
      if (ramp[i].mag > peakMax * 0.05) { rampStart = ramp[i].t; break; }
    }
    return { prof: prof, passes: passes, brake: brake, rampStart: rampStart, peakMax: peakMax };
  }

  /* ── Guion de señales ───────────────────────────────────────────
     Cada entrada: { t, sfx, gain?, rate?, bed? }. Los tiempos vienen
     del análisis y de la línea de tiempo real (LX.Film.T), nunca de
     constantes copiadas. */
  function buildSchedule(an) {
    const T = LX.Film.T;
    const S = [];
    const add = (t, sfx, o) => S.push(Object.assign({ t: t, sfx: sfx }, o || {}));

    // 01 · el vacío: cama de fondo (opcional)
    add(0.2, 'ambience', { bed: 'start' });

    // 02 · las partículas convergen y el logotipo cuaja
    const logoScene = LX.Engine.get('logo');
    add(logoScene.start + 1.8, 'connection-bloom', { gain: 0.5, rate: 0.92 });
    add(logoScene.start + 2.28, 'logo-pulse');

    // 03 · del logotipo salen las conexiones; el ecosistema se abre
    add(T.eco + 0.7, 'connection-bloom');
    add(T.eco + 2.1, 'data-activation', { gain: 0.85 });

    // 04 · la red se convierte en interfaz
    add(T.dash + 0.65, 'ui-morph');

    // 05 · rampa: aceleración y un pase por cada pantalla. El tono y el
    //      nivel de cada pase salen de su velocidad MEDIDA, así que el
    //      sonido sigue de verdad a la cámara y no se repite igual.
    add(an.rampStart - 0.12, 'camera-acceleration');
    an.passes.forEach((p, i) => {
      const k = p.mag / an.peakMax;                 // 0…1 respecto al pico real
      add(p.t - 0.06, 'high-speed-pass', {
        gain: 0.55 + k * 0.45,
        rate: 0.94 + k * 0.20 + (i % 2) * 0.03,
      });
    });

    // 06 · frenazo cinematográfico contra la tarjeta macro
    add(an.brake.t, 'cinematic-brake');

    // 07 · microinteracciones: el cursor pulsa y la cita se confirma
    add(T.macro + 2.0, 'ui-click');
    add(T.macro + 2.35, 'ui-click', { gain: 0.5, rate: 1.18 });

    // 08 · el dato viaja: cama sutil mientras dura el flujo
    add(T.flow - 0.15, 'data-flow', { bed: 'start' });
    add(T.dev + 0.5, 'data-flow', { bed: 'stop' });

    // 09 · dispositivos: DOS cambios de formato, no uno
    const dev = LX.Engine.get('dev');
    add(dev.start + 0.45, 'device-shift');
    add(dev.start + 1.45, 'device-shift', { rate: 1.07, gain: 0.6 });

    // 10 · el riser tiene que EMPEZAR antes del latigazo para resolver
    //      justo en el impacto del héroe
    add(T.whip - 1.15, 'final-riser');
    add(T.whip + 0.05, 'high-speed-pass', { gain: 0.5, rate: 1.25 });

    // 11 · el momento de marca
    add(T.hero + 0.1, 'final-impact');

    // 12 · el ecosistema se abre a otra escala y el film se posa
    add(T.final + 0.2, 'data-activation', { gain: 0.55, rate: 0.88 });
    add(T.cta, 'logo-pulse', { gain: 0.4, rate: 0.8 });
    add(T.end - 0.2, 'ambience', { bed: 'stop' });

    S.sort((x, y) => x.t - y.t);
    return S;
  }

  /* ── Motor de audio ─────────────────────────────────────────────── */
  const SFX = {
    ready: false,
    enabled: false,
    ctx: null,
    buffers: {},
    missing: [],
    schedule: [],
    analysis: null,
    _idx: 0,
    _last: -1,
    _beds: {},
    _busGain: {},
    _master: null,
    _muteGain: null,

    init() {
      if (!LX.Film || !LX.Engine.camTrack) return;
      this.analysis = analyze();
      this.schedule = this.analysis ? buildSchedule(this.analysis) : [];

      // Preferencia recordada. Por defecto en silencio: el navegador
      // bloquea el audio sin gesto y arrancar callado es lo correcto.
      let pref = null;
      try { pref = localStorage.getItem('sd_launch_sfx'); } catch (e) {}
      this.enabled = pref === 'on';

      this._wireClock();
      this._wireControl();
      if (this.enabled) this._boot();          // se reanudará al primer gesto
      LX.emit('sfx-ready', this);
    },

    /* La música corre PEGADA al tiempo del film: al pausar se para y al
       saltar vuelve a arrancar desde el punto correcto (offset), no desde
       el principio. Un one-shot normal se habría desincronizado al primer
       scrub. */
    _syncScore(t) {
      this._stopScore();
      const buf = this.buffers['score'];
      if (!buf || !this.enabled || !this.ctx) return;
      if (t >= buf.duration) return;
      const def = REGISTRY['score'];
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = def.gain;
      src.connect(g).connect(this._busGain[def.cat] || this._master);
      src.onended = () => { try { src.disconnect(); g.disconnect(); } catch (e) {} };
      src.start(0, Math.max(0, t));
      this._score = { src: src, gain: g };
    },
    _stopScore() {
      if (!this._score) return;
      try { this._score.src.stop(); this._score.src.disconnect(); this._score.gain.disconnect(); } catch (e) {}
      this._score = null;
    },

    /* El reloj del film manda: nada de temporizadores propios. */
    _wireClock() {
      LX.on('play', () => this._syncScore(LX.Engine.time));
      LX.on('pause', () => this._stopScore());
      LX.on('end', () => this._stopScore());
      LX.on('frame', (t) => {
        if (!this.ready || !this.enabled) { this._last = t; return; }
        // Un salto hacia atrás o muy grande es un scrub: recolocar sin sonar.
        if (t < this._last || t - this._last > 0.34) {
          this._reindex(t);
          this._stopAllBeds();
          this._last = t;
          return;
        }
        while (this._idx < this.schedule.length && this.schedule[this._idx].t <= t) {
          const c = this.schedule[this._idx++];
          if (c.t <= this._last) continue;      // ya pasó
          this._fire(c);
        }
        this._last = t;
        this._modulate();
      });
      LX.on('seek', (t) => {
        this._reindex(t); this._stopAllBeds(); this._last = t;
        if (LX.Engine.playing) this._syncScore(t); else this._stopScore();
      });
      window.addEventListener('pagehide', () => this.dispose(), { once: true });
    },

    _reindex(t) {
      this._idx = 0;
      while (this._idx < this.schedule.length && this.schedule[this._idx].t <= t) this._idx++;
    },

    _fire(c) {
      if (c.bed === 'start') this.bed(c.sfx, true, c);
      else if (c.bed === 'stop') this.bed(c.sfx, false, c);
      else this.play(c.sfx, c);
      if (LX.debugOn) console.log('%c♪ ' + c.sfx, 'color:#22d3ee', c.t.toFixed(2) + 's');
    },

    /* La cama del flujo de datos respira con la velocidad de cámara.
       Cuantizado: sin esto se escribiría en el grafo de audio 60 veces
       por segundo para cambios que nadie oye. */
    _modulate() {
      const bed = this._beds['data-flow'];
      if (!bed) return;
      const v = Math.min(LX.vel.norm || 0, 1.2);
      const g = Math.round((0.55 + v * 0.45) * 20) / 20;
      if (bed._g === g) return;
      bed._g = g;
      bed.gain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.12);
    },

    /* ── Contexto y carga ─────────────────────────────────────────── */
    _boot() {
      if (this.ctx) return this._resume();
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this._master = this.ctx.createGain();
      this._master.gain.value = 0.9;                    // headroom
      this._muteGain = this.ctx.createGain();
      this._muteGain.gain.value = this.enabled ? 1 : 0;
      this._master.connect(this._muteGain).connect(this.ctx.destination);
      for (const k in CATEGORIES) {
        const g = this.ctx.createGain();
        g.gain.value = CATEGORIES[k];
        g.connect(this._master);
        this._busGain[k] = g;
      }
      this._load();
    },

    _resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

    _load() {
      const names = Object.keys(REGISTRY);
      let pending = names.length;
      names.forEach((name) => {
        const def = REGISTRY[name];
        fetch(def.file.charAt(0) === '/' ? def.file : BASE + def.file, { cache: 'force-cache' })
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
          .then((buf) => this.ctx.decodeAudioData(buf))
          .then((audio) => { this.buffers[name] = audio; })
          .catch(() => { if (!def.optional) this.missing.push(name); })
          .then(() => {
            if (--pending === 0) {
              this.ready = true;
              if (LX.Engine.playing) this._syncScore(LX.Engine.time);
              this._reindex(LX.Engine.time);
              this._last = LX.Engine.time;
              if (this.missing.length) {
                console.warn('[launch/sfx] faltan ' + this.missing.length + ' de ' +
                  names.filter((n) => !REGISTRY[n].optional).length +
                  ' sonidos en ' + BASE + ' → ' + this.missing.join(', ') +
                  '\n  Los disparadores están montados: en cuanto se copien los .wav suenan solos.');
              }
              LX.emit('sfx-loaded', this);
            }
          });
      });
    },

    /* ── API ──────────────────────────────────────────────────────── */
    play(name, opts) {
      const def = REGISTRY[name];
      const buf = this.buffers[name];
      if (!def || !buf || !this.ctx) return false;    // sin archivo, silencio
      opts = opts || {};
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = opts.rate || 1;
      const g = this.ctx.createGain();
      g.gain.value = (opts.gain != null ? opts.gain : 1) * def.gain;
      src.connect(g).connect(this._busGain[def.cat] || this._master);
      // Sin esto, cada disparo deja un nodo colgando del grafo.
      src.onended = () => { try { src.disconnect(); g.disconnect(); } catch (e) {} };
      src.start();
      return true;
    },

    bed(name, on, opts) {
      const def = REGISTRY[name];
      if (!def || !this.ctx) return false;
      if (!on) {
        const b = this._beds[name];
        if (!b) return false;
        b.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
        const src = b.src;
        setTimeout(() => { try { src.stop(); src.disconnect(); b.gain.disconnect(); } catch (e) {} }, 900);
        delete this._beds[name];
        return true;
      }
      if (this._beds[name] || !this.buffers[name]) return false;
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers[name];
      src.loop = true;
      src.playbackRate.value = (opts && opts.rate) || 1;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      src.connect(g).connect(this._busGain[def.cat] || this._master);
      src.start();
      g.gain.setTargetAtTime((opts && opts.gain != null ? opts.gain : 1) * def.gain, this.ctx.currentTime, 0.4);
      this._beds[name] = { src: src, gain: g };
      return true;
    },

    _stopAllBeds() { for (const k in this._beds) this.bed(k, false); },

    setEnabled(on) {
      this.enabled = !!on;
      try { localStorage.setItem('sd_launch_sfx', on ? 'on' : 'off'); } catch (e) {}
      if (on) { this._boot(); this._resume(); }
      if (this._muteGain) {
        this._muteGain.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.08);
      }
      if (!on) { this._stopAllBeds(); this._stopScore(); }
      else if (LX.Engine.playing) this._syncScore(LX.Engine.time);
      this._reindex(LX.Engine.time);
      this._last = LX.Engine.time;
      this._paint();
      LX.emit('sfx-toggle', on);
    },
    toggle() { this.setEnabled(!this.enabled); },

    setCategory(cat, v) {
      CATEGORIES[cat] = v;
      if (this._busGain[cat]) this._busGain[cat].gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    },
    setMaster(v) { if (this._master) this._master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); },
    categories() { return CATEGORIES; },
    registry() { return REGISTRY; },
    has(name) { return !!this.buffers[name]; },
    isOptional(name) { return !!(REGISTRY[name] && REGISTRY[name].optional); },

    dispose() {
      this._stopAllBeds();
      this._stopScore();
      if (this.ctx && this.ctx.state !== 'closed') { try { this.ctx.close(); } catch (e) {} }
      this.ctx = null; this.buffers = {}; this.ready = false;
    },

    /* ── Control discreto de sonido ───────────────────────────────── */
    _wireControl() {
      const btn = document.getElementById('lx-sound');
      if (!btn) return;
      this._btn = btn;
      this._paint();
      btn.addEventListener('click', () => this.toggle());
      // El primer gesto en cualquier sitio reanuda el contexto si el
      // navegador lo dejó suspendido.
      const kick = () => this._resume();
      window.addEventListener('pointerdown', kick, { passive: true });
      window.addEventListener('keydown', kick);
    },

    _paint() {
      if (!this._btn) return;
      this._btn.classList.toggle('is-on', this.enabled);
      this._btn.setAttribute('aria-pressed', this.enabled ? 'true' : 'false');
      this._btn.setAttribute('aria-label', this.enabled ? 'Silenciar' : 'Activar sonido');
      this._btn.title = this.enabled ? 'Silenciar' : 'Activar sonido';
    },
  };

  LX.SFX = SFX;
})();
