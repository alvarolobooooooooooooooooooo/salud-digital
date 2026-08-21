// ── SDLegal — visor de documentos legales y aceptación electrónica ──
//
// Un solo módulo para los cuatro sitios donde aparece lo legal: el alta
// (/registro.html), la invitación, la pantalla de ajustes y el modal que sale
// cuando publicamos una versión nueva (lo dispara layout.js).
//
// Dos reglas de la pantalla que vienen del contrato, no del diseño:
//   · Las casillas SIEMPRE nacen desmarcadas. No hay consentimiento
//     preseleccionado en ningún flujo.
//   · El botón no se habilita hasta que están todas las obligatorias. Y aunque
//     alguien fuerce el botón desde la consola, el servidor vuelve a comprobarlo:
//     esto es comodidad para el usuario, no el control de verdad.
//
// Estilos con prefijo propio (.sdl-) y colores declarados a mano: theme-dark.css
// pisa .card/.modal/.field/section con !important, así que heredar de ahí haría
// que este visor saliera distinto en cada página.
(function (global) {
  'use strict';

  var ESTILOS_ID = 'sdlEstilos';
  var cacheDocs = {};

  // ══════════════════════════════════════════════════════════
  //  Markdown → HTML (mínimo, sin dependencias y sin CDN)
  // ══════════════════════════════════════════════════════════
  //
  // Se escapa TODO primero y solo después se aplican las marcas. Así el
  // contenido del documento no puede inyectar HTML aunque un día lo edite
  // alguien desde el panel de administración.

  function escapar(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function enLinea(t) {
    return t
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      // Solo enlaces http(s) y mailto: nada de javascript: por muy escapado que esté.
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  function markdown(md) {
    var lineas = escapar(md).split('\n');
    var salida = [];
    var enLista = false;
    var enCita = false;
    var enTabla = false;

    function cerrarLista() { if (enLista) { salida.push('</ul>'); enLista = false; } }
    function cerrarCita() { if (enCita) { salida.push('</blockquote>'); enCita = false; } }
    function cerrarTabla() { if (enTabla) { salida.push('</tbody></table></div>'); enTabla = false; } }
    function cerrarTodo() { cerrarLista(); cerrarCita(); cerrarTabla(); }

    for (var i = 0; i < lineas.length; i++) {
      var l = lineas[i];
      var t = l.trim();

      if (!t) { cerrarLista(); cerrarTabla(); continue; }

      // Separador
      if (/^(---|___|\*\*\*)$/.test(t)) { cerrarTodo(); salida.push('<hr>'); continue; }

      // Tabla: cabecera + separador |---|---|
      if (t.charAt(0) === '|' && /^\|(.+)\|$/.test(t) &&
          i + 1 < lineas.length && /^\|[\s:|-]+\|$/.test(lineas[i + 1].trim())) {
        cerrarLista(); cerrarCita(); cerrarTabla();
        var cabeceras = t.slice(1, -1).split('|').map(function (c) { return enLinea(c.trim()); });
        salida.push('<div class="sdl-tabla-wrap"><table class="sdl-tabla"><thead><tr>' +
          cabeceras.map(function (c) { return '<th>' + c + '</th>'; }).join('') +
          '</tr></thead><tbody>');
        enTabla = true;
        i++; // saltar la línea de guiones
        continue;
      }
      if (enTabla) {
        if (t.charAt(0) !== '|') { cerrarTabla(); }
        else {
          var celdas = t.slice(1, -1).split('|').map(function (c) { return enLinea(c.trim()); });
          salida.push('<tr>' + celdas.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>');
          continue;
        }
      }

      // Cita — la usamos para los avisos de "REQUIERE REVISIÓN LEGAL"
      if (t.indexOf('&gt; ') === 0 || t === '&gt;') {
        cerrarLista(); cerrarTabla();
        var cuerpo = t.replace(/^&gt;\s?/, '');
        if (!enCita) {
          var revision = /REQUIERE REVISIÓN LEGAL/.test(cuerpo);
          salida.push('<blockquote class="sdl-cita' + (revision ? ' sdl-cita--revision' : '') + '">');
          enCita = true;
        }
        salida.push('<p>' + enLinea(cuerpo) + '</p>');
        continue;
      }
      cerrarCita();

      // Títulos
      var h = /^(#{1,4})\s+(.*)$/.exec(t);
      if (h) {
        cerrarLista(); cerrarTabla();
        var n = h[1].length;
        var texto = enLinea(h[2]);
        var id = 'sec-' + h[2].toLowerCase().replace(/[^a-z0-9áéíóúñ]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
        salida.push('<h' + n + ' id="' + id + '" class="sdl-h' + n + '">' + texto + '</h' + n + '>');
        continue;
      }

      // Lista
      if (/^[-*]\s+/.test(t)) {
        cerrarTabla();
        if (!enLista) { salida.push('<ul class="sdl-lista">'); enLista = true; }
        salida.push('<li>' + enLinea(t.replace(/^[-*]\s+/, '')) + '</li>');
        continue;
      }
      cerrarLista();

      salida.push('<p>' + enLinea(t) + '</p>');
    }
    cerrarTodo();
    return salida.join('\n');
  }

  // ══════════════════════════════════════════════════════════
  //  Estilos
  // ══════════════════════════════════════════════════════════

  function inyectarEstilos() {
    if (document.getElementById(ESTILOS_ID)) return;
    var s = document.createElement('style');
    s.id = ESTILOS_ID;
    s.textContent = [
      /* Paleta propia: no hereda de la página para verse igual en las cinco
         pantallas donde aparece. Clara por defecto, oscura por atributo. */
      '.sdl-scope{--sdl-bg:#ffffff;--sdl-bg-2:#f8fafc;--sdl-text:#0f172a;--sdl-soft:#475569;',
      '--sdl-muted:#64748b;--sdl-line:#e2e8f0;--sdl-line-soft:#eef2f6;--sdl-accent:#0891b2;',
      '--sdl-accent-soft:#ecfeff;--sdl-accent-line:#a5f3fc;--sdl-warn:#b45309;--sdl-warn-bg:#fffbeb;',
      '--sdl-warn-line:#fde68a;--sdl-shadow:0 24px 70px rgba(15,23,42,.18);--sdl-radius:16px}',
      'html[data-theme="dark"] .sdl-scope{--sdl-bg:#141416;--sdl-bg-2:#0d0d0f;--sdl-text:#f1f5f9;',
      '--sdl-soft:#cbd5e1;--sdl-muted:#94a3b8;--sdl-line:rgba(255,255,255,.09);',
      '--sdl-line-soft:rgba(255,255,255,.055);--sdl-accent:#22d3ee;--sdl-accent-soft:rgba(6,182,212,.09);',
      '--sdl-accent-line:rgba(34,211,238,.28);--sdl-warn:#fbbf24;--sdl-warn-bg:rgba(251,191,36,.07);',
      '--sdl-warn-line:rgba(251,191,36,.22);--sdl-shadow:0 24px 70px rgba(0,0,0,.6)}',

      /* ── Capa modal ── */
      '.sdl-overlay{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;',
      'justify-content:center;background:rgba(15,23,42,.55);',
      'padding:max(20px, env(safe-area-inset-top, 0px)) max(20px, env(safe-area-inset-right, 0px))',
      ' max(20px, env(safe-area-inset-bottom, 0px)) max(20px, env(safe-area-inset-left, 0px));',
      '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:sdlFade .18s ease both}',
      'html[data-theme="dark"] .sdl-overlay{background:rgba(0,0,0,.72)}',
      '@keyframes sdlFade{from{opacity:0}to{opacity:1}}',
      '@keyframes sdlUp{from{opacity:0;transform:translateY(10px) scale(.99)}to{opacity:1;transform:none}}',
      '.sdl-modal{background:var(--sdl-bg);color:var(--sdl-text);border:1px solid var(--sdl-line);',
      'border-radius:var(--sdl-radius);box-shadow:var(--sdl-shadow);width:min(880px,100%);',
      'max-height:min(88vh,900px);display:flex;flex-direction:column;overflow:hidden;',
      'animation:sdlUp .22s cubic-bezier(.22,.61,.36,1) both}',
      '@media (prefers-reduced-motion:reduce){.sdl-overlay,.sdl-modal{animation:none}}',

      /* ── Cabecera ── */
      '.sdl-head{display:flex;align-items:flex-start;gap:14px;padding:20px 22px 16px;',
      'border-bottom:1px solid var(--sdl-line-soft);flex:none}',
      '.sdl-head-txt{flex:1;min-width:0}',
      '.sdl-eyebrow{font-size:.68rem;font-weight:650;letter-spacing:.09em;text-transform:uppercase;',
      'color:var(--sdl-accent);margin-bottom:5px}',
      '.sdl-title{font-size:1.16rem;font-weight:650;letter-spacing:-.02em;margin:0;line-height:1.25}',
      '.sdl-sub{font-size:.84rem;color:var(--sdl-muted);margin:.3rem 0 0;line-height:1.5}',
      '.sdl-x{flex:none;width:32px;height:32px;border-radius:9px;border:1px solid var(--sdl-line);',
      'background:transparent;color:var(--sdl-muted);cursor:pointer;font-size:1.05rem;line-height:1;',
      'display:flex;align-items:center;justify-content:center;transition:.16s}',
      '.sdl-x:hover{background:var(--sdl-bg-2);color:var(--sdl-text)}',

      /* ── Chips de versión / hash ── */
      '.sdl-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}',
      '.sdl-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;',
      'font-size:.7rem;font-weight:600;background:var(--sdl-bg-2);border:1px solid var(--sdl-line);',
      'color:var(--sdl-soft);white-space:nowrap}',
      '.sdl-chip--accent{background:var(--sdl-accent-soft);border-color:var(--sdl-accent-line);color:var(--sdl-accent)}',
      '.sdl-chip code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.66rem;',
      'letter-spacing:-.01em;overflow-wrap:anywhere}',
      // El chip no puede ser más ancho que su columna: un hash de 64 caracteres
      // empujaba la cabecera entera fuera de la pantalla.
      '.sdl-meta{max-width:100%}',
      '.sdl-chip{max-width:100%;white-space:normal}',

      /* ── Cuerpo del documento ── */
      '.sdl-body{flex:1;min-height:0;overflow-y:auto;padding:22px;scroll-behavior:smooth;',
      '-webkit-overflow-scrolling:touch}',
      '.sdl-doc{font-size:.9rem;line-height:1.72;color:var(--sdl-soft);max-width:74ch;',
      'overflow-wrap:anywhere}',
      '.sdl-doc p{margin:0 0 .9rem}',
      '.sdl-doc .sdl-h1{font-size:1.34rem;font-weight:680;letter-spacing:-.025em;color:var(--sdl-text);',
      'margin:0 0 .2rem;line-height:1.24}',
      '.sdl-doc .sdl-h2{font-size:1.03rem;font-weight:660;letter-spacing:-.015em;color:var(--sdl-text);',
      'margin:2rem 0 .7rem;padding-top:.9rem;border-top:1px solid var(--sdl-line-soft)}',
      '.sdl-doc .sdl-h3{font-size:.92rem;font-weight:650;color:var(--sdl-text);margin:1.4rem 0 .5rem}',
      '.sdl-doc .sdl-h4{font-size:.86rem;font-weight:650;color:var(--sdl-text);margin:1.1rem 0 .4rem}',
      '.sdl-doc strong{color:var(--sdl-text);font-weight:640}',
      '.sdl-doc a{color:var(--sdl-accent);text-decoration:none;border-bottom:1px solid transparent}',
      '.sdl-doc a:hover{border-bottom-color:currentColor}',
      '.sdl-doc code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.82em;',
      'background:var(--sdl-bg-2);border:1px solid var(--sdl-line-soft);border-radius:5px;padding:.08em .34em}',
      '.sdl-doc hr{border:0;border-top:1px solid var(--sdl-line-soft);margin:1.5rem 0}',
      '.sdl-lista{margin:0 0 1rem;padding-left:1.15rem}',
      '.sdl-lista li{margin-bottom:.42rem}',
      '.sdl-lista li::marker{color:var(--sdl-muted)}',
      '.sdl-cita{margin:1.1rem 0;padding:.85rem 1rem;border-left:2px solid var(--sdl-line);',
      'background:var(--sdl-bg-2);border-radius:0 10px 10px 0;font-size:.85rem}',
      '.sdl-cita p:last-child{margin-bottom:0}',
      '.sdl-cita--revision{border-left-color:var(--sdl-warn);background:var(--sdl-warn-bg);',
      'border:1px solid var(--sdl-warn-line);border-left-width:3px;color:var(--sdl-warn)}',
      '.sdl-cita--revision strong{color:var(--sdl-warn)}',
      '.sdl-tabla-wrap{overflow-x:auto;margin:0 0 1.1rem;border:1px solid var(--sdl-line);border-radius:11px}',
      '.sdl-tabla{width:100%;border-collapse:collapse;font-size:.82rem;min-width:340px}',
      '.sdl-tabla th{text-align:left;font-weight:640;color:var(--sdl-text);background:var(--sdl-bg-2);',
      'padding:.6rem .8rem;border-bottom:1px solid var(--sdl-line);white-space:nowrap}',
      '.sdl-tabla td{padding:.6rem .8rem;border-bottom:1px solid var(--sdl-line-soft);vertical-align:top}',
      '.sdl-tabla tr:last-child td{border-bottom:0}',

      /* ── Pie con casillas ── */
      '.sdl-foot{flex:none;border-top:1px solid var(--sdl-line-soft);background:var(--sdl-bg-2);',
      'padding:16px 22px 18px}',
      '.sdl-checks{display:flex;flex-direction:column;gap:2px;margin-bottom:14px}',
      '.sdl-check{display:flex;align-items:flex-start;gap:11px;padding:10px 12px;border-radius:11px;',
      'border:1px solid transparent;cursor:pointer;transition:.16s;user-select:none}',
      '.sdl-check:hover{background:var(--sdl-bg);border-color:var(--sdl-line)}',
      '.sdl-check:focus-within{border-color:var(--sdl-accent-line);box-shadow:0 0 0 3px var(--sdl-accent-soft)}',
      '.sdl-check input{appearance:none;-webkit-appearance:none;flex:none;width:18px;height:18px;',
      'margin:1px 0 0;border:1.5px solid var(--sdl-line);border-radius:6px;background:var(--sdl-bg);',
      'cursor:pointer;position:relative;transition:.16s}',
      '.sdl-check input:checked{background:var(--sdl-accent);border-color:var(--sdl-accent)}',
      '.sdl-check input:checked::after{content:"";position:absolute;left:5px;top:1.5px;width:5px;height:10px;',
      'border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}',
      '.sdl-check input:focus-visible{outline:2px solid var(--sdl-accent);outline-offset:2px}',
      '.sdl-check-txt{font-size:.855rem;line-height:1.5;color:var(--sdl-text)}',
      '.sdl-check-note{display:block;font-size:.755rem;color:var(--sdl-muted);margin-top:2px}',
      '.sdl-check a{color:var(--sdl-accent);text-decoration:none;font-weight:600}',
      '.sdl-check a:hover{text-decoration:underline}',
      '.sdl-req{color:var(--sdl-accent);font-weight:700;margin-left:2px}',

      /* ── Acciones ── */
      '.sdl-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}',
      '.sdl-btn{font:inherit;font-size:.855rem;font-weight:600;padding:.62rem 1.15rem;border-radius:10px;',
      'border:1px solid var(--sdl-line);background:var(--sdl-bg);color:var(--sdl-text);cursor:pointer;',
      'transition:.16s;display:inline-flex;align-items:center;gap:7px;text-decoration:none}',
      '.sdl-btn:hover:not(:disabled){background:var(--sdl-bg-2)}',
      '.sdl-btn--primary{background:var(--sdl-accent);border-color:var(--sdl-accent);color:#fff;flex:1;',
      'justify-content:center;min-height:42px}',
      'html[data-theme="dark"] .sdl-btn--primary{color:#04191e}',
      '.sdl-btn--primary:hover:not(:disabled){filter:brightness(1.06)}',
      '.sdl-btn:disabled{opacity:.42;cursor:not-allowed}',
      '.sdl-btn:focus-visible{outline:2px solid var(--sdl-accent);outline-offset:2px}',
      '.sdl-error{font-size:.8rem;color:#dc2626;margin:0 0 10px;line-height:1.45}',
      'html[data-theme="dark"] .sdl-error{color:#f87171}',
      '.sdl-cargando{padding:40px 0;text-align:center;color:var(--sdl-muted);font-size:.86rem}',

      // ── Pantalla completa en móvil, respetando las zonas del sistema ──
      //
      // El servidor inyecta viewport-fit=cover en todo el HTML que sirve, así que
      // en la PWA instalada el modal ocupa TODA la pantalla física: sin estos
      // insets el título queda debajo de la Dynamic Island y los botones debajo
      // del indicador de inicio. Y el botón de aceptar es justo el que no puede
      // quedar tapado: sin él, el doctor no puede desbloquear su cuenta.
      '@media (max-width:640px){',
      '.sdl-overlay{padding:0;align-items:stretch}',
      '.sdl-modal{max-height:100%;height:100%;border-radius:0;border:0;width:100%}',
      '.sdl-head{padding-top:calc(20px + env(safe-area-inset-top, 0px))}',
      '.sdl-foot{padding-bottom:calc(18px + env(safe-area-inset-bottom, 0px))}',
      '.sdl-head,.sdl-body,.sdl-foot{',
      'padding-left:calc(16px + env(safe-area-inset-left, 0px));',
      'padding-right:calc(16px + env(safe-area-inset-right, 0px))}',
      '.sdl-actions{flex-direction:column-reverse;align-items:stretch}',
      '.sdl-btn{justify-content:center}}',
    ].join('');
    document.head.appendChild(s);
  }

  // ══════════════════════════════════════════════════════════
  //  Datos
  // ══════════════════════════════════════════════════════════

  function pedir(url) {
    return fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok) throw new Error((d && d.error) || 'No se pudo cargar el documento.');
          return d;
        });
      });
  }

  function documentos() { return pedir('/api/legal/documents'); }

  function documento(tipo, version) {
    var clave = tipo + '@' + (version || 'vigente');
    if (cacheDocs[clave]) return Promise.resolve(cacheDocs[clave]);
    var url = version
      ? '/api/legal/documents/' + encodeURIComponent(tipo) + '/versions/' + encodeURIComponent(version)
      : '/api/legal/documents/' + encodeURIComponent(tipo);
    return pedir(url).then(function (d) { cacheDocs[clave] = d; return d; });
  }

  function fecha(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('es-HN', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch (_) { return String(iso).slice(0, 10); }
  }

  // ══════════════════════════════════════════════════════════
  //  Capa modal
  // ══════════════════════════════════════════════════════════

  function abrirCapa(opciones) {
    inyectarEstilos();
    var overlay = document.createElement('div');
    overlay.className = 'sdl-overlay sdl-scope';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    if (opciones.label) overlay.setAttribute('aria-label', opciones.label);

    var modal = document.createElement('div');
    modal.className = 'sdl-modal';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    var scrollPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    var focoPrevio = document.activeElement;

    function cerrar() {
      if (!overlay.parentNode) return;
      overlay.parentNode.removeChild(overlay);
      document.body.style.overflow = scrollPrevio;
      document.removeEventListener('keydown', alPulsar, true);
      if (focoPrevio && focoPrevio.focus) { try { focoPrevio.focus(); } catch (_) {} }
    }

    function alPulsar(e) {
      if (e.key === 'Escape' && !opciones.bloqueante) { e.preventDefault(); cerrar(); return; }
      if (e.key !== 'Tab') return;
      // Trampa de foco: el teclado no puede salirse del modal.
      var focos = modal.querySelectorAll(
        'a[href],button:not(:disabled),input:not(:disabled),select,textarea,[tabindex]:not([tabindex="-1"])');
      if (!focos.length) return;
      var primero = focos[0], ultimo = focos[focos.length - 1];
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    }
    document.addEventListener('keydown', alPulsar, true);

    if (!opciones.bloqueante) {
      overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) cerrar(); });
    }
    return { overlay: overlay, modal: modal, cerrar: cerrar };
  }

  function cabecera(cfg) {
    var chips = (cfg.chips || []).map(function (c) {
      return '<span class="sdl-chip' + (c.accent ? ' sdl-chip--accent' : '') + '">' +
        escapar(c.etiqueta) + (c.valor ? ' <code>' + escapar(c.valor) + '</code>' : '') + '</span>';
    }).join('');
    return '<div class="sdl-head">' +
      '<div class="sdl-head-txt">' +
        (cfg.eyebrow ? '<div class="sdl-eyebrow">' + escapar(cfg.eyebrow) + '</div>' : '') +
        '<h2 class="sdl-title">' + escapar(cfg.titulo) + '</h2>' +
        (cfg.sub ? '<p class="sdl-sub">' + escapar(cfg.sub) + '</p>' : '') +
        (chips ? '<div class="sdl-meta">' + chips + '</div>' : '') +
      '</div>' +
      (cfg.cerrable ? '<button type="button" class="sdl-x" data-sdl-close aria-label="Cerrar">&times;</button>' : '') +
    '</div>';
  }

  /** Visor de un documento (o de una versión concreta). Solo lectura. */
  function abrirDocumento(tipo, version) {
    var capa = abrirCapa({ label: 'Documento legal' });
    capa.modal.innerHTML =
      cabecera({ eyebrow: 'Portal Salud Digital', titulo: 'Cargando documento…', cerrable: true }) +
      '<div class="sdl-body"><div class="sdl-cargando">Un momento…</div></div>';
    capa.modal.querySelector('[data-sdl-close]').addEventListener('click', capa.cerrar);

    documento(tipo, version).then(function (d) {
      capa.modal.innerHTML =
        cabecera({
          eyebrow: 'Portal Salud Digital',
          titulo: d.name,
          sub: d.description || '',
          cerrable: true,
          chips: [
            { etiqueta: 'Versión', valor: d.version, accent: true },
            { etiqueta: 'En vigor desde', valor: fecha(d.effective_at || d.published_at) },
            { etiqueta: 'SHA-256', valor: String(d.content_hash || '').slice(0, 16) + '…' },
          ].concat(d.status === 'archived' ? [{ etiqueta: 'Versión archivada' }] : []),
        }) +
        '<div class="sdl-body"><div class="sdl-doc">' + markdown(d.content || '') + '</div></div>';
      capa.modal.querySelector('[data-sdl-close]').addEventListener('click', capa.cerrar);
      var x = capa.modal.querySelector('[data-sdl-close]');
      if (x) x.focus();
    }).catch(function (err) {
      capa.modal.querySelector('.sdl-body').innerHTML =
        '<p class="sdl-error">' + escapar(err.message) + '</p>';
    });
    return capa;
  }

  // ══════════════════════════════════════════════════════════
  //  Modal de aceptación (nueva versión / primera vez)
  // ══════════════════════════════════════════════════════════

  /**
   * `pendientes` viene del servidor (/api/legal/pending o del 451). Se cargan
   * los textos completos y se pinta una casilla por documento, desmarcada.
   */
  function abrirAceptacion(pendientes, opciones) {
    opciones = opciones || {};
    var capa = abrirCapa({ label: 'Aceptación de documentos legales', bloqueante: true });
    capa.modal.innerHTML =
      cabecera({ eyebrow: 'Portal Salud Digital', titulo: 'Cargando documentos…' }) +
      '<div class="sdl-body"><div class="sdl-cargando">Un momento…</div></div>';

    var actualizacion = pendientes.some(function (p) { return p.motivo === 'actualizado'; });

    Promise.all(pendientes.map(function (p) { return documento(p.type); }))
      .then(function (docs) {
        var chips = docs.map(function (d) {
          return { etiqueta: d.name, valor: 'v' + d.version, accent: true };
        });
        var cambios = pendientes
          .filter(function (p) { return p.motivo === 'actualizado' && p.summary_of_changes; })
          .map(function (p) {
            return '<p><strong>' + escapar(p.name) + ' · v' + escapar(p.version) + '</strong><br>' +
              escapar(p.summary_of_changes) + '</p>';
          }).join('');

        capa.modal.innerHTML =
          cabecera({
            eyebrow: actualizacion ? 'Documentos actualizados' : 'Antes de continuar',
            titulo: actualizacion
              ? 'Actualizamos nuestros documentos legales'
              : 'Revisa y acepta los documentos',
            sub: actualizacion
              ? 'Publicamos una versión nueva. Para seguir guardando información necesitamos tu aceptación de la versión vigente. Tu aceptación anterior se conserva.'
              : 'Para usar Portal Salud Digital necesitamos tu aceptación de estos documentos.',
            chips: chips,
          }) +
          '<div class="sdl-body">' +
            (cambios ? '<blockquote class="sdl-cita"><p><strong>Qué cambió</strong></p>' + cambios + '</blockquote>' : '') +
            '<div class="sdl-doc" id="sdlDocs"></div>' +
          '</div>' +
          '<div class="sdl-foot">' +
            '<p class="sdl-error" id="sdlErr" style="display:none"></p>' +
            '<div class="sdl-checks" id="sdlChecks"></div>' +
            '<div class="sdl-actions">' +
              '<button type="button" class="sdl-btn" id="sdlLater">Ahora no</button>' +
              '<button type="button" class="sdl-btn sdl-btn--primary" id="sdlAccept" disabled>' +
                'Aceptar y continuar</button>' +
            '</div>' +
          '</div>';

        // Los documentos completos, uno tras otro, dentro del propio modal:
        // aceptar sin haber podido leer no sería consentimiento informado.
        document.getElementById('sdlDocs').innerHTML = docs.map(function (d) {
          return '<section>' + markdown(d.content || '') + '</section>';
        }).join('<hr>');

        var contenedor = document.getElementById('sdlChecks');
        docs.forEach(function (d, i) {
          var etiqueta = document.createElement('label');
          etiqueta.className = 'sdl-check';
          var verbo = d.type === 'PRIVACY' ? 'He leído y comprendo' : 'He leído y acepto';
          etiqueta.innerHTML =
            '<input type="checkbox" data-idx="' + i + '">' +
            '<span class="sdl-check-txt">' + verbo + ' <a href="#" data-ver="' + escapar(d.type) + '">' +
              escapar(d.name) + '</a><span class="sdl-req">*</span>' +
              '<span class="sdl-check-note">Versión ' + escapar(d.version) +
              ' · en vigor desde ' + escapar(fecha(d.effective_at || d.published_at)) + '</span>' +
            '</span>';
          contenedor.appendChild(etiqueta);
        });

        var casillas = Array.prototype.slice.call(contenedor.querySelectorAll('input'));
        var btn = document.getElementById('sdlAccept');
        var err = document.getElementById('sdlErr');

        function repasar() {
          btn.disabled = !casillas.every(function (c) { return c.checked; });
        }
        casillas.forEach(function (c) { c.addEventListener('change', repasar); });
        repasar();

        contenedor.addEventListener('click', function (e) {
          var a = e.target.closest && e.target.closest('a[data-ver]');
          if (!a) return;
          e.preventDefault();
          abrirDocumento(a.getAttribute('data-ver'));
        });

        document.getElementById('sdlLater').addEventListener('click', function () {
          capa.cerrar();
          if (opciones.alPosponer) opciones.alPosponer();
        });

        btn.addEventListener('click', function () {
          btn.disabled = true;
          var previo = btn.textContent;
          btn.textContent = 'Registrando…';
          err.style.display = 'none';

          fetch('/api/legal/accept', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              // Versión y huella EXACTAS de lo que se acaba de mostrar. Si el
              // servidor publicó otra cosa entretanto, rechaza y se recarga.
              acceptances: docs.map(function (d) {
                return { type: d.type, version: d.version, hash: d.content_hash };
              }),
              method: 'reacceptance_modal',
              source: window.location.pathname,
            }),
          })
            .then(function (r) { return r.json().catch(function () { return {}; })
              .then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); })
            .then(function (res) {
              if (!res.ok) {
                if (res.status === 409) {
                  err.textContent = (res.d && res.d.error) ||
                    'El documento cambió mientras lo revisabas.';
                  err.style.display = 'block';
                  setTimeout(function () { window.location.reload(); }, 2200);
                  return;
                }
                throw new Error((res.d && res.d.error) || 'No se pudo registrar la aceptación.');
              }
              capa.cerrar();
              if (opciones.alAceptar) opciones.alAceptar(res.d);
              else window.location.reload();
            })
            .catch(function (e2) {
              err.textContent = e2.message;
              err.style.display = 'block';
              btn.disabled = false;
              btn.textContent = previo;
            });
        });

        var primera = casillas[0];
        if (primera) primera.focus();
      })
      .catch(function (e) {
        capa.modal.querySelector('.sdl-body').innerHTML =
          '<p class="sdl-error">' + escapar(e.message) + '</p>';
      });

    return capa;
  }

  var abierto = false;

  /**
   * Lo que llama layout.js en cada página de la app. Solo pregunta al servidor
   * y, si hay algo pendiente, abre el modal. No decide nada por su cuenta: el
   * bloqueo real de las escrituras lo hace el guardián del servidor.
   */
  function comprobarPendientes() {
    if (abierto) return Promise.resolve([]);
    return pedir('/api/legal/pending')
      .then(function (d) {
        var pendientes = (d && d.pending) || [];
        if (pendientes.length === 0) return [];
        abierto = true;
        abrirAceptacion(pendientes, {
          alAceptar: function () { abierto = false; window.location.reload(); },
          alPosponer: function () { abierto = false; },
        });
        return pendientes;
      })
      .catch(function () { return []; });
  }

  /** Lo llama common.js cuando una escritura vuelve con 451. */
  function exigir(pendientes) {
    if (abierto) return;
    abierto = true;
    abrirAceptacion(pendientes && pendientes.length ? pendientes : [], {
      alAceptar: function () { abierto = false; window.location.reload(); },
      alPosponer: function () { abierto = false; },
    });
  }

  global.SDLegal = {
    markdown: markdown,
    escapar: escapar,
    fecha: fecha,
    documentos: documentos,
    documento: documento,
    abrirDocumento: abrirDocumento,
    abrirAceptacion: abrirAceptacion,
    comprobarPendientes: comprobarPendientes,
    exigir: exigir,
    inyectarEstilos: inyectarEstilos,
  };
})(window);
