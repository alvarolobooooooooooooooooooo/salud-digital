const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ConversationService = require('../lib/conversation/service');

const conversationService = new ConversationService();

// Health check (no auth)
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Conversation API is alive' });
});

// POST /api/conversation/session
// Create a new conversation session
router.post('/session', authenticate, async (req, res) => {
  try {
    console.log('[conversation] Creating session for user:', req.user?.id);
    const userRole = req.user.role || 'doctor';
    const session = await conversationService.createSession(
      req.user.id,
      req.user.clinic_id,
      userRole
    );

    console.log('[conversation] Session created:', session.session_id);
    res.json({
      success: true,
      session
    });
  } catch (err) {
    console.error('[conversation] Error creating session:', err.message, err.stack);
    res.status(500).json({
      success: false,
      error: 'Error creating conversation session',
      debug: err.message
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
    console.error('[conversation] Error processing message:', err);
    res.status(500).json({
      success: false,
      error: 'Error processing message',
      debug: err.message
    });
  }
});

// GET /api/conversation/:sessionId/history
// Get conversation history for a session
router.get('/:sessionId/history', authenticate, async (req, res) => {
  try {
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
      debug: err.message
    });
  }
});

// POST /api/conversation/:sessionId/close
// Close a conversation session
router.post('/:sessionId/close', authenticate, async (req, res) => {
  try {
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
      debug: err.message
    });
  }
});

module.exports = router;
