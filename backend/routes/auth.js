const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { login, logout, me } = require('../controllers/authController');
const { isAuthenticated } = require('../middleware/auth');
const { pool } = require('../models/db');

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', me);

// Update own profile
router.put('/profile', isAuthenticated, async (req, res) => {
  try {
    const { id, role } = req.session.user;
    const { name, email, currentPassword, newPassword } = req.body;

    // Fetch user
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    const user = rows[0];

    // If changing password, verify current
    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ message: 'Current password is required to change password' });
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) return res.status(400).json({ message: 'Current password is incorrect' });
    }

    if (role === 'student') {
      // Students can only change password
      if (newPassword) {
        const hashed = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, id]);
      }
    } else if (role === 'teacher') {
      // Teachers can update name, email, password
      const updates = [];
      const params = [];
      if (name) { updates.push('name = ?'); params.push(name); }
      if (email) {
        // Check email not taken by another user
        const [emailCheck] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
        if (emailCheck.length > 0) return res.status(400).json({ message: 'Email already in use' });
        updates.push('email = ?'); params.push(email);
      }
      if (newPassword) {
        const hashed = await bcrypt.hash(newPassword, 10);
        updates.push('password = ?'); params.push(hashed);
      }
      if (updates.length > 0) {
        params.push(id);
        await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
      }
      // Update session
      if (name) req.session.user.name = name;
      if (email) req.session.user.email = email;
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
