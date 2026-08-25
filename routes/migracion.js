// ── Migración de expedientes ──
//
// Traer a la plataforma los expedientes que la clínica ya tenía: una exportación
// de Medilink o Dentalink, el Excel que llevaba la recepcionista, o el archivador
// de papel que alguien está digitalizando ficha por ficha.
//
// Cuatro decisiones que explican casi todo el archivo:
//
// 1. LA VALIDACIÓN SE REHACE AQUÍ, ENTERA.
//    La página ya valida y enseña el resultado antes de escribir, pero eso es
//    para que la persona vea lo que va a pasar. La verdad de lo que se guarda la
//    fija el servidor: `lib/migracion/campos.js` se ejecuta otra vez sobre lo que
//    llega. Si no, bastaría un POST a mano para meter filas sin nombre o con la
//    edad puesta a dedo en vez de calculada.
//
// 2. TODO LO ESCRITO QUEDA MARCADO CON SU LOTE.
//    `migration_batch_id` en pacientes y consultas. Es lo que permite deshacer,
//    que es la diferencia entre una herramienta que se usa y una que da miedo:
//    se prueba con 20 filas, se revisa, y si el mapeo estaba mal se revierte y se
//    repite. Sin deshacer, el primer intento fallido deja miles de expedientes
//    basura que hay que borrar a mano.
//
// 3. UN PUÑADO DE CONSULTAS POR TRAMO, NO UNA POR FILA.
//    Cada tramo escribe con INSERT multi-fila (unnest), así que el coste crece
//    con el número de TRAMOS, no de filas. Importar 3.000 expedientes son unas
//    diez idas y vueltas a Postgres por tramo de 200, no 9.000.
//
// 4. REIMPORTAR EL MISMO ARCHIVO NO PUEDE DUPLICAR NADA.
//    Los pacientes se emparejan por identidad (y en su defecto por nombre +
//    teléfono) y la historia clínica lleva su propia huella. Es el caso normal,
//    no el raro: la primera migración casi siempre se hace dos veces.

const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const campos = require('../lib/migracion/campos');

const AuditService = require('../lib/audit/service');
const auditoria = new AuditService();

// Solo el doctor y quien administra la clínica migran expedientes. Recepción no:
// da de alta pacientes de uno en uno desde su pantalla, que es lo suyo.
const soloClinica = requireRole('doctor', 'clinic_admin');

// Tope por tramo. La página manda 200; este número existe para que un cliente
// hecho a mano no pueda pedir un tramo de 50.000 filas y dejar una conexión de
// Postgres ocupada un minuto.
const MAX_FILAS_TRAMO = 400;

// Tope de filas por lote. Un archivo más grande que esto no es una migración,
// es un volcado, y conviene partirlo para poder revisarlo.
const MAX_FILAS_LOTE = 20000;

// Visitas por ficha de papel. Un expediente con más de cincuenta entradas
// tecleadas a mano no existe; el tope es para el cliente hecho a mano.
const MAX_CONSULTAS_FICHA = 50;

const ORIGENES = new Set(['archivo', 'pegado', 'fisico']);
const POLITICAS = new Set(['omitir', 'actualizar', 'crear']);

const MOTIVO_MIGRADO = 'Expediente migrado';

function limpiarTexto(v, max) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
}

// ── Catálogo de campos ──────────────────────────────────────────────────────
// La página lo pide al abrir para pintar los selectores de mapeo y armar la
// plantilla CSV. Sale de aquí y no de una copia en el front para que no haya dos
// listas de campos que puedan discrepar.
router.get('/campos', authenticate, soloClinica, async (req, res) => {
  res.json({
    campos: campos.CAMPOS.map((c) => ({
      key: c.key,
      label: c.label,
      grupo: c.grupo,
      requerido: !!c.requerido,
      tipo: c.tipo || 'texto',
      multiple: !!c.multiple,
      ayuda: c.ayuda || '',
    })),
    grupos: [
      { key: 'paciente', label: 'Datos del paciente' },
      { key: 'critico', label: 'Información crítica' },
      { key: 'historia', label: 'Historia clínica' },
    ],
  });
});

// ── Doctores de la clínica ──────────────────────────────────────────────────
// A quién se le atribuyen los expedientes migrados. Importa de verdad: un
// paciente sin `created_by` solo aparece en la lista del doctor cuando ya tiene
// cita con él, así que una migración sin asignar deja al doctor mirando una
// pantalla vacía y creyendo que no se importó nada.
router.get('/doctores', authenticate, soloClinica, async (req, res) => {
  if (req.user.role === 'doctor') {
    const r = await query(
      'SELECT id, name, specialty FROM users WHERE id = $1 AND clinic_id = $2',
      [req.user.id, req.user.clinic_id],
    );
    return res.json({ doctores: r.rows, fijo: true });
  }
  const r = await query(
    `SELECT id, name, specialty FROM users
      WHERE clinic_id = $1 AND role = 'doctor'
        AND COALESCE(approval_status, 'approved') = 'approved'
      ORDER BY name`,
    [req.user.clinic_id],
  );
  res.json({ doctores: r.rows, fijo: false });
});

