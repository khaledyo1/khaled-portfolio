"use strict";

const { resolveAllowedOrigin, sendJson } = require("../lib/server-utils");
const { clearSessionCookie } = require("../lib/admin-auth");

module.exports = function handler(request, response) {
  const originCheck = resolveAllowedOrigin(request);
  const origin = originCheck.allowed ? originCheck.origin : "";

  if (request.method === "OPTIONS") return sendJson(response, 204, {}, origin);
  if (!originCheck.allowed) return sendJson(response, 403, { ok: false, message: "Origin not allowed." }, origin);
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST, OPTIONS");
    return sendJson(response, 405, { ok: false, message: "Method not allowed." }, origin);
  }

  clearSessionCookie(response);
  return sendJson(response, 200, { ok: true, authenticated: false, message: "تم تسجيل الخروج." }, origin);
};
