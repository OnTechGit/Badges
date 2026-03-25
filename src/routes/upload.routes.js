const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middlewares/auth.middleware');

const uploadPath = path.join(__dirname, '..', 'public', 'uploads', 'badges');
try { fs.mkdirSync(uploadPath, { recursive: true }); } catch (_) {}

const upload = multer({
  dest: uploadPath,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

const router = Router();

router.post('/badge-bg', requireAuth, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message, code: err.code || 'UPLOAD_ERROR' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // Rename to add extension (multer dest mode saves without extension)
    const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
    const newPath = req.file.path + ext;
    const newName = req.file.filename + ext;
    try {
      fs.renameSync(req.file.path, newPath);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to save file: ' + e.message });
    }
    res.json({ url: '/uploads/badges/' + newName });
  });
});

module.exports = router;
