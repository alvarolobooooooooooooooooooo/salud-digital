// Tests del país de la clínica y del formato de su moneda.
//
// LO QUE FIJAN. La app nació solo para Honduras y el símbolo estaba escrito a
// mano en catorce sitios (`'L. ' + n.toFixed(2)`). Al abrirla a seis países hay
// dos formas de romperlo, y las dos son silenciosas:
//
//   1. Que el catálogo del servidor y el del navegador se separen. Añades un
//      país en lib/monedas.js, la pantalla lo ofrece… y el alta lo rechaza. O
//      peor: coinciden los códigos pero no los decimales, y el peso colombiano
//      se pinta con céntimos que esa moneda no tiene, con lo que cada importe
//      parece cien veces mayor de lo que es.
//   2. Que vuelva a colarse un símbolo escrito a mano en alguna pantalla de
//      dinero, y una clínica mexicana vea sus pesos con una L delante.
//
// NO HAY TASAS DE CAMBIO NI CONVERSIÓN, y es a propósito: ver la cabecera de
// lib/monedas.js. Hay un test aquí abajo que lo comprueba, para que no reaparezca
// una tabla de tasas inventadas sin que nadie lo decida.
//
//     npm test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const monedas = require('../lib/monedas');

const RAIZ = path.join(__dirname, '..');

// ── El gemelo del navegador ──────────────────────────────────────────────────
// public/monedas.js se evalúa en un sandbox con lo mínimo que toca al cargar
// (window, document, localStorage, fetch). Así se puede comparar catálogo con
// catálogo en vez de a ojo.
function cargarGemelo() {
  const codigo = fs.readFileSync(path.join(RAIZ, 'public', 'monedas.js'), 'utf8');
  const sandbox = {
    window: {},
    document: {
      readyState: 'complete',
      querySelectorAll: () => [],
      addEventListener: () => {},
      dispatchEvent: () => true,
    },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    fetch: () => Promise.resolve({ ok: false }),
    Promise,
    Intl,
    CustomEvent: function () {},
    console,
  };
  sandbox.window.document = sandbox.document;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(codigo, sandbox, { filename: 'public/monedas.js' });
  return sandbox.window.SDMoneda;
}

test('el catálogo del navegador es idéntico al del servidor', () => {
  const cliente = cargarGemelo();
  assert.ok(cliente, 'public/monedas.js no expuso window.SDMoneda');

  assert.deepStrictEqual(
    Object.keys(cliente.MONEDAS).sort(),
    Object.keys(monedas.MONEDAS).sort(),
    'las dos listas de monedas tienen que traer las mismas',
  );

  for (const codigo of Object.keys(monedas.MONEDAS)) {
    const a = monedas.MONEDAS[codigo];
    const b = cliente.MONEDAS[codigo];
    for (const campo of ['codigo', 'nombre', 'prefijo', 'locale', 'decimales']) {
      assert.strictEqual(
        b[campo], a[campo],
        `${codigo}.${campo} difiere entre lib/monedas.js y public/monedas.js`,
      );
    }
  }

  // Se comparan serializados: los objetos del sandbox vienen de otro realm y
  // deepStrictEqual los daría por distintos aunque tengan los mismos campos.
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(cliente.PAISES)), monedas.PAISES,
    'la lista de países del navegador y la del servidor tienen que ser la misma: ' +
    'si no, la pantalla ofrece un país que el alta rechaza',
  );
  assert.strictEqual(cliente.PAIS_POR_DEFECTO, monedas.PAIS_POR_DEFECTO);
  assert.strictEqual(cliente.MONEDA_POR_DEFECTO, monedas.MONEDA_POR_DEFECTO);
});

test('los seis países que se venden hoy están y traen su moneda', () => {
  const esperado = { HN: 'HNL', SV: 'USD', NI: 'NIO', MX: 'MXN', CO: 'COP', AR: 'ARS' };
  assert.strictEqual(monedas.PAISES.length, Object.keys(esperado).length);
  for (const [pais, moneda] of Object.entries(esperado)) {
    assert.strictEqual(monedas.monedaDePais(pais), moneda, `${pais} debería cobrar en ${moneda}`);
    assert.ok(monedas.MONEDAS[moneda], `falta la ficha de la moneda ${moneda}`);
  }
  // El Salvador es el caso que demuestra que la moneda la manda el país y no una
  // preferencia: su moneda oficial es el dólar, no una propia.
  assert.strictEqual(monedas.monedaDePais('SV'), 'USD');
});

