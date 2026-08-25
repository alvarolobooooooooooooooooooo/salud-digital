// ── Lector de archivos para la migración de expedientes ──
//
// Lee CSV y XLSX EN EL NAVEGADOR, sin subir el archivo a ningún sitio y sin
// cargar ninguna librería externa. Las dos cosas a propósito:
//
//   · Sin subir el archivo: lo que la clínica arrastra aquí es el padrón entero
//     de sus pacientes. Mientras la persona revisa el mapeo y corrige columnas,
//     esos datos no han salido de su computadora. Solo viaja lo que decide
//     importar, ya mapeado y validado.
//
//   · Sin librería externa: el CSP de la app no deja cargar scripts de CDNs que
//     no estén en la allowlist, y meter un parser de Excel de 900 KB en la
//     allowlist para una pantalla que se usa una vez es mal negocio. El .xlsx es
//     un ZIP con XML dentro, y el navegador ya sabe descomprimir
//     (DecompressionStream) y ya sabe leer XML (DOMParser).
//
// Lo que NO hace: fórmulas, varias hojas a la vez (se elige una), celdas
// combinadas. Un export de un sistema clínico no trae nada de eso.

(function (global) {
  'use strict';

  // ── CSV / texto delimitado ────────────────────────────────────────────────

  // El delimitador se detecta contando candidatos FUERA de comillas en las
  // primeras líneas. Contar a lo bruto falla en cuanto un campo trae una coma
  // dentro ("Pérez, Juan"), que es exactamente lo que traen los nombres.
  function detectarDelimitador(texto) {
    const muestra = texto.slice(0, 20000);
    const candidatos = [',', ';', '\t', '|'];
    const cuenta = candidatos.map(() => 0);
    let enComillas = false;
    let lineas = 0;

    for (let i = 0; i < muestra.length; i++) {
      const c = muestra[i];
      if (c === '"') {
        if (enComillas && muestra[i + 1] === '"') { i++; continue; }
        enComillas = !enComillas;
        continue;
      }
      if (enComillas) continue;
      if (c === '\n') {
        lineas++;
        if (lineas >= 12) break;
        continue;
      }
      const idx = candidatos.indexOf(c);
      if (idx >= 0) cuenta[idx]++;
    }

    let mejor = 0;
    for (let i = 1; i < candidatos.length; i++) if (cuenta[i] > cuenta[mejor]) mejor = i;
    return cuenta[mejor] > 0 ? candidatos[mejor] : ',';
  }

  /** Texto delimitado → matriz de celdas. Respeta comillas, CRLF y BOM. */
  function leerDelimitado(texto, delimitador) {
    let t = String(texto || '');
    if (t.charCodeAt(0) === 0xfeff) t = t.slice(1); // BOM de Excel
    const d = delimitador || detectarDelimitador(t);

    const filas = [];
    let fila = [];
    let celda = '';
    let enComillas = false;

    for (let i = 0; i < t.length; i++) {
      const c = t[i];

      if (enComillas) {
        if (c === '"') {
          if (t[i + 1] === '"') { celda += '"'; i++; }
          else enComillas = false;
        } else {
          celda += c;
        }
        continue;
      }

      if (c === '"' && celda === '') { enComillas = true; continue; }
      if (c === d) { fila.push(celda); celda = ''; continue; }
      if (c === '\r') continue;
      if (c === '\n') { fila.push(celda); filas.push(fila); fila = []; celda = ''; continue; }
      celda += c;
    }
    if (celda !== '' || fila.length) { fila.push(celda); filas.push(fila); }

    return { filas, delimitador: d };
  }

  // ── XLSX ──────────────────────────────────────────────────────────────────
  //
  // Un .xlsx es un ZIP. De dentro solo hacen falta cuatro archivos:
  //   xl/workbook.xml         → nombres de las hojas
  //   xl/_rels/workbook.xml.rels → a qué archivo corresponde cada hoja
  //   xl/sharedStrings.xml    → el texto (Excel lo guarda una vez y referencia)
  //   xl/styles.xml           → qué celdas son FECHAS
  //
  // El de estilos parece prescindible y es el más importante: Excel guarda las
  // fechas como número de días desde 1900. Sin mirar el formato de la celda, la
  // fecha de nacimiento de un paciente se importa como "32874".

  const FIRMA_EOCD = 0x06054b50;

  function leerZip(buffer) {
    const dv = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // El directorio central está al final; el comentario del ZIP (casi siempre
    // vacío) obliga a buscar la firma hacia atrás.
    let eocd = -1;
    const desde = Math.max(0, buffer.byteLength - 66000);
    for (let i = buffer.byteLength - 22; i >= desde; i--) {
      if (dv.getUint32(i, true) === FIRMA_EOCD) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('El archivo no parece un .xlsx válido (no se encontró el índice del ZIP).');

    const total = dv.getUint16(eocd + 10, true);
    const inicioCd = dv.getUint32(eocd + 16, true);
    if (inicioCd === 0xffffffff) {
      throw new Error('El archivo usa ZIP64 (demasiado grande). Guárdalo como CSV desde Excel e inténtalo de nuevo.');
    }

    const entradas = new Map();
    let p = inicioCd;
    for (let n = 0; n < total; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const metodo = dv.getUint16(p + 10, true);
      const compSize = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true);
      const extraLen = dv.getUint16(p + 30, true);
      const commentLen = dv.getUint16(p + 32, true);
      const offsetLocal = dv.getUint32(p + 42, true);
      const nombre = new TextDecoder('utf-8').decode(bytes.subarray(p + 46, p + 46 + nameLen));
      entradas.set(nombre, { metodo, compSize, offsetLocal });
      p += 46 + nameLen + extraLen + commentLen;
    }

    return { dv, bytes, entradas };
  }

  async function extraer(zip, nombre) {
    const e = zip.entradas.get(nombre);
    if (!e) return null;

    // La cabecera local repite el nombre y los extras con longitudes que pueden
    // NO coincidir con las del directorio central: hay que leerlas de aquí para
    // saber dónde empiezan de verdad los datos.
    const o = e.offsetLocal;
    if (zip.dv.getUint32(o, true) !== 0x04034b50) throw new Error('ZIP corrupto');
    const nameLen = zip.dv.getUint16(o + 26, true);
    const extraLen = zip.dv.getUint16(o + 28, true);
    const inicio = o + 30 + nameLen + extraLen;
    const crudo = zip.bytes.subarray(inicio, inicio + e.compSize);

    if (e.metodo === 0) return new TextDecoder('utf-8').decode(crudo);
    if (e.metodo !== 8) throw new Error('El .xlsx usa una compresión que este lector no entiende. Guárdalo como CSV.');

    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Este navegador no puede abrir .xlsx. Guarda el archivo como CSV desde Excel.');
    }
    // `slice()` copia: el stream necesita su propio buffer, no una vista sobre
    // el del archivo entero.
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([crudo.slice()]).stream().pipeThrough(ds);
    return await new Response(stream).text();
  }

  const XML = new DOMParser();
  function parsearXml(texto) {
    const doc = XML.parseFromString(texto, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('El .xlsx trae XML ilegible.');
    return doc;
  }

  // Formatos de número que Excel considera fecha. Los 14-22 y 45-47 son fijos;
  // los personalizados hay que mirarlos por dentro.
  const FMT_FECHA_FIJOS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

  function esFormatoFecha(codigo) {
    if (!codigo) return false;
    // Fuera el texto entre comillas y los bloques [..] (colores, condiciones),
    // que pueden traer letras que no significan nada de fecha.
    const limpio = String(codigo).replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '');
    return /[ymdhs]/i.test(limpio);
  }

  function columnaDeRef(ref) {
    // "BC12" → 54 (índice 0)
    let n = 0;
    for (let i = 0; i < ref.length; i++) {
      const c = ref.charCodeAt(i);
      if (c < 65 || c > 90) break;
      n = n * 26 + (c - 64);
    }
    return n - 1;
  }

  function serialAFecha(n) {
    // 25569 = días entre 1899-12-30 (época de Excel) y 1970-01-01.
    const ms = Math.round((n - 25569) * 86400000);
    const f = new Date(ms);
    if (isNaN(f)) return String(n);
    const p = (x) => String(x).padStart(2, '0');
    const fecha = `${f.getUTCFullYear()}-${p(f.getUTCMonth() + 1)}-${p(f.getUTCDate())}`;
    // Con parte horaria se conserva: alguna exportación guarda fecha y hora de
    // la consulta en la misma celda.
    const resto = n - Math.floor(n);
    if (resto > 0.0001) {
      const seg = Math.round(resto * 86400);
      return `${fecha} ${p(Math.floor(seg / 3600))}:${p(Math.floor((seg % 3600) / 60))}`;
    }
    return fecha;
  }

  async function leerXlsx(buffer) {
    const zip = leerZip(buffer);

    // Texto compartido.
    const compartidas = [];
    const ssXml = await extraer(zip, 'xl/sharedStrings.xml');
    if (ssXml) {
      const doc = parsearXml(ssXml);
      const sis = doc.getElementsByTagName('si');
      for (let i = 0; i < sis.length; i++) {
        // Un `si` puede venir partido en varios `t` (trozos con formato distinto
        // dentro de la misma celda): se concatenan todos.
        const ts = sis[i].getElementsByTagName('t');
        let s = '';
        for (let j = 0; j < ts.length; j++) s += ts[j].textContent;
        compartidas.push(s);
      }
    }

    // Estilos → qué índices de estilo son fecha.
    const estiloEsFecha = [];
    const stXml = await extraer(zip, 'xl/styles.xml');
    if (stXml) {
      const doc = parsearXml(stXml);
      const custom = new Map();
      const nf = doc.getElementsByTagName('numFmt');
      for (let i = 0; i < nf.length; i++) {
        custom.set(parseInt(nf[i].getAttribute('numFmtId'), 10), nf[i].getAttribute('formatCode') || '');
      }
      const xfs = doc.querySelector('cellXfs');
      if (xfs) {
        const hijos = xfs.getElementsByTagName('xf');
        for (let i = 0; i < hijos.length; i++) {
          const id = parseInt(hijos[i].getAttribute('numFmtId') || '0', 10);
          estiloEsFecha.push(FMT_FECHA_FIJOS.has(id) || esFormatoFecha(custom.get(id)));
        }
      }
    }

    // Hojas: nombre visible + archivo real.
    const rels = new Map();
    const relsXml = await extraer(zip, 'xl/_rels/workbook.xml.rels');
    if (relsXml) {
      const doc = parsearXml(relsXml);
      const rs = doc.getElementsByTagName('Relationship');
      for (let i = 0; i < rs.length; i++) {
        rels.set(rs[i].getAttribute('Id'), rs[i].getAttribute('Target'));
      }
    }

    const wbXml = await extraer(zip, 'xl/workbook.xml');
    if (!wbXml) throw new Error('El .xlsx no trae libro de trabajo.');
    const wb = parsearXml(wbXml);
    const hojasMeta = [];
    const sheets = wb.getElementsByTagName('sheet');
    for (let i = 0; i < sheets.length; i++) {
      const rid = sheets[i].getAttribute('r:id') || sheets[i].getAttributeNS?.('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      let destino = rels.get(rid) || `worksheets/sheet${i + 1}.xml`;
      destino = destino.replace(/^\/?xl\//, '').replace(/^\//, '');
      hojasMeta.push({ nombre: sheets[i].getAttribute('name') || `Hoja ${i + 1}`, archivo: 'xl/' + destino });
    }

    const hojas = [];
    for (const meta of hojasMeta) {
      const xml = await extraer(zip, meta.archivo);
      if (!xml) continue;
      hojas.push({ nombre: meta.nombre, filas: filasDeHoja(parsearXml(xml), compartidas, estiloEsFecha) });
    }

    if (!hojas.length) throw new Error('El .xlsx no trae ninguna hoja legible.');
    return hojas;
  }

  function filasDeHoja(doc, compartidas, estiloEsFecha) {
    const filas = [];
    const rows = doc.getElementsByTagName('row');
    for (let i = 0; i < rows.length; i++) {
      const celdas = [];
      const cs = rows[i].getElementsByTagName('c');
      for (let j = 0; j < cs.length; j++) {
        const c = cs[j];
        const ref = c.getAttribute('r') || '';
        const col = ref ? columnaDeRef(ref) : j;
        const tipo = c.getAttribute('t') || 'n';
        let valor = '';

        if (tipo === 's') {
          const v = c.getElementsByTagName('v')[0];
          const idx = v ? parseInt(v.textContent, 10) : -1;
          valor = compartidas[idx] != null ? compartidas[idx] : '';
        } else if (tipo === 'inlineStr') {
          const ts = c.getElementsByTagName('t');
          for (let k = 0; k < ts.length; k++) valor += ts[k].textContent;
        } else if (tipo === 'b') {
          const v = c.getElementsByTagName('v')[0];
          valor = v && v.textContent === '1' ? 'Sí' : 'No';
        } else {
          const v = c.getElementsByTagName('v')[0];
          const bruto = v ? v.textContent : '';
          const s = parseInt(c.getAttribute('s') || '-1', 10);
          const n = parseFloat(bruto);
          valor = (estiloEsFecha[s] && Number.isFinite(n) && n > 0) ? serialAFecha(n) : bruto;
        }

        while (celdas.length < col) celdas.push('');
        celdas[col] = valor;
      }
      filas.push(celdas);
    }
    return filas;
  }

  // ── De matriz a tabla con cabeceras ───────────────────────────────────────
  //
  // Los exports reales empiezan con líneas de adorno ("Reporte de pacientes",
  // "Generado el 12/03/2024", una fila vacía…). La cabecera es la primera fila
  // con al menos dos celdas con texto: elegir la primera fila a secas convertiría
  // el título del reporte en el nombre de la única columna.
  function aTabla(matriz) {
    let indiceCabecera = 0;
    for (let i = 0; i < Math.min(matriz.length, 15); i++) {
      const llenas = matriz[i].filter((c) => String(c || '').trim() !== '').length;
      if (llenas >= 2) { indiceCabecera = i; break; }
    }

    const crudas = matriz[indiceCabecera] || [];
    const cabeceras = crudas.map((c, i) => {
      const t = String(c == null ? '' : c).replace(/\s+/g, ' ').trim();
      return t || `Columna ${i + 1}`;
    });

    const filas = [];
    for (let i = indiceCabecera + 1; i < matriz.length; i++) {
      const f = matriz[i] || [];
      if (f.every((c) => String(c == null ? '' : c).trim() === '')) continue;
      const norm = [];
      for (let j = 0; j < cabeceras.length; j++) {
        norm.push(String(f[j] == null ? '' : f[j]).trim());
      }
      filas.push(norm);
    }

    return { cabeceras, filas, indiceCabecera };
  }

  // ── Entrada única ─────────────────────────────────────────────────────────

  async function leerArchivo(file) {
    const nombre = (file.name || '').toLowerCase();

    if (nombre.endsWith('.xlsx') || nombre.endsWith('.xlsm')) {
      const buf = await file.arrayBuffer();
      const hojas = await leerXlsx(buf);
      // Se elige la hoja con más filas: en los exports con varias pestañas, las
      // otras suelen ser leyendas o parámetros del reporte.
      const hoja = hojas.slice().sort((a, b) => b.filas.length - a.filas.length)[0];
      return Object.assign({ tipo: 'xlsx', hojas: hojas.map((h) => h.nombre), hoja: hoja.nombre }, aTabla(hoja.filas));
    }

    if (nombre.endsWith('.xls')) {
      throw new Error('El formato .xls (Excel 97-2003) no se puede leer aquí. Ábrelo en Excel y guárdalo como .xlsx o .csv.');
    }

    const texto = await leerTextoConCodificacion(file);
    if (!pareceTexto(texto)) {
      throw new Error('Este archivo no es una tabla de texto (parece un PDF, un documento o una imagen con la extensión cambiada). Exporta los pacientes como CSV o Excel.');
    }
    const { filas, delimitador } = leerDelimitado(texto);
    return Object.assign({ tipo: 'csv', delimitador }, aTabla(filas));
  }

  // Los sistemas clínicos de la región exportan CSV en Windows-1252 más a
  // menudo que en UTF-8. Se prueba UTF-8 estricto y, si el archivo lo viola
  // (acentos rotos), se relee como latino en vez de guardar "Mart�nez".
  //
  // El UTF-16 va antes que nada porque es lo que produce el "Texto Unicode
  // (*.txt)" de Excel, y leído como UTF-8 aparece como texto con un byte cero
  // entre cada letra: no falla, sale ilegible, que es peor.
  async function leerTextoConCodificacion(file) {
    const buf = await file.arrayBuffer();
    const b = new Uint8Array(buf);
    if (b.length >= 2) {
      if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf);
      if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(buf);
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch (_) {
      return new TextDecoder('windows-1252').decode(buf);
    }
  }

  // ── ¿Esto es una tabla o es otra cosa con la extensión cambiada? ──
  //
  // Windows-1252 decodifica CUALQUIER byte sin quejarse, así que un PDF, un
  // .docx o una foto renombrada a .csv se "leen" perfectamente y llegan al
  // mapeo con una columna cuyo nombre son cuatrocientos bytes de ruido. No
  // rompe nada, pero la persona se queda mirando una pantalla sin sentido sin
  // saber que el problema es el archivo.
  //
  // Los caracteres de control (fuera de tabulador y saltos de línea) no
  // aparecen en un archivo de texto de verdad; en uno binario son constantes.
  function pareceTexto(texto) {
    const muestra = texto.slice(0, 4000);
    if (!muestra.length) return true; // vacío: lo dirá el "no trae filas"
    let raros = 0;
    for (let i = 0; i < muestra.length; i++) {
      const c = muestra.charCodeAt(i);
      if (c === 9 || c === 10 || c === 13) continue;
      if (c < 32 || c === 0xfffd) raros++;
    }
    return raros / muestra.length < 0.05;
  }

  function leerPegado(texto) {
    const { filas, delimitador } = leerDelimitado(texto);
    return Object.assign({ tipo: 'pegado', delimitador }, aTabla(filas));
  }

  // ── Salida a CSV (plantilla y reporte de errores) ─────────────────────────

  function aCsv(filas) {
    const escapa = (v) => {
      const t = String(v == null ? '' : v);
      return /[",\n;]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    };
    return filas.map((f) => f.map(escapa).join(',')).join('\r\n');
  }

  function descargarCsv(nombreArchivo, filas) {
    // El BOM es lo que hace que Excel abra el archivo con los acentos bien.
    const blob = new Blob(['﻿' + aCsv(filas)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  global.MigracionLector = {
    leerArchivo,
    leerPegado,
    leerDelimitado,
    aTabla,
    aCsv,
    descargarCsv,
  };
})(window);
