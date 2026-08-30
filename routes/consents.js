const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const { Readable } = require('stream');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const cloudinary = require('cloudinary').v2;

function stripHtml(html) {
  // Remove script and style tags with their content
  let result = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  result = result.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Convert paragraph and break tags to newlines
  result = result.replace(/<\/p>/g, '\n');
  result = result.replace(/<\/div>/g, '\n');
  result = result.replace(/<br\s*\/?>/gi, '\n');

  // Remove all HTML tags but keep content
  result = result.replace(/<[^>]+>/g, '');

  // Decode HTML numeric entities first (&#95; for underscore, etc.)
  result = result.replace(/&#(\d+);/g, (match, dec) => {
    return String.fromCharCode(parseInt(dec, 10));
  });
  result = result.replace(/&#x([a-fA-F0-9]+);/g, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  // Decode HTML named entities
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&nbsp;': ' ',
    '&#39;': "'",
    '&apos;': "'"
  };

  Object.entries(entities).forEach(([entity, char]) => {
    result = result.split(entity).join(char);
  });

  // Clean up excessive newlines but preserve content
  result = result.replace(/\n\n+/g, '\n');

  // Convert sequences of spaces (likely from underlined fields) to underscores
  result = result.replace(/\s{4,}/g, (match) => {
    return '_'.repeat(match.length);
  });

  return result;
}

// Templates endpoints
router.get('/templates', authenticate, async (req, res) => {
  const queryStr = `SELECT * FROM consent_templates WHERE clinic_id = $1 AND doctor_id = $2 ORDER BY created_at DESC`;
  const result = await query(queryStr, [req.user.clinic_id, req.user.id]);
  res.json(result.rows);
});

router.post('/templates', authenticate, async (req, res) => {
  const { type, title, description } = req.body;
  if (!type || !title || !description) {
    return res.status(400).json({ error: 'type, title y description son requeridos' });
  }

  try {
    const result = await query(
      'INSERT INTO consent_templates (clinic_id, doctor_id, type, title, description) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.user.clinic_id, req.user.id, type, title, description]
    );

    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error('Error creating template:', err);
    res.status(400).json({ error: err.message || 'Error al crear plantilla' });
  }
});

