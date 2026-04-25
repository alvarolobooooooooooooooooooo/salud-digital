const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { authenticate, SECRET } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const result = await query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!user.clinic_id && user.role === 'doctor') {
    return res.status(403).json({ error: 'Your account has been deactivated. Contact your clinic administrator.' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, clinic_id: user.clinic_id },
    SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, role: user.role, clinic_id: user.clinic_id });
});

router.get('/me', authenticate, async (req, res) => {
  const result = await query(
    'SELECT u.id, u.email, u.role, u.clinic_id, u.specialty, c.name as clinic_name FROM users u LEFT JOIN clinics c ON u.clinic_id = c.id WHERE u.id = $1',
    [req.user.id]
  );
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

module.exports = router;
