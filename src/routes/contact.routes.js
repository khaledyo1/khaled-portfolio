'use strict';

const express = require('express');
const { contactLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  validateContactRequest,
  sendContactMessage
} = require('../controllers/contact.controller');

const router = express.Router();

router.post(
  '/',
  contactLimiter,
  express.json({ limit: '20kb', type: ['application/json', 'application/*+json'] }),
  validateContactRequest,
  sendContactMessage
);

module.exports = router;
