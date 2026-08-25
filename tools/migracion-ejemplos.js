// ── Archivos de ejemplo para probar Migrar Expedientes ──
//
//     node tools/migracion-ejemplos.js            → ./ejemplos-migracion/
//     node tools/migracion-ejemplos.js --out ~/Desktop/pruebas
//
// Genera cuatro archivos que se parecen a lo que llega de verdad, no a lo que
// sería cómodo. Cada uno estresa una parte distinta del lector:
//
//   1-medilink-pacientes.csv   separador ';', Windows-1252, dos líneas de
//                              adorno antes de la cabecera, fechas dd/mm/aaaa.
//                              Cinco pacientes traen VARIAS visitas, que es como
//                              exportan las fichas clínicas: una fila por visita.
//   2-dentalink-pacientes.xlsx Excel de verdad, con las fechas guardadas como
//                              número de serie (que es como las guarda Excel).
//   3-excel-propio.csv         separador ',', UTF-8 con BOM, saltos CRLF,
//                              nombres con coma dentro de comillas.
//   4-pegar-desde-excel.txt    separado por tabuladores, para la opción de
//                              copiar y pegar.
//
// Los cuatro llevan a propósito las mismas trampas que traen los archivos
// reales: una fila sin nombre, otra sin identidad, un paciente repetido, una
// fecha que no existe, un teléfono que Excel convirtió en notación científica y
// una columna de adorno que no debe mapearse a nada. Si la pantalla los digiere
// —marcando lo que hay que marcar— es que funciona.
//
// Ningún dato es de nadie: los nombres están inventados y las identidades no
// corresponden a ninguna persona real.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const outArg = process.argv.indexOf('--out');
const OUT = outArg !== -1
  ? path.resolve(process.argv[outArg + 1])
  : path.resolve(process.cwd(), 'ejemplos-migracion');

fs.mkdirSync(OUT, { recursive: true });

