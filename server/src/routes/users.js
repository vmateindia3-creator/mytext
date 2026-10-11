const express = require('express');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/** GET /api/users/me — the signed-in user's profile. */
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

/** GET /api/users?q=search — find people to chat with. */
router.get('/', requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const filter = { _id: { $ne: req.user._id } };
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { username: { $regex: safe, $options: 'i' } },
        { displayName: { $regex: safe, $options: 'i' } },
      ];
    }
    const users = await User.find(filter).limit(30).sort({ username: 1 });
    res.json({ users: users.map((u) => u.toPublic()) });
  } catch (err) {
    console.error('[users/list]', err);
    res.status(500).json({ error: 'could not load users' });
  }
});

module.exports = router;
