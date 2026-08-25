// Tests de la migración de expedientes.
//
// Dos mitades, y la segunda es la que de verdad hacía falta:
//
//   1. `lib/migracion/campos.js` — la lectura de fechas, teléfonos y sexos, y el
//      mapeo automático de cabeceras. Es lógica pura y aquí se prueba a secas.
//
//   2. `routes/migracion.js` con un DOBLE de la base. Además de comprobar el
//      resultado (cuántos se crean, cuáles se saltan, cuándo se crea consulta),
//      el doble verifica algo que ningún test de resultado ve: que cada consulta
//      lleve exactamente tantos parámetros como marcadores $n usa. Ese desajuste
//      no lo detecta nadie hasta que Postgres lo rechaza en producción, y aquí
//      hay INSERT multi-fila con quince parámetros donde es fácil colarse.
//
//     npm test

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-pruebas-suficientemente-largo-123456';

const campos = require('../lib/migracion/campos');

// ── 1. Lectura de valores ───────────────────────────────────────────────────

test('las fechas se leen en los cuatro formatos que llegan de verdad', () => {
  const f = campos.normalizarFecha;
  assert.strictEqual(f('2019-04-03'), '2019-04-03', 'ISO');
  assert.strictEqual(f('03/04/2019', 'dmy'), '2019-04-03', 'día primero');
  assert.strictEqual(f('03/04/2019', 'mdy'), '2019-03-04', 'mes primero');
  assert.strictEqual(f('43558'), '2019-04-03', 'serial de Excel');
  assert.strictEqual(f('3 de abril de 2019'), '2019-04-03', 'texto en español');
  assert.strictEqual(f('5-abr-88'), '1988-04-05', 'mes abreviado y año de dos cifras');
  assert.strictEqual(f('2019-04-03T10:30:00'), '2019-04-03', 'ISO con hora');
});

test('una fecha que no existe no se inventa', () => {
  assert.strictEqual(campos.normalizarFecha('31/02/2019'), null, '31 de febrero');
  assert.strictEqual(campos.normalizarFecha('13/13/2024'), null, 'mes 13');
  assert.strictEqual(campos.normalizarFecha('mañana'), null, 'texto libre');
  assert.strictEqual(campos.normalizarFecha(''), null, 'vacío');
  // Un año suelto en una columna de fechas no es un serial de Excel.
  assert.strictEqual(campos.normalizarFecha('1990'), null);
});

test('en modo mes/día, un valor imposible se lee como día/mes en vez de perderse', () => {
  // 13/05: no hay mes 13, así que la única lectura válida es día 13 de mayo.
  assert.strictEqual(campos.normalizarFecha('13/05/2019', 'mdy'), '2019-05-13');
});

test('los teléfonos conservan el + y pierden todo lo demás', () => {
  assert.strictEqual(campos.normalizarTelefono('(504) 9988-7766'), '50499887766');
  assert.strictEqual(campos.normalizarTelefono('+504 9988 7766'), '+50499887766');
  assert.strictEqual(campos.normalizarTelefono(''), '');
  assert.strictEqual(campos.normalizarTelefono('sin teléfono'), '');
});

test('el sexo se reconoce escrito de cualquier forma, y lo desconocido no se adivina', () => {
  assert.strictEqual(campos.normalizarSexo('M'), 'Masculino');
  assert.strictEqual(campos.normalizarSexo('femenino'), 'Femenino');
  assert.strictEqual(campos.normalizarSexo('MUJER'), 'Femenino');
  assert.strictEqual(campos.normalizarSexo(''), '');
  assert.strictEqual(campos.normalizarSexo('n/d'), null, 'desconocido → null, no una suposición');
});

test('los montos se leen con los dos usos de coma y punto', () => {
  assert.strictEqual(campos.normalizarMonto('L 1,250.00'), 1250);
  assert.strictEqual(campos.normalizarMonto('1.250,50'), 1250.5);
  assert.strictEqual(campos.normalizarMonto('$300'), 300);
  assert.strictEqual(campos.normalizarMonto(''), 0);
});

test('la identidad se compara sin guiones ni espacios', () => {
  assert.strictEqual(
    campos.claveIdentidad('0801-1990-01234'),
    campos.claveIdentidad('0801 1990 01234'),
  );
  assert.strictEqual(campos.claveIdentidad('0801-1990-01234'), '0801199001234');
});

// ── Mapeo automático ────────────────────────────────────────────────────────

test('el mapeo automático reconoce las cabeceras reales de una exportación', () => {
  const cabeceras = ['Nombres y Apellidos', 'Cédula', 'F. Nac.', 'Sexo', 'Celular', 'Diagnóstico'];
  const m = campos.sugerirMapeo(cabeceras).map((x) => x.campo);
  assert.deepStrictEqual(m, ['name', 'identity_number', 'birth_date', 'gender', 'phone', 'diagnosis']);
});

test('una cabecera compuesta va al campo que la ABRE, no al que aparece a mitad', () => {
  // "Alergias del paciente" contiene 'paciente', que es alias de Nombre. Sin la
  // regla del prefijo, la columna de alergias acababa siendo el nombre.
  const m = campos.sugerirMapeo(['Alergias del paciente', 'Medicamentos que toma']).map((x) => x.campo);
  assert.deepStrictEqual(m, ['allergies', 'medications']);
});

