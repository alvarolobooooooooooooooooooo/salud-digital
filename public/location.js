// ── location.js — Ubicación de la clínica en el frontend ──
// Un solo sitio donde se decide cómo se arma un enlace de mapa, para que la
// reserva online, la página de confirmación, los recordatorios y la pantalla de
// configuración muestren exactamente lo mismo.
//
// Sin API keys: Google Maps y Waze aceptan enlaces "universales" que abren la app
// nativa si está instalada y el sitio web si no.

(function (global) {
  'use strict';

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // Normaliza cualquier objeto que traiga datos de clínica (respuesta de
  // /api/clinics/me, /api/public/clinic/:id o /api/confirmations/public/:token)
  // a una forma única.
  function from(src) {
    src = src || {};
    var lat = num(src.latitude !== undefined ? src.latitude : src.lat);
    var lng = num(src.longitude !== undefined ? src.longitude : src.lng);
    // (0,0) es el "null island": dato perdido, no una clínica.
    if (lat === 0 && lng === 0) { lat = null; lng = null; }
    return {
      name: src.name || src.clinic_name || '',
      address: src.address || src.clinic_address || '',
      city: src.city || src.clinic_city || '',
      phone: src.phone || src.clinic_phone || '',
      lat: lat,
      lng: lng,
      mapUrl: src.map_url || src.mapUrl || '',
      notes: src.location_notes || src.notes || ''
    };
  }

  // ¿Hay algo que enseñarle al paciente? Un pin, un enlace pegado o, como mínimo,
  // una dirección escrita.
  function has(loc) {
    if (!loc) return false;
    return hasPin(loc) || !!loc.mapUrl || !!fullAddress(loc);
  }

  function hasPin(loc) {
    return !!loc && loc.lat !== null && loc.lat !== undefined &&
                    loc.lng !== null && loc.lng !== undefined;
  }

  function fullAddress(loc) {
    if (!loc) return '';
    return [loc.address, loc.city].map(function (s) {
      return String(s || '').trim();
    }).filter(Boolean).join(', ');
  }

  function coordsText(loc) {
    if (!hasPin(loc)) return '';
    return Number(loc.lat).toFixed(6) + ', ' + Number(loc.lng).toFixed(6);
  }

  // Google Maps. Si la clínica pegó su propio enlace lo respetamos: suele apuntar
  // a la ficha del negocio, con fotos y horario. Si no, el pin. Si tampoco, texto.
  function googleMapsUrl(loc) {
    if (!loc) return '';
    if (loc.mapUrl && /^https?:\/\//i.test(loc.mapUrl)) return loc.mapUrl;
    if (hasPin(loc)) {
      return 'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent(loc.lat + ',' + loc.lng);
    }
    var addr = fullAddress(loc);
    if (!addr) return '';
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr);
  }

  // Enlace de navegación "en crudo" (nunca el mapUrl de la clínica): lo usa el
  // botón "Cómo llegar" y el mensaje de WhatsApp cuando hay pin.
  function directionsUrl(loc) {
    if (hasPin(loc)) {
      return 'https://www.google.com/maps/dir/?api=1&destination=' +
        encodeURIComponent(loc.lat + ',' + loc.lng);
    }
    var addr = fullAddress(loc);
    if (!addr) return '';
    return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(addr);
  }

  // Waze. Con coordenadas navega directo; con texto abre la búsqueda.
  function wazeUrl(loc) {
    if (hasPin(loc)) {
      return 'https://waze.com/ul?ll=' + encodeURIComponent(loc.lat + ',' + loc.lng) +
        '&navigate=yes';
    }
    var addr = fullAddress(loc);
    if (!addr) return '';
    return 'https://waze.com/ul?q=' + encodeURIComponent(addr);
  }

  // Mapa estático embebible sin API key (iframe de Google Maps).
  function embedUrl(loc) {
    var q = hasPin(loc) ? (loc.lat + ',' + loc.lng) : fullAddress(loc);
    if (!q) return '';
    return 'https://www.google.com/maps?q=' + encodeURIComponent(q) + '&z=16&output=embed';
  }

  // Texto que se manda por WhatsApp. Corto a propósito: nombre, dirección,
  // referencias y los dos enlaces. WhatsApp los convierte en enlaces tocables.
  function shareText(opts) {
    opts = opts || {};
    var loc = opts.loc || {};
    var lines = [];
    var head = opts.intro || ('Ubicación de ' + (loc.name || 'la clínica'));
    lines.push(head);

    var addr = fullAddress(loc);
    if (addr) lines.push(addr);
    if (loc.notes) lines.push('Referencia: ' + loc.notes);
    if (opts.when) lines.push('Cita: ' + opts.when);

    var g = googleMapsUrl(loc);
    var w = wazeUrl(loc);
    if (g || w) lines.push('');
    if (g) lines.push('Google Maps: ' + g);
    if (w) lines.push('Waze: ' + w);

    return lines.join('\n');
  }

  // wa.me sin número abre el selector de contacto de WhatsApp; con número va
  // directo a ese chat. Reutiliza la normalización de whatsapp.js si está cargada.
  function whatsappUrl(text, phone) {
    var digits = String(phone || '').replace(/\D/g, '');
    if (digits && digits.length === 8) digits = '504' + digits;   // Honduras
    if (digits && !/^\d{8,15}$/.test(digits)) digits = '';
    return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(text || '');
  }

  // Lee coordenadas de un enlace de Google Maps pegado por el usuario. Es la
  // versión de navegador de lib/maps-links.js: cubre los enlaces "largos"; los
  // acortados (maps.app.goo.gl) los resuelve el servidor.
  function parseMapsUrl(input) {
    var raw = String(input || '').trim();
    if (!raw) return null;

    function ok(a, b) {
      var x = Number(a), y = Number(b);
      return Number.isFinite(x) && Number.isFinite(y) &&
        x >= -90 && x <= 90 && y >= -180 && y <= 180 && !(x === 0 && y === 0)
        ? { lat: x, lng: y } : null;
    }

    // En orden de fiabilidad: coordenadas sueltas, el pin real (!3d/!4d), el
    // encuadre de la cámara (@) y por último los parámetros de consulta. Si un
    // patrón casa pero da valores imposibles, se sigue probando con el siguiente.
    var patrones = [
      /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/,
      /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
      /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
      /[?&](?:q|query|ll|sll|daddr|destination|center)=(-?\d+(?:\.\d+)?)(?:,|%2C)(-?\d+(?:\.\d+)?)/i
    ];
    for (var i = 0; i < patrones.length; i++) {
      var m = raw.match(patrones[i]);
      var r = m ? ok(m[1], m[2]) : null;
      if (r) return r;
    }
    return null;
  }

  // ── Bloque "Cómo llegar" ────────────────────────────────────────────────────
  // Un solo trozo de HTML+CSS para las tres pantallas donde el paciente ve la
  // ubicación (reserva online, enlace de confirmación y la vista previa de
  // Configuración), para que las tres se vean idénticas.

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Marcas de las apps, dibujadas para que cada botón se reconozca de un vistazo
  // (el pin rojo de Google Maps, el bocadillo de Waze sobre su cian, el auricular
  // de WhatsApp sobre su verde). Van en el propio SVG y no como imagen remota:
  // la CSP de la app no permite cargar assets de terceros.
  var ICON_GMAPS =
    '<svg class="sdloc-ico" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path fill="#34A853" d="M5.4 13.9c.6 1 1.3 2 2 2.9.6.9 1.2 1.7 1.6 2.4.3.5.5.9.7 1.4.1.3.2.5.3.8.1.2.2.3.4.3s.3-.1.4-.3c.1-.3.2-.5.3-.8.2-.5.4-.9.7-1.4.4-.7 1-1.5 1.6-2.4l.6-.9-4.1-4.6z"/>' +
      '<path fill="#FBBC04" d="M3.7 9.4c.2 1 .6 2 1.1 2.9l.6 1.6 4.2-5-.1-.1a2.6 2.6 0 0 1 3.8-3.5l2.6-3-1-.6a8.4 8.4 0 0 0-3.4-.9L9 .8 5.9 2.7z"/>' +
      '<path fill="#4285F4" d="M15.9 5.3a2.6 2.6 0 0 1-.2 3.4l-1.5 1.8 4.2 5 .3-.5c1-1.5 1.6-3.3 1.6-5.2 0-2.7-1.3-5.2-3.3-6.8z"/>' +
      '<path fill="#1A73E8" d="M12 3.3c1.5 0 2.9.7 3.8 1.9l2.6-3A8.5 8.5 0 0 0 12 0C9 0 6.3 1.5 4.7 3.9l3.5 4.2c.4-2.7 1.9-4.8 3.8-4.8z"/>' +
      '<path fill="#EA4335" d="M8.2 8.1 4.7 3.9A8.4 8.4 0 0 0 3.5 8.2c0 .4 0 .8.1 1.2l4.6 5.5-.2-.3c-.6-.9-1-1.6-1.3-2.3-.4-.9-.5-1.7-.5-2.3 0-.7.1-1.3.3-1.8z"/>' +
      '<circle cx="12" cy="9.2" r="2.6" fill="#fff"/>' +
    '</svg>';

  var ICON_WAZE =
    '<svg class="sdloc-ico" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path fill="#fff" d="M12 2.6c-4.6 0-8.3 3.3-8.3 7.5 0 1.3.4 2.5 1 3.6.5.9.6 1.6.4 2.2-.2.6-.7 1-1.2 1.3-.4.2-.5.7-.3 1 .2.4.6.5 1 .4 1-.3 1.9-.8 2.6-1.5 1.4.7 3 1.1 4.8 1.1 4.6 0 8.3-3.3 8.3-7.5S16.6 2.6 12 2.6z"/>' +
      '<circle cx="9.6" cy="9.2" r="1.25" fill="#33CCFF"/>' +
      '<circle cx="14.4" cy="9.2" r="1.25" fill="#33CCFF"/>' +
      '<path fill="none" stroke="#33CCFF" stroke-width="1.3" stroke-linecap="round" d="M9.3 12.6c.6.8 1.5 1.3 2.7 1.3s2.1-.5 2.7-1.3"/>' +
      '<circle cx="7.4" cy="19.6" r="1.6" fill="#fff"/>' +
      '<circle cx="15.4" cy="19.6" r="1.6" fill="#fff"/>' +
    '</svg>';

  var ICON_WA =
    '<svg class="sdloc-ico" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path fill="#fff" d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.4.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3M12.1 21.8a9.9 9.9 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4a9.9 9.9 0 0 1-1.5-5.3C2.3 6.5 6.7 2 12.1 2c2.6 0 5.1 1 7 2.9a9.8 9.8 0 0 1 2.9 7c0 5.5-4.4 9.9-9.9 9.9m8.4-18.3A11.8 11.8 0 0 0 12.1 0C5.5 0 .2 5.3.2 11.9c0 2.1.5 4.1 1.6 5.9L.1 24l6.3-1.7c1.7.9 3.7 1.4 5.7 1.4 6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.2-3.5-8.4"/>' +
    '</svg>';

  var STYLE_ID = 'sd-loc-styles';
  var STYLES =
    '.sdloc{border:1px solid var(--sdloc-line,#e2e8f0);border-radius:14px;padding:14px 16px;text-align:left;' +
      'background:var(--sdloc-bg,#fff);color:var(--sdloc-ink,#0f172a)}' +
    '.sdloc-head{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;' +
      'letter-spacing:.08em;text-transform:uppercase;color:var(--sdloc-muted,#64748b)}' +
    '.sdloc-addr{font-size:14px;font-weight:600;margin-top:8px;line-height:1.5}' +
    '.sdloc-notes{font-size:12.5px;color:var(--sdloc-muted,#64748b);margin-top:5px;line-height:1.5}' +
    // El iframe de Google Maps no necesita API key y ya es el diseño de la app.
    '.sdloc-map{position:relative;margin-top:12px;border-radius:12px;overflow:hidden;' +
      'border:1px solid var(--sdloc-line,#e2e8f0);background:#e8eaed;height:170px}' +
    '.sdloc-map iframe{display:block;width:100%;height:100%;border:0}' +
    '.sdloc-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}' +
    '.sdloc-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;' +
      'font-size:13px;font-weight:600;text-decoration:none;line-height:1;border:1px solid transparent;' +
      'transition:filter .15s,transform .15s,box-shadow .15s;-webkit-tap-highlight-color:transparent}' +
    '.sdloc-btn:hover{transform:translateY(-1px)}' +
    '.sdloc-btn:active{transform:translateY(0)}' +
    '.sdloc-ico{width:18px;height:18px;flex-shrink:0;display:block}' +
    // Google Maps: chip blanco con el pin a color, como los propios botones de Google.
    '.sdloc-gmaps{background:#fff;color:#3c4043;border-color:#dadce0;' +
      'box-shadow:0 1px 2px rgba(60,64,67,.12)}' +
    '.sdloc-gmaps:hover{background:#f8f9fa;box-shadow:0 2px 6px rgba(60,64,67,.2)}' +
    '.sdloc-waze{background:#33CCFF;color:#043b4d;box-shadow:0 1px 2px rgba(4,59,77,.18)}' +
    '.sdloc-waze:hover{filter:brightness(1.05);box-shadow:0 2px 8px rgba(4,59,77,.28)}' +
    '.sdloc-wa{background:#25D366;color:#fff;box-shadow:0 1px 2px rgba(7,94,84,.2)}' +
    '.sdloc-wa:hover{filter:brightness(1.04);box-shadow:0 2px 8px rgba(7,94,84,.3)}' +
    '@media (max-width:420px){.sdloc-btn{flex:1 1 100%;justify-content:center}}';
    // Deliberadamente SIN variante oscura aquí. Las páginas del paciente
    // (agendar.html, confirm.html) son claras por diseño, pero agendar.html carga
    // theme.js y acaba con data-theme="dark" en el <html> si el móvil está en
    // oscuro: una regla [data-theme="dark"] en este archivo dejaba el texto claro
    // sobre la tarjeta blanca. La pantalla que sí tiene modo oscuro de verdad
    // (configuracion.html) redefine --sdloc-* en su propia hoja.

  // Se inyecta una sola vez por página; así location.js sigue siendo un único
  // <script> que se puede añadir a cualquier pantalla sin tocar su CSS.
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = STYLES;
    (document.head || document.documentElement).appendChild(s);
  }

  /**
   * HTML del bloque completo. Devuelve '' si no hay nada que enseñar.
   * opts: { loc, when, title, intro, phone, map:false }
   */
  function blockHtml(opts) {
    opts = opts || {};
    var loc = opts.loc || {};
    if (!has(loc)) return '';
    injectStyles();

    var addr = fullAddress(loc);
    var g = googleMapsUrl(loc);
    var w = wazeUrl(loc);
    var embed = opts.map === false ? '' : embedUrl(loc);
    var waText = shareText({ loc: loc, when: opts.when, intro: opts.intro });

    var html = '<div class="sdloc">' +
      '<div class="sdloc-head">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
          'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>' +
        '</svg>' + esc(opts.title || 'Cómo llegar') +
      '</div>' +
      '<div class="sdloc-addr">' + esc(addr || loc.name) + '</div>' +
      (loc.notes ? '<div class="sdloc-notes">' + esc(loc.notes) + '</div>' : '');

    if (embed) {
      html += '<div class="sdloc-map">' +
        '<iframe src="' + esc(embed) + '" loading="lazy" title="Mapa de ' +
        esc(loc.name || 'la clínica') + '" referrerpolicy="no-referrer-when-downgrade" ' +
        'allowfullscreen></iframe></div>';
    }

    html += '<div class="sdloc-btns">' +
      (g ? '<a class="sdloc-btn sdloc-gmaps" href="' + esc(g) + '" target="_blank" rel="noopener">' +
        ICON_GMAPS + 'Google Maps</a>' : '') +
      (w ? '<a class="sdloc-btn sdloc-waze" href="' + esc(w) + '" target="_blank" rel="noopener">' +
        ICON_WAZE + 'Waze</a>' : '') +
      '<a class="sdloc-btn sdloc-wa" href="' + esc(whatsappUrl(waText, opts.phone)) +
        '" target="_blank" rel="noopener">' + ICON_WA + 'Enviar por WhatsApp</a>' +
    '</div></div>';

    return html;
  }

  global.SDLocation = {
    from: from,
    has: has,
    hasPin: hasPin,
    fullAddress: fullAddress,
    coordsText: coordsText,
    googleMapsUrl: googleMapsUrl,
    directionsUrl: directionsUrl,
    wazeUrl: wazeUrl,
    embedUrl: embedUrl,
    shareText: shareText,
    whatsappUrl: whatsappUrl,
    parseMapsUrl: parseMapsUrl,
    blockHtml: blockHtml,
    injectStyles: injectStyles
  };
})(window);
