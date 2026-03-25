const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { requireAuth } = require('../middlewares/auth.middleware');

const uploadPath = path.join(__dirname, '..', 'public', 'uploads', 'badges');
fs.mkdirSync(uploadPath, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadPath,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomUUID() + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

const router = Router();

router.post('/badge-bg', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No valid image uploaded (PNG/JPG, max 5MB)' });
  }
  const url = `/uploads/badges/${req.file.filename}`;
  res.json({ url });
});

module.exports = router;