test('las abreviaturas de una hoja hecha a mano también se reconocen', () => {
  // "Cel" no lo cogía nadie: la segunda pasada descarta los alias de menos de
  // cinco letras, así que tiene que estar en la tabla de coincidencia exacta o
  // el archivo entero se importa sin teléfonos.
  const cabeceras = ['Paciente', 'No. Identidad', 'Cel', 'Fecha nacimiento', 'Sexo', 'Alergias', 'Observaciones'];
  const m = campos.sugerirMapeo(cabeceras).map((x) => x.campo);
  assert.deepStrictEqual(m, ['name', 'identity_number', 'phone', 'birth_date', 'gender', 'allergies', 'observations']);
});

test('las columnas de adorno no se mapean a nada', () => {
  const m = campos.sugerirMapeo(['Estado', 'Sucursal', 'Aseguradora', 'Saldo']).map((x) => x.campo);
  assert.deepStrictEqual(m, [null, null, null, null]);
});

test('un campo no se asigna dos veces salvo que admita varias columnas', () => {
  const m = campos.sugerirMapeo(['Nombre', 'Apellidos', 'Teléfono', 'Celular']).map((x) => x.campo);
  assert.strictEqual(m[0], 'name');
  assert.strictEqual(m[1], 'name', 'nombre y apellidos se suman en el mismo campo');
  assert.strictEqual(m[2], 'phone');
  assert.strictEqual(m[3], null, 'el teléfono ya estaba cubierto');
});

// ── Validación de fila ──────────────────────────────────────────────────────

test('sin nombre la fila es un error, no un aviso', () => {
  const r = campos.validarFila({ identity_number: '0801-1990-01234' });
  assert.strictEqual(r.errores.length, 1);
  assert.match(r.errores[0].mensaje, /nombre/i);
});

test('sin identidad la fila entra con aviso y expediente provisional', () => {
  const r = campos.validarFila({ name: 'Ana López' });
  assert.strictEqual(r.errores.length, 0);
  assert.strictEqual(r.valores.identity_number, '');
  assert.match(r.avisos[0].mensaje, /provisional/i);
});

test('sin identidad y sin permiso para generarla, la fila no entra', () => {
  const r = campos.validarFila({ name: 'Ana López' }, { generarIdentidad: false });
  assert.strictEqual(r.errores.length, 1);
});

test('la edad se calcula de la fecha de nacimiento y gana a la declarada', () => {
  const nacimiento = `${new Date().getFullYear() - 30}-01-01`;
  const r = campos.validarFila({ name: 'Ana', identity_number: '1', birth_date: nacimiento, age: '99' });
  assert.strictEqual(r.valores.age, 30);
});

test('solo se crea consulta cuando hay algo clínico que guardar', () => {
  const sin = campos.validarFila({ name: 'Ana', identity_number: '1', phone: '99887766' });
  assert.strictEqual(sin.valores.historia, null);

  const con = campos.validarFila({ name: 'Ana', identity_number: '1', diagnosis: 'Onicomicosis' });
  assert.ok(con.valores.historia);
  assert.strictEqual(con.valores.historia.diagnosis, 'Onicomicosis');
});

test('los NOMBRES EN MAYÚSCULAS solo se arreglan si se pide', () => {
  const crudo = { name: 'MARIA ELENA LOPEZ', identity_number: '1' };
  assert.strictEqual(campos.validarFila(crudo).valores.name, 'MARIA ELENA LOPEZ');
  assert.strictEqual(
    campos.validarFila(crudo, { corregirMayusculas: true }).valores.name,
    'Maria Elena Lopez',
  );
});

test('un teléfono en notación científica se recupera pero se avisa', () => {
  const r = campos.validarFila({ name: 'Ana', identity_number: '1', phone: '5.04999e+10' });
  assert.ok(r.valores.phone.length > 5);
  assert.ok(r.avisos.some((a) => /científica/i.test(a.mensaje)));
});

// ── 2. El router, con la base doblada ───────────────────────────────────────

// Todo lo que la base recibe, para poder revisarlo después.
const consultasVistas = [];

// Estado mínimo en memoria. No pretende ser Postgres: solo devolver a cada
// consulta del router una forma de resultado plausible y guardar lo escrito.
const bd = {
  lotes: new Map(),
  pacientes: [],
  criticos: [],
  consultas: [],
  proximoId: 1000,
};

function reiniciarBd() {
  bd.lotes.clear();
  bd.pacientes.length = 0;
  bd.criticos.length = 0;
  bd.consultas.length = 0;
  bd.proximoId = 1000;
  consultasVistas.length = 0;
}

/**
 * El control que justifica todo el doble: ninguna consulta puede usar un $n que
 * no exista en su lista de parámetros, ni traer parámetros que nadie usa.
 */