// ── Los datos ───────────────────────────────────────────────────────────────
// [nombre, identidad, nacimiento, sexo, teléfono, alergias, medicamentos,
//  diagnóstico, fecha consulta, notas, costo]
const PACIENTES = [
  ['MARIA ELENA LOPEZ CRUZ', '0801-1990-01234', '03/04/1990', 'F', '9988-7766', 'Penicilina', '', 'Onicomicosis', '12/02/2024', 'Refiere mejoría desde la última visita', '600'],
  ['Juan Carlos Pérez Andino', '0801-1985-05678', '15/11/1985', 'M', '3344-5566', 'Ninguna', 'Losartán 50mg', 'Uña encarnada', '05/03/2024', 'Control en 3 semanas', '800'],
  ['Ana Sofía Martínez', '', '22/07/2001', 'Femenino', '9911-2233', 'Látex', '', '', '', '', ''],
  ['Carlos Roberto Núñez', '0501-1978-04455', '30/09/1978', 'M', '8877-6655', '', 'Metformina 850mg', 'Pie diabético', '18/01/2024', 'Curación cada 48 horas. Control estricto de glicemia.', '1200'],
  ['Lucía Fernández Discua', '0801-1977-99887', '05/04/1977', 'F', '+504 9900-1122', 'Aspirina', 'Metformina', 'Diabetes tipo 2', '13/13/2024', 'La fecha de esta fila no existe: tiene que salir marcada', '350'],
  ['Rosa Amelia Meléndez', '0801-1992-11111', '18/06/1992', 'F', '9900-1122', '', '', 'Fascitis plantar', '04/03/2019', 'Plantillas indicadas', '450'],
  ['Pedro José Ramírez', '0801-1985-05678', '', 'M', '3344-5566', '', '', 'Espolón calcáneo', '01/01/2023', 'Repetido a propósito: misma identidad que Juan Carlos', '900'],
  ['', '0501-1999-00001', '01/01/1999', 'M', '', '', '', '', '', 'Sin nombre a propósito: no se puede importar', ''],
  ['Sandra Yolanda Cáceres', '0801-1996-33221', '11/12/1996', 'F', '5.04999e+10', 'Sulfas', '', 'Verruga plantar', '22/05/2023', 'Teléfono que Excel rompió: tiene que salir avisado', '500'],
  ['José Manuel Ordóñez', '0801-1970-77665', '25/02/1970', 'M', '9812-3456', '', 'Enalapril', 'Hiperqueratosis', '09/09/2022', '', '400'],
  ['Gabriela Nicole Zelaya', '0801-1998-55443', '14/08/1998', 'F', '3312-9988', 'Ibuprofeno', '', 'Uña encarnada', '17/06/2024', 'Segunda recidiva en el mismo dedo', '850'],
  ['Marvin Antonio Padilla', '0703-1982-11223', '07/07/1982', 'M', '9455-1122', '', '', 'Callosidad plantar', '28/11/2023', '', '350'],
  ['Delmy Suyapa Argueta', '0801-1965-88990', '19/03/1965', 'F', '9977-3322', 'Penicilina, mariscos', 'Levotiroxina', 'Pie plano', '02/10/2023', 'Derivada por su médico de cabecera', '600'],
  ['Óscar Rolando Bustillo', '0501-1988-66778', '30/05/1988', 'M', '8899-0011', '', '', 'Onicocriptosis', '14/04/2024', 'Cirugía menor realizada en consultorio', '1500'],
  ['Karla Michelle Interiano', '0801-2000-22334', '02/02/2000', 'F', '9123-4567', 'Ninguna conocida', '', 'Ampolla infectada', '21/07/2024', '', '300'],
  ['Nelson Eduardo Godoy', '0801-1974-44556', '16/10/1974', 'M', '3398-7766', '', 'Atorvastatina', 'Neuroma de Morton', '05/05/2023', 'Infiltración indicada, pendiente de programar', '1100'],
  ['Wendy Carolina Turcios', '0801-1993-99001', '23/01/1993', 'F', '9634-2211', 'Yodo', '', 'Micosis interdigital', '30/08/2024', '', '400'],
  ['Ramón Alberto Cerrato', '0601-1959-33445', '08/12/1959', 'M', '9788-5544', '', 'Insulina NPH', 'Úlcera diabética grado 1', '11/11/2023', 'Riesgo alto. Curaciones semanales.', '1800'],
  ['Iris Yamileth Mejía', '0801-1987-77889', '27/06/1987', 'F', '3245-6677', '', '', 'Talalgia', '19/02/2024', '', '450'],
  ['Fernando Alexis Chávez', '0801-1991-55667', '13/09/1991', 'M', '9522-3344', 'Latex', '', 'Onicomicosis', '06/06/2024', 'Tratamiento tópico 8 semanas', '700'],
];

// ── Visitas adicionales ──
// [identidad del paciente, diagnóstico, fecha, notas, costo]
// Repiten la cédula de alguien de la lista de arriba. En el archivo de verdad
// esto no es un error: es el historial, una fila por visita. La importación
// tiene que reconocer al paciente, NO duplicarlo, y colgarle cada consulta.
const VISITAS = [
  ['0801-1990-01234', 'Onicomicosis', '14/08/2023', 'Inicio de tratamiento tópico', '600'],
  ['0801-1990-01234', 'Onicomicosis', '02/11/2023', 'Mejoría parcial, se extiende 4 semanas', '350'],
  ['0801-1985-05678', 'Uña encarnada', '20/09/2023', 'Primera consulta por el mismo dedo', '800'],
  ['0801-1985-05678', 'Uña encarnada', '11/12/2023', 'Recidiva. Se propone cirugía menor.', '800'],
  ['0501-1978-04455', 'Pie diabético', '03/08/2023', 'Úlcera superficial, curación', '900'],
  ['0501-1978-04455', 'Pie diabético', '15/10/2023', 'Cierra la úlcera. Control en 2 meses.', '900'],
  ['0501-1978-04455', 'Pie diabético', '22/12/2023', 'Sin lesiones. Educación en calzado.', '450'],
  ['0801-1992-11111', 'Fascitis plantar', '19/09/2019', 'Revisión de plantillas', '300'],
  ['0801-1992-11111', 'Fascitis plantar', '07/02/2020', 'Alta. Sin dolor matutino.', '300'],
  ['0801-1996-33221', 'Verruga plantar', '10/07/2023', 'Segunda sesión de crioterapia', '500'],
];

