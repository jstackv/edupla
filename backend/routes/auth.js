const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { login, logout, me } = require('../controllers/authController');
const { isAuthenticated } = require('../middleware/auth');
const { User } = require('../models/db');

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', me);

// Update own profile
router.put('/profile', isAuthenticated, async (req, res) => {
  try {
    const { id, role } = req.user;
    const { name, email, currentPassword, newPassword } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ message: 'Current password is required to change password' });
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) return res.status(400).json({ message: 'Current password is incorrect' });
    }

    if (role === 'student') {
      // Students can ONLY change their password — name and email are managed by admins
      if (newPassword) {
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        return res.json({ message: 'Password changed successfully' });
      }
      return res.status(403).json({ message: 'Students are not allowed to modify their name or email.' });
    } else if (role === 'admin') {
      // Admins can change their password only
      if (newPassword) {
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
      }
      return res.json({ message: 'Password updated successfully' });
    } else if (role === 'teacher') {
      if (name) user.name = name;
      if (email) {
        const taken = await User.findOne({ email, _id: { $ne: id } });
        if (taken) return res.status(400).json({ message: 'Email already in use' });
        user.email = email;
      }
      if (newPassword) user.password = await bcrypt.hash(newPassword, 10);
      await user.save();
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
