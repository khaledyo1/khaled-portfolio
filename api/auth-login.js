"use strict";

const {
  cleanText,
  clientIp,
  isRateLimited,
  parseJsonBody,
  resolveAllowedOrigin,
  sendJson
} = require("../lib/server-utils");
const {
  createSessionToken,
  csrfForSessionToken,
  setSessionCookie,
  verifyAdminPassword
} = require("../lib/admin-auth");

module.exports = async function handler(request, response) {
  const originCheck = resolveAllowedOrigin(request);
  const origin = originCheck.allowed ? originCheck.origin : "";

  if (request.method === "OPTIONS") return sendJson(response, 204, {}, origin);
  if (!originCheck.allowed) return sendJson(response, 403, { ok: false, message: "Origin not allowed." }, origin);
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST, OPTIONS");
    return sendJson(response, 405, { ok: false, message: "Method not allowed." }, origin);
  }

  const ip = clientIp(request);
  if (isRateLimited(`admin-login:${ip}`, { windowMs: 15 * 60 * 1000, max: 8 })) {
    return sendJson(response, 429, { ok: false, message: "محاولات دخول كثيرة. انتظر 15 دقيقة ثم حاول مرة أخرى." }, origin);
  }

  try {
    const parsed = await parseJsonBody(request, 3_000);
    const password = cleanText(parsed.password, 300);

    if (!verifyAdminPassword(password)) {
      return sendJson(response, 401, { ok: false, message: "كلمة مرور الإدارة غير صحيحة." }, origin);
    }

    const token = createSessionToken();
    setSessionCookie(response, token);

    return sendJson(response, 200, {
      ok: true,
      authenticated: true,
      csrfToken: csrfForSessionToken(token),
      message: "تم تسجيل الدخول بنجاح."
    }, origin);
  } catch (_) {
    return sendJson(response, 400, { ok: false, message: "طلب تسجيل الدخول غير صالح." }, origin);
  }
};