test('un país que no está en la lista no se cuela ni se adivina', () => {
  // Ojo al elegir los ejemplos: 'AR' estuvo aquí hasta que Argentina entró en la
  // lista, y el test siguió pasando en verde por un día antes de caerse.
  for (const malo of ['', null, undefined, 'BR', 'US', 'Honduras', 'XX']) {
    assert.strictEqual(
      monedas.normalizarPais(malo), '',
      `${JSON.stringify(malo)} no debería pasar por país válido`,
    );
  }
  // Espacios y minúsculas sí se toleran: es lo que llega de un formulario.
  assert.strictEqual(monedas.normalizarPais(' hn '), 'HN');
  assert.strictEqual(monedas.normalizarPais('mx'), 'MX');
});

test('el peso colombiano no tiene céntimos', () => {
  // No es un detalle estético: con dos decimales, cada importe colombiano
  // parece cien veces mayor de lo que es.
  assert.strictEqual(monedas.moneda('COP').decimales, 0);
  assert.strictEqual(monedas.formatear(1200000, 'COP'), '$ 1.200.000');
});

test('formatear usa el prefijo y la puntuación de cada moneda', () => {
  assert.strictEqual(monedas.formatear(1200, 'HNL'), 'L. 1,200.00');
  assert.strictEqual(monedas.formatear(1200, 'USD'), '$1,200.00');
  assert.strictEqual(monedas.formatear(1200, 'NIO'), 'C$1,200.00');
  // Colombia y Argentina llevan espacio tras el símbolo (es lo que dice CLDR
  // para su locale), y ese espacio es además el único punto por el que un
  // importe largo puede partirse en dos líneas dentro de una tarjeta.
  assert.strictEqual(monedas.formatear(1200000, 'COP'), '$ 1.200.000');
  // Argentina agrupa como Colombia pero SÍ lleva centavos: la coma decimal es
  // lo que separa "un millón doscientos mil" de "mil doscientos con cincuenta".
  assert.strictEqual(monedas.formatear(1200000, 'ARS'), '$ 1.200.000,00');
  assert.strictEqual(monedas.formatear(1200.5, 'ARS'), '$ 1.200,50');
  // Una moneda desconocida no puede dejar el importe sin símbolo, ni un valor
  // basura puede pintar "NaN" en una pantalla de cobros.
  assert.strictEqual(monedas.formatear(1200, 'XXX'), 'L. 1,200.00');
  assert.strictEqual(monedas.formatear('no soy un número', 'HNL'), 'L. 0.00');
});

test('el navegador sabe releer lo que él mismo formatea', () => {
  // El campo de costo de una consulta se rellena con el texto ya formateado, y
  // al guardar hay que volver a leerlo. Con el `replace(/[^\d.]/g,'')` de antes,
  // un importe colombiano ("$1.200.000") se guardaba como 1,2.
  const cliente = cargarGemelo();
  assert.strictEqual(cliente.parse('L. 1,200.00'), 1200);
  assert.strictEqual(cliente.parse('$ 1.200.000'), 1200000);
  assert.strictEqual(cliente.parse('$ 255.250,50'), 255250.5, 'un importe argentino');
  assert.strictEqual(cliente.parse('C$36.80'), 36.8);
  assert.strictEqual(cliente.parse('1200'), 1200);
  assert.strictEqual(cliente.parse('1.200,50'), 1200.5);
  assert.strictEqual(cliente.parse('1.200'), 1200, 'tres dígitos detrás son miles, no décimas');
  assert.strictEqual(cliente.parse(''), 0);
  assert.strictEqual(cliente.parse(null), 0);
  assert.strictEqual(cliente.parse(1200), 1200);

  // Ida y vuelta por cada moneda: lo que se pinta se puede volver a leer.
  for (const codigo of Object.keys(monedas.MONEDAS)) {
    const original = monedas.moneda(codigo).decimales === 0 ? 1200000 : 1234.56;
    assert.strictEqual(
      cliente.parse(monedas.formatear(original, codigo)), original,
      `no se puede releer un importe formateado en ${codigo}`,
    );
  }
});

