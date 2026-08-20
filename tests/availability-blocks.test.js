// El horario de atención que el doctor guarda en Citas Online tiene que valer
// también por dentro (agenda, recepción, asistente), no solo en el enlace
// público: si recorta sus horas, dejan de poder agendarse citas fuera de ellas.
//
// Sin BD: `db` se sustituye por un doble en require.cache antes de cargar el lib.

const test = require('node:test');
const assert = require('node:assert');

const bd = { disponibilidad: [], excepciones: [] };

function ejecutar(text, params) {
  const sql = String(text).replace(/\s+/g, ' ').trim();

  if (/^SELECT closed, blocked_times FROM doctor_day_overrides/i.test(sql)) {
    const fila = bd.excepciones.find(e => e.doctor_id === params[0] && e.override_date === params[1]);
    return { rows: fila ? [fila] : [], rowCount: fila ? 1 : 0 };
  }
  if (/^SELECT day_of_week, start_time, end_time, slot_duration FROM doctor_availability/i.test(sql)) {
    const filas = bd.disponibilidad.filter(d => d.doctor_id === params[0]);
    return { rows: filas, rowCount: filas.length };
  }
  throw new Error('SQL no previsto en el doble: ' + sql);
}

const resuelta = require.resolve('../db');
require.cache[resuelta] = {
  id: resuelta, filename: resuelta, loaded: true,
  exports: { query: async (text, params) => ejecutar(text, params) },
};

const { blockedReason } = require('../lib/availability-blocks');

// Un lunes y un domingo concretos, para no depender de la fecha de hoy.
const LUNES = '2026-08-17';
const DOMINGO = '2026-08-16';

function horario(filas) {
  bd.disponibilidad.length = 0;
  bd.excepciones.length = 0;
  filas.forEach(f => bd.disponibilidad.push(Object.assign({ doctor_id: 7, slot_duration: 30 }, f)));
}

test('sin horario guardado no se restringe nada (el doctor nunca lo configuró)', async () => {
  horario([]);
  assert.strictEqual(await blockedReason(7, `${LUNES}T23:00`), null);
});

test('una hora dentro del horario semanal se agenda', async () => {
  horario([{ day_of_week: 1, start_time: '08:00', end_time: '17:00' }]);
  assert.strictEqual(await blockedReason(7, `${LUNES}T09:30`), null);
});

test('una hora fuera de las franjas del día queda fuera de horario', async () => {
  horario([{ day_of_week: 1, start_time: '08:00', end_time: '17:00' }]);
  assert.strictEqual(await blockedReason(7, `${LUNES}T19:00`), 'offhours');
  assert.strictEqual(await blockedReason(7, `${LUNES}T07:30`), 'offhours');
  // El fin de la franja es exclusivo: a las 17:00 ya no atiende.
  assert.strictEqual(await blockedReason(7, `${LUNES}T17:00`), 'offhours');
});

test('un día que el horario semanal no incluye se bloquea entero', async () => {
  horario([{ day_of_week: 1, start_time: '08:00', end_time: '17:00' }]);
  assert.strictEqual(await blockedReason(7, `${DOMINGO}T10:00`), 'dayoff');
});

test('con dos franjas el hueco del almuerzo también queda fuera', async () => {
  horario([
    { day_of_week: 1, start_time: '08:00', end_time: '12:00' },
    { day_of_week: 1, start_time: '14:00', end_time: '18:00' },
  ]);
  assert.strictEqual(await blockedReason(7, `${LUNES}T11:30`), null);
  assert.strictEqual(await blockedReason(7, `${LUNES}T12:30`), 'offhours');
  assert.strictEqual(await blockedReason(7, `${LUNES}T15:00`), null);
});

test('la excepción del día manda sobre el horario semanal', async () => {
  horario([{ day_of_week: 1, start_time: '08:00', end_time: '17:00' }]);
  bd.excepciones.push({ doctor_id: 7, override_date: LUNES, closed: true, blocked_times: [] });
  assert.strictEqual(await blockedReason(7, `${LUNES}T09:00`), 'closed');
});

test('una hora quitada a mano sigue saliendo como bloqueada, no como fuera de horario', async () => {
  horario([{ day_of_week: 1, start_time: '08:00', end_time: '17:00' }]);
  bd.excepciones.push({ doctor_id: 7, override_date: LUNES, closed: false, blocked_times: ['09:00'] });
  assert.strictEqual(await blockedReason(7, `${LUNES}T09:15`), 'blocked');
  assert.strictEqual(await blockedReason(7, `${LUNES}T10:00`), null);
});

test('las horas guardadas con segundos ("08:00:00") se entienden igual', async () => {
  horario([{ day_of_week: 1, start_time: '08:00:00', end_time: '17:00:00' }]);
  assert.strictEqual(await blockedReason(7, `${LUNES}T08:00`), null);
});
