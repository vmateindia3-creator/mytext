const fs = require('fs');
const jwt = require('jsonwebtoken');

/**
 * Firebase Cloud Messaging (HTTP v1) sender.
 *
 * No SDK required: we sign a JWT with the service-account private key, swap it
 * for an OAuth2 access token, then POST to the FCM v1 endpoint.
 *
 * Configure with ONE of:
 *   FIREBASE_SERVICE_ACCOUNT       — the service-account JSON, as a string
 *   FIREBASE_SERVICE_ACCOUNT_PATH  — path to the service-account .json file
 *
 * If neither is set, sending is a silent no-op, so the server runs fine
 * without push configured.
 */

let cachedToken = null;
let cachedUntil = 0;

function serviceAccount() {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    }
    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      return JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('[push] could not read service account:', err.message);
  }
  return null;
}

function isConfigured() {
  return !!serviceAccount();
}

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < cachedUntil - 60) return cachedToken;

  const account = serviceAccount();
  if (!account) throw new Error('push not configured');

  const assertion = jwt.sign(
    {
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    account.private_key,
    { algorithm: 'RS256' }
  );

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`token exchange failed: ${JSON.stringify(data)}`);

  cachedToken = data.access_token;
  cachedUntil = now + (data.expires_in || 3600);
  return cachedToken;
}

/**
 * Send a notification to a list of device tokens.
 * Returns { sent, skipped, errors } — never throws, so callers stay safe.
 */
async function sendToTokens(tokens = [], { title, body, data = {} } = {}) {
  const clean = (tokens || []).filter(Boolean);
  if (clean.length === 0) return { sent: 0, skipped: 0, errors: [] };

  const account = serviceAccount();
  if (!account) return { sent: 0, skipped: clean.length, errors: [] };

  let token;
  try {
    token = await accessToken();
  } catch (err) {
    console.error('[push] auth failed:', err.message);
    return { sent: 0, skipped: clean.length, errors: [err.message] };
  }

  const url = `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`;
  let sent = 0;
  const errors = [];

  for (const deviceToken of clean) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title, body },
            data: Object.fromEntries(
              Object.entries(data).map(([k, v]) => [k, String(v)])
            ),
          },
        }),
      });
      if (res.ok) {
        sent += 1;
      } else {
        errors.push(await res.text());
      }
    } catch (err) {
      errors.push(err.message);
    }
  }

  return { sent, skipped: 0, errors };
}

module.exports = { sendToTokens, isConfigured };