function comprobarParametros(sql, params) {
  const usados = [...String(sql).matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
  const maximo = usados.length ? Math.max(...usados) : 0;
  const n = Array.isArray(params) ? params.length : 0;
  const resumen = String(sql).replace(/\s+/g, ' ').trim().slice(0, 80);
  assert.strictEqual(maximo, n, `parámetros desalineados en «${resumen}…»: usa hasta $${maximo} y recibe ${n}`);
  for (let i = 1; i <= maximo; i++) {
    assert.ok(usados.includes(i), `«${resumen}…» se salta $${i}`);
  }
}

function ejecutar(text, params) {
  comprobarParametros(text, params);
  const sql = String(text).replace(/\s+/g, ' ').trim();
  consultasVistas.push({ sql, params });

  if (/^SELECT id, name, specialty FROM users/i.test(sql)) {
    return { rows: [{ id: 7, name: 'Dra. Fabiola', specialty: 'Podología' }], rowCount: 1 };
  }
  if (/^SELECT id FROM users/i.test(sql)) {
    return params[0] === 7 ? { rows: [{ id: 7 }], rowCount: 1 } : { rows: [], rowCount: 0 };
  }
  if (/^SELECT specialty FROM users/i.test(sql)) {
    return { rows: [{ specialty: 'Podología' }], rowCount: 1 };
  }

  if (/^INSERT INTO migration_batches/i.test(sql)) {
    const id = bd.lotes.size + 1;
    bd.lotes.set(id, {
      id, clinic_id: params[0], created_by: params[1], doctor_id: params[2], source: params[3],
      origin_label: params[4], file_name: params[5], total_rows: params[6], mapping: params[7],
      status: 'en_curso', imported: 0, updated: 0, skipped: 0, failed: 0, consultations: 0,
      created_at: new Date(),
    });
    return { rows: [{ id, created_at: new Date() }], rowCount: 1 };
  }
  if (/^SELECT \* FROM migration_batches/i.test(sql)) {
    const l = bd.lotes.get(params[0]);
    const mio = l && l.clinic_id === params[1];
    return { rows: mio ? [{ ...l }] : [], rowCount: mio ? 1 : 0 };
  }
  if (/^UPDATE migration_batches SET imported = imported \+ \$1, updated/i.test(sql)) {
    const l = bd.lotes.get(params[5]);
    l.imported += params[0]; l.updated += params[1];
    l.skipped += params[2]; l.failed += params[3]; l.consultations += params[4];
    return { rows: [{ ...l }], rowCount: 1 };
  }
  if (/^UPDATE migration_batches SET (imported|updated|skipped) = /i.test(sql)) {
    const l = bd.lotes.get(params[1]);
    const cual = sql.match(/SET (\w+) =/)[1];
    l[cual] += 1;
    l.consultations += params[0];
    return { rows: [{ ...l }], rowCount: 1 };
  }
  if (/^UPDATE migration_batches SET status = 'completado'/i.test(sql)) {
    const l = bd.lotes.get(params[0]);
    l.status = 'completado';
    return { rows: [{ ...l }], rowCount: 1 };
  }
  if (/^UPDATE migration_batches SET status = 'revertido'/i.test(sql)) {
    const l = bd.lotes.get(params[0]);
    l.status = 'revertido';
    return { rows: [{ ...l }], rowCount: 1 };
  }
  if (/^SELECT b\.\*, u\.name AS autor/i.test(sql)) {
    return { rows: [...bd.lotes.values()].map((l) => ({ ...l, autor: 'Dra. Fabiola' })), rowCount: bd.lotes.size };
  }

  if (/^SELECT id, name, identity_number FROM patients/i.test(sql)) {
    const claves = params[1];
    const filas = bd.pacientes.filter((p) => claves.includes(campos.claveIdentidad(p.identity_number)));
    return { rows: filas, rowCount: filas.length };
  }
  if (/^SELECT id, name, identity_number, phone FROM patients/i.test(sql)) {
    const colas = params[1];
    const filas = bd.pacientes.filter((p) => colas.includes(campos.colaTelefono(p.phone)));
    return { rows: filas, rowCount: filas.length };
  }
  if (/^INSERT INTO patients/i.test(sql) && /RETURNING id, identity_number/i.test(sql)) {
    const [nombres, identidades, edades, nacimientos, sexos, telefonos, wa] = params;
    const filas = identidades.map((identidad, i) => {
      const fila = {
        id: bd.proximoId++, name: nombres[i], identity_number: identidad, age: edades[i],
        birth_date: nacimientos[i], gender: sexos[i], phone: telefonos[i], whatsapp_number: wa[i],
        clinic_id: params[7], created_by: params[8], migration_batch_id: params[9],
      };
      bd.pacientes.push(fila);
      return { id: fila.id, identity_number: identidad };
    });
    return { rows: filas, rowCount: filas.length };
  }
  if (/^INSERT INTO patients/i.test(sql) && /RETURNING id$/i.test(sql)) {
    const fila = {
      id: bd.proximoId++, name: params[0], identity_number: params[1], age: params[2],
      birth_date: params[3], gender: params[4], phone: params[5], whatsapp_number: params[6],
      clinic_id: params[7], created_by: params[8], migration_batch_id: params[9],
    };
    bd.pacientes.push(fila);
    return { rows: [{ id: fila.id }], rowCount: 1 };
  }
  if (/^UPDATE patients p SET/i.test(sql)) {
    const [ids, nombres, nacimientos, sexos, telefonos, wa, edades] = params;
    ids.forEach((id, i) => {
      const p = bd.pacientes.find((x) => x.id === id);
      if (!p) return;
      // Se replica la única regla que importa aquí: sin sobrescribir, solo se
      // rellena lo que estaba vacío.
      const sobre = /d\.name <> '' THEN d\.name/.test(sql);
      const poner = (col, valor) => {
        if (!p[col] || (sobre && valor)) p[col] = valor;
      };
      poner('birth_date', nacimientos[i]);
      poner('gender', sexos[i]);
      poner('phone', telefonos[i]);
      poner('whatsapp_number', wa[i]);
      if (sobre && nombres[i]) p.name = nombres[i];
      if (!p.age || (sobre && edades[i] > 0)) p.age = edades[i];
    });
    return { rows: [], rowCount: ids.length };
  }
  if (/^INSERT INTO critical_info/i.test(sql)) {
    const [ids, alergias, medicamentos, condiciones] = params;
    ids.forEach((id, i) => {
      bd.criticos.push({ patient_id: id, allergies: alergias[i], medications: medicamentos[i], conditions: condiciones[i] });
    });
    return { rows: [], rowCount: ids.length };
  }
  if (/^SELECT patient_id, to_char/i.test(sql)) {
    const ids = params[1];
    const filas = bd.consultas.filter((c) => ids.includes(c.patient_id))
      .map((c) => ({ patient_id: c.patient_id, dia: c.dia, diagnosis: c.diagnosis, treatment: c.treatment, notes: c.notes }));
    return { rows: filas, rowCount: filas.length };
  }
  if (/^INSERT INTO consultations/i.test(sql) && /FROM unnest/i.test(sql)) {
    const [ids, notas, dx, tx, proc, obs, motivos, costos, dias] = params;
    ids.forEach((id, i) => {
      bd.consultas.push({
        patient_id: id, notes: notas[i], diagnosis: dx[i], treatment: tx[i], procedures: proc[i],
        observations: obs[i], visit_reason: motivos[i] || params[9], cost: costos[i], dia: dias[i],
        specialty: params[11], doctor_id: params[12], clinic_id: params[13], migration_batch_id: params[14],
      });
    });
    return { rows: [], rowCount: ids.length };
  }
  if (/^INSERT INTO consultations/i.test(sql)) {
    const fila = {
      id: bd.proximoId++, patient_id: params[0], notes: params[1], diagnosis: params[2],
      treatment: params[3], procedures: params[4], observations: params[5], visit_reason: params[6],
      cost: params[7], payment_status: params[8], dia: params[13],
      migration_batch_id: params[12],
    };
    bd.consultas.push(fila);
    return { rows: [{ id: fila.id }], rowCount: 1 };
  }

  if (/^DELETE FROM consultations WHERE migration_batch_id/i.test(sql)) {
    const antes = bd.consultas.length;
    bd.consultas = bd.consultas.filter((c) => c.migration_batch_id !== params[0]);
    return { rows: [], rowCount: antes - bd.consultas.length };
  }
  if (/^SELECT p\.id FROM patients/i.test(sql)) {
    const filas = bd.pacientes
      .filter((p) => p.migration_batch_id === params[0])
      .filter((p) => !bd.consultas.some((c) => c.patient_id === p.id))
      .map((p) => ({ id: p.id }));
    return { rows: filas, rowCount: filas.length };
  }
  if (/^DELETE FROM critical_info/i.test(sql)) {
    bd.criticos = bd.criticos.filter((c) => !params[0].includes(c.patient_id));
    return { rows: [], rowCount: 0 };
  }
  if (/^DELETE FROM patients/i.test(sql)) {
    const antes = bd.pacientes.length;
    bd.pacientes = bd.pacientes.filter((p) => !params[0].includes(p.id));
    return { rows: [], rowCount: antes - bd.pacientes.length };
  }
  if (/^SELECT COUNT\(\*\)::int AS n FROM patients WHERE migration_batch_id/i.test(sql)) {
    return { rows: [{ n: bd.pacientes.filter((p) => p.migration_batch_id === params[0]).length }], rowCount: 1 };
  }
  if (/^SELECT COUNT\(\*\)::int AS n FROM patients WHERE clinic_id/i.test(sql)) {
    return { rows: [{ n: bd.pacientes.length }], rowCount: 1 };
  }

  // La auditoría escribe su propia fila y no debe hacer fallar nada.
  if (/^INSERT INTO audit_logs/i.test(sql)) return { rows: [], rowCount: 1 };

  throw new Error('SQL no previsto en el doble: ' + sql.slice(0, 140));
}

const resuelta = require.resolve('../db');
require.cache[resuelta] = {
  id: resuelta, filename: resuelta, loaded: true,
  exports: { query: async (text, params) => ejecutar(text, params) },
};

const router = require('../routes/migracion');

const DOCTOR = { id: 7, email: 'doc@clinica.test', role: 'doctor', clinic_id: 42, specialty: 'Podología' };
const ADMIN = { id: 3, email: 'admin@clinica.test', role: 'clinic_admin', clinic_id: 42 };
const RECEPCION = { id: 8, email: 'rec@clinica.test', role: 'receptionist', clinic_id: 42 };

async function levantar() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));
  app.use('/api/migracion', router);
  // El manejador de errores del server real; sin él un throw deja la petición colgada.
  app.use((err, req, res, _next) => res.status(500).json({ error: err.message }));

  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;

  return {
    async pedir(method, path, usuario, cuerpo) {
      const res = await fetch(base + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + jwt.sign(usuario, process.env.JWT_SECRET, { expiresIn: '5m' }),
        },
        body: method === 'GET' ? undefined : JSON.stringify(cuerpo || {}),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    },
    cerrar: () => new Promise((r) => {
      if (server.closeAllConnections) server.closeAllConnections();
      server.close(r);
    }),
  };
}

