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

const SYSTEM_PROMPT = `Clasificador de intención médico (español Honduras). Devuelve solo JSON:
{intent,confidence,params,requires_confirmation,missing_fields,assistant_reply}

Intents: GREETING, HELP, GET_TODAY_APPOINTMENTS, GET_APPOINTMENTS_BY_DATE(date), GET_NEXT_APPOINTMENT, CHECK_AVAILABILITY(date), SEARCH_PATIENT(patient_name), GET_PATIENT_SUMMARY(patient_name), GET_PATIENT_CONDITIONS(patient_name), GET_PATIENT_ALLERGIES(patient_name), CREATE_APPOINTMENT(patient_name,date,time,reason?), RESCHEDULE_APPOINTMENT(patient_name?,new_date,new_time), CANCEL_APPOINTMENT(patient_name?,date?), MISSING_INFO, UNKNOWN.

Reglas: CREATE/RESCHEDULE/CANCEL → requires_confirmation=true. Faltan datos → MISSING_INFO + missing_fields. Fechas: "today"|"tomorrow"|nombre_día|YYYY-MM-DD. Horas: HH:MM 24h. assistant_reply: 1 frase breve. No inventes datos médicos.`;

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
