'use strict';

require('dotenv').config();
const env = require('../src/config/env');

env.assertStartupConfig();

console.log('Doctor check passed.');
console.log(`PORT=${env.PORT}`);
console.log(`MAIL_MODE=${env.MAIL_MODE}`);
console.log(`RECAPTCHA_ENABLED=${env.RECAPTCHA_ENABLED}`);
console.log(`Allowed origins=${env.ALLOWED_ORIGINS.join(', ') || '(none)'}`);