function fila(i, extra) {
  return Object.assign({ __i: i, name: `Paciente ${i}`, identity_number: `0801-1990-${String(i).padStart(5, '0')}` }, extra);
}

test('recepción no puede migrar expedientes', async () => {
  reiniciarBd();
  const app = await levantar();
  try {
    const r = await app.pedir('POST', '/api/migracion/lotes', RECEPCION, { total_rows: 5 });
    assert.strictEqual(r.status, 403);
  } finally { await app.cerrar(); }
});

test('un tramo crea pacientes, salta los repetidos y rechaza los inválidos', async () => {
  reiniciarBd();
  const app = await levantar();
  try {
    const lote = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 5, source: 'archivo' });
    assert.strictEqual(lote.status, 200);

    const r = await app.pedir('POST', `/api/migracion/lotes/${lote.body.id}/filas`, DOCTOR, {
      filas: [
        fila(0, { phone: '9988-7766', birth_date: '03/04/1990', gender: 'F' }),
        fila(1, { diagnosis: 'Onicomicosis', history_date: '12/02/2024', cost: 'L 600.00' }),
        // Misma identidad que la fila 0: repetida dentro del propio archivo.
        fila(0, { __i: 2 }),
        { __i: 3, identity_number: '0801-1990-99999' },   // sin nombre → error
        { __i: 4, name: 'Sin identidad' },                 // provisional
      ].map((f, i) => Object.assign(f, { __i: i })),
      opciones: { formatoFecha: 'dmy' },
    });

    assert.strictEqual(r.status, 200);
    const estados = r.body.resultados.map((x) => x.estado);
    assert.deepStrictEqual(estados, ['creado', 'creado', 'omitido', 'error', 'creado']);
    assert.strictEqual(bd.pacientes.length, 3);
    assert.strictEqual(r.body.totales.imported, 3);
    assert.strictEqual(r.body.totales.failed, 1);

    // Solo la fila con datos clínicos crea consulta.
    assert.strictEqual(bd.consultas.length, 1);
    assert.strictEqual(bd.consultas[0].diagnosis, 'Onicomicosis');
    assert.strictEqual(bd.consultas[0].dia, '2024-02-12', 'la consulta conserva su fecha original');
    assert.strictEqual(Number(bd.consultas[0].cost), 600);

    // Al que no traía identidad se le pone un expediente provisional del lote.
    const provisional = bd.pacientes.find((p) => p.name === 'Sin identidad');
    assert.match(provisional.identity_number, /^MIG-\d+-\d{4}$/);

    // Y todos llevan la marca del lote, que es lo que permite deshacer.
    assert.ok(bd.pacientes.every((p) => p.migration_batch_id === lote.body.id));
  } finally { await app.cerrar(); }
});

