/**
 * ── Moneda de la clínica, en el navegador ──
 *
 * Toda cifra de dinero que se pinte en la app pasa por aquí. Antes cada página
 * llevaba su propio `'L. ' + n.toFixed(2)` escrito a mano —había catorce
 * copias— y eso significaba que la moneda no era un dato de la clínica sino una
 * constante repartida por el código: una clínica mexicana veía sus pesos con
 * una L delante.
 *
 * El gemelo del servidor es lib/monedas.js: si se toca uno, hay que tocar el
 * otro. tests/monedas.test.js compara los dos catálogos campo por campo.
 *
 * CÓMO SE USA
 *
 *     await SDMoneda.listo();          // una vez, antes de pintar importes
 *     SDMoneda.fmt(1200)               // "L. 1,200.00"
 *     SDMoneda.fmtCorto(1200)          // "L. 1,200"   (KPIs, gráficas)
 *     SDMoneda.parse('L. 1,200.00')    // 1200
 *     SDMoneda.prefijo()               // "L. "        (etiquetas de campos)
 *
 * `listo()` importa: la moneda vive en el perfil de la sesión, y una página que
 * pinte importes antes de tenerlo los pintaría en lempiras por defecto y luego
 * saltaría a la moneda real. Resuelve al instante si el perfil está en caché.
 */
