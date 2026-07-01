"use strict";

/**
 * أدوات مشتركة للـ Serverless Functions.
 * الهدف: توحيد الهيدرز الأمنية، قراءة JSON بأمان، تنظيف النصوص، وضبط Rate Limit.
 */

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_BODY_LIMIT_BYTES = 18_000;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_RATE_LIMIT_MAX = 60;
const MAX_BUCKETS = 750;

/** @type {Map<string, number[]>} */
const rateLimitBuckets = new Map();

/**
 * يحدد إن كان التطبيق يعمل في بيئة إنتاج.
 * @returns {boolean} true عند النشر على Vercel أو عند NODE_ENV=production.
 */
function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

/**
 * يضيف هيدرز أمان قياسية لكل رد JSON من الـ API.
 * @param {import('http').ServerResponse} res كائن الاستجابة.
 * @param {string=} origin أصل الطلب المسموح، إن وُجد.
 * @returns {void}
 */
function setJsonSecurityHeaders(res, origin = "") {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Vary", "Origin");
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "600");
  }
}

/**
 * يرسل JSON موحداً، ويتجنب كتابة body مع status 204.
 * @param {import('http').ServerResponse} res كائن الاستجابة.
 * @param {number} status كود HTTP.
 * @param {Record<string, unknown>} payload حمولة JSON.
 * @param {string=} origin أصل الطلب المسموح.
 * @returns {void}
 */
function sendJson(res, status, payload, origin = "") {
  res.statusCode = status;
  setJsonSecurityHeaders(res, origin);
  if (status === 204) {
    res.end();
    return;
  }
  res.end(JSON.stringify(payload));
}

/**
 * ينظف النصوص القادمة من المستخدم أو البيئة قبل استخدامها.
 * يحذف محارف التحكم ويحد الطول لتقليل استهلاك الذاكرة وسطح الهجوم.
 * @param {unknown} value القيمة الخام.
 * @param {number} limit أقصى طول مسموح.
 * @returns {string} نص آمن ومقصوص.
 */
function cleanText(value, limit = 500) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[ \t]{3,}/g, "  ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, Math.max(0, limit));
}

/**
 * يقرأ عنوان IP بشكل محافظ خلف البروكسي.
 * @param {import('http').IncomingMessage} req كائن الطلب.
 * @returns {string} عنوان IP مختصر أو unknown.
 */
function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded || req.socket?.remoteAddress || "unknown";
  return String(first).split(",")[0].trim().slice(0, 80) || "unknown";
}

/**
 * يقرأ قائمة الأصول المسموحة من متغيرات البيئة.
 * @returns {Set<string>} قائمة origins بصيغة موحدة.
 */
function configuredOrigins() {
  return new Set(
    String(process.env.ALLOWED_ORIGINS || process.env.SITE_ORIGIN || "")
      .split(",")
      .map(item => item.trim().replace(/\/$/, ""))
      .filter(Boolean)
  );
}

/**
 * يتحقق من أن Origin مطابق للمضيف الحالي أو ضمن ALLOWED_ORIGINS.
 * @param {import('http').IncomingMessage} req كائن الطلب.
 * @returns {{allowed: boolean, origin: string}} نتيجة الفحص والأصل المسموح.
 */
function resolveAllowedOrigin(req) {
  const origin = String(req.headers.origin || "").replace(/\/$/, "");
  if (!origin) return { allowed: !isProductionRuntime(), origin: "" };

  try {
    const originUrl = new URL(origin);
    const host = String(req.headers.host || "").toLowerCase();
    const sameHost = host && originUrl.host.toLowerCase() === host;
    const secureEnough = originUrl.protocol === "https:" || /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(originUrl.host);
    if (sameHost && secureEnough) return { allowed: true, origin };
  } catch (_) {
    return { allowed: false, origin: "" };
  }

  return { allowed: configuredOrigins().has(origin), origin };
}

/**
 * ينظف buckets القديمة حتى لا ينمو الـ Map بلا حدود مع IPs عشوائية.
 * @param {number} now الوقت الحالي بالمللي ثانية.
 * @param {number} windowMs نافذة التحديد.
 * @returns {void}
 */