// ── Lo que NO existe, y no por descuido ──────────────────────────────────────

test('no hay tasas de cambio en ninguna parte del catálogo', () => {
  // Se quitaron a propósito (ver la cabecera de lib/monedas.js): convertir el
  // histórico de cobros de una clínica real con una tasa que la plataforma se
  // inventa multiplica su contabilidad por un número que nadie verificó. Este
  // test está para que no vuelvan sin que alguien lo decida.
  const cliente = cargarGemelo();
  for (const catalogo of [monedas.MONEDAS, cliente.MONEDAS]) {
    for (const [codigo, ficha] of Object.entries(catalogo)) {
      assert.ok(
        !('porUSD' in ficha),
        `${codigo} trae una tasa de cambio: convertir importes exige una tasa verificada, ` +
        'y una tabla escrita a ojo no lo es',
      );
    }
  }
  assert.strictEqual(typeof monedas.convertir, 'undefined');
  assert.strictEqual(typeof monedas.tasaDeReferencia, 'undefined');
  assert.strictEqual(typeof cliente.tasaDeReferencia, 'undefined');

  assert.ok(
    !fs.existsSync(path.join(RAIZ, 'lib', 'conversion-monedas.js')),
    'volvió a aparecer el motor de conversión de importes',
  );
});

// ── Las pantallas ────────────────────────────────────────────────────────────

test('el alta y Configuración pintan los países desde el catálogo, no a mano', () => {
  // Es la comprobación que evita el fallo clásico: una lista escrita en el HTML
  // que ofrece un país que el servidor rechaza.
  for (const pagina of ['registro.html', 'configuracion.html']) {
    const html = fs.readFileSync(path.join(RAIZ, 'public', pagina), 'utf8');
    assert.match(html, /src="\/monedas\.js"/, `${pagina} no carga el catálogo`);
    assert.match(html, /SDMoneda\.PAISES/, `${pagina} debería pintar los países desde SDMoneda.PAISES`);
  }
});

test('ninguna pantalla de dinero se quedó con el símbolo escrito a mano', () => {
  // El fallo original: `'L. ' + n.toFixed(2)` repartido por catorce archivos.
  // Cada uno de estos es una pantalla donde una clínica mexicana vería pesos
  // con una L delante.
  const pantallas = [
    'finanzas.html', 'dashboard.html', 'patients.html', 'patient.html',
    'recepcion-pagos.html', 'recepcion-inicio.html', 'crecimiento.html',
    'consultation.html', 'consultation-general.html', 'consultation-podiatry.html',
    'consultation-orthodontics.html', 'consultation-periodontology.html',
    'consultation-nutrition.html', 'consultation-dermatology.html',
    'view-consultation.html', 'view-consultation-podiatry.html',
  ];
  for (const pagina of pantallas) {
    const html = fs.readFileSync(path.join(RAIZ, 'public', pagina), 'utf8');
    assert.match(html, /src="\/monedas\.js"/, `${pagina} pinta dinero pero no carga public/monedas.js`);

    // Se miran solo las líneas de código: los comentarios de este cambio hablan
    // precisamente de "L. " y no son el problema.
    const sospechosas = html.split('\n').filter((linea) => {
      const limpia = linea.trim();
      if (limpia.startsWith('//') || limpia.startsWith('*') || limpia.startsWith('<!--')) return false;
      if (limpia.includes('data-moneda')) return false; // el cero inicial lo repinta SDMoneda
      return /['"`]L\.[\s ]/.test(linea);
    });
    assert.deepStrictEqual(
      sospechosas, [],
      `${pagina} todavía arma un importe con el símbolo del lempira escrito a mano`,
    );
  }
});
