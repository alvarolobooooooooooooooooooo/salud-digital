// ── map-picker.js — Selector de punto en el mapa ──
// Lo usan Configuración › Ubicación y el paso de ubicación del alta.
//
// Leaflet + tiles de OpenStreetMap: no necesita API key ni tarjeta, y es la misma
// pila que ya usa el mapa público /mapa. Los botones "abrir en Google Maps / Waze"
// que ve el paciente son enlaces universales, así que no depender de la SDK de
// Google aquí no le quita nada al doctor.
//
// El script de Leaflet se carga bajo demanda la primera vez que se crea un picker:
// así las páginas que lo incluyen no pagan la descarga si el usuario nunca abre
// la pestaña de ubicación.

(function (global) {
  'use strict';

  var LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  var LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  var CSS_SRI = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
  var JS_SRI = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';

  // Tegucigalpa: encuadre por defecto cuando la clínica todavía no tiene pin.
  var DEFAULT_CENTER = [14.0723, -87.1921];
  var DEFAULT_ZOOM = 12;
  var PIN_ZOOM = 17;

  var loadPromise = null;

  function loadLeaflet() {
    if (global.L) return Promise.resolve(global.L);
    if (loadPromise) return loadPromise;

    loadPromise = new Promise(function (resolve, reject) {
      if (!document.querySelector('link[data-leaflet]')) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = LEAFLET_CSS;
        link.integrity = CSS_SRI;
        link.crossOrigin = '';
        link.setAttribute('data-leaflet', '1');
        document.head.appendChild(link);
      }
      var s = document.createElement('script');
      s.src = LEAFLET_JS;
      s.integrity = JS_SRI;
      s.crossOrigin = '';
      s.async = true;
      s.onload = function () { resolve(global.L); };
      s.onerror = function () {
        loadPromise = null;
        reject(new Error('No se pudo cargar el mapa. Revisa tu conexión.'));
      };
      document.head.appendChild(s);
    });
    return loadPromise;
  }

  function markerIcon(color) {
    var safe = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(color || '')) ? color : '#0891b2';
    return global.L.divIcon({
      className: '',
      html:
        '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;' +
        'transform:rotate(-45deg);background:' + safe + ';' +
        'border:2.5px solid #fff;box-shadow:0 4px 12px rgba(15,23,42,.45)"></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 26]
    });
  }

  /**
   * Crea el selector dentro de `el`.
   * opts: { lat, lng, color, zoom, onChange(lat, lng) }
   * Devuelve una API síncrona; el mapa se monta en cuanto Leaflet termina de
   * cargar, y las llamadas hechas antes se aplican al montarse.
   */
  function create(el, opts) {
    opts = opts || {};
    var map = null;
    var marker = null;
    var pending = null;
    var current = null;
    var onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};
    var ready = false;

    if (hasCoords(opts.lat, opts.lng)) {
      current = { lat: Number(opts.lat), lng: Number(opts.lng) };
    }

    function hasCoords(a, b) {
      return a !== null && a !== undefined && a !== '' &&
             b !== null && b !== undefined && b !== '' &&
             Number.isFinite(Number(a)) && Number.isFinite(Number(b));
    }

    function place(lat, lng, notify) {
      current = { lat: Number(lat), lng: Number(lng) };
      if (!ready) { pending = { lat: current.lat, lng: current.lng }; }
      else {
        if (!marker) {
          marker = global.L.marker([current.lat, current.lng], {
            draggable: true,
            icon: markerIcon(opts.color),
            keyboard: true,
            title: 'Arrastra para ajustar el punto exacto'
          }).addTo(map);
          marker.on('dragend', function () {
            var p = marker.getLatLng();
            current = { lat: p.lat, lng: p.lng };
            onChange(p.lat, p.lng);
          });
        } else {
          marker.setLatLng([current.lat, current.lng]);
        }
      }
      if (notify) onChange(current.lat, current.lng);
    }

    var api = {
      // Coloca el pin y centra el mapa. `silent` evita disparar onChange (se usa
      // al hidratar desde el servidor, para no marcar el formulario como sucio).
      set: function (lat, lng, o) {
        o = o || {};
        if (!hasCoords(lat, lng)) return;
        place(lat, lng, !o.silent);
        if (ready) {
          var z = Math.max(map.getZoom(), o.zoom || PIN_ZOOM);
          if (o.fly) map.flyTo([Number(lat), Number(lng)], z, { duration: 0.8 });
          else map.setView([Number(lat), Number(lng)], z);
        }
      },
      clear: function (o) {
        o = o || {};
        current = null;
        pending = null;
        if (marker && map) { map.removeLayer(marker); marker = null; }
        if (!o.silent) onChange(null, null);
      },
      get: function () { return current ? { lat: current.lat, lng: current.lng } : null; },
      // Leaflet mide mal el contenedor si estaba oculto (pestaña sin abrir, paso
      // del asistente todavía no visible). Hay que llamarlo al mostrarlo.
      refresh: function () {
        if (map) setTimeout(function () { map.invalidateSize(); }, 0);
      },
      isReady: function () { return ready; }
    };

    loadLeaflet().then(function (L) {
      var start = current || pending;
      // attributionControl: false — el selector es un control de formulario, no
      // un mapa publicado, y la firma «Leaflet | OpenStreetMap» sobre la esquina
      // distraía del único gesto que importa aquí: marcar el pin.
      map = L.map(el, { zoomControl: false, attributionControl: false })
        .setView(start ? [start.lat, start.lng] : DEFAULT_CENTER,
                 start ? PIN_ZOOM : (opts.zoom || DEFAULT_ZOOM));
      L.control.zoom({ position: 'topright' }).addTo(map);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      ready = true;
      if (start) place(start.lat, start.lng, false);
      pending = null;

      map.on('click', function (e) {
        place(e.latlng.lat, e.latlng.lng, true);
      });

      setTimeout(function () { map.invalidateSize(); }, 60);
    }).catch(function (err) {
      el.innerHTML = '<div style="padding:16px;font-size:13px;line-height:1.5;text-align:center">' +
        (err && err.message ? err.message : 'No se pudo cargar el mapa.') +
        '</div>';
    });

    return api;
  }

  /**
   * Pide la posición del navegador. Promesa con { lat, lng, accuracy }.
   * Requiere HTTPS (o localhost) — en producción la app ya fuerza HTTPS.
   */
  function locateMe(timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) {
        reject(new Error('Tu navegador no permite compartir la ubicación.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
        },
        function (err) {
          reject(new Error(
            err && err.code === 1
              ? 'Permiso denegado. Actívalo en los ajustes del navegador o marca el punto en el mapa.'
              : 'No pudimos obtener tu ubicación. Marca el punto en el mapa.'
          ));
        },
        { enableHighAccuracy: true, timeout: timeoutMs || 10000, maximumAge: 0 }
      );
    });
  }

  global.SDMapPicker = { create: create, locateMe: locateMe, load: loadLeaflet };
})(window);
