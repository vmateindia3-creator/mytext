const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 24,
    },
    displayName: { type: String, trim: true, maxlength: 48 },
    passwordHash: { type: String, required: true },
    avatarUrl: { type: String, default: '' },
    lastSeen: { type: Date, default: Date.now },
    online: { type: Boolean, default: false },

    // Device tokens for push notifications (Firebase Cloud Messaging).
    pushTokens: [{ type: String }],

    // Base64-encoded X25519 public key, used for end-to-end encryption.
    // The matching private key never leaves the user's device.
    publicKey: { type: String, default: '' },
  },
  { timestamps: true }
);

// Never leak the password hash to clients.
userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    username: this.username,
    displayName: this.displayName || this.username,
    avatarUrl: this.avatarUrl,
    online: this.online,
    lastSeen: this.lastSeen,
    publicKey: this.publicKey,
  };
};

module.exports = mongoose.model('User', userSchema);
