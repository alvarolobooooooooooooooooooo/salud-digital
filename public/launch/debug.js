/* ═══════════════════════════════════════════════════════════════════
   launch/debug.js — Modo desarrollo (tecla D o ?debug=1)
   ─────────────────────────────────────────────────────────────────
   Sirve para ajustar el film sin volver a verlo entero: barra de
   scrub, velocidad de reproducción, activar/desactivar escenas y
   retocar duración, retardo y velocidad de cada una en caliente.
   Como render(t) es una función pura del tiempo, cualquier cambio se
   ve en el fotograma actual sin reiniciar.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const LX = window.LX;
  const { Engine, el } = LX;

  const CSS = `
  #lx-dbg{position:fixed;z-index:40;left:16px;top:16px;width:344px;max-height:calc(100vh - 32px);
    overflow:auto;background:rgba(8,9,11,.93);border:1px solid rgba(255,255,255,.1);border-radius:14px;
    font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#cbd5e1;display:none;
    box-shadow:0 24px 60px rgba(0,0,0,.6);backdrop-filter:none}
  #lx-dbg.on{display:block}
  #lx-dbg h4{font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:#22d3ee;padding:12px 14px 6px;font-weight:600}
  #lx-dbg .r{display:flex;align-items:center;gap:8px;padding:4px 14px}
  #lx-dbg .r label{flex:0 0 82px;color:#64748b}
  #lx-dbg input[type=range]{flex:1;accent-color:#06b6d4;height:14px}
  #lx-dbg input[type=number]{width:56px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
    color:#e2e8f0;border-radius:5px;padding:2px 5px;font:inherit}
  #lx-dbg .v{color:#f1f5f9;min-width:60px;text-align:right;font-variant-numeric:tabular-nums}
  #lx-dbg .sc{display:grid;grid-template-columns:14px 1fr 46px 46px 44px;gap:5px;align-items:center;
    padding:3px 14px;border-left:2px solid transparent}
  #lx-dbg .sc.live{border-left-color:#22d3ee;background:rgba(6,182,212,.07)}
  #lx-dbg .sc button{background:none;border:0;color:#94a3b8;cursor:pointer;text-align:left;font:inherit;padding:2px 0}
  #lx-dbg .sc button:hover{color:#22d3ee}
  #lx-dbg .off button{color:#475569;text-decoration:line-through}
  #lx-dbg .hd{display:grid;grid-template-columns:14px 1fr 46px 46px 44px;gap:5px;padding:2px 14px 5px;
    color:#475569;font-size:9px;letter-spacing:.06em}
  #lx-dbg .cam{padding:6px 14px;color:#94a3b8;font-size:10px;white-space:pre;line-height:1.55}
  #lx-dbg .sfx{display:grid;grid-template-columns:10px 1fr 40px;gap:6px;align-items:center;padding:2px 14px}
  #lx-dbg .sfx b{font-weight:400;color:#94a3b8;cursor:pointer;text-align:left}
  #lx-dbg .sfx b:hover{color:#22d3ee}
  #lx-dbg .sfx i{font-style:normal;font-size:9px;text-align:right}
  #lx-dbg .dot{width:6px;height:6px;border-radius:50%;background:#475569}
  #lx-dbg .dot.on{background:#10b981;box-shadow:0 0 6px rgba(16,185,129,.7)}
  #lx-dbg .dot.opt{background:#334155}
  #lx-dbg .sfx.gone b{color:#64748b}
  #lx-dbg .sfx.gone i{color:#f59e0b}
  #lx-dbg .vol{display:grid;grid-template-columns:64px 1fr 30px;gap:6px;align-items:center;padding:2px 14px}
  #lx-dbg .vol label{color:#64748b}
  #lx-dbg .vol input{accent-color:#06b6d4;height:12px}
  #lx-dbg .vol span{color:#94a3b8;text-align:right;font-variant-numeric:tabular-nums}
  #lx-dbg .warn{padding:6px 14px;color:#f59e0b;font-size:9.5px;line-height:1.5}
  #lx-dbg .foot{padding:8px 14px 12px;color:#475569;font-size:9.5px;border-top:1px solid rgba(255,255,255,.07);margin-top:6px}
  #lx-dbg .cue{color:#f59e0b}
  #lx-fps{position:fixed;z-index:41;right:16px;top:16px;background:rgba(8,9,11,.86);border:1px solid rgba(255,255,255,.1);
    border-radius:9px;padding:6px 11px;font:11px ui-monospace,Menlo,monospace;color:#22d3ee;display:none}
  #lx-fps.on{display:block}`;

  const Debug = {
    on: false,
    init(open) {
      const st = el('style'); st.textContent = CSS; document.head.appendChild(st);
      const p = el('div'); p.id = 'lx-dbg';
      const fps = el('div'); fps.id = 'lx-fps';
      document.body.appendChild(p); document.body.appendChild(fps);
      this.p = p; this.fpsEl = fps;

      p.innerHTML =
        '<h4>Launch · modo desarrollo</h4>' +
        '<div class="r"><label>tiempo</label><input id="dScrub" type="range" min="0" max="1000" value="0"><span class="v" id="dTime">0.00s</span></div>' +
        '<div class="r"><label>velocidad</label><input id="dRate" type="range" min="5" max="300" value="100"><span class="v" id="dRateV">1.00×</span></div>' +
        '<div class="r"><label></label><button class="v" id="dPlay" style="background:none;border:0;color:#22d3ee;cursor:pointer;font:inherit">▶ play / pausa</button></div>' +
        '<h4>Escenas</h4><div class="hd"><span></span><span>escena</span><span>dur</span><span>delay</span><span>vel</span></div>' +
        '<div id="dScenes"></div>' +
        '<h4>Cámara</h4><div class="cam" id="dCam"></div>' +
        '<h4>Sonido</h4><div id="dSfxState" class="warn"></div>' +
        '<div id="dSfxVols"></div><div id="dSfxList"></div>' +
        '<div class="foot">espacio play · ←/→ scrub (shift ×5) · R reinicia · 1-9 salta a escena · D cierra</div>';

      const scenes = p.querySelector('#dScenes');
      Engine.scenes.forEach((s, i) => {
        const row = el('div', 'sc');
        row.dataset.id = s.id;
        row.innerHTML =
          '<input type="checkbox" checked style="accent-color:#06b6d4;margin:0">' +
          '<button>' + (s.label || s.id) + '</button>' +
          '<input type="number" step="0.1" value="' + s.dur + '">' +
          '<input type="number" step="0.1" value="' + s.delay + '">' +
          '<input type="number" step="0.05" value="' + s.speed + '">';
        const [chk, btn, dur, dly, spd] = row.children;
        chk.addEventListener('change', () => { s.enabled = chk.checked; row.classList.toggle('off', !chk.checked); Engine.render(Engine.time, true); });
        btn.addEventListener('click', () => Engine.seek(s.start + 0.01));
        dur.addEventListener('input', () => { s.dur = parseFloat(dur.value) || 0.1; Engine.render(Engine.time, true); });
        dly.addEventListener('input', () => { s.delay = parseFloat(dly.value) || 0; Engine.render(Engine.time, true); });
        spd.addEventListener('input', () => { s.speed = parseFloat(spd.value) || 1; Engine.render(Engine.time, true); });
        scenes.appendChild(row);
        s._row = row;
      });

      /* ── Banco de pruebas de SFX ────────────────────────────────
         Cada sonido se puede disparar suelto para poder sustituir los
         .wav sin tener que ver el film entero. El punto de la izquierda
         dice si el archivo está o falta. */
      const sfxList = p.querySelector('#dSfxList');
      const sfxVols = p.querySelector('#dSfxVols');
      const sfxState = p.querySelector('#dSfxState');
      const paintSfx = () => {
        const S = LX.SFX;
        if (!S) { sfxState.textContent = 'sistema de audio no cargado'; return; }
        if (!S.enabled) {
          sfxState.textContent = 'silencio · pulsa el botón de sonido (abajo a la izquierda) para activarlo';
        } else if (!S.ready) {
          sfxState.textContent = 'cargando sonidos…';
        } else if (S.missing.length) {
          sfxState.textContent = 'faltan ' + S.missing.length + ' archivos en /public/audio/sfx/ — los disparadores ya están montados';
        } else {
          sfxState.textContent = 'todos los sonidos cargados';
        }
        [].forEach.call(sfxList.children, (row) => {
          const n = row.dataset.n;
          const has = S.has(n);
          const opt = S.isOptional(n);
          row.classList.toggle('gone', !has && !opt);
          row.children[0].className = 'dot' + (has ? ' on' : opt ? ' opt' : '');
          row.children[2].textContent = has ? 'ok' : opt ? 'opc.' : 'falta';
        });
      };
      if (LX.SFX) {
        const reg = LX.SFX.registry();
        Object.keys(reg).forEach((n) => {
          const row = el('div', 'sfx');
          row.dataset.n = n;
          row.innerHTML = '<span class="dot"></span><b>' + n + '</b><i></i>';
          row.children[1].addEventListener('click', () => {
            if (!LX.SFX.enabled) LX.SFX.setEnabled(true);
            if (reg[n].loop) {
              LX.SFX.bed(n, !LX.SFX._beds[n]);
            } else LX.SFX.play(n);
          });
          sfxList.appendChild(row);
        });
        const cats = LX.SFX.categories();
        const volRow = (label, get, set) => {
          const r = el('div', 'vol');
          r.innerHTML = '<label>' + label + '</label><input type="range" min="0" max="120" value="' +
            Math.round(get() * 100) + '"><span>' + Math.round(get() * 100) + '</span>';
          r.children[1].addEventListener('input', (e) => {
            const v = e.target.value / 100;
            set(v);
            r.children[2].textContent = e.target.value;
          });
          sfxVols.appendChild(r);
        };
        volRow('master', () => 0.9, (v) => LX.SFX.setMaster(v));
        Object.keys(cats).forEach((c) => volRow(c, () => cats[c], (v) => LX.SFX.setCategory(c, v)));
        LX.on('sfx-loaded', paintSfx);
        LX.on('sfx-toggle', paintSfx);
      }
      this._paintSfx = paintSfx;

      const scrub = p.querySelector('#dScrub');
      const rate = p.querySelector('#dRate');
      let dragging = false;
      scrub.addEventListener('pointerdown', () => { dragging = true; Engine.pause(); });
      window.addEventListener('pointerup', () => (dragging = false));
      scrub.addEventListener('input', () => Engine.seek((scrub.value / 1000) * Engine.duration));
      rate.addEventListener('input', () => {
        Engine.rate = rate.value / 100;
        p.querySelector('#dRateV').textContent = Engine.rate.toFixed(2) + '×';
      });
      p.querySelector('#dPlay').addEventListener('click', () => Engine.toggle());

      const tEl = p.querySelector('#dTime'), camEl = p.querySelector('#dCam');
      LX.on('cue', (n) => { this._cue = n; this._cueT = performance.now(); });
      LX.on('frame', (t) => {
        if (!this.on) return;
        if (!dragging) scrub.value = Math.round((t / Engine.duration) * 1000);
        tEl.textContent = t.toFixed(2) + 's';
        const c = LX.camNow || LX.cam, v = LX.vel;
        camEl.textContent =
          'z ' + c.z.toFixed(0).padStart(7) + '   x ' + c.x.toFixed(0).padStart(5) + '   y ' + c.y.toFixed(0).padStart(5) + '\n' +
          'ry ' + c.ry.toFixed(2).padStart(6) + '  rx ' + c.rx.toFixed(2).padStart(6) + '  rz ' + c.rz.toFixed(2).padStart(6) + '\n' +
          'vel ' + v.norm.toFixed(3) + '   dof ' + (c.dof || 0).toFixed(2) + '   mb ' + (c.mb || 0).toFixed(2) + '\n' +
          (this._cue && performance.now() - this._cueT < 1600 ? '♪ ' + this._cue : '');
        Engine.scenes.forEach((s) => s._row.classList.toggle('live', s._on));
        this.fpsEl.textContent = LX.Quality.fps.toFixed(0) + ' fps · ' + LX.Quality.tier;
        this.fpsEl.style.color = LX.Quality.fps > 55 ? '#22d3ee' : LX.Quality.fps > 45 ? '#f59e0b' : '#ef4444';
      });
      paintSfx();
      if (open) this.toggle();
    },
    toggle() {
      this.on = !this.on;
      if (!this.on === false && this._paintSfx) this._paintSfx();
      LX.debugOn = this.on;
      this.p.classList.toggle('on', this.on);
      this.fpsEl.classList.toggle('on', this.on);
    },
  };
  LX.Debug = Debug;
})();
