const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Conversation = require('../models/Conversation');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 10);
    const id = crypto.randomBytes(16).toString('hex');
    cb(null, `${Date.now()}-${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

/**
 * POST /api/upload  (multipart form field: "file", optional "conversationId")
 * Stores the file and returns a URL the app can attach to a message.
 */
router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no file uploaded' });

    // If a conversation id is supplied, make sure the sender belongs to it.
    if (req.body.conversationId) {
      const conv = await Conversation.findById(req.body.conversationId);
      if (!conv || !conv.members.some((m) => m.toString() === req.user._id.toString())) {
        fs.unlink(req.file.path, () => {});
        return res.status(403).json({ error: 'not a member of this conversation' });
      }
    }

    const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
    const relPath = `/uploads/${req.file.filename}`;
    res.status(201).json({
      url: base ? `${base}${relPath}` : relPath,
      name: req.file.originalname,
      mime: req.file.mimetype,
      size: req.file.size,
    });
  } catch (err) {
    console.error('[upload]', err);
    res.status(500).json({ error: 'upload failed' });
  }
});

module.exports = router;
