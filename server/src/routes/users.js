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

/**
 * GET /api/users/keys?ids=a,b,c
 * Public encryption keys for a set of users (used to encrypt messages for them).
 */
router.get('/keys', requireAuth, async (req, res) => {
  try {
    const ids = (req.query.ids || '')
      .toString()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) return res.json({ keys: {} });

    const users = await User.find({ _id: { $in: ids } }).select('publicKey');
    const keys = {};
    users.forEach((u) => {
      keys[u._id.toString()] = u.publicKey || '';
    });
    res.json({ keys });
  } catch (err) {
    console.error('[users/keys]', err);
    res.status(500).json({ error: 'could not load keys' });
  }
});

/** POST /api/users/me/public-key — publish this device's encryption public key. */
router.post('/me/public-key', requireAuth, async (req, res) => {
  try {
    const { publicKey } = req.body || {};
    if (!publicKey || typeof publicKey !== 'string' || publicKey.length > 200) {
      return res.status(400).json({ error: 'a valid publicKey is required' });
    }
    req.user.publicKey = publicKey;
    await req.user.save();
    res.json({ ok: true });
  } catch (err) {
    console.error('[users/public-key]', err);
    res.status(500).json({ error: 'could not save public key' });
  }
});

/** POST /api/users/me/devices — register a push-notification device token. */
router.post('/me/devices', requireAuth, async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'a device token is required' });
    }
    await User.updateOne({ _id: req.user._id }, { $addToSet: { pushTokens: token } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[users/devices]', err);
    res.status(500).json({ error: 'could not register device' });
  }
});

/** DELETE /api/users/me/devices — stop sending push to this device. */
router.delete('/me/devices', requireAuth, async (req, res) => {
  try {
    const { token } = req.body || {};
    if (token) {
      await User.updateOne({ _id: req.user._id }, { $pull: { pushTokens: token } });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[users/devices/delete]', err);
    res.status(500).json({ error: 'could not remove device' });
  }
});

module.exports = router;
