# -*- coding: utf-8 -*-
"""Genera public/demo/consulta-podologica.html: la ficha podológica REAL,
recortada de consultation-podiatry.html, sin autenticación, sin API y sin
guardado. No es una recreación — es el mismo marcado y el mismo CSS."""
import io, re, sys

PUB = "/Users/bicho/Desktop/Salud digital 3/Salud digital/public/"
src = io.open(PUB + "consultation-podiatry.html", encoding="utf-8").read()

# ── 1 · El CSS del módulo, tal cual ──
i = src.index("<style>") + len("<style>")
j = src.index("</style>", i)
CSS = src[i:j]

# ── 2 · El marcado de los seis grupos, tal cual ──
a = src.index('<div class="pod-group" data-group-idx="0">')
b = src.index('<script src="/podogram-container.js">')
MARCADO = src[a:b]

# Fuera lo que solo tiene sentido con backend: banner de autorrelleno,
# mensajes de estado y cualquier botón de guardar que haya quedado dentro.
# Fuera TODOS los <script> que venían dentro del recorte: layout.js pide
# sesión, consultation-draft/-inventory hablan con la API. Las que la ficha
# necesita de verdad se añaden abajo, elegidas a mano.
MARCADO = re.sub(r'<script\b[^>]*>.*?</script>\s*', '', MARCADO, flags=re.S)
MARCADO = re.sub(r'<div id="prefillBanner"[^>]*></div>\s*', '', MARCADO)
MARCADO = re.sub(r'<div[^>]*class="[^"]*form-msg[^"]*"[^>]*>.*?</div>\s*', '', MARCADO, flags=re.S)

if 'id="podogram1"' not in MARCADO:
    sys.exit("no encontré el podograma en el marcado")
if 'id="dfeRoot"' not in MARCADO:
    sys.exit("no encontré la exploración de pie diabético")

PAGINA = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- El mismo arranque de tema que usa la app. Como el iframe es del mismo
     origen que la landing, lee el MISMO localStorage (sd_theme) y aplica el
     MISMO data-theme: la ficha se ve clara o en modo oscuro exactamente igual
     que la página que la contiene, sin que nadie tenga que sincronizar nada. -->
<script src="/theme.js"></script>
<title>Consulta podológica — Salud Digital</title>
<meta name="robots" content="noindex">

<!-- ─────────────────────────────────────────────────────────────
     GENERADO — no editar a mano.
     Se produce desde consultation-podiatry.html con
     tools/gen-demo-podologia.py: mismo CSS y mismo marcado de la ficha real.
     Lo único que se quita es lo que necesita servidor: sesión, carga
     del paciente, API y guardado. Por eso aquí no hay nada que
     guardar: no existe el código que guarda.

     Se embebe en la landing (#especialidades) dentro de un iframe.
     ───────────────────────────────────────────────────────────── -->

<link rel="stylesheet" href="/layout.css">
<style>
%s
</style>
<style>
  /* Ajustes propios del demo: sin el armazón de la app (barra lateral,
     cabecera), la ficha va sola sobre el lienzo. El fondo NO se toca: lo
     ponen las reglas de la app (claro) y theme-dark.css (oscuro), que es
     justo lo que hace que el demo cambie de tema solo. */
  body { margin: 0; padding: 1.5rem 1rem 3rem; }
  .demo-wrap { max-width: 980px; margin: 0 auto; }
  /* El cursor delata que las cabeceras se abren, igual que en la app. */
  .pod-group { cursor: pointer; }
  @media (max-width: 720px) { body { padding: 1rem 0.75rem 2rem; } }
</style>
</head>
<body>
<div class="demo-wrap">
  <form id="consultationForm" autocomplete="off" onsubmit="return false;">
%s
  </form>
</div>

<script src="/icons.js"></script>
<script src="/podogram-container.js"></script>
<script src="/diabetic-foot-exam.js"></script>
<script>
  // El podograma, en modo solo lectura (tercer argumento del componente).
  try { new PodogramContainer('podogram1', {}, true); } catch (e) {}

  // Los acordeones: mismo comportamiento que en la ficha real — la cabecera
  // pliega todo lo que va hasta el siguiente grupo.
  (function acordeones() {
    const form = document.getElementById('consultationForm');
    if (!form) return;
    function hermanos(grupo) {
      const out = [];
      let el = grupo.nextElementSibling;
      while (el && !el.classList.contains('pod-group')) {
        if (el.nodeType === 1) out.push(el);
        el = el.nextElementSibling;
      }
      return out;
    }
    function aplicar(grupo) {
      const plegado = grupo.classList.contains('is-collapsed');
      hermanos(grupo).forEach((s) => s.classList.toggle('is-hidden-by-group', plegado));
    }
    form.querySelectorAll('.pod-group').forEach((g) => {
      aplicar(g);
      g.addEventListener('click', () => { g.classList.toggle('is-collapsed'); aplicar(g); });
    });
  })();

  // Avisar a la landing de cuánto mide, para que el iframe crezca con el
  // contenido en vez de dejar una barra de scroll interna.
  (function avisarAlto() {
    let ultimo = 0;
    function medir() {
      const alto = Math.ceil(document.querySelector('.demo-wrap').getBoundingClientRect().height) + 48;
      if (alto !== ultimo) {
        ultimo = alto;
        parent.postMessage({ tipo: 'alto-consulta', alto: alto }, '*');
      }
    }
    new ResizeObserver(medir).observe(document.body);
    document.addEventListener('click', () => setTimeout(medir, 420));
    window.addEventListener('load', medir);
    medir();
  })();
</script>
</body>
</html>
""" % (CSS, MARCADO)

import os
os.makedirs(PUB + "demo", exist_ok=True)
io.open(PUB + "demo/consulta-podologica.html", "w", encoding="utf-8").write(PAGINA)
print("OK · %d KB (CSS %d KB + marcado %d KB)"
      % (len(PAGINA) // 1024, len(CSS) // 1024, len(MARCADO) // 1024))
