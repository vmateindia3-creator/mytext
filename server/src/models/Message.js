const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // "text" | "image" | "file" | "call"
    kind: { type: String, enum: ['text', 'image', 'file', 'call'], default: 'text' },
    text: { type: String, default: '', maxlength: 4000 },

    // End-to-end encryption. When true, `text` is empty and the real content
    // lives in `enc`, which the server cannot read.
    //   enc = { ciphertext, nonce, keys: { <userId>: <encryptedKey> } }
    encrypted: { type: Boolean, default: false },
    enc: { type: mongoose.Schema.Types.Mixed, default: null },
    // For media messages: relative path served by this server.
    mediaUrl: { type: String, default: '' },
    mediaName: { type: String, default: '' },
    mediaMime: { type: String, default: '' },
    mediaSize: { type: Number, default: 0 },
    // Read receipts: which members have seen this message.
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