// Cada visita se escribe como una fila completa del archivo: los sistemas que
// exportan el historial repiten los datos del paciente en todas sus líneas.
function filaDeVisita(visita) {
  const dueno = PACIENTES.find((p) => p[1] === visita[0]);
  return [dueno[0], dueno[1], dueno[2], dueno[3], dueno[4], dueno[5], dueno[6],
    visita[1], visita[2], visita[3], visita[4]];
}

const CABECERAS_MEDILINK = [
  'Nombres y Apellidos', 'Cédula', 'F. Nac.', 'Sexo', 'Celular',
  'Alergias del paciente', 'Medicamentos que toma', 'Diagnóstico',
  'Fecha de la consulta', 'Notas', 'Estado', 'Costo',
];

// La columna 'Estado' se cuela en medio a propósito: no debe mapearse a nada.
function filaMedilink(p) {
  return [p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], p[9], 'Activo', p[10]];
}

// ── 1. CSV estilo Medilink ──────────────────────────────────────────────────
{
  const lineas = [
    'Reporte de Pacientes - Clínica Ejemplo',
    'Generado el 12/03/2024 por el usuario admin',
    '',
    CABECERAS_MEDILINK.join(';'),
    ...PACIENTES.map((p) => filaMedilink(p).join(';')),
    ...VISITAS.map((v) => filaMedilink(filaDeVisita(v)).join(';')),
  ];
  // latin1 == Windows-1252 para todo lo que aparece aquí. Es la codificación que
  // usan de verdad estas exportaciones, y la que rompe los acentos si el lector
  // asume UTF-8 a ciegas.
  fs.writeFileSync(path.join(OUT, '1-medilink-pacientes.csv'), Buffer.from(lineas.join('\r\n'), 'latin1'));
}

// ── 3. CSV propio de la clínica ─────────────────────────────────────────────
{
  const cab = ['Paciente', 'No. Identidad', 'Cel', 'Fecha nacimiento', 'Sexo', 'Alergias', 'Observaciones'];
  const comilla = (v) => (/[",;\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : v);
  const filas = PACIENTES.map((p) => {
    // Apellido primero y con coma: el caso que rompe a quien parte por comas
    // sin mirar las comillas.
    const partes = p[0].split(' ');
    const nombre = partes.length > 1 ? `${partes.slice(-1)}, ${partes.slice(0, -1).join(' ')}` : p[0];
    return [nombre, p[1], p[4], p[2], p[3], p[5], p[9]].map(comilla).join(',');
  });
  const texto = '﻿' + [cab.join(','), ...filas].join('\r\n');
  fs.writeFileSync(path.join(OUT, '3-excel-propio.csv'), texto, 'utf8');
}

// ── 4. Para pegar ───────────────────────────────────────────────────────────
{
  const cab = ['Nombre completo', 'Identidad', 'Teléfono', 'Fecha de nacimiento', 'Diagnóstico'];
  const filas = PACIENTES.slice(0, 10).map((p) => [p[0], p[1], p[4], p[2], p[7]].join('\t'));
  fs.writeFileSync(path.join(OUT, '4-pegar-desde-excel.txt'), [cab.join('\t'), ...filas].join('\n'), 'utf8');
}

// ── 2. XLSX de verdad ───────────────────────────────────────────────────────
//
// Se escribe el ZIP a mano (deflate + CRC32, los dos en zlib) por la misma razón
// que el lector lo abre a mano: no meter una dependencia de 900 KB para una
// pantalla que se usa una vez. Y sirve de contraste: el archivo lo construye
// este código y lo lee otro distinto, así que si se entienden es que el formato
// está bien interpretado por los dos lados.

function serialExcel(ddmmaaaa) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmaaaa || '');
  if (!m) return null;
  const ms = Date.UTC(+m[3], +m[2] - 1, +m[1]);
  return Math.round(ms / 86400000) + 25569; // 25569 = 1970-01-01 en serial Excel
}

