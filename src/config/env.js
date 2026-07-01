'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function toCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function clean(value, fallback = '') {
  const result = String(value ?? '').trim();
  return result || fallback;
}

const env = {
  NODE_ENV: clean(process.env.NODE_ENV, 'development'),
  PORT: toNumber(process.env.PORT, 3000),
  TRUST_PROXY: toNumber(process.env.TRUST_PROXY, 0),

  SITE_ORIGIN: clean(process.env.SITE_ORIGIN, 'http://localhost:3000').replace(/\/$/, ''),
  ALLOWED_ORIGINS: toCsv(process.env.ALLOWED_ORIGINS || process.env.SITE_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5500,http://127.0.0.1:5500'),

  MAIL_MODE: clean(process.env.MAIL_MODE, 'console').toLowerCase(),
  MAIL_TO: clean(process.env.MAIL_TO, 'khaled.yous3f19@gmail.com'),
  MAIL_FROM: clean(process.env.MAIL_FROM || process.env.SMTP_USER || 'Portfolio Contact <no-reply@localhost>'),
  SMTP_HOST: clean(process.env.SMTP_HOST),
  SMTP_PORT: toNumber(process.env.SMTP_PORT, 465),
  SMTP_SECURE: toBoolean(process.env.SMTP_SECURE, true),
  SMTP_USER: clean(process.env.SMTP_USER),
  SMTP_PASS: clean(process.env.SMTP_PASS),

  RECAPTCHA_ENABLED: toBoolean(process.env.RECAPTCHA_ENABLED, false),
  RECAPTCHA_SECRET_KEY: clean(process.env.RECAPTCHA_SECRET_KEY),
  RECAPTCHA_MIN_SCORE: toNumber(process.env.RECAPTCHA_MIN_SCORE, 0.5),
  RECAPTCHA_EXPECTED_ACTION: clean(process.env.RECAPTCHA_EXPECTED_ACTION, 'contact'),
  RECAPTCHA_ALLOWED_HOSTNAMES: toCsv(process.env.RECAPTCHA_ALLOWED_HOSTNAMES || 'localhost,127.0.0.1'),

  GLOBAL_RATE_LIMIT_WINDOW_MS: toNumber(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  GLOBAL_RATE_LIMIT_MAX: toNumber(process.env.GLOBAL_RATE_LIMIT_MAX, 180),
  CONTACT_RATE_LIMIT_WINDOW_MS: toNumber(process.env.CONTACT_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  CONTACT_RATE_LIMIT_MAX: toNumber(process.env.CONTACT_RATE_LIMIT_MAX, 5),

  assertStartupConfig() {
    if (!['console', 'smtp'].includes(this.MAIL_MODE)) {
      throw new Error('MAIL_MODE must be either console or smtp.');
    }

    if (this.MAIL_MODE === 'smtp') {
      const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'MAIL_TO'].filter((key) => !this[key]);
      if (missing.length) throw new Error(`Missing SMTP environment variables: ${missing.join(', ')}`);
    }

    if (this.RECAPTCHA_ENABLED && !this.RECAPTCHA_SECRET_KEY) {
      throw new Error('RECAPTCHA_SECRET_KEY is required when RECAPTCHA_ENABLED=true.');
    }
  }
};

module.exports = env;