function cleanupRateBuckets(now, windowMs) {
  if (rateLimitBuckets.size < MAX_BUCKETS) return;
  for (const [ip, timestamps] of rateLimitBuckets) {
    const fresh = timestamps.filter(time => now - time < windowMs);
    if (fresh.length) rateLimitBuckets.set(ip, fresh);
    else rateLimitBuckets.delete(ip);
  }
}

/**
 * يطبق Rate Limit بسيط داخل الذاكرة لكل IP.
 * مناسب لـ Serverless كطبقة حماية أولية، وليس بديلاً عن WAF عند التوسع الكبير.
 * @param {string} ip عنوان العميل.
 * @param {{windowMs?: number, max?: number}=} options إعدادات التحديد.
 * @returns {boolean} true إذا كان الطلب مرفوضاً بسبب كثرة الطلبات.
 */
function isRateLimited(ip, options = {}) {
  const windowMs = options.windowMs || DEFAULT_RATE_LIMIT_WINDOW_MS;
  const max = options.max || DEFAULT_RATE_LIMIT_MAX;
  const now = Date.now();
  cleanupRateBuckets(now, windowMs);

  const fresh = (rateLimitBuckets.get(ip) || []).filter(time => now - time < windowMs);
  if (fresh.length >= max) {
    rateLimitBuckets.set(ip, fresh);
    return true;
  }

  fresh.push(now);
  rateLimitBuckets.set(ip, fresh);
  return false;
}

/**
 * يقرأ stream الطلب مع حد حجم صارم قبل JSON.parse.
 * @param {import('http').IncomingMessage} req كائن الطلب.
 * @param {number} limitBytes أقصى حجم للـ body.
 * @returns {Promise<Record<string, unknown>>} جسم الطلب بعد التحويل من JSON.
 */
function readJsonStream(req, limitBytes = DEFAULT_BODY_LIMIT_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let raw = "";

    req.on("data", chunk => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error("body_too_large"));
        req.destroy();
        return;
      }
      raw += chunk;
    });

    req.on("end", () => {
      try {
        const parsed = raw ? JSON.parse(raw) : {};
        resolve(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {});
      } catch (_) {
        reject(new Error("invalid_json"));
      }
    });

    req.on("error", reject);
  });
}

/**
 * يقرأ body سواء كان Vercel قد جهزه مسبقاً أو وصل كـ stream.
 * @param {import('http').IncomingMessage & {body?: unknown}} req كائن الطلب.
 * @param {number=} limitBytes أقصى حجم.
 * @returns {Promise<Record<string, unknown>>} جسم JSON آمن.
 */
async function parseJsonBody(req, limitBytes = DEFAULT_BODY_LIMIT_BYTES) {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) return req.body;
  if (typeof req.body === "string") {
    try {
      const parsed = JSON.parse(req.body || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      throw new Error("invalid_json");
    }
  }
  return readJsonStream(req, limitBytes);
}

/**
 * يتحقق من اسم نموذج Gemini حتى لا يدخل في المسار إلا بقيمة آمنة.
 * @param {unknown} value القيمة الخام.
 * @returns {string} اسم نموذج آمن.
 */
function safeModelName(value) {
  const model = cleanText(value || DEFAULT_GEMINI_MODEL, 80);
  return /^[a-z0-9][a-z0-9._-]{2,79}$/i.test(model) ? model : DEFAULT_GEMINI_MODEL;
}

/**
 * تأخير صغير بين محاولات إعادة الطلب.
 * @param {number} ms عدد المللي ثانية.
 * @returns {Promise<void>} Promise ينتهي بعد الزمن المحدد.
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  DEFAULT_BODY_LIMIT_BYTES,
  DEFAULT_GEMINI_MODEL,
  cleanText,
  clientIp,
  isProductionRuntime,
  isRateLimited,
  parseJsonBody,
  resolveAllowedOrigin,
  safeModelName,
  sendJson,
  setJsonSecurityHeaders,
  wait
};
