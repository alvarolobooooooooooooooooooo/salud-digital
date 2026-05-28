const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ConversationService = require('../lib/conversation/service');

const conversationService = new ConversationService();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valida el formato del sessionId y que pertenezca al usuario+clínica del token.
// Responde 400/404 y devuelve false si no procede; el caller debe abortar.
async function ensureOwnSession(req, res) {
  const sessionId = req.params.sessionId;
  if (!UUID_RE.test(sessionId)) {
    res.status(400).json({ success: false, error: 'Invalid session id' });
    return false;
  }
  const owns = await conversationService.ownsSession(sessionId, req.user.id, req.user.clinic_id);
  if (!owns) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return false;
  }
  return true;
}

// Health check (no auth)
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Conversation API is alive' });
});

// Test endpoint - echo message without AI
router.post('/test/echo', authenticate, async (req, res) => {
  try {
    const { message } = req.body;
    res.json({
      success: true,
      result: {
        assistant_response: `Echo: ${message}`
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// POST /api/conversation/session
// Create a new conversation session
router.post('/session', authenticate, async (req, res) => {
  try {
    const userRole = req.user.role || 'doctor';
    const session = await conversationService.createSession(
      req.user.id,
      req.user.clinic_id,
      userRole
    );

    res.json({
      success: true,
      session
    });
  } catch (err) {
    console.error('[conversation] Error creating session');
    res.status(500).json({
      success: false,
      error: 'Error creating conversation session',
    });
  }
});

// POST /api/conversation/:sessionId/message
// Send a message in an active conversation
router.post('/:sessionId/message', authenticate, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message cannot be empty'
      });
    }

    if (!(await ensureOwnSession(req, res))) return;

    const userRole = req.user.role || 'doctor';
    const result = await conversationService.processUserInput(
      req.params.sessionId,
      message,
      req.user.id,
      req.user.clinic_id,
      userRole
    );

    res.json({
      success: true,
      result
    });
  } catch (err) {
    console.error('[conversation] Error processing message');
    res.status(500).json({
      success: false,
      error: 'Error processing message',
    });
  }
});

// GET /api/conversation/:sessionId/history
// Get conversation history for a session
router.get('/:sessionId/history', authenticate, async (req, res) => {
  try {
    if (!(await ensureOwnSession(req, res))) return;

    const history = await conversationService.getSessionHistory(
      req.params.sessionId,
      req.query.limit || 50
    );

    res.json({
      success: true,
      session_id: req.params.sessionId,
      messages: history
    });
  } catch (err) {
    console.error('[conversation] Error fetching history:', err);
    res.status(500).json({
      success: false,
      error: 'Error fetching conversation history',
    });
  }
});

// POST /api/conversation/:sessionId/close
// Close a conversation session
router.post('/:sessionId/close', authenticate, async (req, res) => {
  try {
    if (!(await ensureOwnSession(req, res))) return;

    const result = await conversationService.closeSession(req.params.sessionId);

    res.json({
      success: true,
      result
    });
  } catch (err) {
    console.error('[conversation] Error closing session:', err);
    res.status(500).json({
      success: false,
      error: 'Error closing session',
    });
  }
});

module.exports = router;
