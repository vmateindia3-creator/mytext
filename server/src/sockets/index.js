const { Server } = require('socket.io');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { verifyToken } = require('../middleware/auth');
const { createMessage } = require('../utils/messages');
const { iceServers } = require('../utils/ice');

/** userId -> Set<socketId> so we can track multi-device presence. */
const onlineSockets = new Map();

function room(conversationId) {
  return `conv:${conversationId}`;
}
function userRoom(userId) {
  return `user:${userId}`;
}

async function isMember(conversationId, userId) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) return null;
  const ok = conv.members.some((m) => m.toString() === userId.toString());
  return ok ? conv : null;
}

function initSockets(httpServer, corsOrigin) {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin === '*' ? true : corsOrigin.split(','), credentials: true },
    maxHttpBufferSize: 1e6,
  });

  // Authenticate every socket connection with the same JWT used by the API.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('missing token'));
      const payload = verifyToken(token);
      const user = await User.findById(payload.sub);
      if (!user) return next(new Error('user not found'));
      socket.userId = user._id.toString();
      next();
    } catch (err) {
      next(new Error('invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const uid = socket.userId;

    // Presence bookkeeping.
    if (!onlineSockets.has(uid)) onlineSockets.set(uid, new Set());
    onlineSockets.get(uid).add(socket.id);

    socket.join(userRoom(uid));
    await User.findByIdAndUpdate(uid, { online: true, lastSeen: new Date() });
    io.emit('presence', { userId: uid, online: true });

    // Tell the client which ICE servers to use for calls.
    socket.emit('ice-servers', { iceServers: iceServers() });

    // ---- Conversation rooms ----------------------------------------------
    socket.on('conversation:join', async ({ conversationId } = {}, ack) => {
      const conv = await isMember(conversationId, uid);
      if (!conv) return typeof ack === 'function' && ack({ error: 'not a member' });
      socket.join(room(conversationId));
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('conversation:leave', ({ conversationId } = {}) => {
      if (conversationId) socket.leave(room(conversationId));
    });

    // ---- Sending messages -------------------------------------------------
    socket.on('message:send', async (payload = {}, ack) => {
      try {
        const { conversationId, text = '', kind = 'text', media = {} } = payload;
        const conv = await isMember(conversationId, uid);
        if (!conv) return typeof ack === 'function' && ack({ error: 'not a member' });

        const message = await createMessage({
          conversation: conv,
          sender: socket.userId,
          kind,
          text: (text || '').slice(0, 4000),
          media,
        });

        io.to(room(conversationId)).emit('message:new', message);
        // Also nudge members' personal rooms so their chat list updates.
        conv.members.forEach((m) => {
          io.to(userRoom(m.toString())).emit('conversation:updated', {
            conversationId: conversationId.toString(),
            lastMessage: message,
          });
        });

        if (typeof ack === 'function') ack({ ok: true, message });
      } catch (err) {
        console.error('[socket message:send]', err);
        if (typeof ack === 'function') ack({ error: 'could not send message' });
      }
    });

    // ---- Typing indicator -------------------------------------------------
    socket.on('typing', ({ conversationId, typing } = {}) => {
      if (!conversationId) return;
      socket.to(room(conversationId)).emit('typing', {
        conversationId,
        userId: uid,
        typing: !!typing,
      });
    });

    // ---- Read receipts ----------------------------------------------------
    socket.on('message:read', async ({ conversationId, messageId } = {}) => {
      const conv = await isMember(conversationId, uid);
      if (!conv) return;
      const Message = require('../models/Message');
      await Message.updateOne({ _id: messageId }, { $addToSet: { readBy: uid } });
      io.to(room(conversationId)).emit('message:read', { conversationId, messageId, userId: uid });
    });

    // ---- WebRTC call signalling ------------------------------------------
    // These events are relayed to the target user's personal room. The server
    // never inspects the SDP/ICE payloads; it only routes them.
    const relay = (event) => (payload = {}) => {
      const { to, ...rest } = payload;
      if (!to) return;
      io.to(userRoom(to)).emit(event, { ...rest, from: uid });
    };
    socket.on('call:invite', relay('call:invite'));
    socket.on('call:offer', relay('call:offer'));
    socket.on('call:answer', relay('call:answer'));
    socket.on('call:ice', relay('call:ice'));
    socket.on('call:end', relay('call:end'));
    socket.on('call:reject', relay('call:reject'));

    // ---- Disconnect -------------------------------------------------------
    socket.on('disconnect', async () => {
      const set = onlineSockets.get(uid);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          onlineSockets.delete(uid);
          await User.findByIdAndUpdate(uid, { online: false, lastSeen: new Date() });
          io.emit('presence', { userId: uid, online: false });
        }
      }
    });
  });

  return io;
}

module.exports = { initSockets };