test('la historia migrada sin costo no aterriza en Pendientes de cobro', async () => {
  // Finanzas › Pendientes lista todas las consultas 'pending' SIN filtro de
  // fecha: con el valor por defecto, migrar historia llenaba la pantalla de
  // cobros con visitas de hace años y cero lempiras.
  reiniciarBd();
  const app = await levantar();
  try {
    const lote = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 3 });
    await app.pedir('POST', `/api/migracion/lotes/${lote.body.id}/filas`, DOCTOR, {
      filas: [
        fila(0, { diagnosis: 'Control', history_date: '2023-05-01' }),                  // sin costo
        fila(1, { diagnosis: 'Limpieza', history_date: '2023-06-01', cost: '600' }),    // con costo
      ],
      opciones: { costosPagados: true },
    });

    const insercion = consultasVistas.filter((c) => /^INSERT INTO consultations/i.test(c.sql)).pop();
    assert.match(insercion.sql, /d\.cost <= 0 THEN 'paid'/, 'lo que no tiene costo no queda pendiente');
    assert.strictEqual(bd.consultas.length, 2);
  } finally { await app.cerrar(); }
});

test('un historial con varias visitas por paciente crea UN paciente y TODAS sus consultas', async () => {
  // Es como exportan las "fichas clínicas" Medilink y compañía: una fila por
  // VISITA, no por paciente. Saltarse las filas repetidas dejaba entrar la
  // primera visita de cada uno y tiraba el resto del historial.
  reiniciarBd();
  const app = await levantar();
  try {
    const lote = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 5 });
    const r = await app.pedir('POST', `/api/migracion/lotes/${lote.body.id}/filas`, DOCTOR, {
      filas: [
        fila(0, { __i: 0, diagnosis: 'Fascitis plantar', history_date: '2019-03-04' }),
        fila(0, { __i: 1, diagnosis: 'Control', history_date: '2021-07-15' }),
        fila(0, { __i: 2, diagnosis: 'Revisión anual', history_date: '2024-02-02' }),
        fila(1, { __i: 3, diagnosis: 'Uña encarnada', history_date: '2023-05-01' }),
      ],
      opciones: { duplicados: 'omitir' },
    });

    assert.deepStrictEqual(r.body.resultados.map((x) => x.estado),
      ['creado', 'omitido', 'omitido', 'creado']);
    assert.strictEqual(bd.pacientes.length, 2, 'dos pacientes, no cuatro');
    assert.strictEqual(bd.consultas.length, 4, 'las cuatro visitas entran');
    assert.strictEqual(r.body.totales.consultations, 4);

    // Y el resultado tiene que DECIRLO: "omitido" a secas se lee como
    // "esta fila no hizo nada", y aquí sí hizo.
    assert.ok(r.body.resultados[1].consulta_anadida);
    assert.match(r.body.resultados[1].motivo, /añadió la consulta/);

    // Las tres visitas del primer paciente cuelgan del MISMO expediente.
    const suyas = bd.consultas.filter((c) => c.patient_id === bd.pacientes[0].id);
    assert.strictEqual(suyas.length, 3);
    assert.deepStrictEqual(suyas.map((c) => c.dia).sort(),
      ['2019-03-04', '2021-07-15', '2024-02-02']);
  } finally { await app.cerrar(); }
});

