"use strict";

const { resolveAllowedOrigin, sendJson } = require("../lib/server-utils");

/**
 * Health endpoint خفيف للتأكد من أن API يعمل.
 * لا يعرض حالة المفاتيح أو أسماء النماذج في الإنتاج لتقليل تسريب معلومات التشغيل.
 * @param {import('http').IncomingMessage} req طلب HTTP.
 * @param {import('http').ServerResponse} res استجابة HTTP.
 * @returns {void}
 */
module.exports = function handler(req, res) {
  const originCheck = resolveAllowedOrigin(req);

  if (req.method === "OPTIONS") return sendJson(res, 204, {}, originCheck.allowed ? originCheck.origin : "");
  if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "Method not allowed" }, originCheck.origin);

  return sendJson(res, 200, {
    ok: true,
    service: "khaled-portfolio-api",
    status: "ready"
  }, originCheck.allowed ? originCheck.origin : "");
};
