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

// Email test (temporary) — uses raw fetch to bypass MSAL network issues
app.get('/api/test-email', require('./middlewares/auth.middleware').requireAuth, async (_req, res) => {
  const https = require('https');
  const env = {
    MS365_TENANT_ID: process.env.MS365_TENANT_ID ? 'set (' + process.env.MS365_TENANT_ID.substring(0, 8) + '...)' : 'NOT SET',
    MS365_CLIENT_ID: process.env.MS365_CLIENT_ID ? 'set (' + process.env.MS365_CLIENT_ID.substring(0, 8) + '...)' : 'NOT SET',
    MS365_CLIENT_SECRET: process.env.MS365_CLIENT_SECRET ? 'set (length: ' + process.env.MS365_CLIENT_SECRET.length + ')' : 'NOT SET',
    MS365_USER_ID: process.env.MS365_USER_ID || 'NOT SET',
    MS365_SHARED_MAILBOX: process.env.MS365_SHARED_MAILBOX || 'NOT SET',
  };

  if (!process.env.MS365_TENANT_ID) {
    return res.json({ ok: false, step: 'config', error: 'MS365_TENANT_ID not set', env });
  }

  // Step 1: Test DNS/network to login.microsoftonline.com
  function httpsPost(url, body, headers) {
    return new Promise((resolve, reject) => {
      const u = new URL(url);
      const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST', headers }, (resp) => {
        let data = '';
        resp.on('data', (c) => data += c);
        resp.on('end', () => {
          try { resolve({ status: resp.statusCode, body: JSON.parse(data) }); }
          catch (_) { resolve({ status: resp.statusCode, body: data }); }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  // Step 2: Get token via raw HTTPS
  let token;
  try {
    const tokenUrl = `https://login.microsoftonline.com/${process.env.MS365_TENANT_ID}/oauth2/v2.0/token`;
    const tokenBody = new URLSearchParams({
      client_id: process.env.MS365_CLIENT_ID,
      client_secret: process.env.MS365_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }).toString();
    const tokenResp = await httpsPost(tokenUrl, tokenBody, { 'Content-Type': 'application/x-www-form-urlencoded' });
    if (tokenResp.body.access_token) {
      token = tokenResp.body.access_token;
    } else {
      return res.json({ ok: false, step: 'auth', tokenResponse: tokenResp, env });
    }
  } catch (err) {
    return res.json({ ok: false, step: 'network', error: err.message, code: err.code, env });
  }

  // Step 3: Send test email via raw Graph API
  try {
    const userId = process.env.MS365_USER_ID;
    const fromEmail = process.env.MS365_SHARED_MAILBOX || userId;
    const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userId)}/sendMail`;
    const mailBody = JSON.stringify({
      message: {
        subject: 'Open Badges - Test Email',
        body: { contentType: 'HTML', content: '<h2>Email de prueba</h2><p>Microsoft Graph funciona correctamente.</p>' },
        from: { emailAddress: { address: fromEmail, name: 'Open Badges Test' } },
        toRecipients: [{ emailAddress: { address: fromEmail, name: 'Test' } }],
      },
      saveToSentItems: true,
    });
    const sendResp = await httpsPost(graphUrl, mailBody, {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    });

    if (sendResp.status === 202 || sendResp.status === 200) {
      return res.json({ ok: true, step: 'sent', sentTo: fromEmail, env });
    }
    return res.json({ ok: false, step: 'send', graphResponse: sendResp, env });
  } catch (err) {
    return res.json({ ok: false, step: 'send-network', error: err.message, code: err.code, env });
  }
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
app.use('/api/learning-paths', require('./routes/learning-path.routes'));

// Widget embebible
app.use('/widget', require('./routes/widget.routes'));

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
