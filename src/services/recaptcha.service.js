'use strict';

const env = require('../config/env');
const AppError = require('../utils/appError');

async function verifyRecaptcha(token, remoteIp) {
  if (!env.RECAPTCHA_ENABLED) {
    return { ok: true, score: 1, disabled: true };
  }

  if (!token || typeof token !== 'string') {
    throw new AppError('reCAPTCHA token is required.', 400, 'RECAPTCHA_TOKEN_MISSING');
  }

  const body = new URLSearchParams({
    secret: env.RECAPTCHA_SECRET_KEY,
    response: token
  });

  if (remoteIp) body.append('remoteip', remoteIp);

  let response;
  try {
    response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
  } catch (_) {
    throw new AppError('Could not reach reCAPTCHA verification service.', 502, 'RECAPTCHA_NETWORK_ERROR');
  }

  if (!response.ok) {
    throw new AppError('Could not verify reCAPTCHA.', 502, 'RECAPTCHA_VERIFY_FAILED');
  }

  const data = await response.json();

  if (!data.success) {
    throw new AppError('reCAPTCHA verification failed.', 400, 'RECAPTCHA_REJECTED');
  }

  if (env.RECAPTCHA_EXPECTED_ACTION && data.action !== env.RECAPTCHA_EXPECTED_ACTION) {
    throw new AppError('Invalid reCAPTCHA action.', 400, 'RECAPTCHA_ACTION_MISMATCH');
  }

  if (env.RECAPTCHA_ALLOWED_HOSTNAMES.length > 0 && !env.RECAPTCHA_ALLOWED_HOSTNAMES.includes(data.hostname)) {
    throw new AppError('Invalid reCAPTCHA hostname.', 400, 'RECAPTCHA_HOSTNAME_MISMATCH');
  }

  if (typeof data.score === 'number' && data.score < env.RECAPTCHA_MIN_SCORE) {
    throw new AppError('Message rejected by anti-spam protection.', 403, 'RECAPTCHA_LOW_SCORE');
  }

  return {
    ok: true,
    score: typeof data.score === 'number' ? data.score : null,
    action: data.action || null,
    hostname: data.hostname || null
  };
}

module.exports = { verifyRecaptcha };
