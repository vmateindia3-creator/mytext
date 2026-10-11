/**
 * Pluggable SMS sender for OTP delivery.
 *
 * Set SMS_DRIVER to one of:
 *   console   (default) — does NOT send an SMS; prints the message to the server
 *                         log and reports the code back to the caller so you can
 *                         test the whole flow without paying for SMS.
 *   twilio    — Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM)
 *   msg91     — MSG91  (MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_TEMPLATE_ID)
 *   fast2sms  — Fast2SMS (FAST2SMS_API_KEY)
 *
 * Everything here uses plain fetch, so there are no extra dependencies.
 */

function driverName() {
  return (process.env.SMS_DRIVER || 'console').toLowerCase();
}

/** True when a real SMS provider is configured (i.e. not the console stub). */
function isRealProvider() {
  const d = driverName();
  if (d === 'twilio') return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
  if (d === 'msg91') return !!(process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID);
  if (d === 'fast2sms') return !!(process.env.FAST2SMS_API_KEY);
  return false;
}

async function sendTwilio(phone, message) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: phone,
      From: process.env.TWILIO_FROM,
      Body: message,
    }),
  });
  if (!res.ok) throw new Error(`twilio: ${await res.text()}`);
}

async function sendMsg91(phone, message) {
  const res = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: {
      authkey: process.env.MSG91_AUTH_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      template_id: process.env.MSG91_TEMPLATE_ID,
      sender: process.env.MSG91_SENDER_ID || 'MYTEXT',
      recipients: [{ mobiles: phone.replace(/\D/g, ''), message }],
    }),
  });
  if (!res.ok) throw new Error(`msg91: ${await res.text()}`);
}

async function sendFast2Sms(phone, message) {
  const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      authorization: process.env.FAST2SMS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      route: 'q',
      message,
      numbers: phone.replace(/\D/g, ''),
    }),
  });
  if (!res.ok) throw new Error(`fast2sms: ${await res.text()}`);
}

/**
 * Send an SMS. Never throws — returns { sent, provider, error }.
 * With the console driver nothing is sent, and `sent` is false.
 */
async function send(phone, message) {
  const driver = driverName();
  try {
    if (driver === 'twilio') {
      await sendTwilio(phone, message);
      return { sent: true, provider: driver };
    }
    if (driver === 'msg91') {
      await sendMsg91(phone, message);
      return { sent: true, provider: driver };
    }
    if (driver === 'fast2sms') {
      await sendFast2Sms(phone, message);
      return { sent: true, provider: driver };
    }
    // console / unconfigured
    console.log(`[sms:console] to ${phone}: ${message}`);
    return { sent: false, provider: 'console' };
  } catch (err) {
    console.error('[sms] send failed:', err.message);
    return { sent: false, provider: driver, error: err.message };
  }
}

module.exports = { send, isRealProvider, driverName };
