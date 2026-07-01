'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const env = require('./config/env');
const contactRoutes = require('./routes/contact.routes');
const { globalLimiter } = require('./middlewares/rateLimiter.middleware');
const apiNotFound = require('./middlewares/notFound.middleware');
const errorHandler = require('./middlewares/error.middleware');

const chatHandler = require('../api/chat');

const app = express();
const publicDir = path.resolve(__dirname, '..', 'public');

app.set('trust proxy', env.TRUST_PROXY);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

const allowedOrigins = new Set(env.ALLOWED_ORIGINS);
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const normalized = String(origin).replace(/\/$/, '');
    if (allowedOrigins.has(normalized)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  maxAge: 600
}));

app.use(globalLimiter);

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'khaled-portfolio-express',
    status: 'ready',
    contact: 'ready'
  });
});

// Preserve the existing portfolio chatbot endpoint without exposing server files as static assets.
app.all('/api/chat', (req, res) => chatHandler(req, res));

app.use('/api/contact', contactRoutes);
app.use('/api', apiNotFound);

app.use(express.static(publicDir, {
  extensions: ['html'],
  index: 'index.html',
  maxAge: env.NODE_ENV === 'production' ? '1h' : 0,
  setHeaders(res, filePath) {
    if (/\.(html)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));

app.get('*', (_req, res) => {
  res.status(404).sendFile(path.join(publicDir, '404.html'));
});

app.use(errorHandler);

module.exports = app;
