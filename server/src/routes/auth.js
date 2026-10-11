const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../middleware/auth');

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

/** POST /api/auth/register — create an account and return a token. */
router.post('/register', async (req, res) => {
  try {
    const { username, password, displayName } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    if (!USERNAME_RE.test(username)) {
      return res
        .status(400)
        .json({ error: 'username must be 3-24 letters, numbers or underscores' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'password must be at least 6 characters' });
    }

    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'username already taken' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username: username.toLowerCase(),
      displayName: displayName || username,
      passwordHash,
    });

    const token = signToken(user._id);
    res.status(201).json({ token, user: user.toPublic() });
  } catch (err) {
    console.error('[auth/register]', err);
    res.status(500).json({ error: 'could not create account' });
  }
});

/** POST /api/auth/login — exchange credentials for a token. */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });

    const token = signToken(user._id);
    res.json({ token, user: user.toPublic() });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: 'could not log in' });
  }
});

module.exports = router;
