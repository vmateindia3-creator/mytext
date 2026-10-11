const express = require('express');
const multer = require('multer');
const Conversation = require('../models/Conversation');
const { requireAuth } = require('../middleware/auth');
const storage = require('../utils/storage');

const router = express.Router();

// Keep the file in memory so any storage driver (local / S3 / Cloudinary) can
// receive the raw bytes.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

/**
 * POST /api/upload  (multipart form field: "file", optional "conversationId")
 * Stores the file using the configured driver and returns a URL to attach.
 */
router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no file uploaded' });

    // If a conversation id is supplied, make sure the sender belongs to it.
    if (req.body.conversationId) {
      const conv = await Conversation.findById(req.body.conversationId);
      if (!conv || !conv.members.some((m) => m.toString() === req.user._id.toString())) {
        return res.status(403).json({ error: 'not a member of this conversation' });
      }
    }

    const { url, key } = await storage.putObject({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    });

    res.status(201).json({
      url,
      key,
      name: req.file.originalname,
      mime: req.file.mimetype,
      size: req.file.size,
    });
  } catch (err) {
    console.error('[upload]', err);
    res.status(500).json({ error: err.message || 'upload failed' });
  }
});

module.exports = router;