// Resuelve y comprueba a qué doctor se atribuye lo migrado.
// Devuelve null si el id pedido no es un doctor de esta clínica.
async function resolverDoctor(req, pedido) {
  if (req.user.role === 'doctor') return { id: req.user.id };
  if (!pedido) return { id: null };
  const r = await query(
    "SELECT id FROM users WHERE id = $1 AND clinic_id = $2 AND role = 'doctor'",
    [pedido, req.user.clinic_id],
  );
  if (r.rows.length === 0) return null;
  return { id: r.rows[0].id };
}

// ── Lotes ───────────────────────────────────────────────────────────────────

router.post('/lotes', authenticate, soloClinica, async (req, res) => {
  const source = ORIGENES.has(req.body.source) ? req.body.source : 'archivo';
  const total = Math.min(parseInt(req.body.total_rows, 10) || 0, MAX_FILAS_LOTE);
  if (total <= 0) return res.status(400).json({ error: 'El lote no trae filas' });

  const doctor = await resolverDoctor(req, req.body.doctor_id);
  if (doctor === null) return res.status(400).json({ error: 'El doctor indicado no pertenece a esta clínica' });

  let mapeo = '{}';
  try { mapeo = JSON.stringify(req.body.mapping || {}).slice(0, 8000); } catch (_) {}

  const r = await query(
    `INSERT INTO migration_batches
       (clinic_id, created_by, doctor_id, source, origin_label, file_name, total_rows, mapping, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'en_curso')
     RETURNING id, created_at`,
    [
      req.user.clinic_id, req.user.id, doctor.id, source,
      limpiarTexto(req.body.origin_label, 60),
      limpiarTexto(req.body.file_name, 200),
      total, mapeo,
    ],
  );

  res.json({ id: r.rows[0].id, created_at: r.rows[0].created_at, doctor_id: doctor.id });
});

async function cargarLote(req, id) {
  const n = parseInt(id, 10);
  if (!Number.isFinite(n)) return null;
  const r = await query('SELECT * FROM migration_batches WHERE id = $1 AND clinic_id = $2', [n, req.user.clinic_id]);
  return r.rows[0] || null;
}

// ── Análisis previo (no escribe nada) ───────────────────────────────────────
//
// Devuelve, fila a fila, qué pasaría: si es alta, si choca con un paciente que
// ya existe, y qué avisos arrastra. La página lo usa para pintar la revisión
// antes de que nadie pulse Importar.
router.post('/analizar', authenticate, soloClinica, async (req, res) => {
  const filas = Array.isArray(req.body.filas) ? req.body.filas : [];
  if (filas.length === 0) return res.json({ resultados: [] });
  if (filas.length > MAX_FILAS_TRAMO) {
    return res.status(400).json({ error: `Máximo ${MAX_FILAS_TRAMO} filas por tramo` });
  }

  const opciones = normalizarOpciones(req.body.opciones);
  const preparadas = filas.map((f) => prepararFila(f, opciones));
  const existentes = await buscarExistentes(req.user.clinic_id, preparadas);

  res.json({
    resultados: preparadas.map((p) => {
      const previo = emparejar(p, existentes);
      return {
        i: p.i,
        errores: p.errores,
        avisos: p.avisos,
        duplicado: previo
          ? { id: previo.id, name: previo.name, identity_number: previo.identity_number, motivo: previo.__motivo }
          : null,
        crea_consulta: !!p.valores.historia,
      };
    }),
  });
});

