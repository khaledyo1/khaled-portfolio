'use strict';

const fs = require('fs/promises');
const path = require('path');
const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeSubject(name) {
  const cleanName = String(name || 'Website visitor')
    .replace(/[\r\n]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 80);

  return `Portfolio contact message from ${cleanName || 'Website visitor'}`;
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      },
      connectionTimeout: 12_000,
      greetingTimeout: 12_000,
      socketTimeout: 20_000
    });
  }
  return transporter;
}

function buildEmail({ name, email, message, ip, userAgent, captchaScore }) {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');
  const safeIp = escapeHtml(ip || 'unknown');
  const safeUserAgent = escapeHtml(userAgent || 'unknown');
  const safeScore = escapeHtml(captchaScore ?? 'n/a');

  const text = [
    'New portfolio contact message',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    `IP: ${ip || 'unknown'}`,
    `User-Agent: ${userAgent || 'unknown'}`,
    `reCAPTCHA score: ${captchaScore ?? 'n/a'}`,
    '',
    'Message:',
    message
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2 style="margin:0 0 12px">New portfolio contact message</h2>
      <p><strong>Name:</strong> ${safeName}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>IP:</strong> ${safeIp}</p>
      <p><strong>User-Agent:</strong> ${safeUserAgent}</p>
      <p><strong>reCAPTCHA score:</strong> ${safeScore}</p>
      <hr>
      <p><strong>Message:</strong></p>
      <p>${safeMessage}</p>
    </div>`;

  return { text, html };
}

async function verifyMailer() {
  if (env.MAIL_MODE === 'console') {
    await fs.mkdir(path.resolve(process.cwd(), 'storage'), { recursive: true });
    console.log('Mailer ready in console mode. Messages will be written to storage/contact-messages.log');
    return true;
  }

  await getTransporter().verify();
  console.log('SMTP mailer verified successfully.');
  return true;
}

async function writeConsoleMessage(emailPayload) {
  const logPath = path.resolve(process.cwd(), 'storage', 'contact-messages.log');
  const entry = [
    '============================================================',
    `Date: ${new Date().toISOString()}`,
    `To: ${env.MAIL_TO}`,
    `Subject: ${emailPayload.subject}`,
    '',
    emailPayload.text,
    ''
  ].join('\n');

  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.appendFile(logPath, entry, 'utf8');
  console.log(entry);
}

async function sendContactEmail({ name, email, message, ip, userAgent, captchaScore }) {
  const content = buildEmail({ name, email, message, ip, userAgent, captchaScore });

  const emailPayload = {
    from: env.MAIL_FROM,
    to: env.MAIL_TO,
    replyTo: email,
    subject: safeSubject(name),
    text: content.text,
    html: content.html
  };

  if (env.MAIL_MODE === 'console') {
    await writeConsoleMessage(emailPayload);
    return { ok: true, mode: 'console' };
  }

  const info = await getTransporter().sendMail(emailPayload);
  return { ok: true, mode: 'smtp', messageId: info.messageId };
}

module.exports = { sendContactEmail, verifyMailer };
