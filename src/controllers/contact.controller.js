'use strict';

const { body, validationResult } = require('express-validator');
const { sendContactEmail } = require('../services/mail.service');
const { verifyRecaptcha } = require('../services/recaptcha.service');
const AppError = require('../utils/appError');

function sanitizeText(value, limit = 4000) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[ \t]{3,}/g, '  ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, limit);
}

const validateContactRequest = [
  body('name')
    .customSanitizer((value) => sanitizeText(value, 120))
    .isLength({ min: 2, max: 120 })
    .withMessage('Name must be between 2 and 120 characters.'),

  body('email')
    .customSanitizer((value) => String(value ?? '').trim().toLowerCase().slice(0, 180))
    .isEmail()
    .withMessage('A valid email address is required.')
    .normalizeEmail(),

  body('message')
    .customSanitizer((value) => sanitizeText(value, 4000))
    .isLength({ min: 10, max: 4000 })
    .withMessage('Message must be between 10 and 4000 characters.'),

  body('recaptchaToken')
    .optional({ checkFalsy: true })
    .isString()
    .isLength({ max: 5000 })
    .withMessage('Invalid reCAPTCHA token.'),

  body('website')
    .optional({ checkFalsy: true })
    .customSanitizer((value) => sanitizeText(value, 120))
    .isLength({ max: 120 })
    .withMessage('Invalid request.')
];

async function sendContactMessage(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { name, email, message, recaptchaToken, website } = req.body;

    // Honeypot field: bots often fill hidden inputs. Return fake success to avoid training them.
    if (website) {
      return res.status(200).json({ ok: true, message: 'Message sent successfully.' });
    }

    const captcha = await verifyRecaptcha(recaptchaToken, req.ip);

    await sendContactEmail({
      name,
      email,
      message,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      captchaScore: captcha.score
    });

    return res.status(200).json({
      ok: true,
      message: 'Message sent successfully.'
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { validateContactRequest, sendContactMessage };
