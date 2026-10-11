/**
 * Unit checks for logic that does not need a live database.
 * (The full DB-backed end-to-end flow lives in smoke.test.js and runs wherever
 * a MongoDB instance is reachable — locally, in CI, or against Atlas.)
 *
 * Run with:  npm run test:unit
 */
const assert = require('assert');

async function main() {
  process.env.JWT_SECRET = 'unit-test-secret';

  const bcrypt = require('bcryptjs');
  const { signToken, verifyToken } = require('../src/middleware/auth');
  const Conversation = require('../src/models/Conversation');
  const { iceServers } = require('../src/utils/ice');

  console.log('1. password hashing round-trips...');
  const hash = await bcrypt.hash('secret123', 10);
  assert.ok(await bcrypt.compare('secret123', hash));
  assert.ok(!(await bcrypt.compare('wrong', hash)));

  console.log('2. JWT sign/verify round-trips...');
  const token = signToken('64b7f0c2f1a2b3c4d5e6f7a8');
  const payload = verifyToken(token);
  assert.strictEqual(payload.sub, '64b7f0c2f1a2b3c4d5e6f7a8');

  console.log('3. tampered JWT is rejected...');
  assert.throws(() => verifyToken(token + 'x'));

  console.log('4. direct-conversation key is order independent...');
  const a = 'aaa';
  const b = 'bbb';
  assert.strictEqual(Conversation.directKey(a, b), Conversation.directKey(b, a));

  console.log('5. ICE servers include STUN, and TURN only when configured...');
  process.env.PUBLIC_TURN_ENABLED = 'false';
  const base = iceServers();
  assert.ok(base.some((s) => s.urls.startsWith('stun:')));
  assert.ok(!base.some((s) => s.urls.startsWith('turn:')));
  process.env.TURN_URL = 'turn:example.com:3478';
  process.env.TURN_USERNAME = 'u';
  process.env.TURN_CREDENTIAL = 'p';
  assert.ok(iceServers().some((s) => s.urls.startsWith('turn:')));
  delete process.env.TURN_URL;
  delete process.env.TURN_USERNAME;
  delete process.env.TURN_CREDENTIAL;
  // With no TURN configured, a public relay is added so calls can connect.
  delete process.env.PUBLIC_TURN_ENABLED;
  assert.ok(iceServers().some((s) => s.urls.startsWith('turn:')));

  console.log('6. the Express app builds and unauthenticated routes are locked...');
  const { createApp } = require('../src/index');
  const app = createApp();
  const http = require('http');
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const get = (path, headers = {}) =>
    new Promise((resolve, reject) => {
      const req = http.get({ host: '127.0.0.1', port, path, headers }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on('error', reject);
    });

  assert.strictEqual(await get('/health'), 200);
  assert.strictEqual(await get('/api/users/me'), 401);
  assert.strictEqual(await get('/api/users/me', { Authorization: 'Bearer not-a-real-token' }), 401);
  assert.strictEqual(await get('/nope'), 404);

  server.close();

  console.log('7. media storage driver...');
  delete process.env.STORAGE_DRIVER;
  const storage = require('../src/utils/storage');
  assert.strictEqual(storage.driverName(), 'local');
  assert.ok(storage.isConfigured());
  const stored = await storage.putObject({
    buffer: Buffer.from('hello'),
    filename: 'note.txt',
    mimetype: 'text/plain',
  });
  assert.ok(stored.url.includes('/uploads/'), 'expected a /uploads/ url');
  assert.ok(require('fs').existsSync(require('path').join(storage.UPLOAD_DIR, stored.key)));
  require('fs').unlinkSync(require('path').join(storage.UPLOAD_DIR, stored.key));

  process.env.STORAGE_DRIVER = 's3';
  process.env.S3_BUCKET = 'demo';
  process.env.S3_ACCESS_KEY_ID = 'key';
  assert.ok(storage.isConfigured());
  delete process.env.S3_BUCKET;
  assert.ok(!storage.isConfigured(), 's3 without a bucket should be unconfigured');
  delete process.env.STORAGE_DRIVER;
  delete process.env.S3_ACCESS_KEY_ID;

  console.log('8. push notifications are a safe no-op when unconfigured...');
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
  delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const push = require('../src/utils/push');
  assert.strictEqual(push.isConfigured(), false);
  const none = await push.sendToTokens([], { title: 't', body: 'b' });
  assert.strictEqual(none.sent, 0);
  const unconfigured = await push.sendToTokens(['device-1'], { title: 't', body: 'b' });
  assert.strictEqual(unconfigured.sent, 0);
  assert.strictEqual(unconfigured.skipped, 1);

  console.log('9. phone + OTP helpers...');
  const otp = require('../src/utils/otp');
  assert.strictEqual(otp.normalizePhone('+91 98765-43210'), '+919876543210');
  assert.strictEqual(otp.normalizePhone('09876543210'), '09876543210');
  assert.strictEqual(otp.normalizePhone(''), '');
  assert.ok(otp.isValidPhone('+919876543210'));
  assert.ok(!otp.isValidPhone('123'));
  const code = otp.generateCode();
  assert.strictEqual(code.length, 6);
  assert.ok(/^\d{6}$/.test(code));
  assert.strictEqual(otp.hashCode('123456', '+91123'), otp.hashCode('123456', '+91123'));
  assert.notStrictEqual(otp.hashCode('123456', '+91123'), otp.hashCode('123456', '+91999'));
  assert.ok(otp.safeEqual(otp.hashCode('123456', 'p'), otp.hashCode('123456', 'p')));
  assert.ok(!otp.safeEqual(otp.hashCode('123456', 'p'), otp.hashCode('654321', 'p')));

  console.log('10. SMS sender falls back to the console stub...');
  delete process.env.SMS_DRIVER;
  const sms = require('../src/utils/sms');
  assert.strictEqual(sms.driverName(), 'console');
  assert.strictEqual(sms.isRealProvider(), false);
  const sent = await sms.send('+919876543210', 'test message');
  assert.strictEqual(sent.sent, false);
  assert.strictEqual(sent.provider, 'console');

  console.log('\nUNIT TESTS PASSED ✓');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nUNIT TEST FAILED ✗\n', err);
  process.exit(1);
});