// ── Escritura de un tramo ───────────────────────────────────────────────────
router.post('/lotes/:id/filas', authenticate, soloClinica, async (req, res) => {
  const lote = await cargarLote(req, req.params.id);
  if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
  if (lote.status !== 'en_curso') return res.status(409).json({ error: 'Este lote ya está cerrado' });

  const filas = Array.isArray(req.body.filas) ? req.body.filas : [];
  if (filas.length === 0) return res.json({ resultados: [], totales: totalesDe(lote) });
  if (filas.length > MAX_FILAS_TRAMO) {
    return res.status(400).json({ error: `Máximo ${MAX_FILAS_TRAMO} filas por tramo` });
  }

  const opciones = normalizarOpciones(req.body.opciones);
  const clinicId = req.user.clinic_id;
  const doctorId = lote.doctor_id || null;
  // `created_by` ES lo que decide la opción "expedientes a nombre de": la lista
  // del doctor son los pacientes que dio de alta o que tienen cita con él, y las
  // consultas migradas NO cuentan para eso. Si aquí se pusiera el id de quien
  // pulsa el botón, un administrador que importa 3.000 expedientes para la Dra.
  // X se los dejaría a nombre de nadie, y ella abriría Pacientes y vería la
  // pantalla vacía. Sin doctor elegido queda NULL, que es el alcance de clínica.
  const creadoPor = doctorId;
  const especialidad = await especialidadDe(doctorId, clinicId);

  const preparadas = filas.map((f) => prepararFila(f, opciones));
  const existentes = await buscarExistentes(clinicId, preparadas);

  const resultados = [];
  const aCrear = [];
  const aActualizar = [];
  // Dos redes contra el archivo que trae la misma persona dos veces. La de
  // `actualizados` no es cosmética: `critical_info` se escribe con un solo
  // INSERT … ON CONFLICT, y Postgres rechaza la sentencia ENTERA si intenta
  // tocar la misma fila dos veces («cannot affect row a second time»). Un tramo
  // de 200 expedientes se perdía por dos filas repetidas.
  // ── Por qué "repetido" no significa "tirar la fila" ──
  //
  // Hay dos clases de archivo, y la diferencia decide todo lo de abajo:
  //
  //   PADRÓN     una fila = un paciente. Que se repita es un error de datos.
  //   HISTORIAL  una fila = una VISITA. Que el paciente se repita es lo normal:
  //              así exportan las "fichas clínicas" Medilink y compañía.
  //
  // Saltarse la fila repetida entera trata el segundo caso como si fuera el
  // primero, y un historial de tres años entra con la primera visita de cada
  // paciente y nada más — perdiendo justo lo que se venía a migrar.
  //
  // La regla: lo repetido es el PACIENTE, no su historia. El expediente no se
  // duplica; la consulta se cuelga del que ya existe. Y como la historia lleva
  // su propia huella (fecha + contenido), reimportar el archivo no la duplica.
  const vistasEnTramo = new Map();       // huella → la fila que creó el paciente
  const actualizadosEnTramo = new Map(); // id de paciente → la fila que lo actualizó
  const soloHistoria = [];               // filas cuyo paciente ya existía en la base
  const heredanPaciente = [];            // filas cuyo paciente lo crea otra fila del tramo

  // Cuelga la historia de una fila del paciente que ya existe, sin tocar sus datos.
  const anotarHistoria = (p, patientId) => {
    if (!opciones.historiaEnExistentes || !p.valores.historia) return;
    p.patientId = patientId;
    soloHistoria.push(p);
  };

  for (const p of preparadas) {
    if (p.errores.length) {
      resultados.push({ i: p.i, estado: 'error', motivo: p.errores[0].mensaje, avisos: p.avisos });
      continue;
    }

    const previo = emparejar(p, existentes);
    if (previo) {
      if (opciones.duplicados === 'omitir') {
        anotarHistoria(p, previo.id);
        resultados.push({ i: p.i, estado: 'omitido', motivo: `Ya existe: ${previo.name}`, patient_id: previo.id, avisos: p.avisos });
        continue;
      }
      if (opciones.duplicados === 'actualizar') {
        const yaEnTramo = actualizadosEnTramo.get(previo.id);
        if (yaEnTramo) {
          anotarHistoria(p, previo.id);
          resultados.push({ i: p.i, estado: 'omitido', motivo: `Otra visita de ${previo.name}`, patient_id: previo.id, avisos: p.avisos });
          continue;
        }
        actualizadosEnTramo.set(previo.id, p);
        aActualizar.push({ p, previo });
        continue;
      }
      // 'crear': se da de alta igual, pero queda constancia en los avisos.
      p.avisos = p.avisos.concat([{
        campo: 'identity_number',
        mensaje: `Se creó un expediente nuevo aunque ya existía "${previo.name}"`,
      }]);
    }

    // Choque dentro del propio archivo: dos filas del mismo paciente. Sin
    // identidad se compara por nombre + teléfono, que es lo único que queda
    // cuando el origen es una libreta de papel.
    const huella = p.claveIdentidad || (p.colaTelefono ? `${p.claveNombre}|${p.colaTelefono}` : '');
    const original = huella ? vistasEnTramo.get(huella) : null;
    if (original) {
      // El paciente lo crea la primera fila; el id todavía no existe, así que
      // esta fila se queda esperando a que se resuelva el INSERT.
      if (opciones.historiaEnExistentes && p.valores.historia) heredanPaciente.push({ p, original });
      resultados.push({ i: p.i, estado: 'omitido', motivo: 'Otra fila del mismo paciente', avisos: p.avisos });
      continue;
    }
    if (huella) vistasEnTramo.set(huella, p);
    aCrear.push(p);
  }

  // ── Altas ──
  if (aCrear.length) {
    asignarExpedientesProvisionales(aCrear, lote);

    const v = (k) => aCrear.map((p) => p.valores[k]);
    const ins = await query(
      `INSERT INTO patients
         (name, identity_number, age, birth_date, gender, phone, whatsapp_number,
          clinic_id, created_by, migration_batch_id)
       SELECT d.name, d.identity_number, d.age, d.birth_date, d.gender, d.phone, d.whatsapp_number,
              $8, $9, $10
         FROM unnest($1::text[], $2::text[], $3::int[], $4::text[], $5::text[], $6::text[], $7::text[])
              AS d(name, identity_number, age, birth_date, gender, phone, whatsapp_number)
       RETURNING id, identity_number`,
      [v('name'), v('identity_number'), v('age'), v('birth_date'), v('gender'), v('phone'), v('whatsapp_number'),
        clinicId, creadoPor, lote.id],
    );

    // Se mapea por identity_number porque el orden de RETURNING no lo garantiza
    // el estándar. Dentro del tramo la identidad es única: los repetidos se
    // apartaron arriba y los vacíos llevan su propio consecutivo.
    const porIdentidad = new Map(ins.rows.map((r) => [r.identity_number, r.id]));
    const creados = [];
    for (const p of aCrear) {
      const id = porIdentidad.get(p.valores.identity_number);
      if (id) {
        p.patientId = id;
        creados.push(p);
        resultados.push({ i: p.i, estado: 'creado', patient_id: id, avisos: p.avisos });
      } else {
        resultados.push({ i: p.i, estado: 'error', motivo: 'No se pudo crear el expediente', avisos: p.avisos });
      }
    }

    if (creados.length) {
      await guardarCritico(creados.map((p) => ({ id: p.patientId, v: p.valores })), true);
    }
  }

  // ── Actualizaciones ──
  if (aActualizar.length) {
    await actualizarPacientes(aActualizar.map(({ p, previo }) => ({ id: previo.id, v: p.valores })), opciones, clinicId);
    await guardarCritico(aActualizar.map(({ p, previo }) => ({ id: previo.id, v: p.valores })), opciones.sobrescribir);
    for (const { p, previo } of aActualizar) {
      p.patientId = previo.id;
      resultados.push({ i: p.i, estado: 'actualizado', patient_id: previo.id, avisos: p.avisos });
    }
  }

  // ── Historia clínica ──
  // Las filas que heredan el paciente de otra del mismo tramo ya pueden saber su
  // id: el INSERT de altas acaba de resolverlo.
  for (const { p, original } of heredanPaciente) p.patientId = original.patientId;

  const conHistoria = [
    ...aCrear,
    ...aActualizar.map(({ p }) => p),
    ...soloHistoria,
    ...heredanPaciente.map(({ p }) => p),
  ].filter((p) => p.patientId && p.valores.historia);

  // A quién hay que preguntarle si esa consulta ya estaba guardada: solo a los
  // pacientes que existían antes de este tramo. Los recién creados no tienen
  // historia previa con la que chocar.
  const idsPrevios = [
    ...aActualizar.map(({ previo }) => previo.id),
    ...soloHistoria.map((p) => p.patientId),
  ];

  const nuevasConsultas = await filtrarHistoriaNueva(conHistoria, idsPrevios, clinicId);

  if (nuevasConsultas.length) {
    await insertarConsultas(nuevasConsultas, {
      clinicId, doctorId, especialidad, loteId: lote.id, costosPagados: opciones.costosPagados,
    });
  }

  // El "omitido" a secas se lee como "esta fila no hizo nada", y en un archivo de
  // historial es justo al revés: el paciente no se duplicó, pero su visita entró.
  const conConsultaNueva = new Set(nuevasConsultas.map((p) => p.i));
  for (const r of resultados) {
    if (r.estado === 'omitido' && conConsultaNueva.has(r.i)) {
      r.motivo = `${r.motivo} · se le añadió la consulta`;
      r.consulta_anadida = true;
    }
  }

  // ── Contadores del lote ──
  const cuenta = { creado: 0, actualizado: 0, omitido: 0, error: 0 };
  for (const r of resultados) cuenta[r.estado] = (cuenta[r.estado] || 0) + 1;

  const upd = await query(
    `UPDATE migration_batches SET
       imported = imported + $1, updated = updated + $2,
       skipped = skipped + $3, failed = failed + $4,
       consultations = consultations + $5
     WHERE id = $6 AND clinic_id = $7
     RETURNING imported, updated, skipped, failed, consultations`,
    [cuenta.creado, cuenta.actualizado, cuenta.omitido, cuenta.error, nuevasConsultas.length, lote.id, clinicId],
  );

  resultados.sort((a, b) => a.i - b.i);
  res.json({ resultados, totales: upd.rows[0] || totalesDe(lote) });
});

