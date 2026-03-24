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

// Rutas
app.use('/api/issuers', require('./routes/issuer.routes'));
app.use('/api/badge-classes', require('./routes/badge-class.routes'));
app.use('/api/recipients', require('./routes/recipient.routes'));

// Error handler
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

module.exports = app;
