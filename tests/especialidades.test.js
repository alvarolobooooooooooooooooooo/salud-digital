// Tests del nombre canónico de la especialidad.
//
// EL FALLO QUE FIJAN. La especialidad se guarda como texto libre en
// users.specialty y se compara con `===` en cada página de consulta y en
// citas.html. El <select> de Configuración ofrecía slugs sin tilde
// («podologia») mientras el resto de la app comparaba contra «Podología»: al
// abrir Configuración el select no reconocía el valor guardado y salía en
// blanco, el doctor lo volvía a elegir, se guardaba el slug, y a partir de ahí
// TODAS sus consultas rebotaban a la agenda sin decir por qué.
//
//     npm test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { normalizar, CANONICAS } = require('../lib/especialidades');

test('los slugs y las variantes sin tilde llegan al nombre canónico', () => {
  for (const v of ['podologia', 'Podologia', 'PODOLOGIA', '  podología  ', 'Podología']) {
    assert.strictEqual(normalizar(v), 'Podología', `no normalizó ${JSON.stringify(v)}`);
  }
  assert.strictEqual(normalizar('general'), 'Medicina General');
  assert.strictEqual(normalizar('odontologia'), 'Odontología');
  assert.strictEqual(normalizar('nutricion'), 'Nutrición');
  assert.strictEqual(normalizar('odontopediatria'), 'Odontopediatría');
});

test('normalizar no puede convertirse en perder datos', () => {
  assert.strictEqual(normalizar(''), '', 'sin especialidad es un estado válido');
  assert.strictEqual(normalizar(null), '');
  assert.strictEqual(normalizar(undefined), '');
  // Un valor que no reconocemos se devuelve tal cual, no se borra ni se inventa.
  assert.strictEqual(normalizar('Pediatría'), 'Pediatría');
  assert.strictEqual(normalizar('Traumatología deportiva'), 'Traumatología deportiva');
});

test('cada opción del select de Configuración guarda un nombre canónico', () => {
  // Esta es la comprobación que habría evitado el fallo: el `value` de cada
  // opción es lo que se guarda, y tiene que ser exactamente lo que las páginas
  // de consulta comparan.
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'configuracion.html'), 'utf8');
  const bloque = html.match(/<select id="fldSpecialty">([\s\S]*?)<\/select>/);
  assert.ok(bloque, 'ya no está el select de especialidad: revisar este test');
  const valores = [...bloque[1].matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
  assert.ok(valores.length >= 5, 'el select se quedó sin opciones');
  for (const v of valores) {
    assert.ok(
      CANONICAS.includes(v),
      `la opción "${v}" no es un nombre canónico; se guardaría un valor que ninguna página de consulta reconoce`,
    );
  }
  assert.ok(valores.includes('Podología'), 'falta Podología, que es la única especialidad que se vende hoy');
});

test('ninguna página de consulta deja fuera a un doctor sin especialidad', () => {
  // Sin la guardia `me.specialty &&`, una especialidad vacía —o cualquier valor
  // que no case— rebota al doctor a la agenda al instante y sin mensaje, que es
  // exactamente como se manifestó el fallo.
  const dir = path.join(__dirname, '..', 'public');
  const paginas = fs.readdirSync(dir).filter((f) => /^consultation.*\.html$/.test(f));
  assert.ok(paginas.length >= 7, 'esperaba encontrar las páginas de consulta');
  for (const f of paginas) {
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    const guardias = [...html.matchAll(/role\s*===\s*["']doctor["']\s*&&([^)]*?)me\.specialty\s*!==/g)];
    for (const g of guardias) {
      assert.match(
        g[1], /me\.specialty\s*&&/,
        `${f}: hay una guardia de especialidad sin comprobar antes que no esté vacía`,
      );
    }
  }
});
