'use strict';

const app = require('./src/app');
const env = require('./src/config/env');
const { verifyMailer } = require('./src/services/mail.service');

async function startServer() {
  env.assertStartupConfig();
  await verifyMailer();

  app.listen(env.PORT, () => {
    console.log(`Portfolio server is running: http://localhost:${env.PORT}`);
    console.log(`Contact endpoint: http://localhost:${env.PORT}/api/contact`);
    console.log(`Mail mode: ${env.MAIL_MODE}`);
    console.log(`reCAPTCHA enabled: ${env.RECAPTCHA_ENABLED}`);
  });
}

startServer().catch((error) => {
  console.error('Startup failed:', error.message);
  if (process.env.NODE_ENV !== 'production') console.error(error);
  process.exit(1);
});
