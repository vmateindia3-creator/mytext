const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    // "direct" = 1:1 chat, "group" = many members
    type: { type: String, enum: ['direct', 'group'], default: 'direct' },
    name: { type: String, trim: true, maxlength: 64 }, // group name
    avatarUrl: { type: String, default: '' },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// A stable key for direct chats so we never create duplicates.
conversationSchema.statics.directKey = function directKey(a, b) {
  return [a.toString(), b.toString()].sort().join(':');
};

module.exports = mongoose.model('Conversation', conversationSchema);