function col(n) {
  let s = '';
  let x = n + 1;
  while (x) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

const escXml = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function construirXlsx() {
  const cab = ['Nombre del paciente', 'Identidad', 'Fecha de nacimiento', 'Sexo',
    'Teléfono', 'Alergias', 'Diagnóstico', 'Fecha', 'Tratamiento', 'Sucursal'];

  const compartidas = [];
  const idx = (v) => {
    let i = compartidas.indexOf(v);
    if (i === -1) { compartidas.push(v); i = compartidas.length - 1; }
    return i;
  };

  const filasXml = [];
  filasXml.push('<row r="1">' + cab.map((h, j) =>
    `<c r="${col(j)}1" t="s"><v>${idx(h)}</v></c>`).join('') + '</row>');

  PACIENTES.forEach((p, k) => {
    const r = k + 2;
    // Las dos columnas de fecha van como NÚMERO con estilo de fecha, que es como
    // las guarda Excel. Sin leer styles.xml, aquí saldría "32874".
    const valores = [
      { t: 's', v: p[0] },
      { t: 's', v: p[1] },
      { t: 'd', v: serialExcel(p[2]) },
      { t: 's', v: p[3] },
      { t: 's', v: p[4] },
      { t: 's', v: p[5] },
      { t: 's', v: p[7] },
      { t: 'd', v: serialExcel(p[8]) },
      { t: 's', v: p[9] },
      { t: 's', v: 'Sede Central' },
    ];
    const celdas = valores.map((celda, j) => {
      const ref = `${col(j)}${r}`;
      if (celda.t === 'd') {
        return celda.v == null ? '' : `<c r="${ref}" s="1"><v>${celda.v}</v></c>`;
      }
      if (celda.v === '' || celda.v == null) return '';
      return `<c r="${ref}" t="s"><v>${idx(String(celda.v))}</v></c>`;
    }).join('');
    filasXml.push(`<row r="${r}">${celdas}</row>`);
  });

  const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<sheetData>' + filasXml.join('') + '</sheetData></worksheet>';

  const sst = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${compartidas.length}" uniqueCount="${compartidas.length}">`
    + compartidas.map((v) => `<si><t xml:space="preserve">${escXml(v)}</t></si>`).join('')
    + '</sst>';

  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<numFmts count="1"><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>'
    + '<cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="165" applyNumberFormat="1"/></cellXfs>'
    + '</styleSheet>';

  const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<sheets><sheet name="Pacientes" sheetId="1" r:id="rId1"/></sheets></workbook>';

  const wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'
    + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    + '</Relationships>';

  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '</Types>';

  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>';

  return zip([
    ['[Content_Types].xml', contentTypes],
    ['_rels/.rels', rootRels],
    ['xl/workbook.xml', workbook],
    ['xl/_rels/workbook.xml.rels', wbRels],
    ['xl/sharedStrings.xml', sst],
    ['xl/styles.xml', styles],
    ['xl/worksheets/sheet1.xml', sheet],
  ]);
}

function zip(archivos) {
  const locales = [];
  const central = [];
  let offset = 0;

  for (const [nombre, contenido] of archivos) {
    const crudo = Buffer.from(contenido, 'utf8');
    const comprimido = zlib.deflateRawSync(crudo, { level: 6 });
    const crc = zlib.crc32(crudo);
    const nombreBuf = Buffer.from(nombre, 'utf8');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // versión necesaria
    local.writeUInt16LE(0, 6);           // sin banderas
    local.writeUInt16LE(8, 8);           // deflate
    local.writeUInt16LE(0, 10);          // hora
    local.writeUInt16LE(0x2821, 12);     // fecha (2000-01-01)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(crudo.length, 22);
    local.writeUInt16LE(nombreBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locales.push(local, nombreBuf, comprimido);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0x2821, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(comprimido.length, 20);
    cd.writeUInt32LE(crudo.length, 24);
    cd.writeUInt16LE(nombreBuf.length, 28);
    cd.writeUInt16LE(0, 30);             // extra
    cd.writeUInt16LE(0, 32);             // comentario
    cd.writeUInt16LE(0, 34);             // disco
    cd.writeUInt16LE(0, 36);             // atributos internos
    cd.writeUInt32LE(0, 38);             // atributos externos
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nombreBuf);

    offset += 30 + nombreBuf.length + comprimido.length;
  }

  const cuerpoCentral = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(archivos.length, 8);
  eocd.writeUInt16LE(archivos.length, 10);
  eocd.writeUInt32LE(cuerpoCentral.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...locales, cuerpoCentral, eocd]);
}

