"use strict";

const { resolveAllowedOrigin, sendJson } = require("../lib/server-utils");
const { requireAdminSession } = require("../lib/admin-auth");

module.exports = function handler(request, response) {
  const originCheck = resolveAllowedOrigin(request);
  const origin = originCheck.allowed ? originCheck.origin : "";

  if (request.method === "OPTIONS") return sendJson(response, 204, {}, origin);
  if (!originCheck.allowed) return sendJson(response, 403, { ok: false, message: "Origin not allowed." }, origin);
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET, OPTIONS");
    return sendJson(response, 405, { ok: false, message: "Method not allowed." }, origin);
  }

  const session = requireAdminSession(request, { requireCsrf: false });
  if (!session.ok) {
    return sendJson(response, 200, { ok: true, authenticated: false }, origin);
  }

  return sendJson(response, 200, {
    ok: true,
    authenticated: true,
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt
  }, origin);
};
