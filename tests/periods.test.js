// Tests unitarios de la aritmética de periodos. Sin BD ni red.
const test = require('node:test');
const assert = require('node:assert');
const { addInterval, periodFrom, prorate, isDue, round2 } = require('../lib/billing/periods');

const d = (s) => new Date(s + 'T12:00:00Z');

test('addInterval suma días, semanas, meses y años', () => {
  assert.equal(addInterval(d('2026-01-10'), 'day', 5).getUTCDate(), 15);
  assert.equal(addInterval(d('2026-01-10'), 'week', 2).getUTCDate(), 24);
  assert.equal(addInterval(d('2026-01-10'), 'month', 1).getUTCMonth(), 1); // febrero
  assert.equal(addInterval(d('2026-01-10'), 'year', 1).getUTCFullYear(), 2027);
});

// El bug clásico: sumar un mes al 31 en JS desborda al mes siguiente.
test('addInterval recorta al último día del mes en vez de desbordar', () => {
  const r = addInterval(d('2026-01-31'), 'month', 1);
  assert.equal(r.getUTCMonth(), 1, 'debe caer en febrero, no en marzo');
  assert.equal(r.getUTCDate(), 28, '2026 no es bisiesto');

  const bisiesto = addInterval(d('2028-01-31'), 'month', 1);
  assert.equal(bisiesto.getUTCDate(), 29, '2028 sí es bisiesto');

  // Y no se "arrastra": 31-ene + 1 mes = 28-feb, pero 31-mar + 1 mes = 30-abr.
  assert.equal(addInterval(d('2026-03-31'), 'month', 1).getUTCDate(), 30);
});

test('addInterval rechaza intervalos desconocidos', () => {
  assert.throws(() => addInterval(new Date(), 'fortnight', 1), /Intervalo/);
});

test('periodFrom devuelve inicio y fin coherentes', () => {
  const p = periodFrom(d('2026-05-15'), 'month', 1);
  assert.equal(p.start.getUTCDate(), 15);
  assert.equal(p.end.getUTCMonth(), 5); // junio
  assert.ok(p.end > p.start);
});

test('prorate reparte por el tiempo restante del periodo', () => {
  // Justo a mitad de un periodo de 10 días.
  const r = prorate({
    amountOld: 10,
    amountNew: 30,
    periodStart: d('2026-01-01'),
    periodEnd: d('2026-01-11'),
    changeAt: d('2026-01-06'),
  });
  assert.equal(round2(r.ratio), 0.5);
  assert.equal(r.unusedCredit, 5);
  assert.equal(r.newCharge, 15);
  assert.equal(r.amountDue, 10);
});

test('prorate a favor del cliente da un importe negativo (crédito)', () => {
  const r = prorate({
    amountOld: 30, amountNew: 10,
    periodStart: d('2026-01-01'), periodEnd: d('2026-01-11'), changeAt: d('2026-01-06'),
  });
  assert.ok(r.amountDue < 0, 'bajar de plan a mitad de periodo genera crédito');
});

test('prorate no explota con periodos degenerados', () => {
  const r = prorate({
    amountOld: 10, amountNew: 20,
    periodStart: d('2026-01-01'), periodEnd: d('2026-01-01'),
  });
  assert.equal(r.amountDue, 20);
});

test('isDue compara contra la hora dada', () => {
  assert.equal(isDue(d('2026-01-01'), d('2026-01-02')), true);
  assert.equal(isDue(d('2026-01-03'), d('2026-01-02')), false);
  assert.equal(isDue(null), false);
});
