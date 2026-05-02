const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const { Readable } = require('stream');

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
  const queryStr = `SELECT * FROM consent_templates WHERE clinic_id = $1 ORDER BY created_at DESC`;
  const result = await query(queryStr, [req.user.clinic_id]);
  res.json(result.rows);
});

router.post('/templates', authenticate, async (req, res) => {
  const { type, title, description } = req.body;
  if (!type || !title || !description) {
    return res.status(400).json({ error: 'type, title y description son requeridos' });
  }

  try {
    const result = await query(
      'INSERT INTO consent_templates (clinic_id, type, title, description) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.user.clinic_id, type, title, description]
    );

    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error('Error creating template:', err);
    res.status(400).json({ error: err.message || 'Error al crear plantilla' });
  }
});

router.get('/templates/:id', authenticate, async (req, res) => {
  const result = await query('SELECT * FROM consent_templates WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
  res.json(result.rows[0]);
});

router.put('/templates/:id', authenticate, async (req, res) => {
  const { title, description, type } = req.body;
  const result = await query('SELECT * FROM consent_templates WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });

  await query('UPDATE consent_templates SET title = $1, description = $2, type = $3 WHERE id = $4',
    [title, description, type, req.params.id]);
  res.json({ success: true });
});

router.delete('/templates/:id', authenticate, async (req, res) => {
  const result = await query('SELECT * FROM consent_templates WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });

  await query('DELETE FROM consent_templates WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

router.get('/templates/:id/download', authenticate, async (req, res) => {
  const result = await query('SELECT * FROM consent_templates WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });

  const template = result.rows[0];
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${template.title}.pdf"`);

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
  let queryStr = `SELECT pc.*, t.type, t.title, t.description, p.name as patient_name FROM patient_consents pc
    JOIN consent_templates t ON pc.template_id = t.id
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
  const result = await query('SELECT pc.*, t.type, t.title, t.description, p.name as patient_name FROM patient_consents pc JOIN consent_templates t ON pc.template_id = t.id JOIN patients p ON pc.patient_id = p.id WHERE pc.id = $1 AND pc.clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Consent not found' });
  res.json(result.rows[0]);
});

router.put('/:id', authenticate, async (req, res) => {
  const { status, signed_by, signature_data } = req.body;
  const result = await query('SELECT * FROM patient_consents WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Consent not found' });

  let updateQuery = 'UPDATE patient_consents SET status = $1, signed_by = $2';
  const params = [status, signed_by, req.params.id];

  if (signature_data) {
    updateQuery += ', signature_data = $3 WHERE id = $4';
    params[2] = signature_data;
    params[3] = req.params.id;
  } else {
    updateQuery += ' WHERE id = $3';
  }

  await query(updateQuery, params);
  res.json({ success: true });
});

router.delete('/:id', authenticate, async (req, res) => {
  const result = await query('SELECT * FROM patient_consents WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Consent not found' });

  await query('DELETE FROM patient_consents WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
