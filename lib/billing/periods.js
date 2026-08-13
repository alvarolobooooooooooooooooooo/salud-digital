// ── Aritmética de periodos de facturación ──
// Aislado en su propio archivo porque es la parte más fácil de equivocar y la
// que más merece tests: de aquí sale la fecha del próximo cobro y el prorrateo
// al cambiar de plan.

const INTERVALOS = ['day', 'week', 'month', 'year'];

/**
 * Suma un intervalo a una fecha.
 *
 * Ojo con los meses: sumar 1 mes al 31 de enero en JS da el 3 de marzo
 * (desborda a febrero). Aquí se recorta al último día del mes destino, que es
 * lo que hace cualquier facturador serio: 31-ene + 1 mes = 28/29-feb.
 */
function addInterval(fecha, interval, count = 1) {
  if (!INTERVALOS.includes(interval)) {
    throw new Error('Intervalo de facturación inválido: ' + interval);
  }
  const n = Math.max(1, parseInt(count, 10) || 1);
  const d = new Date(fecha.getTime());

  if (interval === 'day') { d.setDate(d.getDate() + n); return d; }
  if (interval === 'week') { d.setDate(d.getDate() + 7 * n); return d; }

  const meses = interval === 'month' ? n : 12 * n;
  const diaOriginal = d.getDate();
  d.setDate(1);                       // evita el desbordamiento antes de mover el mes
  d.setMonth(d.getMonth() + meses);
  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(diaOriginal, ultimoDia));
  return d;
}

/** Periodo completo a partir de un inicio. */
function periodFrom(inicio, interval, count = 1) {
  const start = new Date(inicio.getTime());
  return { start, end: addInterval(start, interval, count) };
}

/**
 * Prorrateo al cambiar de plan a mitad de periodo.
 *
 * Devuelve el crédito no consumido del plan viejo y el coste del tramo que
 * queda del nuevo, ambos redondeados a 2 decimales. Un resultado negativo en
 * `amountDue` significa saldo a favor del cliente: NO se devuelve dinero
 * automáticamente, se aplica como crédito en el siguiente cobro.
 */
function prorate({ amountOld, amountNew, periodStart, periodEnd, changeAt = new Date() }) {
  const total = periodEnd.getTime() - periodStart.getTime();
  if (total <= 0) return { unusedCredit: 0, newCharge: round2(amountNew), amountDue: round2(amountNew), ratio: 0 };

  const restante = Math.max(0, Math.min(total, periodEnd.getTime() - changeAt.getTime()));
  const ratio = restante / total;

  const unusedCredit = round2(amountOld * ratio);
  const newCharge = round2(amountNew * ratio);
  return { unusedCredit, newCharge, amountDue: round2(newCharge - unusedCredit), ratio };
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/** ¿La fecha de cobro ya pasó? Con margen para no adelantarse por relojes. */
function isDue(nextBillingAt, ahora = new Date()) {
  if (!nextBillingAt) return false;
  return new Date(nextBillingAt).getTime() <= ahora.getTime();
}

module.exports = { INTERVALOS, addInterval, periodFrom, prorate, isDue, round2 };
