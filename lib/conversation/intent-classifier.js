// Intent classifier - local, zero-token classification using regex patterns
// Avoids using LLM tokens for simple intent detection

const INTENT = {
  GENERAL: 'general',           // "¿en qué me ayudas?", "hola", agradecimientos
  APPOINTMENTS: 'appointments', // citas, agenda, horarios
  PATIENT: 'patient',           // datos paciente, búsqueda
  RECORD: 'record',             // expediente, alergias, diagnósticos
  ACTION: 'action',             // crear, editar, cancelar, eliminar
  UNKNOWN: 'unknown'
};

const PATTERNS = {
  [INTENT.GENERAL]: [
    /^(hola|buenos? (días|tardes|noches)|hey|saludos)/i,
    /(qué|que|en qué|en que|como).*(ayud|servir|hacer|puedes)/i,
    /(gracias|adios|adiós|chao)/i,
    /^(ok|listo|entendido|perfecto)/i
  ],
  [INTENT.APPOINTMENTS]: [
    /\b(cita|citas|agenda|horario|disponibilidad|próxima|proxima|hoy|mañana|manana)\b/i,
    /\b(programad|agendad|reservad)/i
  ],
  [INTENT.PATIENT]: [
    /\b(paciente|pacientes|persona|cliente)\b/i,
    /\b(buscar|encuentr|ubicar)\b.*\b(paciente|persona)\b/i
  ],
  [INTENT.RECORD]: [
    /\b(expediente|historia|historial|alergia|alergias|diagnóstico|diagnostico|enfermedad|tratamiento|medicamento)\b/i,
    /\b(resumen|completo)\b.*(clinico|clínico|paciente)/i
  ],
  [INTENT.ACTION]: [
    /\b(agenda|agendar|crear|nuevo|registrar|añadir|anadir|programar)\b/i,
    /\b(cancelar|eliminar|borrar|quitar)\b/i,
    /\b(cambiar|reprogramar|modificar|editar|actualizar)\b/i
  ]
};

function classifyIntent(message) {
  if (!message || typeof message !== 'string') return INTENT.UNKNOWN;

  const text = message.toLowerCase().trim();

  // Check ACTION first (highest priority - sensitive operations)
  for (const pattern of PATTERNS[INTENT.ACTION]) {
    if (pattern.test(text)) return INTENT.ACTION;
  }

  // Check specific intents
  for (const pattern of PATTERNS[INTENT.RECORD]) {
    if (pattern.test(text)) return INTENT.RECORD;
  }
  for (const pattern of PATTERNS[INTENT.APPOINTMENTS]) {
    if (pattern.test(text)) return INTENT.APPOINTMENTS;
  }
  for (const pattern of PATTERNS[INTENT.PATIENT]) {
    if (pattern.test(text)) return INTENT.PATIENT;
  }
  for (const pattern of PATTERNS[INTENT.GENERAL]) {
    if (pattern.test(text)) return INTENT.GENERAL;
  }

  return INTENT.UNKNOWN;
}

// Pre-canned responses for general questions - zero LLM tokens
const CANNED_RESPONSES = {
  greeting: '¡Hola! Soy tu asistente. Puedo ayudarte a consultar citas, buscar pacientes, revisar expedientes y agendar o cancelar citas. ¿Qué necesitas?',
  capabilities: 'Puedo ayudarte a: consultar tus citas de hoy, buscar pacientes, revisar resúmenes de expedientes, ver alergias o enfermedades registradas, consultar disponibilidad y agendar, reprogramar o cancelar citas con tu confirmación.',
  thanks: '¡Con gusto! ¿Algo más en lo que te pueda ayudar?',
  farewell: 'Hasta luego. Estoy disponible cuando me necesites.'
};

function getCannedResponse(message) {
  const text = message.toLowerCase().trim();
  if (/^(hola|buenos? (días|tardes|noches)|hey|saludos)/i.test(text)) {
    return CANNED_RESPONSES.greeting;
  }
  if (/(qué|que|en qué|en que|como).*(ayud|servir|hacer|puedes)/i.test(text)) {
    return CANNED_RESPONSES.capabilities;
  }
  if (/^gracias/i.test(text)) {
    return CANNED_RESPONSES.thanks;
  }
  if (/(adios|adiós|chao|hasta luego)/i.test(text)) {
    return CANNED_RESPONSES.farewell;
  }
  return null;
}

// Map intent to relevant tool names
const INTENT_TOOLS = {
  [INTENT.GENERAL]: [],
  [INTENT.APPOINTMENTS]: ['get_today_appointments', 'get_availability'],
  [INTENT.PATIENT]: ['get_last_appointment', 'register_patient'],
  [INTENT.RECORD]: ['get_last_appointment'],
  [INTENT.ACTION]: ['schedule_appointment', 'reschedule_appointment', 'cancel_appointment', 'register_patient', 'get_availability'],
  [INTENT.UNKNOWN]: ['get_today_appointments', 'get_last_appointment', 'get_availability', 'transfer_to_human']
};

module.exports = {
  INTENT,
  classifyIntent,
  getCannedResponse,
  INTENT_TOOLS
};
