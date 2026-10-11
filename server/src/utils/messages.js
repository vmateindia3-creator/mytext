const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

/**
 * Create a message, update the conversation's last-message pointer and return
 * a client-shaped object. Shared by the REST route and the socket handler so
 * both paths behave identically.
 */
async function createMessage({
  conversation,
  sender,
  kind = 'text',
  text = '',
  media = {},
  enc = null,
}) {
  const msg = await Message.create({
    conversation: conversation._id,
    sender: sender._id || sender,
    kind,
    text,
    encrypted: !!enc,
    enc,
    mediaUrl: media.url || '',
    mediaName: media.name || '',
    mediaMime: media.mime || '',
    mediaSize: media.size || 0,
  });

  conversation.lastMessage = msg._id;
  conversation.lastMessageAt = msg.createdAt;
  await conversation.save();

  await msg.populate('sender', 'username displayName avatarUrl');

  return shapeMessage(msg);
}

/** Turn a Message document into the JSON the apps consume. */
function shapeMessage(msg) {
  return {
    id: msg._id.toString(),
    conversation: msg.conversation.toString(),
    sender: {
      id: msg.sender._id.toString(),
      username: msg.sender.username,
      displayName: msg.sender.displayName || msg.sender.username,
      avatarUrl: msg.sender.avatarUrl,
    },
    kind: msg.kind,
    text: msg.text,
    encrypted: !!msg.encrypted,
    enc: msg.enc || null,
    mediaUrl: msg.mediaUrl,
    mediaName: msg.mediaName,
    mediaMime: msg.mediaMime,
    mediaSize: msg.mediaSize,
    readBy: (msg.readBy || []).map((r) => r.toString()),
    createdAt: msg.createdAt,
  };
}

module.exports = { createMessage, shapeMessage };
