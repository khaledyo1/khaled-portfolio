"use strict";

const { resolveAllowedOrigin, sendJson } = require("../lib/server-utils");

/**
 * Health endpoint خفيف لا يكشف أسرار التشغيل.
 * يعطيك حالة عامة ومؤشرات Boolean فقط تساعد في التشخيص بدون عرض القيم.
 */
module.exports = function handler(req, res) {
  const originCheck = resolveAllowedOrigin(req);
  const origin = originCheck.allowed ? originCheck.origin : "";

  if (req.method === "OPTIONS") return sendJson(res, 204, {}, origin);
  if (!originCheck.allowed) return sendJson(res, 403, { ok: false, error: "Origin not allowed" }, origin);
  if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "Method not allowed" }, origin);

  return sendJson(res, 200, {
    ok: true,
    service: "khaled-portfolio-api",
    status: "ready",
    runtime: "vercel-serverless",
    configured: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      cmsAdmin: Boolean(process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD_HASH),
      adminSessionSecret: Boolean(process.env.ADMIN_SESSION_SECRET),
      githubCms: Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO)
    }
  }, origin);
};
