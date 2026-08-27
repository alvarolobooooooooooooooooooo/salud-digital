/* ═══════════════════════════════════════════════════════════════════
   launch/fx.js — Capa de partículas y red del ecosistema
   ─────────────────────────────────────────────────────────────────
   Dos lienzos (uno detrás del mundo 3D y otro delante) dibujados con
   LA MISMA proyección que usa el DOM (LX.project). Por eso el polvo,
   el logo de partículas y la red comparten cámara con las tarjetas:
   si se proyectaran aparte, al mover la cámara se notaría el desfase.

   Reglas de rendimiento que sostienen los 60fps:
   · el brillo sale de un sprite pre-renderizado, nunca de shadowBlur;
   · todas las líneas del mismo color van en UN solo path + un stroke;
   · si todos los modos están a 0, no se dibuja ni se limpia nada.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const LX = window.LX;
  const { clamp, lerp, project, ease } = LX;

  const COL = {
    cyan: [16, 190, 251],
    cyanDeep: [6, 182, 212],
    navy: [46, 123, 224],
    white: [226, 245, 255],
    dim: [90, 120, 150],
  };

  /* ── Sprite de brillo: un disco con caída suave. Dibujarlo escalado
     cuesta una fracción de lo que cuesta un shadowBlur por partícula. */
  function makeSprite(rgb, size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    const s = rgb.join(',');
    g.addColorStop(0, 'rgba(' + s + ',1)');
    g.addColorStop(0.25, 'rgba(' + s + ',0.55)');
    g.addColorStop(0.55, 'rgba(' + s + ',0.14)');
    g.addColorStop(1, 'rgba(' + s + ',0)');
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
    return c;
  }

  /* ── Geometría real del logotipo ────────────────────────────────
     La marca son cuatro bloques de esquinas redondeadas en cruz con el
     centro vacío: tres cian y el del oeste marino. Se rasteriza una vez
     a baja resolución y se leen los píxeles opacos: así los puntos de
     destino de las partículas son EXACTAMENTE la silueta del logo, no
     una aproximación dibujada a mano. */
  const LOGO_BLOCKS = [
    { x: 185, y: 30, w: 147, h: 155, r: [46, 46, 8, 46], c: 'cyan' },   // norte
    { x: 330, y: 180, w: 148, h: 150, r: [8, 46, 46, 46], c: 'cyan' },  // este
    { x: 185, y: 325, w: 147, h: 155, r: [46, 8, 46, 46], c: 'cyan' },  // sur
    { x: 33, y: 178, w: 149, h: 150, r: [46, 46, 46, 46], c: 'navy' },  // oeste
  ];

  function roundRect(x, rc, b) {
    const [r1, r2, r3, r4] = b.r;
    x.beginPath();
    x.moveTo(b.x + r1, b.y);
    x.lineTo(b.x + b.w - r2, b.y);
    x.quadraticCurveTo(b.x + b.w, b.y, b.x + b.w, b.y + r2);
    x.lineTo(b.x + b.w, b.y + b.h - r3);
    x.quadraticCurveTo(b.x + b.w, b.y + b.h, b.x + b.w - r3, b.y + b.h);
    x.lineTo(b.x + r4, b.y + b.h);
    x.quadraticCurveTo(b.x, b.y + b.h, b.x, b.y + b.h - r4);
    x.lineTo(b.x, b.y + r1);
    x.quadraticCurveTo(b.x, b.y, b.x + r1, b.y);
    x.closePath();
  }

  function sampleLogo(step) {
    const N = 512;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const x = c.getContext('2d');
    LOGO_BLOCKS.forEach((b) => {
      x.fillStyle = b.c === 'navy' ? '#ff0000' : '#00ff00';   // canal = color de marca
      roundRect(x, null, b);
      x.fill();
    });
    const d = x.getImageData(0, 0, N, N).data;
    const pts = [];
    for (let y = 0; y < N; y += step) {
      for (let px = 0; px < N; px += step) {
        const i = (y * N + px) * 4;
        if (d[i + 3] < 128) continue;
        pts.push({
          x: (px - N / 2) / (N / 2),          // −1 … 1
          y: (y - N / 2) / (N / 2),
          navy: d[i] > 128,
          edge: false,
        });
      }
    }
    // Marcar los puntos de borde: son los que reciben las "líneas que
    // se alinean" en el último tramo de la formación.
    const key = {};
    pts.forEach((p) => (key[Math.round(p.x * 1000) + ':' + Math.round(p.y * 1000)] = true));
    const k = (step / (N / 2)) * 1000;
    pts.forEach((p) => {
      const gx = Math.round(p.x * 1000), gy = Math.round(p.y * 1000);
      let n = 0;
      if (key[gx + Math.round(k) + ':' + gy]) n++;
      if (key[gx - Math.round(k) + ':' + gy]) n++;
      if (key[gx + ':' + (gy + Math.round(k))]) n++;
      if (key[gx + ':' + (gy - Math.round(k))]) n++;
      p.edge = n < 4;
    });
    return pts;
  }

  /* ── Nodos del ecosistema ───────────────────────────────────────
     Seis familias reales del producto. El anillo interior lleva
     etiqueta; el resto son satélites que dan densidad. */
  const FAMILIES = [
    { label: 'Pacientes', a: -90 },
    { label: 'Médicos', a: -30 },
    { label: 'Clínicas', a: 30 },
    { label: 'Laboratorios', a: 90 },
    { label: 'Farmacias', a: 150 },
    { label: 'Expedientes', a: 210 },
  ];

  const FX = {
    modes: { dust: 0, logo: 0, network: 0, warp: 0, stream: 0, streak: 0, netScale: 1, netLabels: 0 },
    parts: [],
    logoPts: [],
    nodes: [],
    edges: [],
    ready: false,

    init(back, front) {
      this.back = back; this.front = front;
      this.bx = back.getContext('2d', { alpha: true });
      this.fx = front.getContext('2d', { alpha: true });
      const tier = LX.Quality.tier;
      this.sprites = {
        cyan: makeSprite(COL.cyan, 64),
        cyanDeep: makeSprite(COL.cyanDeep, 64),
        navy: makeSprite(COL.navy, 64),
        white: makeSprite(COL.white, 64),
        dim: makeSprite(COL.dim, 64),
      };

      // Muestreo del logo: menos denso en móvil, pero la silueta se
      // reconoce igual porque los puntos caen sobre la forma real.
      const step = tier === 'high' ? 9 : tier === 'med' ? 13 : 17;
      this.logoPts = sampleLogo(step);
      // Barajado determinista: sin esto se toman los primeros N puntos
      // del muestreo, que van por filas — el logo se formaba solo por
      // arriba y el bloque sur no llegaba nunca.
      let sd = 1337;
      const rnd = () => ((sd = (sd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      for (let i = this.logoPts.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        const tmp = this.logoPts[i]; this.logoPts[i] = this.logoPts[j]; this.logoPts[j] = tmp;
      }

      const N = tier === 'high' ? 620 : tier === 'med' ? 400 : 240;
      this.build(N);
      this.buildNetwork();
      this.resize();
      this.ready = true;
      // Si el gestor de calidad baja de nivel, hay que rehacer el campo:
      // degradar sin tocar las partículas dejaba las 900 del nivel alto.
      LX.on('quality', (tier) => {
        if (!this.ready) return;
        const n = tier === 'high' ? 620 : tier === 'med' ? 400 : 240;
        if (n !== this.parts.length) { this.build(n); this.resize(); }
      });
    },

    /* Cada partícula tiene tres vidas: polvo a la deriva, punto del
       logotipo y nodo/satélite del ecosistema. No se crean ni destruyen
       partículas en ningún momento del film — se transforman, que es
       justo lo que la narrativa dice que hace el producto. */
    build(n) {
      const P = [];
      const L = this.logoPts;
      const R = 2600;
      for (let i = 0; i < n; i++) {
        const lp = L[i % L.length];
        const useLogo = i < Math.min(n * 0.78, L.length);
        const a = Math.random() * Math.PI * 2;
        const r = Math.pow(Math.random(), 0.55) * R;
        P.push({
          // deriva (polvo del vacío)
          dx: Math.cos(a) * r,
          dy: (Math.random() - 0.5) * 1700,
          dz: -3200 + Math.random() * 4200,
          sp: 0.25 + Math.random() * 0.85,
          ph: Math.random() * Math.PI * 2,
          // destino en el logotipo
          lx: useLogo ? lp.x : 0,
          ly: useLogo ? lp.y : 0,
          navy: useLogo ? lp.navy : false,
          edge: useLogo ? lp.edge : false,
          inLogo: useLogo,
          // orden de llegada: de fuera hacia dentro, con jitter
          ord: useLogo ? clamp(Math.sqrt(lp.x * lp.x + lp.y * lp.y) / 1.42, 0, 1) * 0.6 + Math.random() * 0.4 : Math.random(),
          size: 0.7 + Math.random() * 1.9,
          alpha: 0.25 + Math.random() * 0.75,
          // posición proyectada del frame anterior, para las estelas
          px: 0, py: 0, ps: 0, has: false,
          x: 0, y: 0, z: 0,
        });
      }
      this.parts = P;
    },

    buildNetwork() {
      const nodes = [];
      const edges = [];
      // hub = el logotipo
      nodes.push({ x: 0, y: 0, z: 0, r: 7, hub: true, label: null, fam: -1 });
      FAMILIES.forEach((f, i) => {
        const a = (f.a * Math.PI) / 180;
        const R = 430;
        nodes.push({
          x: Math.cos(a) * R,
          y: Math.sin(a) * R * 0.66,
          z: -120 + Math.sin(i * 2.1) * 240,
          r: 4.6, hub: false, label: f.label, fam: i, ring: 1,
        });
        edges.push({ a: 0, b: nodes.length - 1, w: 1 });
      });
      // segundo y tercer anillo: densidad, sin etiqueta
      let seed = 7;
      const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
      for (let ring = 2; ring <= 3; ring++) {
        const count = ring === 2 ? 14 : 22;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + ring * 0.4;
          const R = ring === 2 ? 760 + rnd() * 180 : 1180 + rnd() * 420;
          const idx = nodes.length;
          nodes.push({
            x: Math.cos(a) * R,
            y: Math.sin(a) * R * 0.62,
            z: -300 + rnd() * 900 - (ring - 2) * 420,
            r: ring === 2 ? 3.2 : 2.3, hub: false, label: null, fam: -1, ring: ring,
          });
          // enlazar con el nodo más cercano del anillo interior
          let best = 1, bd = 1e9;
          for (let j = 1; j < idx; j++) {
            if (nodes[j].ring !== ring - 1) continue;
            const dx = nodes[j].x - nodes[idx].x, dy = nodes[j].y - nodes[idx].y;
            const d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = j; }
          }
          edges.push({ a: best, b: idx, w: ring === 2 ? 0.7 : 0.45 });
          if (rnd() > 0.72 && idx > 8) edges.push({ a: idx, b: 1 + Math.floor(rnd() * 6), w: 0.3 });
        }
      }
      edges.forEach((e, i) => { e.ph = (i * 0.37) % 1; e.sp = 0.22 + ((i * 13) % 7) * 0.05; });
      this.nodes = nodes;
      this.edges = edges;
    },

    resize() {
      /* Las partículas son manchas suaves: a DPR 2 se limpian y se
         rellenan 6,7 MPx por frame para un resultado que a 1,25 es
         idéntico. Este techo es la diferencia entre 15 ms y 5 ms de
         base, en TODAS las escenas. */
      const d = LX.Quality.tier === 'high' ? 1 : 0.8;
      [this.back, this.front].forEach((c) => {
        c.width = Math.round(LX.VIEW.w * d);
        c.height = Math.round(LX.VIEW.h * d);
        c.style.width = LX.VIEW.w + 'px';
        c.style.height = LX.VIEW.h + 'px';
      });
      this.bx.setTransform(d, 0, 0, d, 0, 0);
      this.fx.setTransform(d, 0, 0, d, 0, 0);
      this.parts.forEach((p) => (p.has = false));
    },

    /* Escala del logotipo en el mundo: el mark ocupa 520px de alto en
       el plano z=0, que es donde luego aparece el logotipo nítido. */
    // Mitad del lado del SVG que lo releva: las partículas caen
    // EXACTAMENTE sobre la silueta del vector, no cerca.
    logoScale() { return (LX.Quality.mobile ? 240 : 400) / 2; },

    draw(t, cam, vel) {
      const m = this.modes;
      const anything = m.dust > 0.001 || m.logo > 0.001 || m.network > 0.001 || m.warp > 0.001 || m.streak > 0.001;
      const bx = this.bx;
      const W = LX.VIEW.w, H = LX.VIEW.h;
      if (!anything) {
        if (this._dirty) { bx.clearRect(0, 0, W, H); this._dirty = false; }
        return;
      }
      this._dirty = true;
      bx.clearRect(0, 0, W, H);
      bx.globalCompositeOperation = 'lighter';

      const S = this.logoScale();
      const warp = clamp(m.warp, 0, 1);
      const speed = clamp(LX.vel.norm, 0, 1.6);
      const trail = warp * clamp(speed * 0.9, 0, 1.3);

      /* ── Red del ecosistema ──────────────────────────────────── */
      if (m.network > 0.001) this.drawNetwork(bx, t, m.network, m.netScale);

      /* ── Corriente de datos ──────────────────────────────────── */
      if (m.stream > 0.001) this.drawStream(bx, t, m.stream, cam);

      /* ── Estelas de velocidad ────────────────────────────────── */
      if (m.streak > 0.001) this.drawStreaks(bx, t, m.streak);

      /* ── Partículas ──────────────────────────────────────────── */
      const P = this.parts;
      const lm = m.logo;
      /* A toda velocidad, la mitad del campo: con estela y motion blur
         encima nadie cuenta las partículas, y son el grueso del relleno
         del lienzo justo en la escena más cara. */
      const step = warp > 0.85 ? 4 : warp > 0.72 ? 3 : warp > 0.4 ? 2 : 1;
      for (let i = 0; i < P.length; i += step) {
        const p = P[i];
        let x, y, z, a = p.alpha, sz = p.size;

        // deriva base — el polvo microscópico que abre el film
        const dx = p.dx + Math.sin(t * 0.13 * p.sp + p.ph) * 46;
        const dy = p.dy + Math.cos(t * 0.11 * p.sp + p.ph * 1.7) * 38;
        const dz = p.dz + Math.sin(t * 0.09 * p.sp + p.ph * 0.6) * 60;

        if (lm > 0.001 && p.inLogo) {
          // llegada escalonada: cada partícula tiene su ventana
          const w = clamp((lm - p.ord * 0.42) / 0.58, 0, 1);
          const e = ease.out(w);
          x = lerp(dx, p.lx * S, e);
          y = lerp(dy, p.ly * S, e);
          z = lerp(dz, 0, e);
          a = lerp(p.alpha * 0.5, 0.95, e);
          sz = lerp(p.size, 1.35 + (p.edge ? 0.9 : 0), e);
        } else if (m.network > 0.001 && !p.inLogo) {
          // los satélites se acomodan alrededor de la red
          const e = ease.inOut(clamp(m.network, 0, 1));
          const ns = m.netScale;
          x = lerp(dx, dx * 0.55 * ns, e);
          y = lerp(dy, dy * 0.5 * ns, e);
          z = lerp(dz, dz * 0.8, e);
          a = p.alpha * lerp(1, 0.8, e);
        } else {
          x = dx; y = dy; z = dz;
        }

        const q = project(x, y, z, cam);
        if (!q.vis) { p.has = false; continue; }
        if (q.x < -260 || q.x > W + 260 || q.y < -260 || q.y > H + 260) { p.has = false; continue; }

        const scr = clamp(q.s, 0.05, 6);
        const r = Math.min(sz * scr * 2.4, 18);
        const dim = m.dust < 1 ? lerp(0.15, 1, m.dust) : 1;
        let alpha = a * dim * clamp(scr * 0.9, 0.12, 1.2);
        if (lm > 0.001 && p.inLogo) alpha = a * clamp(scr, 0.2, 1.4);

        const spr = p.inLogo && lm > 0.15 ? (p.navy ? this.sprites.navy : this.sprites.cyan) : (p.navy ? this.sprites.navy : this.sprites.cyanDeep);

        // Estela real: se estira entre la proyección anterior y la
        // actual. No es un efecto añadido, es dónde estuvo de verdad.
        if (trail > 0.02 && p.has && r > 2.4 && alpha > 0.12) {
          const tx = q.x - p.px, ty = q.y - p.py;
          const len = Math.sqrt(tx * tx + ty * ty);
          if (len > 2) {
            const steps = clamp(Math.round(len / 18), 1, 3);
            for (let k = 1; k <= steps; k++) {
              const f = k / (steps + 1);
              const rr = r * (1 - f * 0.55);
              bx.globalAlpha = clamp(alpha * (1 - f) * 0.55 * trail, 0, 1);
              bx.drawImage(spr, q.x - tx * f - rr, q.y - ty * f - rr, rr * 2, rr * 2);
            }
          }
        }
        if (alpha < 0.025) { p.px = q.x; p.py = q.y; p.has = true; continue; }
        bx.globalAlpha = clamp(alpha, 0, 1);
        bx.drawImage(spr, q.x - r, q.y - r, r * 2, r * 2);
        p.px = q.x; p.py = q.y; p.ps = scr; p.has = true;
      }

      bx.globalAlpha = 1;
      bx.globalCompositeOperation = 'source-over';
    },

    drawNetwork(x, t, k, scale) {
      const N = this.nodes, E = this.edges;
      const cam = LX.camNow || LX.cam;
      const S = scale || 1;
      // proyectar una sola vez por frame
      for (let i = 0; i < N.length; i++) {
        const n = N[i];
        // El anillo etiquetado crece con la raíz de la escala: al abrirse
        // el ecosistema del final, con la escala entera sus rótulos se
        // salían de cuadro justo cuando hay que poder leerlos.
        const sc = n.ring === 1 ? Math.sqrt(S) : S;
        const q = project(n.x * sc, n.y * sc, n.z * sc, cam);
        n._x = q.x; n._y = q.y; n._s = q.s; n._v = q.vis;
      }
      // aristas: un único trazo por grosor
      const buckets = [[0.9, 1.4], [0.55, 0.9], [0.3, 0.55]];
      for (let b = 0; b < buckets.length; b++) {
        x.beginPath();
        let any = false;
        for (let i = 0; i < E.length; i++) {
          const e = E[i];
          if (e.w > buckets[b][1] || e.w <= (buckets[b + 1] ? buckets[b + 1][1] : -1)) continue;
          const a = N[e.a], c = N[e.b];
          if (!a._v || !c._v) continue;
          // crecimiento: las conexiones se dibujan, no aparecen
          const g = clamp((k - i / (E.length * 1.6)) * 2.2, 0, 1);
          if (g <= 0.01) continue;
          const ge = ease.out(g);
          x.moveTo(a._x, a._y);
          x.lineTo(lerp(a._x, c._x, ge), lerp(a._y, c._y, ge));
          any = true;
        }
        if (any) {
          x.strokeStyle = 'rgba(16,190,251,' + (0.1 + b * 0.045) * k + ')';
          x.lineWidth = buckets[b][0] * 0.8;
          x.stroke();
        }
      }
      // pulsos que recorren las aristas (el "dato" viajando)
      const spr = this.sprites.white;
      x.globalCompositeOperation = 'lighter';
      for (let i = 0; i < E.length; i += 3) {
        const e = E[i];
        const a = N[e.a], c = N[e.b];
        if (!a._v || !c._v) continue;
        const g = clamp((k - i / (E.length * 1.6)) * 2.2, 0, 1);
        if (g < 0.95) continue;
        const f = ((t * e.sp + e.ph) % 1);
        const px = lerp(a._x, c._x, f), py = lerp(a._y, c._y, f);
        const r = 2.6 * clamp((a._s + c._s) / 2, 0.2, 3) * (1 + e.w);
        x.globalAlpha = clamp(0.5 * k * Math.sin(f * Math.PI), 0, 1);
        x.drawImage(spr, px - r, py - r, r * 2, r * 2);
      }
      // nodos
      for (let i = 0; i < N.length; i++) {
        const n = N[i];
        if (!n._v) continue;
        const g = clamp((k - (n.ring || 0) * 0.16) * 2, 0, 1);
        if (g <= 0.01) continue;
        const r = n.r * clamp(n._s, 0.15, 4) * (n.hub ? 2.2 : 1.7) * ease.out(g);
        x.globalAlpha = clamp(0.85 * g, 0, 1);
        x.drawImage(n.hub ? this.sprites.white : this.sprites.cyan, n._x - r, n._y - r, r * 2, r * 2);
      }
      x.globalAlpha = 1;
      x.globalCompositeOperation = 'source-over';
    },

    /* La información que sale de la interfaz no es una metáfora suelta:
       son hilos que envuelven el eje por el que avanza la cámara, con
       paquetes viajando por ellos. Se dibujan en coordenadas del mundo,
       así que pasan de largo mientras la pieza que se transforma queda
       encuadrada — que es justo la sensación de "seguir al dato". */
    drawStream(x, t, k, cam) {
      const high = LX.Quality.tier === 'high';
      const THREADS = high ? 5 : 3;
      const STEPS = high ? 46 : 26;
      const GAP = 190;
      const RAD = (L) => 380 + L * 170;
      const ANG = (zz, ph) => zz * 0.0011 + ph + t * 0.38;
      const jumpMax = LX.VIEW.w * 0.45;
      x.globalCompositeOperation = 'lighter';
      for (let L = 0; L < THREADS; L++) {
        const ph = L * 1.32, rad = RAD(L);
        x.beginPath();
        let px = 0, py = 0, started = false;
        for (let i = 0; i <= STEPS; i++) {
          const zz = -cam.z - 240 - i * GAP;
          const a = ANG(zz, ph);
          const q = project(Math.cos(a) * rad, Math.sin(a) * rad * 0.56, zz, cam);
          // cortar el trazo al cruzar el plano de la cámara: si no, el
          // punto reaparece al otro lado y deja un rayajo diagonal
          if (!q.vis || (started && Math.abs(q.x - px) + Math.abs(q.y - py) > jumpMax)) { started = false; continue; }
          if (!started) { x.moveTo(q.x, q.y); started = true; } else x.lineTo(q.x, q.y);
          px = q.x; py = q.y;
        }
        x.strokeStyle = 'rgba(34,211,238,' + (0.26 * k).toFixed(3) + ')';
        x.lineWidth = 1.25;
        x.stroke();
      }
      // paquetes: lo que de verdad viaja
      const spr = this.sprites.white, spc = this.sprites.cyan;
      for (let L = 0; L < THREADS; L++) {
        const ph = L * 1.32, rad = RAD(L);
        for (let p = 0; p < 7; p++) {
          const f = ((t * 0.5 + p * 0.143 + L * 0.11) % 1);
          const zz = -cam.z - 240 - f * (STEPS * GAP);
          const q = project(Math.cos(ANG(zz, ph)) * rad, Math.sin(ANG(zz, ph)) * rad * 0.56, zz, cam);
          if (!q.vis) continue;
          const r = 5.6 * clamp(q.s, 0.1, 3);
          x.globalAlpha = clamp(k * (1 - f * 0.75), 0, 1);
          x.drawImage(p % 2 ? spc : spr, q.x - r, q.y - r, r * 2, r * 2);
        }
      }
      x.globalAlpha = 1;
      x.globalCompositeOperation = 'source-over';
    },

    /* Las estelas van aquí y no en un div: como capa DOM necesitaban una
       máscara a pantalla completa, y una máscara es una superficie de
       composición propia que el GPU compone entera cada frame — justo en
       la escena más cara. En el lienzo, que ya está compuesto, son gratis. */
    drawStreaks(x, t, k) {
      const W = LX.VIEW.w, H = LX.VIEW.h, cx = LX.VIEW.cx, cy = LX.VIEW.cy;
      const R = Math.sqrt(W * W + H * H) * 0.62;
      const RAYS = LX.Quality.tier === 'low' ? 44 : 80;
      x.globalCompositeOperation = 'lighter';
      // tres bandas: la intensidad crece hacia fuera y muere en el borde
      const bands = [[0.22, 0.46, 0.35], [0.46, 0.78, 1], [0.78, 1, 0.45]];
      for (let b = 0; b < bands.length; b++) {
        x.beginPath();
        for (let i = 0; i < RAYS; i++) {
          const a = (i / RAYS) * Math.PI * 2 + (i % 3) * 0.011 + t * 0.02;
          const co = Math.cos(a), si = Math.sin(a);
          const j = 1 + ((i * 37) % 11) * 0.02;
          x.moveTo(cx + co * R * bands[b][0] * j, cy + si * R * bands[b][0] * j);
          x.lineTo(cx + co * R * bands[b][1] * j, cy + si * R * bands[b][1] * j);
        }
        x.strokeStyle = 'rgba(198,240,255,' + (0.1 * bands[b][2] * k).toFixed(3) + ')';
        x.lineWidth = 1.15;
        x.stroke();
      }
      x.globalCompositeOperation = 'source-over';
    },

    /* Posición en pantalla de un nodo con etiqueta — la usan las
       etiquetas del ecosistema, que son DOM (texto nítido) montado
       sobre coordenadas del canvas. */
    labelPos(famIdx) {
      const n = this.nodes[1 + famIdx];
      return n && n._v ? { x: n._x, y: n._y, s: n._s } : null;
    },
  };

  LX.FX = FX;
  LX.FAMILIES = FAMILIES;
  LX.LOGO_BLOCKS = LOGO_BLOCKS;
})();
