const crypto = require('crypto');

/**
 * Small, dependency-free helpers for phone + OTP login.
 * Kept pure (no database, no network) so they are easy to unit-test.
 */

/**
 * Normalise a phone number to digits only, keeping a leading '+'.
 * Accepts "+91 98765 43210", "098765-43210", etc.
 */
function normalizePhone(input) {
  if (!input) return '';
  const raw = String(input).trim();
  const plus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return (plus ? '+' : '') + digits;
}

/** Basic sanity check: 7-15 digits (E.164 allows up to 15). */
function isValidPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/** A random 6-digit code, as a string (leading zeros preserved). */
function generateCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Store only a hash of the code, never the code itself. */
function hashCode(code, phone) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'dev-secret')
    .update(`${phone}:${code}`)
    .digest('hex');
}

/** Constant-time comparison of two hex strings. */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

module.exports = {
  normalizePhone,
  isValidPhone,
  generateCode,
  hashCode,
  safeEqual,
};
