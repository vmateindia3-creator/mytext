const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../middleware/auth');
const otp = require('../utils/otp');
const sms = require('../utils/sms');

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_RESEND_MS = 30 * 1000; // 30 seconds between requests
const OTP_MAX_ATTEMPTS = 5;

/** Build a unique username for a phone sign-up. */
async function makeUniqueUsername(phone) {
  const digits = phone.replace(/\D/g, '').slice(-6) || '000000';
  for (let i = 0; i < 10; i++) {
    const candidate = `user${digits}${Math.floor(Math.random() * 90 + 10)}`;
    const exists = await User.exists({ username: candidate });
    if (!exists) return candidate;
  }
  return `user${Date.now().toString().slice(-10)}`;
}

// ---------------------------------------------------------------------------
// Phone number + OTP
// ---------------------------------------------------------------------------

/** POST /api/auth/request-otp  { phone } */
router.post('/request-otp', async (req, res) => {
  try {
    const phone = otp.normalizePhone(req.body?.phone);
    if (!otp.isValidPhone(phone)) {
      return res.status(400).json({ error: 'Enter a valid phone number' });
    }

    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({
        phone,
        username: await makeUniqueUsername(phone),
        displayName: phone,
      });
    }

    // Simple throttle so the endpoint cannot be used to spam someone.
    if (user.otpLastSentAt && Date.now() - user.otpLastSentAt.getTime() < OTP_RESEND_MS) {
      const wait = Math.ceil((OTP_RESEND_MS - (Date.now() - user.otpLastSentAt.getTime())) / 1000);
      return res.status(429).json({ error: `Please wait ${wait}s before requesting another code` });
    }

    const code = otp.generateCode();
    user.otpHash = otp.hashCode(code, phone);
    user.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
    user.otpLastSentAt = new Date();
    user.otpAttempts = 0;
    await user.save();

    const result = await sms.send(phone, `Your Mytext verification code is ${code}. It expires in 5 minutes.`);

    // When no real SMS provider is configured we hand the code back so the app
    // can be tested end-to-end. NEVER allow this in production.
    const devMode = !sms.isRealProvider() && process.env.OTP_DEV_MODE !== 'false';

    res.json({
      ok: true,
      sent: result.sent,
      provider: result.provider,
      expiresInSeconds: OTP_TTL_MS / 1000,
      ...(devMode ? { devCode: code, devMode: true } : {}),
      ...(result.error ? { error: result.error } : {}),
    });
  } catch (err) {
    console.error('[auth/request-otp]', err);
    res.status(500).json({ error: 'Could not send the code' });
  }
});

/** POST /api/auth/verify-otp  { phone, code } */
router.post('/verify-otp', async (req, res) => {
  try {
    const phone = otp.normalizePhone(req.body?.phone);
    const code = String(req.body?.code || '').trim();

    if (!otp.isValidPhone(phone) || !/^\d{4,8}$/.test(code)) {
      return res.status(400).json({ error: 'Enter the code we sent you' });
    }

    const user = await User.findOne({ phone });
    if (!user || !user.otpHash || !user.otpExpiresAt) {
      return res.status(400).json({ error: 'Request a new code' });
    }
    if (user.otpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: 'That code has expired — request a new one' });
    }
    if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many attempts — request a new code' });
    }

    const expected = user.otpHash;
    if (!otp.safeEqual(expected, otp.hashCode(code, phone))) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(401).json({ error: 'Incorrect code' });
    }

    // Success: clear the OTP and mark the number verified.
    user.otpHash = '';
    user.otpExpiresAt = null;
    user.otpAttempts = 0;
    user.verified = true;
    if (!user.displayName || user.displayName === phone) {
      user.displayName = phone;
    }
    await user.save();

    const token = signToken(user._id);
    res.json({ token, user: user.toPublic() });
  } catch (err) {
    console.error('[auth/verify-otp]', err);
    res.status(500).json({ error: 'Could not verify the code' });
  }
});

// ---------------------------------------------------------------------------
// Username + password (kept for accounts that prefer it)
// ---------------------------------------------------------------------------

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
    if (!user || !user.passwordHash) return res.status(401).json({ error: 'invalid credentials' });

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
