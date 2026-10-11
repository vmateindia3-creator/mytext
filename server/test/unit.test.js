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
  console.log('\nUNIT TESTS PASSED ✓');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nUNIT TEST FAILED ✗\n', err);
  process.exit(1);
});
