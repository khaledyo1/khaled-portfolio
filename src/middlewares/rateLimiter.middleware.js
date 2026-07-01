'use strict';

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

function rateLimitResponse(message) {
  return { ok: false, message };
}

const globalLimiter = rateLimit({
  windowMs: env.GLOBAL_RATE_LIMIT_WINDOW_MS,
  limit: env.GLOBAL_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitResponse('Too many requests. Please try again later.')
});

const contactLimiter = rateLimit({
  windowMs: env.CONTACT_RATE_LIMIT_WINDOW_MS,
  limit: env.CONTACT_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitResponse('Too many contact attempts. Please wait before sending another message.')
});

module.exports = { globalLimiter, contactLimiter };
