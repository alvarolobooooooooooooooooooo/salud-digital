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
    parseMapsUrl: parseMapsUrl
  };
})(window);