test('las visitas de un paciente que YA estaba en la base se le añaden', async () => {
  reiniciarBd();
  const app = await levantar();
  try {
    // Primera migración: solo el padrón, sin historia.
    const l1 = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 1 });
    await app.pedir('POST', `/api/migracion/lotes/${l1.body.id}/filas`, DOCTOR, { filas: [fila(0)] });
    assert.strictEqual(bd.consultas.length, 0);

    // Segunda: el historial de ese mismo paciente.
    const l2 = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 2 });
    const r = await app.pedir('POST', `/api/migracion/lotes/${l2.body.id}/filas`, DOCTOR, {
      filas: [
        fila(0, { __i: 0, diagnosis: 'Primera visita', history_date: '2020-01-10' }),
        fila(0, { __i: 1, diagnosis: 'Segunda visita', history_date: '2022-06-20' }),
      ],
      opciones: { duplicados: 'omitir' },
    });

    assert.strictEqual(bd.pacientes.length, 1, 'no se duplicó el expediente');
    assert.strictEqual(bd.consultas.length, 2, 'se le añadió su historia');
    assert.ok(r.body.resultados.every((x) => x.consulta_anadida));
  } finally { await app.cerrar(); }
});

test('quien no quiera que se toque al paciente existente puede apagarlo', async () => {
  reiniciarBd();
  const app = await levantar();
  try {
    const l1 = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 1 });
    await app.pedir('POST', `/api/migracion/lotes/${l1.body.id}/filas`, DOCTOR, { filas: [fila(0)] });

    const l2 = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 1 });
    await app.pedir('POST', `/api/migracion/lotes/${l2.body.id}/filas`, DOCTOR, {
      filas: [fila(0, { diagnosis: 'No debería entrar', history_date: '2020-01-10' })],
      opciones: { duplicados: 'omitir', historiaEnExistentes: false },
    });

    assert.strictEqual(bd.consultas.length, 0, 'con la opción apagada no se escribe nada');
  } finally { await app.cerrar(); }
});

test('una visita idéntica repetida dentro del mismo archivo entra una sola vez', async () => {
  reiniciarBd();
  const app = await levantar();
  try {
    const lote = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 3 });
    await app.pedir('POST', `/api/migracion/lotes/${lote.body.id}/filas`, DOCTOR, {
      filas: [
        fila(0, { __i: 0, diagnosis: 'Control', history_date: '2022-04-01' }),
        fila(0, { __i: 1, diagnosis: 'Control', history_date: '2022-04-01' }), // exacta
        fila(0, { __i: 2, diagnosis: 'Control', history_date: '2023-04-01' }), // otro día
      ],
      opciones: { duplicados: 'omitir' },
    });

    assert.strictEqual(bd.pacientes.length, 1);
    assert.strictEqual(bd.consultas.length, 2, 'la fila calcada no crea una segunda consulta');
  } finally { await app.cerrar(); }
});

test('reimportar el mismo archivo no duplica al paciente ni su historia', async () => {
  reiniciarBd();
  const app = await levantar();
  try {
    const cuerpo = {
      filas: [fila(0, { phone: '9988-7766', diagnosis: 'Fascitis', history_date: '2024-02-12' })],
      opciones: { duplicados: 'actualizar' },
    };

    const l1 = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 1 });
    await app.pedir('POST', `/api/migracion/lotes/${l1.body.id}/filas`, DOCTOR, cuerpo);
    assert.strictEqual(bd.pacientes.length, 1);
    assert.strictEqual(bd.consultas.length, 1);

    const l2 = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 1 });
    const r = await app.pedir('POST', `/api/migracion/lotes/${l2.body.id}/filas`, DOCTOR, cuerpo);

    assert.strictEqual(r.body.resultados[0].estado, 'actualizado');
    assert.strictEqual(bd.pacientes.length, 1, 'sigue habiendo un solo paciente');
    assert.strictEqual(bd.consultas.length, 1, 'la consulta no se duplicó');
  } finally { await app.cerrar(); }
});

test('actualizar rellena lo vacío y respeta lo que ya estaba escrito', async () => {
  reiniciarBd();
  const app = await levantar();
  try {
    const l1 = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 1 });
    await app.pedir('POST', `/api/migracion/lotes/${l1.body.id}/filas`, DOCTOR, {
      filas: [fila(0, { phone: '9988-7766' })],
    });
    const paciente = bd.pacientes[0];
    assert.strictEqual(paciente.phone, '99887766');
    assert.strictEqual(paciente.gender, '');

    const l2 = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 1 });
    await app.pedir('POST', `/api/migracion/lotes/${l2.body.id}/filas`, DOCTOR, {
      filas: [fila(0, { phone: '2222-2222', gender: 'F' })],
      opciones: { duplicados: 'actualizar' },
    });

    assert.strictEqual(paciente.gender, 'Femenino', 'lo que faltaba se rellena');
    assert.strictEqual(paciente.phone, '99887766', 'lo que ya estaba NO se pisa');
  } finally { await app.cerrar(); }
});

test('con "que mande el archivo", el dato del archivo sí pisa al guardado', async () => {
  reiniciarBd();
  const app = await levantar();
  try {
    const l1 = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 1 });
    await app.pedir('POST', `/api/migracion/lotes/${l1.body.id}/filas`, DOCTOR, { filas: [fila(0, { phone: '9988-7766' })] });

    const l2 = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 1 });
    await app.pedir('POST', `/api/migracion/lotes/${l2.body.id}/filas`, DOCTOR, {
      filas: [fila(0, { phone: '2222-2222' })],
      opciones: { duplicados: 'actualizar', sobrescribir: true },
    });

    assert.strictEqual(bd.pacientes[0].phone, '22222222');
  } finally { await app.cerrar(); }
});