window.SDMoneda = (function () {
  'use strict';

  // ── Catálogo (gemelo de lib/monedas.js) ──
  var MONEDAS = {
    HNL: { codigo: 'HNL', nombre: 'Lempira',         prefijo: 'L. ', locale: 'es-HN', decimales: 2 },
    USD: { codigo: 'USD', nombre: 'Dólar',           prefijo: '$',   locale: 'en-US', decimales: 2 },
    NIO: { codigo: 'NIO', nombre: 'Córdoba',         prefijo: 'C$',  locale: 'es-NI', decimales: 2 },
    MXN: { codigo: 'MXN', nombre: 'Peso mexicano',   prefijo: '$',   locale: 'es-MX', decimales: 2 },
    COP: { codigo: 'COP', nombre: 'Peso colombiano', prefijo: '$ ',  locale: 'es-CO', decimales: 0 },
    ARS: { codigo: 'ARS', nombre: 'Peso argentino',  prefijo: '$ ',  locale: 'es-AR', decimales: 2 },
  };

  var PAISES = [
    { codigo: 'HN', nombre: 'Honduras',    moneda: 'HNL', telefono: '+504' },
    { codigo: 'SV', nombre: 'El Salvador', moneda: 'USD', telefono: '+503' },
    { codigo: 'NI', nombre: 'Nicaragua',   moneda: 'NIO', telefono: '+505' },
    { codigo: 'MX', nombre: 'México',      moneda: 'MXN', telefono: '+52'  },
    { codigo: 'CO', nombre: 'Colombia',    moneda: 'COP', telefono: '+57'  },
    { codigo: 'AR', nombre: 'Argentina',   moneda: 'ARS', telefono: '+54'  },
  ];

  var PAIS_POR_DEFECTO = 'HN';
  var MONEDA_POR_DEFECTO = 'HNL';

  // Clave propia además del perfil cacheado: el perfil lo reescribe layout.js
  // entero, y así la moneda sobrevive aunque esa caché se limpie o cambie de
  // forma. Es metadata de presentación, no dato clínico.
  var CLAVE = 'sd_moneda';

  var actual = null;   // código resuelto, o null mientras no se sabe
  var promesa = null;  // la carga en curso, para no pedir el perfil dos veces

  function normalizarMoneda(v) {
    var c = String(v == null ? '' : v).trim().toUpperCase();
    return Object.prototype.hasOwnProperty.call(MONEDAS, c) ? c : '';
  }

  function normalizarPais(v) {
    var c = String(v == null ? '' : v).trim().toUpperCase();
    for (var i = 0; i < PAISES.length; i++) if (PAISES[i].codigo === c) return c;
    return '';
  }

  function monedaDePais(pais) {
    var c = normalizarPais(pais);
    for (var i = 0; i < PAISES.length; i++) if (PAISES[i].codigo === c) return PAISES[i].moneda;
    return MONEDA_POR_DEFECTO;
  }

  function paisPorCodigo(c) {
    var k = normalizarPais(c);
    for (var i = 0; i < PAISES.length; i++) if (PAISES[i].codigo === k) return PAISES[i];
    return null;
  }

  /** Ficha de una moneda; sin argumento, la de la clínica en sesión. */
  function ficha(cod) {
    return MONEDAS[normalizarMoneda(cod || codigo())] || MONEDAS[MONEDA_POR_DEFECTO];
  }

  /** El código vigente. Nunca devuelve vacío: sin sesión resuelta, lempiras. */
  function codigo() {
    return actual || leerCache() || MONEDA_POR_DEFECTO;
  }

  function leerCache() {
    try {
      var directo = normalizarMoneda(localStorage.getItem(CLAVE));
      if (directo) return directo;
      var perfil = JSON.parse(localStorage.getItem('sd_user_profile') || 'null');
      if (perfil) return normalizarMoneda(perfil.clinic_currency);
    } catch (_) {}
    return '';
  }

  /**
   * Fija la moneda vigente. La llama layout.js con el perfil fresco, y
   * Configuración cuando se corrige el país (que es lo que la decide).
   *
   * Si el código cambia, dispara `sd:moneda` en `document`: las páginas que ya
   * pintaron importes se enteran de que lo hicieron con la moneda equivocada.
   */
  function fijar(cod) {
    var c = normalizarMoneda(cod);
    if (!c) return codigo();
    // `actual === null` es la PRIMERA resolución de la pestaña, no un cambio:
    // no hay nada pintado con otra moneda que corregir. Distinguirlo importa
    // porque quien escucha `sd:moneda` recarga la página (ver layout.js), y sin
    // esta condición la primera carga sin caché se recargaría a sí misma en
    // bucle.
    var cambio = actual !== null && c !== actual;
    actual = c;
    try { localStorage.setItem(CLAVE, c); } catch (_) {}
    etiquetar();
    if (cambio) {
      try {
        document.dispatchEvent(new CustomEvent('sd:moneda', { detail: { codigo: c } }));
      } catch (_) {}
    }
    return c;
  }

  /**
   * Resuelve cuando se sabe en qué moneda pinta esta clínica.
   * Con el perfil en caché es inmediato; si no, pide /api/auth/me una vez.
   */
  function listo() {
    if (actual) return Promise.resolve(actual);
    if (promesa) return promesa;

    var cacheado = leerCache();
    if (cacheado) {
      actual = cacheado;
      // Aun así se refresca por detrás: si el administrador cambió la moneda
      // desde otra sesión, esta se entera sin tener que cerrar sesión.
      refrescar();
      return Promise.resolve(actual);
    }

    promesa = refrescar().then(function () {
      promesa = null;
      return codigo();
    });
    return promesa;
  }

  function refrescar() {
    return fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (me) { if (me && me.clinic_currency) fijar(me.clinic_currency); })
      .catch(function () { /* sin red se sigue con lo que haya en caché */ });
  }

  // ── Formato ────────────────────────────────────────────────────────────────

  function numero(n, decimales, loc) {
    var v = Number(n);
    if (!isFinite(v)) v = 0;
    try {
      return new Intl.NumberFormat(loc, {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales,
      }).format(v);
    } catch (_) {
      return v.toFixed(decimales).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
  }

  /** "L. 1,200.00" — el formato de cualquier importe en tabla o detalle. */
  function fmt(n, cod) {
    var m = ficha(cod || codigo());
    return m.prefijo + numero(n, m.decimales, m.locale);
  }

  /** "L. 1,200" — sin decimales, para KPIs grandes y etiquetas de gráfica. */
  function fmtCorto(n, cod) {
    var m = ficha(cod || codigo());
    return m.prefijo + numero(n, 0, m.locale);
  }

  /** Solo el prefijo, para etiquetas del tipo "Costo de la consulta (L.)". */
  function prefijo(cod) {
    return ficha(cod || codigo()).prefijo.trim();
  }

  function decimales(cod) {
    return ficha(cod || codigo()).decimales;
  }

  /**
   * Texto de un campo de importe → número.
   *
   * Tiene que aguantar lo que el formateador produce y lo que la gente teclea:
   * "L. 1,200.00", "$1.200.000", "1200", "1.200,50".
   *
   * LA REGLA, y por qué es esta:
   *   · Si aparecen los DOS separadores, el último es el decimal. ("1.200,50")
   *   · Si aparece uno solo y varias veces, son todos de miles. ("1.200.000")
   *   · Si aparece uno solo una vez, manda cuántos dígitos lleva detrás:
   *     exactamente tres es agrupación de miles ("1.200" = mil doscientos);
   *     cualquier otra cantidad es decimal ("36.80", "0.038023").
   *
   * La regla de los tres dígitos importa: sin ella, un importe colombiano
   * copiado de la tabla ("$1.200.000") se leería como 1,2 al volver a
   * guardarlo, y un "1234.567" se convertiría en mil doscientos treinta y
   * cuatro con cinco.
   */
  function parse(txt) {
    if (typeof txt === 'number') return isFinite(txt) ? txt : 0;
    var s = String(txt == null ? '' : txt).replace(/[^\d.,-]/g, '').trim();
    // El punto de "L." sobrevive al filtro y quedaría al principio.
    s = s.replace(/^[.,]+/, '');
    if (!s) return 0;
    var negativo = /-/.test(s);
    s = s.replace(/-/g, '');

    var puntos = (s.match(/\./g) || []).length;
    var comas = (s.match(/,/g) || []).length;
    var corte = -1;
    if (puntos && comas) {
      corte = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
    } else if (puntos === 1 || comas === 1) {
      var i = puntos ? s.indexOf('.') : s.indexOf(',');
      if (s.length - i - 1 !== 3) corte = i;
    }

    var entero = corte > -1 ? s.slice(0, corte) : s;
    var decimal = corte > -1 ? s.slice(corte + 1) : '';
    var n = Number(entero.replace(/[.,]/g, '') + (decimal ? '.' + decimal.replace(/[.,]/g, '') : ''));
    if (!isFinite(n)) return 0;
    return negativo ? -n : n;
  }

  /**
   * Pinta el símbolo en el HTML estático.
   *
   *   <span data-moneda="prefijo"></span>   → "L."
   *   <span data-moneda="codigo"></span>    → "HNL"
   *   <span data-moneda="nombre"></span>    → "Lempira"
   *   <div data-moneda="cero"></div>        → "L. 0.00"  (valor inicial de un KPI)
   *
   * Así las etiquetas de los formularios y los ceros de arranque no hay que
   * tocarlos a mano en cada página.
   */
  function etiquetar(raiz) {
    var m = ficha(codigo());
    var nodos = (raiz || document).querySelectorAll('[data-moneda]');
    for (var i = 0; i < nodos.length; i++) {
      var el = nodos[i];
      var que = el.getAttribute('data-moneda');
      if (que === 'prefijo') el.textContent = m.prefijo.trim();
      else if (que === 'codigo') el.textContent = m.codigo;
      else if (que === 'nombre') el.textContent = m.nombre;
      else if (que === 'cero') el.textContent = fmt(0);
    }
  }

  // Las etiquetas estáticas se pintan en cuanto el DOM está listo, con lo que
  // haya en caché. Si el perfil fresco trae otra moneda, `fijar` las repinta.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { etiquetar(); });
  } else {
    etiquetar();
  }

  return {
    MONEDAS: MONEDAS,
    PAISES: PAISES,
    PAIS_POR_DEFECTO: PAIS_POR_DEFECTO,
    MONEDA_POR_DEFECTO: MONEDA_POR_DEFECTO,
    codigo: codigo,
    ficha: ficha,
    fijar: fijar,
    listo: listo,
    fmt: fmt,
    fmtCorto: fmtCorto,
    prefijo: prefijo,
    decimales: decimales,
    parse: parse,
    normalizarPais: normalizarPais,
    normalizarMoneda: normalizarMoneda,
    monedaDePais: monedaDePais,
    paisPorCodigo: paisPorCodigo,
    etiquetar: etiquetar,
  };
})();
