# Conversation API - NLU Assistant

The conversation API enables natural language interaction with the healthcare platform. It uses Claude AI to understand user intent and execute controlled backend functions.

## Architecture

```
User Input
    ↓
/api/conversation/:sessionId/message
    ↓
ConversationService (orchestrates)
    ↓
ClaudeClient (calls Claude API with tool definitions)
    ↓
ToolExecutor (validates permissions + executes tools)
    ↓
Tool Registry (8 predefined tools)
    ↓
PostgreSQL (stores sessions, messages, audit logs)
```

## Endpoints

### 1. Create Session
**POST** `/api/conversation/session`

Creates a new conversation session for the authenticated user.

```bash
curl -X POST http://localhost:3000/api/conversation/session \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "session": {
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": 5,
    "clinic_id": 1,
    "state": "active",
    "created_at": "2026-04-24T23:45:00.000Z"
  }
}
```

### 2. Send Message
**POST** `/api/conversation/:sessionId/message`

Send a message in an active conversation. Claude processes it and may call tools.

```bash
curl -X POST http://localhost:3000/api/conversation/abc123/message \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Qué citas tengo hoy?"
  }'
```

**Response (with tool execution):**
```json
{
  "success": true,
  "result": {
    "session_id": "abc123",
    "message_id": "msg123",
    "user_message": "¿Qué citas tengo hoy?",
    "assistant_response": "Tienes 2 citas programadas para hoy. La primera es a las 10:00 AM con María González.",
    "tool_calls": [
      {
        "id": "toolu_123",
        "name": "get_today_appointments",
        "input": {}
      }
    ],
    "tool_results": [
      {
        "id": "toolu_123",
        "name": "get_today_appointments",
        "result": {
          "success": true,
          "data": {
            "total": 2,
            "appointments": [
              {
                "appointment_id": 45,
                "time": "10:00 AM",
                "patient_name": "María González",
                "status": "scheduled"
              },
              {
                "appointment_id": 46,
                "time": "11:00 AM",
                "patient_name": "Carlos Rodríguez",
                "status": "scheduled"
              }
            ]
          }
        }
      }
    ]
  }
}
```

### 3. Get History
**GET** `/api/conversation/:sessionId/history?limit=50`

Retrieve conversation history for a session.

```bash
curl http://localhost:3000/api/conversation/abc123/history \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "session_id": "abc123",
  "messages": [
    {
      "id": "msg123",
      "role": "user",
      "content": "¿Qué citas tengo hoy?",
      "created_at": "2026-04-24T23:46:00.000Z"
    },
    {
      "id": "msg124",
      "role": "assistant",
      "content": "Tienes 2 citas programadas para hoy...",
      "created_at": "2026-04-24T23:46:01.000Z"
    }
  ]
}
```

### 4. Close Session
**POST** `/api/conversation/:sessionId/close`

Close a conversation session.

```bash
curl -X POST http://localhost:3000/api/conversation/abc123/close \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "result": {
    "success": true,
    "session_id": "abc123",
    "state": "closed"
  }
}
```

## Tools

Claude can call these 8 tools based on user intent:

| Tool | Access | Description |
|------|--------|-------------|
| `get_today_appointments` | Doctor, Admin | Get appointments for today |
| `get_last_appointment` | Doctor, Admin, Patient | Get last appointment of a patient |
| `get_availability` | Doctor, Admin | Get available time slots |
| `schedule_appointment` | Doctor, Admin | Create new appointment |
| `reschedule_appointment` | Doctor, Admin | Change appointment date/time |
| `cancel_appointment` | Doctor, Admin | Cancel appointment |
| `register_patient` | Doctor, Admin | Register new patient |
| `transfer_to_human` | All | Transfer to human operator |

## Authentication

All endpoints require JWT authentication:
```bash
Authorization: Bearer <jwt_token>
```

The JWT token must include:
- `id` (user ID)
- `clinic_id` (clinic ID)
- `role` (user role: doctor, clinic_admin, patient)

## Role-Based Access

- **Doctor**: All tools except transfer_to_human (can request it)
- **Clinic Admin**: get_availability, transfer_to_human only
- **Patient**: get_last_appointment, transfer_to_human only

## Environment Variables

Add to `.env`:
```
ANTHROPIC_API_KEY=sk-...
TZ=America/Chicago
```

## Database Schema

### conversation_sessions
```sql
id UUID PRIMARY KEY
user_id INTEGER
clinic_id INTEGER
user_role TEXT
state TEXT ('active' or 'closed')
created_at TIMESTAMP
updated_at TIMESTAMP
```

### conversation_messages
```sql
id UUID PRIMARY KEY
session_id UUID
role TEXT ('user' or 'assistant')
content TEXT
created_at TIMESTAMP
```

### audit_logs
```sql
id SERIAL PRIMARY KEY
user_id INTEGER
clinic_id INTEGER
action TEXT (tool name)
status TEXT ('success', 'error', 'denied')
reason TEXT
tool_input TEXT (JSON)
tool_output TEXT (JSON)
error TEXT
duration_ms INTEGER
created_at TIMESTAMP
```

## Example Conversation Flow

```javascript
// 1. Create session
const session = await fetch('/api/conversation/session', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

const sessionId = session.session.session_id;

// 2. Send message
const response = await fetch(`/api/conversation/${sessionId}/message`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: '¿Qué citas tengo hoy?'
  })
}).then(r => r.json());

console.log(response.result.assistant_response);

// 3. Continue conversation
const followUp = await fetch(`/api/conversation/${sessionId}/message`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: '¿Cuánta disponibilidad tengo mañana?'
  })
}).then(r => r.json());

// 4. Get history
const history = await fetch(`/api/conversation/${sessionId}/history`, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

// 5. Close session
await fetch(`/api/conversation/${sessionId}/close`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## Error Handling

### Insufficient Permissions
```json
{
  "success": false,
  "error": "No tienes permiso para usar esta función: schedule_appointment"
}
```

### Invalid Input
```json
{
  "success": false,
  "error": "Message cannot be empty"
}
```

### Tool Execution Error
```json
{
  "success": false,
  "error": "Error agendando cita: Patient not found"
}
```

## Next Steps

1. Add frontend UI component for conversation
2. Implement voice recognition (Web Speech API)
3. Add rate limiting per session
4. Implement conversation analytics
5. Cache appointment availability
6. Support multiple conversation threads per user
