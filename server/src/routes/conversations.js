const express = require('express');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { shapeMessage } = require('../utils/messages');

const router = express.Router();

async function populateConversation(conv) {
  await conv.populate([
    { path: 'members', select: 'username displayName avatarUrl online lastSeen' },
    { path: 'lastMessage' },
  ]);
  return conv;
}

function shape(conv) {
  return {
    id: conv._id.toString(),
    type: conv.type,
    name: conv.name || '',
    avatarUrl: conv.avatarUrl || '',
    members: conv.members.map((m) => ({
      id: m._id.toString(),
      username: m.username,
      displayName: m.displayName || m.username,
      avatarUrl: m.avatarUrl,
      online: m.online,
      lastSeen: m.lastSeen,
    })),
    lastMessage: conv.lastMessage
      ? {
          id: conv.lastMessage._id.toString(),
          text: conv.lastMessage.text,
          kind: conv.lastMessage.kind,
          createdAt: conv.lastMessage.createdAt,
        }
      : null,
    lastMessageAt: conv.lastMessageAt,
  };
}

/** GET /api/conversations — every chat the signed-in user belongs to. */
router.get('/', requireAuth, async (req, res) => {
  try {
    const convs = await Conversation.find({ members: req.user._id })
      .sort({ lastMessageAt: -1 })
      .limit(100);
    await Promise.all(convs.map(populateConversation));
    res.json({ conversations: convs.map(shape) });
  } catch (err) {
    console.error('[conversations/list]', err);
    res.status(500).json({ error: 'could not load conversations' });
  }
});

/**
 * POST /api/conversations
 * body: { type: "direct", userId }  OR  { type: "group", name, memberIds: [] }
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { type = 'direct', userId, name, memberIds = [] } = req.body || {};

    if (type === 'direct') {
      if (!userId) return res.status(400).json({ error: 'userId is required' });
      const other = await User.findById(userId);
      if (!other) return res.status(404).json({ error: 'user not found' });

      const members = [req.user._id, other._id];
      let conv = await Conversation.findOne({
        type: 'direct',
        members: { $all: members, $size: 2 },
      });
      if (!conv) {
        conv = await Conversation.create({ type: 'direct', members });
      }
      await populateConversation(conv);
      return res.status(201).json({ conversation: shape(conv) });
    }

    if (type === 'group') {
      const uniqueIds = [...new Set(memberIds.map(String))].filter(
        (id) => id !== req.user._id.toString()
      );
      if (!name) return res.status(400).json({ error: 'group name is required' });
      if (uniqueIds.length < 1) {
        return res.status(400).json({ error: 'add at least one other member' });
      }
      const members = [req.user._id, ...uniqueIds];
      const conv = await Conversation.create({
        type: 'group',
        name,
        members,
        admins: [req.user._id],
      });
      await populateConversation(conv);
      return res.status(201).json({ conversation: shape(conv) });
    }

    return res.status(400).json({ error: 'unknown conversation type' });
  } catch (err) {
    console.error('[conversations/create]', err);
    res.status(500).json({ error: 'could not create conversation' });
  }
});

/** GET /api/conversations/:id/messages?before=<iso> — paginated history. */
router.get('/:id/messages', requireAuth, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'conversation not found' });
    if (!conv.members.some((m) => m.toString() === req.user._id.toString())) {
      return res.status(403).json({ error: 'not a member of this conversation' });
    }

    const filter = { conversation: conv._id };
    if (req.query.before) {
      const before = new Date(req.query.before);
      if (!Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', 'username displayName avatarUrl');

    res.json({ messages: messages.reverse().map(shapeMessage) });
  } catch (err) {
    console.error('[conversations/messages]', err);
    res.status(500).json({ error: 'could not load messages' });
  }
});

module.exports = router;
