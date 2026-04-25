// Session states
const SESSION_STATE = {
  ACTIVE: 'active',
  CLOSED: 'closed'
};

// Tool intents that Claude can call
const TOOL_INTENT = {
  GET_TODAY_APPOINTMENTS: 'get_today_appointments',
  GET_LAST_APPOINTMENT: 'get_last_appointment',
  GET_AVAILABILITY: 'get_availability',
  SCHEDULE_APPOINTMENT: 'schedule_appointment',
  RESCHEDULE_APPOINTMENT: 'reschedule_appointment',
  CANCEL_APPOINTMENT: 'cancel_appointment',
  REGISTER_PATIENT: 'register_patient',
  TRANSFER_TO_HUMAN: 'transfer_to_human'
};

// Tool definitions - minimized descriptions for token efficiency
const TOOL_DEFINITIONS = [
  {
    name: 'get_today_appointments',
    description: 'Citas del doctor hoy',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_last_appointment',
    description: 'Última cita de un paciente',
    input_schema: {
      type: 'object',
      properties: { patient_name: { type: 'string' } },
      required: ['patient_name']
    }
  },
  {
    name: 'get_availability',
    description: 'Horarios libres en una fecha (YYYY-MM-DD)',
    input_schema: {
      type: 'object',
      properties: { date: { type: 'string' } },
      required: ['date']
    }
  },
  {
    name: 'schedule_appointment',
    description: 'Agendar cita (confirmar antes)',
    input_schema: {
      type: 'object',
      properties: {
        patient_name: { type: 'string' },
        date: { type: 'string' },
        time: { type: 'string' }
      },
      required: ['patient_name', 'date', 'time']
    }
  },
  {
    name: 'reschedule_appointment',
    description: 'Reprogramar cita (confirmar antes)',
    input_schema: {
      type: 'object',
      properties: {
        appointment_id: { type: 'string' },
        new_date: { type: 'string' },
        new_time: { type: 'string' }
      },
      required: ['appointment_id', 'new_date', 'new_time']
    }
  },
  {
    name: 'cancel_appointment',
    description: 'Cancelar cita (confirmar antes)',
    input_schema: {
      type: 'object',
      properties: { appointment_id: { type: 'string' } },
      required: ['appointment_id']
    }
  },
  {
    name: 'register_patient',
    description: 'Registrar paciente nuevo',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' }
      },
      required: ['name', 'email', 'phone']
    }
  },
  {
    name: 'transfer_to_human',
    description: 'Transferir a operador',
    input_schema: {
      type: 'object',
      properties: { reason: { type: 'string' } },
      required: ['reason']
    }
  }
];

// Role-based tool access control
const TOOL_ACCESS = {
  doctor: [
    TOOL_INTENT.GET_TODAY_APPOINTMENTS,
    TOOL_INTENT.GET_LAST_APPOINTMENT,
    TOOL_INTENT.GET_AVAILABILITY,
    TOOL_INTENT.SCHEDULE_APPOINTMENT,
    TOOL_INTENT.RESCHEDULE_APPOINTMENT,
    TOOL_INTENT.CANCEL_APPOINTMENT,
    TOOL_INTENT.REGISTER_PATIENT,
    TOOL_INTENT.TRANSFER_TO_HUMAN
  ],
  clinic_admin: [
    TOOL_INTENT.GET_AVAILABILITY,
    TOOL_INTENT.TRANSFER_TO_HUMAN
  ],
  patient: [
    TOOL_INTENT.GET_LAST_APPOINTMENT,
    TOOL_INTENT.TRANSFER_TO_HUMAN
  ]
};

module.exports = {
  SESSION_STATE,
  TOOL_INTENT,
  TOOL_DEFINITIONS,
  TOOL_ACCESS
};
