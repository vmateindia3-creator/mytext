/**
 * End-to-end smoke test.
 * Boots an in-memory MongoDB, starts the real HTTP + socket server and walks
 * through the full happy path: register -> login -> create a direct chat ->
 * send a message over the socket -> read history -> upload a file.
 *
 * Run with:  npm test
 */
const assert = require('assert');
const http = require('http');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { io: ioClient } = require('socket.io-client');

async function main() {
  process.env.JWT_SECRET = 'test-secret';
  process.env.PUBLIC_URL = '';
  process.env.CORS_ORIGIN = '*';

  console.log('1. starting in-memory MongoDB...');
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri('wavechat_test');

  const { createApp } = require('../src/index');
  const { initSockets } = require('../src/sockets');
  const { connectDB } = require('../src/config/db');

  const app = createApp();
  const server = http.createServer(app);
  initSockets(server, '*');
  await connectDB(process.env.MONGO_URI, { retries: 3 });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  console.log(`   server up on ${base}`);

  const api = async (method, path, body, token) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await res.json() };
  };

  console.log('2. health check...');
  const health = await api('GET', '/health');
  assert.strictEqual(health.status, 200);
  assert.strictEqual(health.data.status, 'ok');

  console.log('3. register two users...');
  const alice = await api('POST', '/api/auth/register', {
    username: 'alice',
    password: 'secret123',
    displayName: 'Alice',
  });
  assert.strictEqual(alice.status, 201, JSON.stringify(alice.data));
  assert.ok(alice.data.token, 'expected a token');

  const bob = await api('POST', '/api/auth/register', {
    username: 'bob',
    password: 'secret123',
    displayName: 'Bob',
  });
  assert.strictEqual(bob.status, 201, JSON.stringify(bob.data));

  console.log('4. duplicate username is rejected...');
  const dup = await api('POST', '/api/auth/register', { username: 'alice', password: 'secret123' });
  assert.strictEqual(dup.status, 409);

  console.log('5. login works...');
  const login = await api('POST', '/api/auth/login', { username: 'alice', password: 'secret123' });
  assert.strictEqual(login.status, 200);
  assert.ok(login.data.token);

  console.log('6. bad password is rejected...');
  const badLogin = await api('POST', '/api/auth/login', { username: 'alice', password: 'wrong' });
  assert.strictEqual(badLogin.status, 401);

  console.log('7. search finds the other user...');
  const search = await api('GET', '/api/users?q=bob', null, alice.data.token);
  assert.strictEqual(search.status, 200);
  assert.strictEqual(search.data.users.length, 1);
  assert.strictEqual(search.data.users[0].username, 'bob');

  console.log('8. create a direct conversation...');
  const conv = await api(
    'POST',
    '/api/conversations',
    { type: 'direct', userId: bob.data.user.id },
    alice.data.token
  );
  assert.strictEqual(conv.status, 201, JSON.stringify(conv.data));
  const convId = conv.data.conversation.id;

  console.log('9. creating it again reuses the same conversation...');
  const conv2 = await api(
    'POST',
    '/api/conversations',
    { type: 'direct', userId: bob.data.user.id },
    alice.data.token
  );
  assert.strictEqual(conv2.data.conversation.id, convId);

  console.log('10. group conversation...');
  const group = await api(
    'POST',
    '/api/conversations',
    { type: 'group', name: 'Test Group', memberIds: [bob.data.user.id] },
    alice.data.token
  );
  assert.strictEqual(group.status, 201);
  assert.strictEqual(group.data.conversation.type, 'group');

  console.log('11. real-time message over socket.io...');
  const bobSocket = ioClient(base, { auth: { token: bob.data.token }, transports: ['websocket'] });
  const aliceSocket = ioClient(base, {
    auth: { token: alice.data.token },
    transports: ['websocket'],
  });

  await Promise.all([
    new Promise((r) => bobSocket.on('connect', r)),
    new Promise((r) => aliceSocket.on('connect', r)),
  ]);

  const received = new Promise((resolve) => bobSocket.on('message:new', resolve));
  await new Promise((r) => bobSocket.emit('conversation:join', { conversationId: convId }, r));

  const ack = await new Promise((r) =>
    aliceSocket.emit('message:send', { conversationId: convId, text: 'hello bob!' }, r)
  );
  assert.strictEqual(ack.ok, true, JSON.stringify(ack));

  const delivered = await received;
  assert.strictEqual(delivered.text, 'hello bob!');
  assert.strictEqual(delivered.sender.username, 'alice');
  console.log('   message delivered in real time ✓');

  console.log('12. history endpoint returns the message...');
  const history = await api('GET', `/api/conversations/${convId}/messages`, null, bob.data.token);
  assert.strictEqual(history.status, 200);
  assert.strictEqual(history.data.messages.length, 1);
  assert.strictEqual(history.data.messages[0].text, 'hello bob!');

  console.log('13. non-members are blocked...');
  const carol = await api('POST', '/api/auth/register', { username: 'carol', password: 'secret123' });
  const blocked = await api(
    'GET',
    `/api/conversations/${convId}/messages`,
    null,
    carol.data.token
  );
  assert.strictEqual(blocked.status, 403);

  console.log('14. file upload...');
  const form = new FormData();
  form.append('file', new Blob([Buffer.from('hello file')], { type: 'text/plain' }), 'note.txt');
  form.append('conversationId', convId);
  const upRes = await fetch(base + '/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${alice.data.token}` },
    body: form,
  });
  const up = await upRes.json();
  assert.strictEqual(upRes.status, 201, JSON.stringify(up));
  assert.ok(up.url.includes('/uploads/'), 'expected a media url');

  console.log('15. conversation list shows the chat...');
  const list = await api('GET', '/api/conversations', null, alice.data.token);
  assert.strictEqual(list.status, 200);
  assert.ok(list.data.conversations.length >= 2);

  aliceSocket.close();
  bobSocket.close();
  server.close();
  await mongo.stop();

  console.log('\nALL TESTS PASSED ✓');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nTEST FAILED ✗\n', err);
  process.exit(1);
});