test('los expedientes quedan a nombre del doctor elegido, no de quien pulsa el botón', async () => {
  // La lista de un doctor son los pacientes que dio de alta (created_by) o que
  // tienen cita con él; las consultas migradas no cuentan. Si `created_by` fuera
  // el administrador que importa, la doctora abriría Pacientes y no vería nada.
  reiniciarBd();
  const app = await levantar();
  try {
    const lote = await app.pedir('POST', '/api/migracion/lotes', ADMIN, { total_rows: 1, doctor_id: 7 });
    await app.pedir('POST', `/api/migracion/lotes/${lote.body.id}/filas`, ADMIN, { filas: [fila(0)] });
    assert.strictEqual(bd.pacientes[0].created_by, 7);

    // Y sin doctor elegido queda NULL: alcance de clínica, no del administrador.
    const suelto = await app.pedir('POST', '/api/migracion/lotes', ADMIN, { total_rows: 1 });
    await app.pedir('POST', `/api/migracion/lotes/${suelto.body.id}/filas`, ADMIN, { filas: [fila(1)] });
    assert.strictEqual(bd.pacientes[1].created_by, null);
  } finally { await app.cerrar(); }
});

test('una ficha de papel devuelve la consulta donde colgar las fotos', async () => {
  reiniciarBd();
  const app = await levantar();
  try {
    const lote = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 100, source: 'fisico' });
    const r = await app.pedir('POST', `/api/migracion/lotes/${lote.body.id}/ficha`, DOCTOR, {
      fila: { name: 'Ana del archivador', identity_number: '' },
      consultas: [{ con_fotos: true }],
    });

    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.estado, 'creado');
    assert.strictEqual(r.body.consultas.length, 1, 'sin consulta las fotos no tendrían dónde ir');
    assert.ok(r.body.consultas[0].id);
    assert.strictEqual(r.body.totales.imported, 1);
  } finally { await app.cerrar(); }
});

test('una ficha de papel con varias visitas crea una consulta por visita, en orden', async () => {
  // Es el caso normal del archivador: una hoja con cinco entradas fechadas. El
  // ORDEN de la respuesta es lo que hace que las fotos de cada visita acaben
  // colgadas de su consulta y no de la de otro día.
  reiniciarBd();
  const app = await levantar();
  try {
    const lote = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 100, source: 'fisico' });
    const r = await app.pedir('POST', `/api/migracion/lotes/${lote.body.id}/ficha`, DOCTOR, {
      fila: { name: 'Rosa Meléndez', identity_number: '0801-1992-11111' },
      consultas: [
        { history_date: '2019-03-04', diagnosis: 'Fascitis plantar', con_fotos: true },
        { history_date: '2021-07-15', diagnosis: 'Control', notes: 'Mejoría' },
        { con_fotos: true },                       // hoja suelta sin nada tecleado
        { visit_reason: '   ', diagnosis: '   ' }, // vacía de verdad: no cuenta
      ],
      opciones: { formatoFecha: 'dmy' },
    });

    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.consultas.length, 3, 'la vacía no crea consulta');
    assert.deepStrictEqual(r.body.consultas.map((c) => c.date), ['2019-03-04', '2021-07-15', '']);
    assert.strictEqual(bd.pacientes.length, 1, 'un solo paciente para toda la ficha');
    assert.strictEqual(bd.consultas.length, 3);
    assert.strictEqual(bd.consultas[0].diagnosis, 'Fascitis plantar');
    assert.strictEqual(bd.consultas[1].notes, 'Mejoría');
    assert.strictEqual(r.body.totales.consultations, 3);
  } finally { await app.cerrar(); }
});

test('volver a guardar al mismo paciente le añade consultas, no lo duplica', async () => {
  // Lo que pasa cuando alguien encuentra media ficha después y la teclea aparte.
  reiniciarBd();
  const app = await levantar();
  try {
    const lote = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 100, source: 'fisico' });
    const cuerpo = (dx) => ({
      fila: { name: 'Rosa Meléndez', identity_number: '0801-1992-11111' },
      consultas: [{ history_date: '2019-03-04', diagnosis: dx }],
    });

    await app.pedir('POST', `/api/migracion/lotes/${lote.body.id}/ficha`, DOCTOR, cuerpo('Fascitis'));
    const r = await app.pedir('POST', `/api/migracion/lotes/${lote.body.id}/ficha`, DOCTOR, cuerpo('Espolón'));

    assert.strictEqual(r.body.estado, 'omitido', 'el paciente ya existía');
    assert.strictEqual(bd.pacientes.length, 1);
    assert.strictEqual(bd.consultas.length, 2, 'la segunda visita se añade igual');
  } finally { await app.cerrar(); }
});

test('una ficha no puede pedir consultas sin fin', async () => {
  reiniciarBd();
  const app = await levantar();
  try {
    const lote = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 100, source: 'fisico' });
    const r = await app.pedir('POST', `/api/migracion/lotes/${lote.body.id}/ficha`, DOCTOR, {
      fila: { name: 'Ana', identity_number: '1' },
      consultas: Array.from({ length: 51 }, () => ({ diagnosis: 'x' })),
    });
    assert.strictEqual(r.status, 400);
  } finally { await app.cerrar(); }
});

test('una ficha sin fotos y sin datos clínicos no crea consulta vacía', async () => {
  reiniciarBd();
  const app = await levantar();
  try {
    const lote = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 100, source: 'fisico' });
    const r = await app.pedir('POST', `/api/migracion/lotes/${lote.body.id}/ficha`, DOCTOR, {
      fila: { name: 'Solo datos', identity_number: '0801-1990-00007' },
      consultas: [],
    });
    assert.strictEqual(r.body.consultas.length, 0);
    assert.strictEqual(r.body.consultation_id, null);
    assert.strictEqual(bd.consultas.length, 0);
  } finally { await app.cerrar(); }
});

