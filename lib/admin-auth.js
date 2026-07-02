"use strict";

/**
 * مصادقة لوحة الإدارة بدون قاعدة بيانات.
 * الفكرة: كلمة المرور تُستخدم فقط لتوليد جلسة موقّعة داخل Cookie آمن.
 * بعد تسجيل الدخول، عمليات الحفظ والفحص تستخدم الجلسة + CSRF token بدل إرسال كلمة المرور كل مرة.
 */

const crypto = require("crypto");
const { cleanText, isProductionRuntime } = require("./server-utils");

const COOKIE_NAME = "kp_admin_session";
const DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60;
const SCRYPT_KEY_LENGTH = 64;

function sessionTtlSeconds() {
  const raw = Number(process.env.ADMIN_SESSION_TTL_SECONDS || DEFAULT_SESSION_TTL_SECONDS);
  if (!Number.isFinite(raw)) return DEFAULT_SESSION_TTL_SECONDS;
  return Math.min(Math.max(Math.floor(raw), 900), 86_400);
}

function authSecret() {
  return String(
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD_HASH ||
    process.env.ADMIN_PASSWORD ||
    ""
  );
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(String(value || ""), "base64url").toString("utf8");
}

function sign(value, secret = authSecret()) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function parseCookies(req) {
  const header = String(req.headers.cookie || "");
  return header.split(";").reduce((cookies, part) => {
    const index = part.indexOf("=");
    if (index === -1) return cookies;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function sessionCookieOptions(maxAgeSeconds) {
  const parts = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`
  ];
  if (isProductionRuntime()) parts.push("Secure");
  return parts;
}

function setSessionCookie(res, token) {
  const parts = sessionCookieOptions(sessionTtlSeconds());
  parts[0] = `${COOKIE_NAME}=${encodeURIComponent(token)}`;
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res) {
  const parts = sessionCookieOptions(0);
  parts.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function createSessionToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: "portfolio-admin",
    iat: now,
    exp: now + sessionTtlSeconds(),
    nonce: crypto.randomBytes(18).toString("base64url")
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

function verifySessionToken(token) {
  const raw = cleanText(token, 4_000);
  const [encoded, signature] = raw.split(".");
  if (!encoded || !signature || !authSecret()) return null;
  if (!safeEqual(signature, sign(encoded))) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encoded));
    const now = Math.floor(Date.now() / 1000);
    if (payload?.sub !== "portfolio-admin") return null;
    if (!Number.isFinite(Number(payload.exp)) || Number(payload.exp) < now) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function getSessionToken(req) {
  return parseCookies(req)[COOKIE_NAME] || "";
}

function getSession(req) {
  const token = getSessionToken(req);
  const payload = verifySessionToken(token);
  return payload ? { token, payload } : null;
}

function csrfForSessionToken(token) {
  return sign(`csrf:${token}`);
}

function csrfFromRequest(req) {
  return cleanText(req.headers["x-csrf-token"] || req.headers["x-admin-csrf"] || "", 500);
}

function verifyCsrf(req, token) {
  const expected = csrfForSessionToken(token);
  const received = csrfFromRequest(req);
  return Boolean(received && safeEqual(received, expected));
}

function requireAdminSession(req, options = {}) {
  const session = getSession(req);
  if (!session) {
    return { ok: false, status: 401, message: "جلسة الإدارة غير فعالة. سجّل الدخول أولاً." };
  }
  if (options.requireCsrf !== false && !verifyCsrf(req, session.token)) {
    return { ok: false, status: 403, message: "فشل فحص CSRF. أعد تسجيل الدخول ثم حاول مرة أخرى." };
  }
  return {
    ok: true,
    session,
    csrfToken: csrfForSessionToken(session.token),
    expiresAt: new Date(Number(session.payload.exp) * 1000).toISOString()
  };
}

function makePasswordHash(password, salt = crypto.randomBytes(18).toString("base64url")) {
  const safePassword = String(password || "");
  const hash = crypto.scryptSync(safePassword, salt, SCRYPT_KEY_LENGTH).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}

function verifyPasswordHash(password, storedHash) {
  const value = cleanText(storedHash, 1_000);
  const [scheme, salt, expectedHash] = value.split("$");
  if (scheme !== "scrypt" || !salt || !expectedHash) return false;
  const actualHash = crypto.scryptSync(String(password || ""), salt, SCRYPT_KEY_LENGTH).toString("base64url");
  return safeEqual(actualHash, expectedHash);
}

function verifyAdminPassword(password) {
  const rawPassword = String(password || "");
  if (!rawPassword) return false;

  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (passwordHash) return verifyPasswordHash(rawPassword, passwordHash);

  const plainPassword = process.env.ADMIN_PASSWORD;
  if (!plainPassword) return false;
  return safeEqual(rawPassword, plainPassword);
}

module.exports = {
  COOKIE_NAME,
  clearSessionCookie,
  createSessionToken,
  csrfForSessionToken,
  getSession,
  makePasswordHash,
  requireAdminSession,
  setSessionCookie,
  verifyAdminPassword
};