router.get('/templates/:id', authenticate, async (req, res) => {
  const result = await query('SELECT * FROM consent_templates WHERE id = $1 AND clinic_id = $2 AND doctor_id = $3',
    [req.params.id, req.user.clinic_id, req.user.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
  res.json(result.rows[0]);
});

router.put('/templates/:id', authenticate, async (req, res) => {
  const { title, description, type } = req.body;
  const result = await query('SELECT * FROM consent_templates WHERE id = $1 AND clinic_id = $2 AND doctor_id = $3',
    [req.params.id, req.user.clinic_id, req.user.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });

  await query('UPDATE consent_templates SET title = $1, description = $2, type = $3 WHERE id = $4',
    [title, description, type, req.params.id]);
  res.json({ success: true });
});

router.delete('/templates/:id', authenticate, async (req, res) => {
  const result = await query('SELECT * FROM consent_templates WHERE id = $1 AND clinic_id = $2 AND doctor_id = $3',
    [req.params.id, req.user.clinic_id, req.user.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });

  await query('DELETE FROM consent_templates WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

router.get('/templates/:id/download', authenticate, async (req, res) => {
  const result = await query('SELECT * FROM consent_templates WHERE id = $1 AND clinic_id = $2 AND doctor_id = $3',
    [req.params.id, req.user.clinic_id, req.user.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });

  const template = result.rows[0];
  const doc = new PDFDocument({ margin: 50 });

  // Sanitizar el filename para evitar CRLF/header injection y caracteres conflictivos.
  const safeFilename = String(template.title || 'consentimiento')
    .replace(/[\r\n"\\\/]/g, '')
    .replace(/[^\w\s().,-]/g, '_')
    .slice(0, 120) || 'consentimiento';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.pdf"`);

  doc.pipe(res);

  doc.fontSize(18).font('Helvetica-Bold').text(template.title, { align: 'center' });
  doc.moveDown(0.5);

  const cleanDescription = stripHtml(template.description);
  const lines = cleanDescription.split('\n');
  doc.fontSize(11).font('Helvetica');
  lines.forEach(line => {
    if (line.trim()) {
      doc.text(line, { align: 'left' });
    } else {
      doc.moveDown(0.3);
    }
  });

  doc.moveDown(1);
  doc.fontSize(10).text('_______________________________', { align: 'center' });
  doc.text('Firma del Paciente', { align: 'center' });
  doc.moveDown(0.5);
  doc.text('Fecha: ___________________', { align: 'center' });

  doc.end();
});

// Patient consents endpoints (assign template to patient)
router.get('/', authenticate, async (req, res) => {
  // LEFT JOIN sobre la plantilla: un consentimiento firmado en papel puede no
  // tener plantilla cargada en la app (solo la foto del documento). Con el JOIN
  // interno de antes esas filas desaparecían del listado.
  let queryStr = `SELECT pc.*, t.type, COALESCE(t.title, 'Consentimiento en papel') AS title, t.description,
    p.name as patient_name FROM patient_consents pc
    LEFT JOIN consent_templates t ON pc.template_id = t.id
    JOIN patients p ON pc.patient_id = p.id
    WHERE pc.clinic_id = $1
    ORDER BY pc.created_at DESC`;
  const params = [req.user.clinic_id];

  const result = await query(queryStr, params);
  res.json(result.rows);
});

router.post('/', authenticate, async (req, res) => {
  const { patient_id, template_id, signed_by } = req.body;
  if (!patient_id || !template_id) {
    return res.status(400).json({ error: 'patient_id y template_id son requeridos' });
  }

  const patientResult = await query('SELECT * FROM patients WHERE id = $1 AND clinic_id = $2',
    [patient_id, req.user.clinic_id]);
  if (patientResult.rows.length === 0) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  const templateResult = await query('SELECT * FROM consent_templates WHERE id = $1 AND clinic_id = $2',
    [template_id, req.user.clinic_id]);
  if (templateResult.rows.length === 0) {
    return res.status(404).json({ error: 'Template not found' });
  }

  const result = await query(
    'INSERT INTO patient_consents (patient_id, template_id, clinic_id, signed_by) VALUES ($1, $2, $3, $4) RETURNING id',
    [patient_id, template_id, req.user.clinic_id, signed_by || '']
  );

  res.json({ id: result.rows[0].id });
});

router.get('/:id', authenticate, async (req, res) => {
  const result = await query("SELECT pc.*, t.type, COALESCE(t.title, 'Consentimiento en papel') AS title, t.description, p.name as patient_name FROM patient_consents pc LEFT JOIN consent_templates t ON pc.template_id = t.id JOIN patients p ON pc.patient_id = p.id WHERE pc.id = $1 AND pc.clinic_id = $2",
    [req.params.id, req.user.clinic_id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Consent not found' });
  res.json(result.rows[0]);
});

router.put('/:id', authenticate, async (req, res) => {
  const { status, signed_by, signature_data } = req.body;
  const result = await query('SELECT * FROM patient_consents WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Consent not found' });

  if (signature_data) {
    await query(
      'UPDATE patient_consents SET status = $1, signed_by = $2, signature_data = $3 WHERE id = $4 AND clinic_id = $5',
      [status, signed_by, signature_data, req.params.id, req.user.clinic_id]
    );
  } else {
    await query(
      'UPDATE patient_consents SET status = $1, signed_by = $2 WHERE id = $3 AND clinic_id = $4',
      [status, signed_by, req.params.id, req.user.clinic_id]
    );
  }
  res.json({ success: true });
});

router.delete('/:id', authenticate, async (req, res) => {
  const result = await query('SELECT * FROM patient_consents WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Consent not found' });

  await query('DELETE FROM patient_consents WHERE id = $1 AND clinic_id = $2', [req.params.id, req.user.clinic_id]);
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Consentimiento firmado en PAPEL
// ─────────────────────────────────────────────────────────────────────────────
// Muchas clínicas siguen firmando el consentimiento en hoja impresa. Aquí se
// sube la foto (o el escaneo en PDF) de ese documento firmado y queda colgado
// del paciente igual que una firma hecha en pantalla: el consentimiento existe
// en el expediente, con su fecha, y la consulta lo referencia por consent_id.
//
// Dos decisiones que no son obvias:
//   · La plantilla es OPCIONAL. Una clínica de papel normalmente no tiene sus
//     hojas cargadas como plantilla en la app; exigirla dejaba fuera justo al
//     caso que esto viene a resolver.
//   · Un solo endpoint crea la fila y sube el archivo. Separarlo en dos
//     peticiones dejaba consentimientos huérfanos —fila creada, subida fallida—
//     que en el expediente se leen como "consentimiento registrado" sin nada
//     detrás.

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Rechazo de tipo con código propio: sin él multer entrega un Error pelado y el
// manejador global lo convierte en "Internal server error" (mismo motivo que en
// routes/consultations.js).
function tipoNoPermitido(mensaje) {
  const err = new Error(mensaje);
  err.code = 'INVALID_FILE_TYPE';
  return err;
}

const MIMES_DOCUMENTO = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (MIMES_DOCUMENTO.includes(String(file.mimetype || '').toLowerCase())) return cb(null, true);
    cb(tipoNoPermitido('Solo se permiten imágenes (JPEG, PNG, WebP) o PDF'));
  }
});

const subirDocumento = (buffer, publicId, folder) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    { public_id: publicId, folder, resource_type: 'auto' },
    (err, result) => (err ? reject(err) : resolve(result))
  );
  stream.end(buffer);
});

// Borra el archivo anterior en Cloudinary. Nunca tumba la petición: si falla, lo
// que queda es un archivo suelto en Cloudinary, no un consentimiento sin foto.
async function borrarDeCloudinary(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (e) {
    console.warn('[consents] no se pudo borrar el documento anterior:', e && e.message);
  }
}

async function nombreDelUsuario(userId) {
  try {
    const r = await query('SELECT name FROM users WHERE id = $1', [userId]);
    return (r.rows[0] && r.rows[0].name) || '';
  } catch {
    return '';
  }
}

// POST /api/consents/paper — sube el consentimiento firmado en papel.
// Campos: document (archivo), patient_id, template_id? , consent_id?, signed_by?
// Con consent_id reemplaza el documento de un consentimiento ya existente; sin
// él crea uno nuevo.
router.post('/paper', authenticate, documentUpload.single('document'), async (req, res) => {
  const file = req.file;
  if (!file || !file.buffer || !file.buffer.length) {
    return res.status(400).json({ error: 'No se recibió ningún archivo' });
  }

  const patientId = parseInt(req.body.patient_id, 10);
  const templateId = req.body.template_id ? parseInt(req.body.template_id, 10) : null;
  const consentId = req.body.consent_id ? parseInt(req.body.consent_id, 10) : null;
  if (!patientId) return res.status(400).json({ error: 'patient_id es requerido' });

  const paciente = await query('SELECT id FROM patients WHERE id = $1 AND clinic_id = $2',
    [patientId, req.user.clinic_id]);
  if (paciente.rows.length === 0) return res.status(404).json({ error: 'Patient not found' });

  if (templateId) {
    const plantilla = await query('SELECT id FROM consent_templates WHERE id = $1 AND clinic_id = $2',
      [templateId, req.user.clinic_id]);
    if (plantilla.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
  }

  let previo = null;
  if (consentId) {
    const existente = await query(
      'SELECT * FROM patient_consents WHERE id = $1 AND clinic_id = $2 AND patient_id = $3',
      [consentId, req.user.clinic_id, patientId]
    );
    if (existente.rows.length === 0) return res.status(404).json({ error: 'Consent not found' });
    previo = existente.rows[0];
  }

  const firmadoPor = (req.body.signed_by || '').toString().trim() || await nombreDelUsuario(req.user.id);
  const nombreArchivo = String(file.originalname || 'consentimiento').slice(0, 200);

  try {
    const publicId = `${Date.now()}-${uuid()}`;
    const subida = await subirDocumento(file.buffer, publicId, `consents/${req.user.clinic_id}/${patientId}`);

    let fila;
    if (previo) {
      const publicIdAnterior = previo.document_public_id;
      const upd = await query(
        `UPDATE patient_consents
         SET document_url = $1, document_name = $2, document_public_id = $3,
             document_uploaded_at = CURRENT_TIMESTAMP, status = 'signed',
             signed_by = COALESCE(NULLIF($4, ''), signed_by),
             template_id = COALESCE($5, template_id)
         WHERE id = $6 AND clinic_id = $7
         -- Columnas explícitas: con RETURNING * volvía también signature_data,
         -- que es la firma en base64 y pesa más que la respuesta entera.
         RETURNING id, patient_id, template_id, clinic_id, signed_by, status,
                   document_url, document_name, document_public_id, document_uploaded_at`,
        [subida.secure_url, nombreArchivo, subida.public_id, firmadoPor, templateId, previo.id, req.user.clinic_id]
      );
      fila = upd.rows[0];
      await borrarDeCloudinary(publicIdAnterior);
    } else {
      const ins = await query(
        `INSERT INTO patient_consents
           (patient_id, template_id, clinic_id, signed_by, status,
            document_url, document_name, document_public_id, document_uploaded_at)
         VALUES ($1, $2, $3, $4, 'signed', $5, $6, $7, CURRENT_TIMESTAMP)
         RETURNING id, patient_id, template_id, clinic_id, signed_by, status,
                   document_url, document_name, document_public_id, document_uploaded_at`,
        [patientId, templateId, req.user.clinic_id, firmadoPor,
         subida.secure_url, nombreArchivo, subida.public_id]
      );
      fila = ins.rows[0];
    }

    res.json(fila);
  } catch (err) {
    console.error('Error saving paper consent:', err);
    res.status(500).json({ error: 'No se pudo guardar el consentimiento' });
  }
});

// DELETE /api/consents/:id/document — quita la foto sin borrar el
// consentimiento (puede tener además una firma hecha en pantalla).
router.delete('/:id/document', authenticate, async (req, res) => {
  const result = await query('SELECT * FROM patient_consents WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Consent not found' });

  // El identificador del archivo se guarda ANTES del UPDATE: después la fila ya
  // no lo tiene y no habría con qué borrarlo de Cloudinary.
  const publicIdAnterior = result.rows[0].document_public_id;
  await query(
    `UPDATE patient_consents
     SET document_url = NULL, document_name = NULL, document_public_id = NULL, document_uploaded_at = NULL
     WHERE id = $1 AND clinic_id = $2`,
    [req.params.id, req.user.clinic_id]
  );
  await borrarDeCloudinary(publicIdAnterior);
  res.json({ success: true });
});

module.exports = router;