// ── Una ficha suelta (expediente en papel) ──────────────────────────────────
//
// El archivador de papel no se importa en tramos: se teclea ficha por ficha y se
// le hacen fotos a las hojas.
//
// Y una ficha de papel NO es una visita, es un paciente con su historia: cinco
// entradas fechadas en la misma hoja. Por eso el cuerpo trae `consultas` como
// lista, y la respuesta devuelve el id de cada una — es donde la página cuelga
// las fotos de esa visita con /api/consultations/:id/images, el mismo sitio
// donde viven las imágenes clínicas del resto de la app.
//
// `MAX_CONSULTAS_FICHA` existe por la misma razón que el tope de los tramos: la
// página nunca manda tantas, y sin él un cliente hecho a mano podría pedir mil
// inserciones en una sola petición.
router.post('/lotes/:id/ficha', authenticate, soloClinica, async (req, res) => {
  const lote = await cargarLote(req, req.params.id);
  if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
  if (lote.status !== 'en_curso') return res.status(409).json({ error: 'Este lote ya está cerrado' });

  const opciones = normalizarOpciones(req.body.opciones);
  const clinicId = req.user.clinic_id;
  const doctorId = lote.doctor_id || null;
  const p = prepararFila(req.body.fila || {}, opciones);

  if (p.errores.length) {
    return res.status(400).json({ error: p.errores[0].mensaje, errores: p.errores });
  }

  // Las visitas de la ficha. Cada una puede traer `con_fotos`: eso obliga a
  // crear la consulta aunque no se haya tecleado nada de ella, porque una hoja
  // escaneada necesita una consulta donde vivir.
  const pedidas = Array.isArray(req.body.consultas) ? req.body.consultas : [];
  if (pedidas.length > MAX_CONSULTAS_FICHA) {
    return res.status(400).json({ error: `Máximo ${MAX_CONSULTAS_FICHA} consultas por ficha` });
  }

  const visitas = [];
  for (const cruda of pedidas) {
    const entrada = cruda && typeof cruda === 'object' ? cruda : {};
    const historia = campos.normalizarHistoria(entrada, opciones, p.avisos);
    if (historia) visitas.push(historia);
    else if (entrada.con_fotos === true) visitas.push(campos.historiaVacia());
  }
  // Compatibilidad con la forma antigua: los campos clínicos dentro de `fila`.
  if (p.valores.historia) visitas.unshift(p.valores.historia);
  if (!visitas.length && req.body.con_fotos === true) visitas.push(campos.historiaVacia());

  const existentes = await buscarExistentes(clinicId, [p]);
  const previo = emparejar(p, existentes);

  let estado;
  if (previo && opciones.duplicados === 'omitir') {
    p.patientId = previo.id;
    estado = 'omitido';
  } else if (previo && opciones.duplicados === 'actualizar') {
    await actualizarPacientes([{ id: previo.id, v: p.valores }], opciones, clinicId);
    await guardarCritico([{ id: previo.id, v: p.valores }], opciones.sobrescribir);
    p.patientId = previo.id;
    estado = 'actualizado';
  } else {
    asignarExpedientesProvisionales([p], lote);
    const ins = await query(
      `INSERT INTO patients
         (name, identity_number, age, birth_date, gender, phone, whatsapp_number,
          clinic_id, created_by, migration_batch_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [p.valores.name, p.valores.identity_number, p.valores.age, p.valores.birth_date,
        p.valores.gender, p.valores.phone, p.valores.whatsapp_number,
        clinicId, doctorId, lote.id],
    );
    p.patientId = ins.rows[0].id;
    await guardarCritico([{ id: p.patientId, v: p.valores }], true);
    estado = 'creado';
  }

  // Las consultas se crean UNA A UNA y no con un INSERT multi-fila: hay que
  // devolver el id de cada una para que la página cuelgue ahí sus fotos, y el
  // orden de RETURNING no lo garantiza el estándar. Son un puñado por ficha, no
  // un tramo de doscientas, así que el coste no importa.
  const especialidad = visitas.length ? await especialidadDe(doctorId, clinicId) : '';
  const creadas = [];
  for (const h of visitas) {
    const r = await query(
      `INSERT INTO consultations
         (patient_id, notes, diagnosis, treatment, procedures, observations, visit_reason,
          cost, payment_status, specialty, doctor_id, clinic_id, migration_batch_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
               COALESCE(NULLIF($14::text, '')::timestamp, NOW()))
       RETURNING id`,
      [p.patientId, h.notes, h.diagnosis, h.treatment, h.procedures, h.observations,
        h.visit_reason || MOTIVO_MIGRADO, h.cost,
        estadoDePago(h.cost, opciones.costosPagados),
        especialidad, doctorId, clinicId, lote.id, h.date || ''],
    );
    creadas.push({ id: r.rows[0].id, date: h.date || '' });
  }

  const cuenta = { creado: 'imported', actualizado: 'updated', omitido: 'skipped' }[estado];
  const upd = await query(
    `UPDATE migration_batches
        SET ${cuenta} = ${cuenta} + 1, consultations = consultations + $1
      WHERE id = $2 AND clinic_id = $3
      RETURNING imported, updated, skipped, failed, consultations`,
    [creadas.length, lote.id, clinicId],
  );

  res.json({
    estado,
    patient_id: p.patientId,
    consultas: creadas,
    // La forma antigua, para no romper nada que espere un solo id.
    consultation_id: creadas.length ? creadas[0].id : null,
    avisos: p.avisos,
    duplicado: previo ? { id: previo.id, name: previo.name } : null,
    totales: upd.rows[0] || totalesDe(lote),
  });
});

// ── Cierre del lote ─────────────────────────────────────────────────────────
router.post('/lotes/:id/cerrar', authenticate, soloClinica, async (req, res) => {
  const lote = await cargarLote(req, req.params.id);
  if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });

  const r = await query(
    `UPDATE migration_batches SET status = 'completado', finished_at = NOW()
      WHERE id = $1 AND clinic_id = $2 AND status = 'en_curso'
      RETURNING *`,
    [lote.id, req.user.clinic_id],
  );
  const cerrado = r.rows[0] || lote;

  auditoria.logAction({
    user_id: req.user.id,
    clinic_id: req.user.clinic_id,
    action: 'migracion.importar',
    status: 'success',
    tool_input: JSON.stringify({ lote: lote.id, origen: lote.source, archivo: lote.file_name }),
    tool_output: JSON.stringify(totalesDe(cerrado)),
  });

  res.json({ lote: aVista(cerrado) });
});

// ── Historial ───────────────────────────────────────────────────────────────
router.get('/lotes', authenticate, soloClinica, async (req, res) => {
  const r = await query(
    `SELECT b.*, u.name AS autor
       FROM migration_batches b
       LEFT JOIN users u ON u.id = b.created_by
      WHERE b.clinic_id = $1
      ORDER BY b.created_at DESC
      LIMIT 40`,
    [req.user.clinic_id],
  );
  const total = await query('SELECT COUNT(*)::int AS n FROM patients WHERE clinic_id = $1', [req.user.clinic_id]);
  res.json({ lotes: r.rows.map(aVista), pacientes_total: total.rows[0].n });
});

// ── Deshacer ────────────────────────────────────────────────────────────────
//
// Borra lo que escribió el lote y NADA más. Un paciente migrado que desde
// entonces tiene cita, consulta propia o consentimiento firmado ya no es "lo que
// escribió el lote": es un paciente de la clínica, y se queda. Se informa de
// cuántos se conservaron por eso — si no, parece que el deshacer falló.
router.post('/lotes/:id/revertir', authenticate, soloClinica, async (req, res) => {
  const lote = await cargarLote(req, req.params.id);
  if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
  if (lote.status === 'revertido') return res.status(409).json({ error: 'Este lote ya se revirtió' });

  const clinicId = req.user.clinic_id;

  const cons = await query(
    'DELETE FROM consultations WHERE migration_batch_id = $1 AND clinic_id = $2',
    [lote.id, clinicId],
  );

  const candidatos = await query(
    `SELECT p.id FROM patients p
      WHERE p.migration_batch_id = $1 AND p.clinic_id = $2
        AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM consultations c WHERE c.patient_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM patient_consents pc WHERE pc.patient_id = p.id)`,
    [lote.id, clinicId],
  );
  const borrables = candidatos.rows.map((r) => r.id);

  if (borrables.length) {
    await query('DELETE FROM critical_info WHERE patient_id = ANY($1::int[])', [borrables]);
    await query('DELETE FROM patients WHERE id = ANY($1::int[]) AND clinic_id = $2', [borrables, clinicId]);
  }

  const quedan = await query(
    'SELECT COUNT(*)::int AS n FROM patients WHERE migration_batch_id = $1 AND clinic_id = $2',
    [lote.id, clinicId],
  );

  const upd = await query(
    "UPDATE migration_batches SET status = 'revertido', reverted_at = NOW() WHERE id = $1 AND clinic_id = $2 RETURNING *",
    [lote.id, clinicId],
  );

  auditoria.logAction({
    user_id: req.user.id,
    clinic_id: clinicId,
    action: 'migracion.revertir',
    status: 'success',
    tool_input: JSON.stringify({ lote: lote.id }),
    tool_output: JSON.stringify({
      pacientes: borrables.length,
      consultas: cons.rowCount,
      conservados: quedan.rows[0].n,
    }),
  });

  res.json({
    lote: aVista(upd.rows[0] || lote),
    pacientes_borrados: borrables.length,
    consultas_borradas: cons.rowCount,
    pacientes_conservados: quedan.rows[0].n,
  });
});

// ── Piezas internas ─────────────────────────────────────────────────────────

function normalizarOpciones(o) {
  const op = o && typeof o === 'object' ? o : {};
  return {
    formatoFecha: ['dmy', 'mdy', 'iso'].includes(op.formatoFecha) ? op.formatoFecha : 'dmy',
    duplicados: POLITICAS.has(op.duplicados) ? op.duplicados : 'omitir',
    sobrescribir: !!op.sobrescribir,
    corregirMayusculas: !!op.corregirMayusculas,
    generarIdentidad: op.generarIdentidad !== false,
    costosPagados: op.costosPagados !== false,
    historiaEnExistentes: op.historiaEnExistentes !== false,
  };
}

function prepararFila(fila, opciones) {
  const crudo = fila && typeof fila === 'object' ? fila : {};
  const { valores, errores, avisos } = campos.validarFila(crudo, opciones);
  return {
    i: Number.isFinite(+crudo.__i) ? +crudo.__i : 0,
    valores,
    errores,
    avisos,
    claveIdentidad: campos.claveIdentidad(valores.identity_number),
    claveNombre: campos.claveNombre(valores.name),
    colaTelefono: campos.colaTelefono(valores.phone),
    patientId: null,
  };
}

// Número de expediente provisional para quien no traía identidad. Lleva dentro
// el lote, así que es único y además dice de dónde salió.
function asignarExpedientesProvisionales(filas, lote) {
  // El arranque es el total ya creado por el lote: el tramo anterior nunca gastó
  // más consecutivos que filas creó, así que los rangos no se pisan.
  let consecutivo = parseInt(lote.imported, 10) || 0;
  for (const p of filas) {
    if (!p.valores.identity_number) {
      consecutivo += 1;
      p.valores.identity_number = `MIG-${lote.id}-${String(consecutivo).padStart(4, '0')}`;
    }
  }
}

async function especialidadDe(doctorId, clinicId) {
  if (!doctorId) return '';
  const r = await query('SELECT specialty FROM users WHERE id = $1 AND clinic_id = $2', [doctorId, clinicId]);
  return (r.rows[0] && r.rows[0].specialty) || '';
}

// Busca en la clínica los pacientes que puedan ser los mismos que traen las
// filas. Dos redes, en este orden:
//   1. La identidad, comparada por su forma desnuda (sin guiones ni espacios).
//   2. Nombre + últimos 8 dígitos del teléfono, para el archivo de papel que
//      nunca apuntó la cédula.
// Dos consultas por tramo, no dos por fila.
async function buscarExistentes(clinicId, preparadas) {
  const identidades = [...new Set(preparadas.map((p) => p.claveIdentidad).filter(Boolean))];
  const porIdentidad = new Map();
  const porNombreTel = new Map();

  if (identidades.length) {
    const r = await query(
      `SELECT id, name, identity_number FROM patients
        WHERE clinic_id = $1
          AND upper(regexp_replace(identity_number, '[^A-Za-z0-9]', '', 'g')) = ANY($2::text[])`,
      [clinicId, identidades],
    );
    for (const row of r.rows) porIdentidad.set(campos.claveIdentidad(row.identity_number), row);
  }

  const conTelefono = preparadas.filter((p) => !p.claveIdentidad && p.colaTelefono && p.claveNombre);
  if (conTelefono.length) {
    const colas = [...new Set(conTelefono.map((p) => p.colaTelefono))];
    const r = await query(
      `SELECT id, name, identity_number, phone FROM patients
        WHERE clinic_id = $1
          AND right(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 8) = ANY($2::text[])`,
      [clinicId, colas],
    );
    for (const row of r.rows) {
      porNombreTel.set(`${campos.claveNombre(row.name)}|${campos.colaTelefono(row.phone)}`, row);
    }
  }

  return { porIdentidad, porNombreTel };
}

function emparejar(p, existentes) {
  if (p.claveIdentidad) {
    const hit = existentes.porIdentidad.get(p.claveIdentidad);
    return hit ? Object.assign({ __motivo: 'identidad' }, hit) : null;
  }
  if (p.claveNombre && p.colaTelefono) {
    const hit = existentes.porNombreTel.get(`${p.claveNombre}|${p.colaTelefono}`);
    if (hit) return Object.assign({ __motivo: 'nombre y teléfono' }, hit);
  }
  return null;
}

// `mezcla` decide, columna a columna: sin sobrescribir solo se rellena lo que
// estaba vacío (una migración no puede pisar lo que el doctor ya corrigió a
// mano); con sobrescribir gana el archivo, salvo que venga vacío.
async function actualizarPacientes(entradas, opciones, clinicId) {
  if (!entradas.length) return;
  const sobre = opciones.sobrescribir;
  const col = (k) => entradas.map(({ v }) => v[k]);
  const mezcla = (c) => (sobre
    ? `CASE WHEN d.${c} <> '' THEN d.${c} ELSE p.${c} END`
    : `CASE WHEN COALESCE(p.${c}, '') = '' THEN d.${c} ELSE p.${c} END`);

  await query(
    `UPDATE patients p SET
       name = ${sobre ? "CASE WHEN d.name <> '' THEN d.name ELSE p.name END" : 'p.name'},
       birth_date = ${mezcla('birth_date')},
       gender = ${mezcla('gender')},
       phone = ${mezcla('phone')},
       whatsapp_number = ${mezcla('whatsapp_number')},
       age = CASE WHEN COALESCE(p.age, 0) = 0 OR (${sobre} AND d.age > 0) THEN d.age ELSE p.age END
     FROM unnest($1::int[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::int[])
          AS d(id, name, birth_date, gender, phone, whatsapp_number, age)
     WHERE p.id = d.id AND p.clinic_id = $8`,
    [entradas.map(({ id }) => id), col('name'), col('birth_date'), col('gender'),
      col('phone'), col('whatsapp_number'), col('age'), clinicId],
  );
}

// critical_info tiene UNIQUE(patient_id), así que un solo INSERT … ON CONFLICT
// sirve igual para el alta y para la actualización. Siempre se escribe la fila,
// aunque venga vacía: es lo que hace también el alta normal de pacientes, y el
// banner de alerta médica cuenta con que exista.
async function guardarCritico(entradas, sobrescribir) {
  if (!entradas.length) return;
  const col = (k) => entradas.map(({ v }) => v[k]);
  const mezcla = (c) => (sobrescribir
    ? `CASE WHEN EXCLUDED.${c} <> '' THEN EXCLUDED.${c} ELSE critical_info.${c} END`
    : `CASE WHEN COALESCE(critical_info.${c}, '') = '' THEN EXCLUDED.${c} ELSE critical_info.${c} END`);

  await query(
    `INSERT INTO critical_info (patient_id, allergies, medications, conditions)
     SELECT d.patient_id, d.allergies, d.medications, d.conditions
       FROM unnest($1::int[], $2::text[], $3::text[], $4::text[])
            AS d(patient_id, allergies, medications, conditions)
     ON CONFLICT (patient_id) DO UPDATE SET
       allergies = ${mezcla('allergies')},
       medications = ${mezcla('medications')},
       conditions = ${mezcla('conditions')}`,
    [entradas.map(({ id }) => id), col('allergies'), col('medications'), col('conditions')],
  );
}

// Reimportar el mismo archivo no puede duplicar la historia. Para los pacientes
// que YA existían se miran sus consultas y se descarta la que ya esté guardada
// con la misma fecha y el mismo contenido. Los recién creados no necesitan la
// comprobación: acaban de nacer sin historia.
async function filtrarHistoriaNueva(conHistoria, idsPrevios, clinicId) {
  if (!conHistoria.length) return [];

  const yaGuardadas = new Set();

  if (idsPrevios.length) {
    const r = await query(
      `SELECT patient_id, to_char(created_at, 'YYYY-MM-DD') AS dia, diagnosis, treatment, notes
         FROM consultations WHERE clinic_id = $1 AND patient_id = ANY($2::int[])`,
      [clinicId, [...new Set(idsPrevios)]],
    );
    for (const row of r.rows) yaGuardadas.add(huellaConsulta(row.patient_id, row.dia, row));
  }

  // El mismo Set sigue creciendo con lo que se acepta, así que una fila
  // literalmente repetida dentro del propio archivo —misma persona, misma fecha,
  // mismo texto— tampoco entra dos veces. Sin esto, un historial exportado con
  // filas duplicadas metía la visita por duplicado en el expediente.
  return conHistoria.filter((p) => {
    const h = p.valores.historia;
    if (!h.date) return true; // sin fecha no hay con qué comparar: se guarda
    const huella = huellaConsulta(p.patientId, h.date, h);
    if (yaGuardadas.has(huella)) return false;
    yaGuardadas.add(huella);
    return true;
  });
}

async function insertarConsultas(filas, ctx) {
  const h = (k) => filas.map((p) => p.valores.historia[k]);
  await query(
    `INSERT INTO consultations
       (patient_id, notes, diagnosis, treatment, procedures, observations, visit_reason,
        cost, payment_status, specialty, doctor_id, clinic_id, migration_batch_id, created_at)
     SELECT d.patient_id, d.notes, d.diagnosis, d.treatment, d.procedures, d.observations,
            CASE WHEN d.visit_reason <> '' THEN d.visit_reason ELSE $10 END,
            d.cost,
            CASE WHEN d.cost <= 0 THEN 'paid'
                 WHEN $11::boolean THEN 'paid'
                 ELSE 'pending' END,
            $12, $13, $14, $15,
            COALESCE(NULLIF(d.dia, '')::timestamp, NOW())
       FROM unnest($1::int[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[],
                   $7::text[], $8::numeric[], $9::text[])
            AS d(patient_id, notes, diagnosis, treatment, procedures, observations,
                 visit_reason, cost, dia)`,
    [
      filas.map((p) => p.patientId),
      h('notes'), h('diagnosis'), h('treatment'), h('procedures'), h('observations'), h('visit_reason'),
      h('cost'), h('date'),
      MOTIVO_MIGRADO, ctx.costosPagados,
      ctx.especialidad, ctx.doctorId, ctx.clinicId, ctx.loteId,
    ],
  );
}

// Huella de una consulta para no duplicarla al reimportar. Fecha más los tres
// campos que de verdad la identifican; el texto se recorta y se aplana porque un
// salto de línea de más no debería convertirla en "otra".
function huellaConsulta(patientId, dia, h) {
  const t = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 160).toLowerCase();
  return `${patientId}|${dia}|${t(h.diagnosis)}|${t(h.treatment)}|${t(h.notes)}`;
}

// ── Por qué una consulta migrada SIN costo se marca como cobrada ──
//
// `payment_status` solo tiene dos valores, y 'pending' no significa "no tiene
// precio": significa "esto se le debe a la clínica". Finanzas › Pendientes de
// cobro lista TODAS las consultas en ese estado, sin filtro de fecha. Con
// 'pending' por defecto, migrar tres mil expedientes de historia llenaba la
// lista de cobros con tres mil visitas de hace años y cero lempiras cada una, y
// dejaba inservible la pantalla que usa la clínica para cobrar de verdad.
//
// Una consulta sin costo no tiene nada pendiente: 'paid' suma cero a los
// ingresos y no aparece donde no toca.
function estadoDePago(costo, migradosCobrados) {
  if (!(Number(costo) > 0)) return 'paid';
  return migradosCobrados ? 'paid' : 'pending';
}

function totalesDe(l) {
  return {
    imported: l.imported || 0,
    updated: l.updated || 0,
    skipped: l.skipped || 0,
    failed: l.failed || 0,
    consultations: l.consultations || 0,
  };
}

function aVista(l) {
  return {
    id: l.id,
    source: l.source,
    origin_label: l.origin_label || '',
    file_name: l.file_name || '',
    total_rows: l.total_rows || 0,
    status: l.status,
    autor: l.autor || '',
    created_at: l.created_at,
    finished_at: l.finished_at,
    reverted_at: l.reverted_at,
    ...totalesDe(l),
  };
}

module.exports = router;
