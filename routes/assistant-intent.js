const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const { authenticate, requireRole } = require('../middleware/auth');

const VALID_INTENTS = [
  'GREETING',
  'HELP',
  'GET_TODAY_APPOINTMENTS',
  'GET_APPOINTMENTS_BY_DATE',
  'GET_NEXT_APPOINTMENT',
  'CHECK_AVAILABILITY',
  'SEARCH_PATIENT',
  'GET_PATIENT_SUMMARY',
  'GET_PATIENT_CONDITIONS',
  'GET_PATIENT_ALLERGIES',
  'CREATE_APPOINTMENT',
  'RESCHEDULE_APPOINTMENT',
  'CANCEL_APPOINTMENT',
  'MISSING_INFO',
  'UNKNOWN'
];

const ACTION_INTENTS = new Set([
  'CREATE_APPOINTMENT',
  'RESCHEDULE_APPOINTMENT',
  'CANCEL_APPOINTMENT'
]);

const SYSTEM_PROMPT = `Eres un clasificador de intención para un asistente médico en español (Honduras).
Tu única tarea: convertir lo que dice el doctor a JSON estructurado. NO ejecutas acciones, NO consultas datos, NO inventas información médica.

Devuelve SOLO un JSON válido con esta forma exacta:
{
  "intent": "<una de las intenciones permitidas>",
  "confidence": <número 0..1>,
  "params": { <parámetros extraídos> },
  "requires_confirmation": <true|false>,
  "missing_fields": [<lista de campos faltantes>],
  "assistant_reply": "<respuesta breve y natural en español>"
}

Intenciones permitidas:
- GREETING: saludos ("hola", "buenas")
- HELP: pide ayuda o capacidades ("¿en qué me ayudas?", "qué puedes hacer")
- GET_TODAY_APPOINTMENTS: citas de hoy
- GET_APPOINTMENTS_BY_DATE: citas de fecha específica. params: { date: "YYYY-MM-DD" | "tomorrow" | "today" | "<día semana>" }
- GET_NEXT_APPOINTMENT: próxima cita
- CHECK_AVAILABILITY: disponibilidad. params: { date }
- SEARCH_PATIENT: buscar paciente. params: { patient_name }
- GET_PATIENT_SUMMARY: resumen del expediente. params: { patient_name }
- GET_PATIENT_CONDITIONS: enfermedades/condiciones. params: { patient_name }
- GET_PATIENT_ALLERGIES: alergias. params: { patient_name }
- CREATE_APPOINTMENT: agendar cita. params: { patient_name, date, time (HH:MM 24h), reason? }
- RESCHEDULE_APPOINTMENT: reprogramar. params: { patient_name?, appointment_id?, new_date, new_time }
- CANCEL_APPOINTMENT: cancelar. params: { patient_name?, appointment_id?, date? }
- MISSING_INFO: la intención está clara pero faltan datos. Lista los campos faltantes en missing_fields.
- UNKNOWN: no se entiende la solicitud.

Reglas:
- Si la intención es CREATE_APPOINTMENT, RESCHEDULE_APPOINTMENT o CANCEL_APPOINTMENT, requires_confirmation = true.
- Si faltan datos, usa MISSING_INFO con missing_fields = ["patient_name", "date", "time", ...] y assistant_reply pidiendo SOLO lo que falta.
- Para fechas relativas usa: "today", "tomorrow", o nombre del día ("lunes"). El backend resolverá la fecha real.
- Horas en 24h ("a las 3 de la tarde" → "15:00").
- assistant_reply: máximo 1-2 frases, natural, en español.
- NO inventes datos médicos.
- Responde SIEMPRE solo con el JSON, sin texto adicional, sin markdown, sin code fences.`;

let _client = null;
function getClient() {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY no configurado');
    }
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch (_) {
    const m = raw && raw.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch (__) { return null; }
    }
    return null;
  }
}

function normalize(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const intent = VALID_INTENTS.includes(parsed.intent) ? parsed.intent : 'UNKNOWN';
  const params = (parsed.params && typeof parsed.params === 'object') ? parsed.params : {};
  const missing_fields = Array.isArray(parsed.missing_fields) ? parsed.missing_fields : [];
  const requires_confirmation = ACTION_INTENTS.has(intent)
    ? true
    : Boolean(parsed.requires_confirmation);
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5;
  const assistant_reply = typeof parsed.assistant_reply === 'string' ? parsed.assistant_reply : '';
  return { intent, confidence, params, requires_confirmation, missing_fields, assistant_reply };
}

router.post('/parse-intent', authenticate, requireRole('doctor'), async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'text es requerido' });
    }

    const trimmed = text.trim().slice(0, 500);

    const completion = await getClient().chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: trimmed }
      ]
    });

    const raw = completion.choices[0]?.message?.content || '';
    const usage = completion.usage || {};
    const parsed = normalize(safeParse(raw));

    console.log(`[parse-intent] "${trimmed.substring(0, 60)}" → ${parsed ? parsed.intent : 'PARSE_FAIL'} | tokens in=${usage.prompt_tokens} out=${usage.completion_tokens} total=${usage.total_tokens}`);

    if (!parsed) {
      return res.json({
        success: true,
        intent: 'UNKNOWN',
        confidence: 0,
        params: {},
        requires_confirmation: false,
        missing_fields: [],
        assistant_reply: 'No te entendí bien. ¿Puedes repetirlo de otra forma?',
        usage
      });
    }

    return res.json({ success: true, ...parsed, usage });
  } catch (err) {
    console.error('[parse-intent] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Error procesando intención.' });
  }
});

module.exports = router;