fs.writeFileSync(path.join(OUT, '2-dentalink-pacientes.xlsx'), construirXlsx());

// ── Guía ────────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(OUT, 'LEEME.txt'), `ARCHIVOS DE EJEMPLO — Migrar Expedientes
========================================

Arrástralos a la pantalla Migrar Expedientes (AJUSTES → Migrar Expedientes).
Ninguno lleva datos de personas reales.

1-medilink-pacientes.csv
    Lo que exporta un sistema clínico: separador ";", acentos en
    Windows-1252 y dos líneas de adorno antes de la cabecera.
    Elige el origen "Archivo de otro sistema".

    OJO: trae 30 filas para 19 pacientes. Cinco de ellos tienen VARIAS
    visitas, cada una en su propia fila con la misma cédula repetida —que
    es como exportan el historial estos sistemas—. Sirve para comprobar
    que el expediente NO se duplica y que aun así se le añaden todas sus
    consultas.

2-dentalink-pacientes.xlsx
    Excel de verdad. Las dos columnas de fecha van guardadas como número
    de serie: si en la revisión ves fechas y no números de cinco cifras,
    el lector de Excel está haciendo su trabajo.
    Trae una columna "Sucursal" que NO debe mapearse a nada.

3-excel-propio.csv
    La hoja que lleva la clínica a mano. Cabeceras caseras ("Paciente",
    "No. Identidad", "Cel") y nombres escritos "Apellido, Nombre" — con la
    coma dentro del nombre, que es lo que rompe a los lectores flojos.

4-pegar-desde-excel.txt
    Ábrelo, selecciona todo, copia, y en la pantalla elige
    "Pegar desde Excel o Sheets".

QUÉ TIENE QUE PASAR
-------------------
Los tres archivos llevan las mismas trampas a propósito. En el paso 3
(Revisar) tienen que salir marcadas así:

  · 1 fila CON ERROR      → la que no tiene nombre. No se importa.
  · 11 filas DUPLICADAS   → Pedro José Ramírez (repite la cédula de Juan
                            Carlos Pérez) más las 10 visitas adicionales.
                            En la revisión tienen que decir "otra visita
                            del mismo paciente: se suma a su historial",
                            NO "repetida".
  · Ana Sofía Martínez    → aviso: sin identidad, se le dará un número
                            de expediente provisional.
  · Lucía Fernández       → aviso: 13/13/2024 no existe, la consulta se
                            registrará con la fecha de hoy.
  · Sandra Yolanda        → aviso: el teléfono venía en notación
                            científica (5.04999e+10).
  · La columna "Estado" / "Sucursal" → sin asignar, en gris.

Si eso es lo que ves, la lectura y la validación funcionan.

PARA PROBAR LA IMPORTACIÓN DE VERDAD
------------------------------------
Importa y abre en Pacientes a estos tres, que son los que traen
historial de varias visitas:

  Carlos Roberto Núñez   → 4 consultas (2023-08, 2023-10, 2023-12, 2024-01)
  MARIA ELENA LOPEZ CRUZ → 3 consultas (2023-08, 2023-11, 2024-02)
  Rosa Amelia Meléndez   → 3 consultas (2019-03, 2019-09, 2020-02)

Cada consulta tiene que aparecer con SU fecha original, no con la de hoy.

Después pulsa "Deshacer esta importación": vuelve todo a como estaba.

Y si vuelves a importar el mismo archivo encima, no debe duplicarse ni un
paciente ni una consulta.
`);

console.log(`Listo. ${fs.readdirSync(OUT).length} archivos en:\n  ${OUT}\n`);
for (const f of fs.readdirSync(OUT).sort()) {
  console.log('  ' + f.padEnd(32) + fs.statSync(path.join(OUT, f)).size + ' bytes');
}
