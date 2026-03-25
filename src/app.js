const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { nodeEnv } = require('./config/env');
const { generalLimiter, authLimiter, verifyLimiter } = require('./middlewares/rate-limit.middleware');

const app = express();

// Middlewares globales
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json());
app.use(generalLimiter);
if (nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Root redirect
app.get('/', (_req, res) => res.redirect('/admin'));

// Static files
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', build: '20260325b' });
});

// Diagnostics (public temporarily for debugging)
app.get('/api/diagnostics', (_req, res) => {
  try {
    const fs = require('fs');
    const uploadsPath = path.join(__dirname, 'public', 'uploads', 'badges');
    const exists = fs.existsSync(uploadsPath);

    let writable = false;
    let writeError = null;
    if (exists) {
      const testFile = path.join(uploadsPath, '.write-test-' + Date.now());
      try {
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        writable = true;
      } catch (e) { writeError = e.message; }
    }

    const safeEnv = {};
    const hide = ['PASSWORD', 'PASS', 'SECRET', 'KEY'];
    for (const [k, v] of Object.entries(process.env)) {
      safeEnv[k] = hide.some((h) => k.toUpperCase().includes(h)) ? '***' : v;
    }

    res.json({
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uploadsPath,
      uploadsExists: exists,
      uploadsWritable: writable,
      writeError,
      dirname: __dirname,
      cwd: process.cwd(),
      env: safeEnv,
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Badge background upload
app.post('/api/upload-test', require('./middlewares/auth.middleware').requireAuth, (req, res) => {
  try {
    const multer = require('multer');
    const fs = require('fs');
    const uploadsDir = path.join(__dirname, 'public', 'uploads', 'badges');
    try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (_) {}

    const upload = multer({
      dest: uploadsDir,
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_r, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, ['.png', '.jpg', '.jpeg'].includes(ext));
      },
    });

    upload.single('image')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message, code: err.code });
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
      const newPath = req.file.path + ext;
      const newName = req.file.filename + ext;
      try { fs.renameSync(req.file.path, newPath); } catch (e) {
        return res.status(500).json({ error: 'Rename failed: ' + e.message });
      }
      res.json({ url: '/uploads/badges/' + newName });
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// DID Document (did:web resolution)
app.get('/.well-known/did.json', (_req, res, next) => {
  try {
    const { getDidDocument } = require('./services/did.service');
    res.json(getDidDocument());
  } catch (err) {
    next(err);
  }
});

// Auth
app.use('/api/auth', authLimiter, require('./routes/auth.routes'));

// Rutas
app.use('/api/issuers', require('./routes/issuer.routes'));
app.use('/api/badge-classes', require('./routes/badge-class.routes'));
app.use('/api/recipients', require('./routes/recipient.routes'));
app.use('/api/assertions', require('./routes/assertion.routes'));

// Verificación pública
app.use('/verify', verifyLimiter, require('./routes/verifier.routes'));
app.use('/api/status-list', require('./routes/status-list.routes'));

// Error handler
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

module.exports = app;
