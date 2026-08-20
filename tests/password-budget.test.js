// Tests del presupuesto global de hashing (lib/password-budget.js).
//
// El motivo, medido: bcryptjs coste 10 tarda ~114 ms POR OPERACIÓN y NO cede el
// hilo mientras trabaja (ocho en paralelo dejaron un temporizador de 10 ms
// corriendo 2 veces en lugar de 91). Nueve intentos de login por segundo bastan
// para que la plataforma deje de responder a todo lo demás.
//
// Los límites por IP no cubren esto: acotan a cada atacante, no a la suma. Con
// ~135 IPs se llega a nueve por segundo sin superar ningún tope individual.
//
//     npm test

const test = require('node:test');
const assert = require('node:assert');

process.env.PASSWORD_BUDGET_BURST = '20';
process.env.PASSWORD_BUDGET_PER_SECOND = '2';

const presupuesto = require('../lib/password-budget');

test('la ráfaga inicial se concede entera', () => {
  presupuesto._reiniciar();
  // La clínica llegando a las ocho de la mañana no debe notar nada.
  const reserva = presupuesto.RESERVA_AUTENTICADOS;
  for (let i = 0; i < presupuesto.CAPACIDAD - reserva; i++) {
    assert.ok(presupuesto.intentarGastar({ autenticado: false }), 'la nº' + i + ' debería pasar');
  }
});

test('agotado el presupuesto se rechaza, y sin gastar CPU', () => {
  presupuesto._reiniciar();
  while (presupuesto.intentarGastar({ autenticado: false })) { /* vaciar */ }

  const t0 = process.hrtime.bigint();
  const concedido = presupuesto.intentarGastar({ autenticado: false });
  const microsegundos = Number(process.hrtime.bigint() - t0) / 1000;

  assert.strictEqual(concedido, false);
  // El sentido del cubo es que negarse sea gratis: si rechazar costara lo que
  // cuesta un bcrypt, no habría defensa ninguna.
  assert.ok(microsegundos < 1000, `rechazar tardó ${microsegundos} µs, debería ser inmediato`);
});

test('una avalancha anónima no deja sin presupuesto a quien ya está dentro', () => {
  // El doctor con un paciente delante tiene que poder cambiar su contraseña
  // aunque estén inundando el login desde fuera.
  presupuesto._reiniciar();
  while (presupuesto.intentarGastar({ autenticado: false })) { /* vaciar la parte pública */ }

  assert.strictEqual(presupuesto.intentarGastar({ autenticado: false }), false);
  assert.ok(
    presupuesto.intentarGastar({ autenticado: true }),
    'la reserva de autenticados debe seguir disponible',
  );
});

test('el cubo se recarga con el tiempo', async () => {
  presupuesto._reiniciar();
  while (presupuesto.intentarGastar({ autenticado: true })) { /* vaciar del todo */ }
  assert.strictEqual(presupuesto.intentarGastar({ autenticado: true }), false);

  await new Promise((r) => setTimeout(r, 1100)); // ~2 fichas a 2/s
  assert.ok(presupuesto.intentarGastar({ autenticado: true }), 'debería haber recargado');
});

test('el ritmo sostenido queda muy por debajo del punto de saturación', () => {
  // Medido: ~8,8 operaciones por segundo saturan un núcleo. El ritmo permitido
  // tiene que dejar margen de sobra por debajo de esa cifra.
  const SATURACION_OPS_POR_SEGUNDO = 8.8;
  assert.ok(
    presupuesto.POR_SEGUNDO < SATURACION_OPS_POR_SEGUNDO / 2,
    `${presupuesto.POR_SEGUNDO}/s está demasiado cerca de la saturación`,
  );
});