test('el mismo paciente dos veces en el archivo se actualiza una sola vez', async () => {
  // Esto no es un detalle: critical_info se escribe con un solo INSERT … ON
  // CONFLICT, y Postgres rechaza la sentencia entera si intenta tocar la misma
  // fila dos veces. Sin la red, dos filas repetidas tiraban el tramo completo.
  reiniciarBd();
  const app = await levantar();
  try {
    const l1 = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 1 });
    await app.pedir('POST', `/api/migracion/lotes/${l1.body.id}/filas`, DOCTOR, { filas: [fila(0)] });

    const l2 = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 2 });
    const r = await app.pedir('POST', `/api/migracion/lotes/${l2.body.id}/filas`, DOCTOR, {
      filas: [fila(0, { gender: 'F' }), fila(0, { __i: 1, gender: 'F' })],
      opciones: { duplicados: 'actualizar' },
    });

    assert.deepStrictEqual(r.body.resultados.map((x) => x.estado), ['actualizado', 'omitido']);
    const critico = consultasVistas.filter((c) => /^INSERT INTO critical_info/i.test(c.sql)).pop();
    assert.strictEqual(critico.params[0].length, 1, 'un solo paciente en el upsert');
  } finally { await app.cerrar(); }
});

test('sin identidad, dos filas con el mismo nombre y teléfono no crean dos expedientes', async () => {
  reiniciarBd();
  const app = await levantar();
  try {
    const lote = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 2 });
    const r = await app.pedir('POST', `/api/migracion/lotes/${lote.body.id}/filas`, DOCTOR, {
      filas: [
        { __i: 0, name: 'Ana del archivador', phone: '9988-7766' },
        { __i: 1, name: 'Ana del Archivador', phone: '(504) 9988-7766' },
      ],
    });
    assert.deepStrictEqual(r.body.resultados.map((x) => x.estado), ['creado', 'omitido']);
    assert.strictEqual(bd.pacientes.length, 1);
  } finally { await app.cerrar(); }
});

test('deshacer borra lo del lote y conserva a quien ya tiene consulta propia', async () => {
  reiniciarBd();
  const app = await levantar();
  try {
    const lote = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 2 });
    await app.pedir('POST', `/api/migracion/lotes/${lote.body.id}/filas`, DOCTOR, {
      filas: [fila(0), fila(1)],
    });
    assert.strictEqual(bd.pacientes.length, 2);

    // Al segundo se le añade después una consulta que NO es del lote: ya es un
    // paciente de la clínica, no "lo que escribió la importación".
    bd.consultas.push({ patient_id: bd.pacientes[1].id, migration_batch_id: null, dia: '2026-01-01' });

    const r = await app.pedir('POST', `/api/migracion/lotes/${lote.body.id}/revertir`, DOCTOR, {});
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.pacientes_borrados, 1);
    assert.strictEqual(r.body.pacientes_conservados, 1);
    assert.strictEqual(bd.pacientes.length, 1);
    assert.strictEqual(r.body.lote.status, 'revertido');
  } finally { await app.cerrar(); }
});

test('no se escribe en un lote ya cerrado', async () => {
  reiniciarBd();
  const app = await levantar();
  try {
    const lote = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 1 });
    await app.pedir('POST', `/api/migracion/lotes/${lote.body.id}/cerrar`, DOCTOR, {});
    const r = await app.pedir('POST', `/api/migracion/lotes/${lote.body.id}/filas`, DOCTOR, { filas: [fila(0)] });
    assert.strictEqual(r.status, 409);
  } finally { await app.cerrar(); }
});

test('un lote de otra clínica no existe para quien pregunta', async () => {
  reiniciarBd();
  const app = await levantar();
  try {
    const lote = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 1 });
    const otro = Object.assign({}, ADMIN, { clinic_id: 99 });
    const r = await app.pedir('POST', `/api/migracion/lotes/${lote.body.id}/filas`, otro, { filas: [fila(0)] });
    assert.strictEqual(r.status, 404);
  } finally { await app.cerrar(); }
});

test('un administrador no puede atribuir la migración a un doctor de otra clínica', async () => {
  reiniciarBd();
  const app = await levantar();
  try {
    const r = await app.pedir('POST', '/api/migracion/lotes', ADMIN, { total_rows: 1, doctor_id: 555 });
    assert.strictEqual(r.status, 400);
  } finally { await app.cerrar(); }
});

test('el análisis previo no escribe absolutamente nada', async () => {
  reiniciarBd();
  const app = await levantar();
  try {
    const r = await app.pedir('POST', '/api/migracion/analizar', DOCTOR, {
      filas: [fila(0), { __i: 1, identity_number: 'X' }],
    });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.resultados.length, 2);
    assert.ok(r.body.resultados[1].errores.length, 'la fila sin nombre se marca');
    assert.strictEqual(bd.pacientes.length, 0);
    assert.ok(
      !consultasVistas.some((c) => /^(INSERT|UPDATE|DELETE)/i.test(c.sql)),
      'el análisis no puede haber escrito',
    );
  } finally { await app.cerrar(); }
});

test('un tramo más grande que el tope se rechaza en vez de intentarlo', async () => {
  reiniciarBd();
  const app = await levantar();
  try {
    const lote = await app.pedir('POST', '/api/migracion/lotes', DOCTOR, { total_rows: 500 });
    const filas = Array.from({ length: 401 }, (_, i) => fila(i));
    const r = await app.pedir('POST', `/api/migracion/lotes/${lote.body.id}/filas`, DOCTOR, { filas });
    assert.strictEqual(r.status, 400);
  } finally { await app.cerrar(); }
});
