const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { nodeEnv } = require('./config/env');

const app = express();

// Middlewares globales
app.use(helmet());
app.use(cors());
app.use(express.json());
if (nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
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

// Rutas
app.use('/api/issuers', require('./routes/issuer.routes'));
app.use('/api/badge-classes', require('./routes/badge-class.routes'));
app.use('/api/recipients', require('./routes/recipient.routes'));
app.use('/api/assertions', require('./routes/assertion.routes'));

// Verificación pública
app.use('/verify', require('./routes/verifier.routes'));
app.use('/api/status-list', require('./routes/status-list.routes'));

// Error handler
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

module.exports = app;
