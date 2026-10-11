const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // Phone number in a normalised form, e.g. "+919876543210".
    phone: { type: String, trim: true, unique: true, sparse: true },

    // Always set (auto-generated for phone sign-ups) so the unique index holds.
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 24,
    },
    displayName: { type: String, trim: true, maxlength: 48 },

    // Empty for accounts that sign in with a phone number + OTP.
    passwordHash: { type: String, default: '' },

    avatarUrl: { type: String, default: '' },
    lastSeen: { type: Date, default: Date.now },
    online: { type: Boolean, default: false },

    // True once the phone number has been confirmed with an OTP.
    verified: { type: Boolean, default: false },

    // One-time-password state. Only a hash of the code is ever stored.
    otpHash: { type: String, default: '' },
    otpExpiresAt: { type: Date, default: null },
    otpLastSentAt: { type: Date, default: null },
    otpAttempts: { type: Number, default: 0 },

    // Device tokens for push notifications (Firebase Cloud Messaging).
    pushTokens: [{ type: String }],

    // Base64-encoded X25519 public key, used for end-to-end encryption.
    publicKey: { type: String, default: '' },
  },
  { timestamps: true }
);

// Never leak the password hash (or OTP state) to clients.
userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    username: this.username,
    displayName: this.displayName || this.username,
    phone: this.phone || '',
    avatarUrl: this.avatarUrl,
    online: this.online,
    lastSeen: this.lastSeen,
    publicKey: this.publicKey,
  };
};

module.exports = mongoose.model('User', userSchema);
