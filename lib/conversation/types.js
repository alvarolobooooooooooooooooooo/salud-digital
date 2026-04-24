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

// Tool definitions for Claude
const TOOL_DEFINITIONS = [
  {
    name: 'get_today_appointments',
    description: 'Retrieve all appointments for the authenticated doctor today. Returns appointment details including times and patient names.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_last_appointment',
    description: 'Find the last appointment of a specific patient for the authenticated doctor. Requires patient name.',
    input_schema: {
      type: 'object',
      properties: {
        patient_name: {
          type: 'string',
          description: 'Name of the patient to search for'
        }
      },
      required: ['patient_name']
    }
  },
  {
    name: 'get_availability',
    description: 'Check available time slots for scheduling appointments on a specific date. Returns open slots.',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format'
        }
      },
      required: ['date']
    }
  },
  {
    name: 'schedule_appointment',
    description: 'Create a new appointment with a patient on a specific date and time.',
    input_schema: {
      type: 'object',
      properties: {
        patient_name: {
          type: 'string',
          description: 'Name of the patient'
        },
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format'
        },
        time: {
          type: 'string',
          description: 'Time in HH:MM format (24-hour)'
        }
      },
      required: ['patient_name', 'date', 'time']
    }
  },
  {
    name: 'reschedule_appointment',
    description: 'Reschedule an existing appointment to a new date and time.',
    input_schema: {
      type: 'object',
      properties: {
        appointment_id: {
          type: 'string',
          description: 'ID of the appointment to reschedule'
        },
        new_date: {
          type: 'string',
          description: 'New date in YYYY-MM-DD format'
        },
        new_time: {
          type: 'string',
          description: 'New time in HH:MM format (24-hour)'
        }
      },
      required: ['appointment_id', 'new_date', 'new_time']
    }
  },
  {
    name: 'cancel_appointment',
    description: 'Cancel an existing appointment.',
    input_schema: {
      type: 'object',
      properties: {
        appointment_id: {
          type: 'string',
          description: 'ID of the appointment to cancel'
        }
      },
      required: ['appointment_id']
    }
  },
  {
    name: 'register_patient',
    description: 'Register a new patient in the system.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Full name of the patient'
        },
        email: {
          type: 'string',
          description: 'Email address of the patient'
        },
        phone: {
          type: 'string',
          description: 'Phone number of the patient'
        }
      },
      required: ['name', 'email', 'phone']
    }
  },
  {
    name: 'transfer_to_human',
    description: 'Transfer the conversation to a human operator when unable to help or on request.',
    input_schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Reason for transferring to human'
        }
      },
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
