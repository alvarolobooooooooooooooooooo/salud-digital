/* ─────────────────────────────────────────────────────────────────────────────
   Consentimiento firmado en PAPEL
   ─────────────────────────────────────────────────────────────────────────────
   Muchas clínicas no firman en pantalla: imprimen la hoja, el paciente firma y
   esa hoja se archiva en una carpeta. Este bloque se cuelga de la sección
   "Consentimiento Informado" de cada consulta para que esa hoja entre también
   al expediente: se sube la foto (o el PDF escaneado), queda guardada junto al
   consentimiento del paciente y la consulta la referencia por consent_id.

   Vive en un solo archivo porque la misma sección está repetida en seis
   pantallas de consulta (odontología, podología, ortodoncia, periodoncia,
   medicina general y nutrición) con dos juegos de clases distintos. Cada página
   solo llama a ConsentPhoto.init() con cómo leer su propio estado.

     ConsentPhoto.init({ getPatientId, getConsentId, onConsent })  → modo edición
     ConsentPhoto.showSaved(consentId)                             → modo lectura

   Ambas admiten `host` (un selector) para las pantallas que no tienen la barra
   de consentimiento clásica y ofrecen su propio hueco — hoy, odontopediatría.

   Prefijo propio `cpf-` en TODAS las clases: theme-dark.css pisa con !important
   nombres genéricos (.card, .field, .modal…) y cualquiera de esos aquí saldría
   con colores ajenos.
   ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // Un consentimiento es un documento legal: tiene que leerse. 2000px en el lado
  // largo mantiene la letra pequeña legible y deja el archivo en pocos cientos
  // de KB; el original de un móvil moderno son 10-25 MP para nada.
  var MAX_LADO = 2000;
  var CALIDAD_JPEG = 0.85;
  var MAX_BYTES = 10 * 1024 * 1024;

  var cfg = null;
  var estado = { consentId: null, doc: null, subiendo: false };
  var ESTILOS_ID = 'cpfEstilos';

  /* ── utilidades ── */

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function token() {
    try {
      if (typeof getToken === 'function') return getToken() || '';
      return localStorage.getItem('sd_token') || '';
    } catch (_) { return ''; }
  }

  function esHeic(file) {
    var t = String(file.type || '').toLowerCase();
    if (t === 'image/heic' || t === 'image/heif' ||
        t === 'image/heic-sequence' || t === 'image/heif-sequence') return true;
    return /\.(heic|heif)$/i.test(file.name || '');
  }

  function esPdf(file) {
    return String(file.type || '').toLowerCase() === 'application/pdf' ||
           /\.pdf$/i.test(file.name || '');
  }

  function fecha(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) { return ''; }
  }

  /* ── estilos ── */

  function inyectarEstilos() {
    if (document.getElementById(ESTILOS_ID)) return;
    var s = document.createElement('style');
    s.id = ESTILOS_ID;
    s.textContent = [
      '.cpf{margin-top:1rem;border:1px solid #e2e8f0;border-radius:12px;',
      'background:#fff;padding:.95rem 1rem;font-size:.875rem}',
      '.cpf-top{display:flex;gap:.8rem;align-items:flex-start}',
      '.cpf-ico{flex:none;width:34px;height:34px;border-radius:9px;background:#ecfeff;',
      'color:#0891b2;display:flex;align-items:center;justify-content:center}',
      '.cpf-ico svg{width:18px;height:18px}',
      '.cpf-tit{font-size:.875rem;font-weight:650;color:#0f172a;line-height:1.3}',
      '.cpf-sub{font-size:.8rem;color:#64748b;line-height:1.5;margin-top:.2rem}',
      '.cpf-acciones{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin-top:.8rem}',
      '.cpf-btn{display:inline-flex;align-items:center;gap:.4rem;padding:.5rem .9rem;',
      'border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#0891b2;',
      'font:inherit;font-size:.82rem;font-weight:600;cursor:pointer}',
      '.cpf-btn:hover{background:#ecfeff;border-color:#0891b2}',
      '.cpf-btn svg{width:15px;height:15px}',
      '.cpf-btn[aria-disabled="true"]{opacity:.6;cursor:progress}',
      '.cpf-btn.cpf-quitar{color:#64748b}',
      '.cpf-btn.cpf-quitar:hover{background:#fef2f2;border-color:#fca5a5;color:#b91c1c}',
      '.cpf-formatos{font-size:.75rem;color:#94a3b8}',
      '.cpf-archivo{display:flex;gap:.8rem;align-items:center;margin-top:.85rem;',
      'padding-top:.85rem;border-top:1px solid #e2e8f0}',
      '.cpf-thumb{flex:none;width:58px;height:58px;border-radius:8px;border:1px solid #e2e8f0;',
      'background:#f8fafc;object-fit:cover;cursor:zoom-in;display:block}',
      '.cpf-pdf{flex:none;width:58px;height:58px;border-radius:8px;border:1px solid #e2e8f0;',
      'background:#f8fafc;color:#0891b2;display:flex;align-items:center;justify-content:center}',
      '.cpf-pdf svg{width:22px;height:22px}',
      '.cpf-datos{flex:1;min-width:0}',
      '.cpf-nombre{font-size:.82rem;font-weight:600;color:#0f172a;overflow:hidden;',
      'text-overflow:ellipsis;white-space:nowrap}',
      '.cpf-meta{font-size:.75rem;color:#64748b;margin-top:.15rem}',
      '.cpf-msg{margin-top:.7rem;font-size:.8rem;line-height:1.45}',
      '.cpf-msg.cpf-error{color:#b91c1c}',
      '.cpf-msg.cpf-ok{color:#0e7490}',
      // Lightbox
      '.cpf-lupa{position:fixed;inset:0;z-index:10001;background:rgba(15,23,42,.82);',
      'display:flex;align-items:center;justify-content:center;padding:1.5rem;cursor:zoom-out}',
      '.cpf-lupa img{max-width:100%;max-height:100%;border-radius:10px;background:#fff}',
      // Oscuro
      'html[data-theme="dark"] .cpf{background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.09)}',
      'html[data-theme="dark"] .cpf-ico{background:rgba(6,182,212,.12);color:#22d3ee}',
      'html[data-theme="dark"] .cpf-tit,html[data-theme="dark"] .cpf-nombre{color:#f1f5f9}',
      'html[data-theme="dark"] .cpf-sub,html[data-theme="dark"] .cpf-meta{color:#94a3b8}',
      'html[data-theme="dark"] .cpf-btn{background:rgba(255,255,255,.04);',
      'border-color:rgba(255,255,255,.12);color:#22d3ee}',
      'html[data-theme="dark"] .cpf-btn:hover{background:rgba(6,182,212,.12);border-color:#22d3ee}',
      'html[data-theme="dark"] .cpf-btn.cpf-quitar{color:#94a3b8}',
      'html[data-theme="dark"] .cpf-archivo{border-top-color:rgba(255,255,255,.09)}',
      'html[data-theme="dark"] .cpf-thumb,html[data-theme="dark"] .cpf-pdf{',
      'background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.12)}',
      'html[data-theme="dark"] .cpf-msg.cpf-error{color:#fca5a5}',
      'html[data-theme="dark"] .cpf-msg.cpf-ok{color:#22d3ee}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ── iconos ── */

  var ICO_CAMARA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
  var ICO_SUBIR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
  var ICO_PDF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  var ICO_OJO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var ICO_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  /* ── conversión y compresión ── */

  // HEIC (formato por defecto del iPhone) no lo decodifica <img> fuera de Safari:
  // se convierte en el servidor antes de tocar el canvas.
  function heicAJpeg(file) {
    var fd = new FormData();
    fd.append('file', file, file.name || 'foto.heic');
    return fetch('/api/media/heic-to-jpeg', { method: 'POST', body: fd, credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('No se pudo convertir la foto del iPhone. Prueba con JPG o PNG.');
        return r.blob();
      }, function () {
        throw new Error('No se pudo convertir la foto (sin conexión).');
      });
  }

  function reducirImagen(file) {
    var origen = Promise.resolve(file);
    if (esHeic(file)) origen = heicAJpeg(file);
    return origen.then(function (src) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onerror = function () { reject(new Error('No se pudo leer el archivo')); };
        reader.onload = function () {
          var img = new Image();
          img.onerror = function () { reject(new Error('No se pudo abrir la imagen')); };
          img.onload = function () {
            var w = img.width, h = img.height;
            var escala = Math.min(1, MAX_LADO / Math.max(w, h));
            w = Math.round(w * escala); h = Math.round(h * escala);
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            canvas.toBlob(function (blob) {
              if (!blob) return reject(new Error('No se pudo procesar la imagen'));
              resolve(blob);
            }, 'image/jpeg', CALIDAD_JPEG);
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(src);
      });
    });
  }

  /* ── pintado ── */

  function bloqueSubida() {
    var wrap = document.createElement('div');
    wrap.className = 'cpf';
    wrap.id = 'cpfBloque';
    wrap.innerHTML =
      '<div class="cpf-top">' +
        '<div class="cpf-ico">' + ICO_CAMARA + '</div>' +
        '<div>' +
          '<div class="cpf-tit">¿El paciente firmó en papel?</div>' +
          '<div class="cpf-sub">Sube la foto o el escaneo de la hoja firmada y queda guardada ' +
          'en el expediente del paciente junto a esta consulta.</div>' +
        '</div>' +
      '</div>' +
      '<div class="cpf-acciones">' +
        // data-sd-gate: el modo solo lectura (layout.js) apaga los <label> solo
        // cuando lo piden a mano, y este abre el selector de archivos.
        '<label class="cpf-btn" id="cpfSubirBtn" for="cpfInput" data-sd-gate>' + ICO_SUBIR + 'Subir consentimiento firmado</label>' +
        '<input type="file" id="cpfInput" accept="image/*,.heic,.heif,application/pdf" hidden>' +
        '<span class="cpf-formatos">Foto o PDF · máx. 10 MB</span>' +
      '</div>' +
      '<div class="cpf-msg" id="cpfMsg" style="display:none"></div>' +
      '<div id="cpfArchivo"></div>';
    return wrap;
  }

  function mensaje(texto, tipo) {
    var el = document.getElementById('cpfMsg');
    if (!el) return;
    if (!texto) { el.style.display = 'none'; el.textContent = ''; return; }
    el.className = 'cpf-msg ' + (tipo === 'error' ? 'cpf-error' : 'cpf-ok');
    el.textContent = texto;
    el.style.display = '';
  }

  function tarjetaArchivo(doc, opciones) {
    var soloLectura = !!(opciones && opciones.soloLectura);
    var esImagen = !/\.pdf($|\?)/i.test(doc.document_url || '') &&
                   !/\.pdf$/i.test(doc.document_name || '');
    var cont = document.createElement('div');
    cont.className = 'cpf-archivo';
    cont.innerHTML =
      (esImagen
        ? '<img class="cpf-thumb" id="cpfThumb" alt="Consentimiento firmado" src="' + esc(doc.document_url) + '">'
        : '<div class="cpf-pdf">' + ICO_PDF + '</div>') +
      '<div class="cpf-datos">' +
        '<div class="cpf-nombre">' + esc(doc.document_name || 'Consentimiento firmado') + '</div>' +
        // En lectura la cabecera ya dice "Firmado en papel": repetirlo aquí solo
        // gasta una línea.
        '<div class="cpf-meta">' +
          (soloLectura ? '' : 'Firmado en papel') +
          (doc.document_uploaded_at
            ? (soloLectura ? '' : ' · ') + esc(fecha(doc.document_uploaded_at))
            : '') +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:.4rem;flex-wrap:wrap">' +
        '<button type="button" class="cpf-btn" id="cpfVer">' + ICO_OJO + 'Ver</button>' +
        (soloLectura ? '' : '<button type="button" class="cpf-btn cpf-quitar" id="cpfQuitar">Quitar</button>') +
      '</div>';

    var abrir = function () {
      if (!esImagen) { window.open(doc.document_url, '_blank', 'noopener'); return; }
      var lupa = document.createElement('div');
      lupa.className = 'cpf-lupa';
      lupa.innerHTML = '<img alt="Consentimiento firmado" src="' + esc(doc.document_url) + '">';
      lupa.addEventListener('click', function () { lupa.remove(); });
      document.body.appendChild(lupa);
    };
    cont.querySelector('#cpfVer').addEventListener('click', abrir);
    var thumb = cont.querySelector('#cpfThumb');
    if (thumb) thumb.addEventListener('click', abrir);
    var quitar = cont.querySelector('#cpfQuitar');
    if (quitar) quitar.addEventListener('click', quitarDocumento);
    return cont;
  }

  function pintarArchivo() {
    var caja = document.getElementById('cpfArchivo');
    if (!caja) return;
    caja.innerHTML = '';
    if (estado.doc && estado.doc.document_url) caja.appendChild(tarjetaArchivo(estado.doc, {}));
    var btn = document.getElementById('cpfSubirBtn');
    if (btn) {
      btn.innerHTML = ICO_SUBIR + (estado.doc && estado.doc.document_url
        ? 'Reemplazar foto'
        : 'Subir consentimiento firmado');
    }
  }

  /* ── subida ── */

  function subir(file) {
    if (!file || estado.subiendo) return;
    mensaje('');

    var patientId = cfg.getPatientId ? cfg.getPatientId() : null;
    if (!patientId) {
      mensaje('Espera a que termine de cargar el paciente e inténtalo de nuevo.', 'error');
      return;
    }
    if (file.size > MAX_BYTES && esPdf(file)) {
      mensaje('El PDF pesa más de 10 MB. Escanéalo con menos calidad e inténtalo de nuevo.', 'error');
      return;
    }

    var btn = document.getElementById('cpfSubirBtn');
    estado.subiendo = true;
    if (btn) { btn.setAttribute('aria-disabled', 'true'); btn.innerHTML = ICO_SUBIR + 'Subiendo…'; }

    var preparado = esPdf(file)
      ? Promise.resolve(file)
      : reducirImagen(file).then(function (blob) {
          // El canvas siempre devuelve JPEG: el nombre tiene que acompañar o el
          // servidor archiva un .heic que en realidad ya es una foto normal.
          var base = (file.name || 'consentimiento').replace(/\.[^.]+$/, '');
          return new File([blob], base + '.jpg', { type: 'image/jpeg' });
        });

    preparado
      .then(function (archivo) {
        if (archivo.size > MAX_BYTES) throw new Error('El archivo pesa más de 10 MB.');
        var fd = new FormData();
        fd.append('document', archivo, archivo.name || 'consentimiento.jpg');
        fd.append('patient_id', String(patientId));
        var templateId = plantillaSeleccionada();
        if (templateId) fd.append('template_id', String(templateId));
        var consentId = estado.consentId || (cfg.getConsentId ? cfg.getConsentId() : null);
        if (consentId) fd.append('consent_id', String(consentId));

        var headers = {};
        var t = token();
        if (t) headers['Authorization'] = 'Bearer ' + t;
        return fetch('/api/consents/paper', {
          method: 'POST', body: fd, headers: headers, credentials: 'same-origin'
        });
      })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (res.status === 402) {
            if (typeof window.sdPaywall === 'function') window.sdPaywall();
            throw new Error(data.error || 'Tu cuenta está en modo solo lectura.');
          }
          if (!res.ok) throw new Error(data.error || 'No se pudo guardar el consentimiento.');
          return data;
        });
      })
      .then(function (consent) {
        estado.consentId = consent.id;
        estado.doc = consent;
        if (cfg.onConsent) cfg.onConsent(consent.id);
        pintarArchivo();
        mensaje('Consentimiento guardado en el expediente del paciente.', 'ok');
      })
      .catch(function (e) {
        mensaje(e.message || 'No se pudo guardar el consentimiento.', 'error');
      })
      .then(function () {
        estado.subiendo = false;
        var b = document.getElementById('cpfSubirBtn');
        if (b) b.removeAttribute('aria-disabled');
        pintarArchivo();
        var input = document.getElementById('cpfInput');
        if (input) input.value = '';
      });
  }

  function quitarDocumento() {
    var id = estado.consentId || (cfg && cfg.getConsentId ? cfg.getConsentId() : null);
    if (!id) return;
    if (!window.confirm('¿Quitar la foto del consentimiento firmado?')) return;
    var headers = {};
    var t = token();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    fetch('/api/consents/' + id + '/document', {
      method: 'DELETE', headers: headers, credentials: 'same-origin'
    })
      .then(function (res) {
        if (res.status === 402 && typeof window.sdPaywall === 'function') window.sdPaywall();
        if (!res.ok) throw new Error('No se pudo quitar el documento.');
        estado.doc = null;
        pintarArchivo();
        mensaje('');
      })
      .catch(function (e) { mensaje(e.message, 'error'); });
  }

  function plantillaSeleccionada() {
    if (cfg && cfg.getTemplateId) return cfg.getTemplateId();
    var sel = document.getElementById('consTemplateSelect');
    var v = sel && sel.value ? parseInt(sel.value, 10) : null;
    return v || null;
  }

  /* ── montaje ── */

  function seccionDeConsentimiento() {
    var barra = document.getElementById('consConsentInfo');
    if (!barra) return null;
    return barra.closest('.form-section') || barra.parentElement;
  }

  function init(opciones) {
    cfg = opciones || {};
    // `host` es para las pantallas que pintan su sección con React
    // (odontopediatría): ahí no hay barra de consentimiento donde colgarse, sino
    // un div vacío que React nunca toca por dentro.
    var host = cfg.host ? document.querySelector(cfg.host) : null;
    var barra = document.getElementById('consConsentInfo');
    if (!host && !barra) return;
    if (document.getElementById('cpfBloque')) return;
    // En modo lectura la página llama a showSaved(), no a init().
    if (document.body.classList.contains('viewer-mode')) return;

    inyectarEstilos();
    var bloque = bloqueSubida();
    if (host) host.appendChild(bloque);
    else barra.parentNode.insertBefore(bloque, barra.nextSibling);

    var input = document.getElementById('cpfInput');
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) subir(input.files[0]);
    });
    // Cuenta sin plan: el clic sobre el <label> lo ataja layout.js y sale el
    // aviso, pero el navegador ya habría abierto el selector de archivos.
    document.getElementById('cpfSubirBtn').addEventListener('click', function (e) {
      if (window.SD_READONLY) { e.preventDefault(); }
    });
  }

  // Modo lectura: pinta el consentimiento ya guardado (firma en pantalla y/o
  // foto del papel) dentro de la sección, y deja fuera todo lo que edita.
  function showSaved(consentId, opciones) {
    if (!consentId) return Promise.resolve(null);
    var host = opciones && opciones.host ? document.querySelector(opciones.host) : null;
    var seccion = host || seccionDeConsentimiento();
    if (!seccion) return Promise.resolve(null);

    return fetch('/api/consents/' + consentId, {
      headers: (function () { var h = {}; var t = token(); if (t) h['Authorization'] = 'Bearer ' + t; return h; })(),
      credentials: 'same-origin'
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (consent) {
        if (!consent) return null;
        inyectarEstilos();

        // Con contenedor propio no hay nada que apagar: la página ya pinta su
        // sección en modo lectura. Sin él hay que retirar los controles de
        // edición, y la sección entera puede venir oculta por el CSS de
        // viewer-mode (con !important), así que se fuerza.
        if (!host) {
          var barra = document.getElementById('consConsentInfo');
          if (barra) barra.style.setProperty('display', 'none', 'important');
          Array.prototype.forEach.call(seccion.querySelectorAll('.form-grid'), function (g) {
            g.style.setProperty('display', 'none', 'important');
          });
          // "Seleccionar plantilla y firmar antes de cerrar la consulta" es una
          // instrucción para quien rellena, no para quien consulta.
          Array.prototype.forEach.call(seccion.querySelectorAll('.section-help'), function (h) {
            h.style.setProperty('display', 'none', 'important');
          });
          seccion.style.setProperty('display', 'block', 'important');
        }

        var previo = document.getElementById('cpfBloque');
        if (previo) previo.remove();

        var wrap = document.createElement('div');
        wrap.className = 'cpf';
        wrap.id = 'cpfBloque';
        wrap.innerHTML =
          '<div class="cpf-top">' +
            '<div class="cpf-ico">' + ICO_CHECK + '</div>' +
            '<div>' +
              '<div class="cpf-tit">' + esc(consent.title || 'Consentimiento informado') + '</div>' +
              '<div class="cpf-sub">' +
                (consent.document_url ? 'Firmado en papel' : 'Firmado en pantalla') +
                (consent.signed_by ? ' · registrado por ' + esc(consent.signed_by) : '') +
                (consent.signature_date ? ' · ' + esc(fecha(consent.signature_date)) : '') +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div id="cpfArchivo"></div>';
        seccion.appendChild(wrap);

        if (consent.document_url) {
          wrap.querySelector('#cpfArchivo').appendChild(tarjetaArchivo(consent, { soloLectura: true }));
        } else if (consent.signature_data) {
          var firma = document.createElement('div');
          firma.className = 'cpf-archivo';
          firma.innerHTML = '<img class="cpf-thumb" style="cursor:default;object-fit:contain" ' +
            'alt="Firma del paciente" src="' + esc(consent.signature_data) + '">' +
            '<div class="cpf-datos"><div class="cpf-nombre">Firma del paciente</div>' +
            '<div class="cpf-meta">Capturada en pantalla</div></div>';
          wrap.querySelector('#cpfArchivo').appendChild(firma);
        }
        return consent;
      })
      .catch(function () { return null; });
  }

  window.ConsentPhoto = {
    init: init,
    showSaved: showSaved,
    // La página avisa cuando la firma en pantalla ya creó el consentimiento, para
    // que una foto posterior se guarde en esa misma fila y no en una nueva.
    setConsentId: function (id) { estado.consentId = id || null; }
  };
})();
