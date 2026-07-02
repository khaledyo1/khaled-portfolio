"use strict";

const {
  clientIp,
  isRateLimited,
  parseJsonBody,
  resolveAllowedOrigin,
  sendJson
} = require("../lib/server-utils");
const { ValidationError, cleanString, normalizeContent } = require("../lib/cms-schema");

const CONTENT_PATH = "public/content/site-content.json";
const LIMITS = Object.freeze({
  bodyBytes: 2_800_000,
  uploadCount: 6,
  uploadBytes: 1_800_000,
  rateWindowMs: 10 * 60 * 1000,
  rateMaxRequests: 12
});
const ALLOWED_UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`missing_env:${name}`);
  return value;
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "khaled-portfolio-cms"
  };
}

function safeErrorMessage(error) {
  const raw = String(error?.message || "");
  if (raw.startsWith("missing_env:")) return "إعدادات النشر غير مكتملة داخل Vercel Environment Variables.";
  if (error instanceof ValidationError) return "البيانات غير صالحة. راجع الحقول المطلوبة والروابط.";
  if (/bad credentials/i.test(raw)) return "GitHub Token غير صحيح أو لا يملك صلاحية الوصول.";
  if (/not found/i.test(raw)) return "لم يتم العثور على الريبو أو الملف. راجع GITHUB_OWNER و GITHUB_REPO واسم الفرع.";
  if (/rate limit/i.test(raw)) return "تم تجاوز حد GitHub API مؤقتاً. حاول لاحقاً.";
  if (/body_too_large/i.test(raw)) return "حجم البيانات كبير جداً. قلل حجم الصور أو عددها.";
  if (/invalid_json/i.test(raw)) return "صيغة الطلب غير صالحة.";
  return "فشل الحفظ بسبب خطأ آمن غير متوقع.";
}

async function githubRequest(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || `GitHub request failed with ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.githubPayload = payload;
    throw error;
  }
  return payload;
}

function safeRepoPath(value) {
  const path = cleanString(value, 220).replace(/\\/g, "/");
  if (!path.startsWith("public/assets/uploads/")) return "";
  if (path.includes("..") || path.startsWith("/")) return "";
  return path.replace(/[^a-zA-Z0-9_\-./]/g, "");
}

function decodedBase64Size(base64) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function sanitizeUploads(uploads) {
  if (!Array.isArray(uploads)) return [];

  return uploads.slice(0, LIMITS.uploadCount).map((upload, index) => {
    const path = safeRepoPath(upload?.path);
    const contentType = cleanString(upload?.contentType, 80).toLowerCase();
    const contentBase64 = cleanString(upload?.contentBase64, 2_500_000).replace(/[^a-zA-Z0-9+/=]/g, "");

    if (!path) throw new Error(`Invalid upload path at index ${index}.`);
    if (!ALLOWED_UPLOAD_TYPES.has(contentType)) throw new Error(`Invalid upload type at index ${index}.`);
    if (!contentBase64 || decodedBase64Size(contentBase64) > LIMITS.uploadBytes) {
      throw new Error(`Upload at index ${index} is too large.`);
    }

    return { path, contentBase64, contentType };
  });
}

async function getFileSha({ owner, repo, branch, path, headers }) {
  const safePath = encodeURIComponent(path).replace(/%2F/g, "/");
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${safePath}?ref=${encodeURIComponent(branch)}`;
  try {
    const payload = await githubRequest(url, { headers });
    return payload.sha || null;
  } catch (error) {
    if (Number(error.status) === 404 || /not found/i.test(error.message)) return null;
    throw error;
  }
}

async function putFile({ owner, repo, branch, path, contentBase64, message, headers }) {
  const sha = await getFileSha({ owner, repo, branch, path, headers });
  const safePath = encodeURIComponent(path).replace(/%2F/g, "/");
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${safePath}`;
  const body = { message, content: contentBase64, branch };
  if (sha) body.sha = sha;
  return githubRequest(url, { method: "PUT", headers, body: JSON.stringify(body) });
}

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
  if (isRateLimited(`cms-save:${ip}`, { windowMs: LIMITS.rateWindowMs, max: LIMITS.rateMaxRequests })) {
    return sendJson(response, 429, { ok: false, message: "طلبات كثيرة جداً. حاول بعد دقائق." }, origin);
  }

  try {
    const adminPassword = requiredEnv("ADMIN_PASSWORD");
    const token = requiredEnv("GITHUB_TOKEN");
    const owner = requiredEnv("GITHUB_OWNER");
    const repo = requiredEnv("GITHUB_REPO");
    const branch = process.env.GITHUB_BRANCH || "main";

    const parsed = await parseJsonBody(request, LIMITS.bodyBytes);
    if (cleanString(parsed.password, 240) !== adminPassword) {
      return sendJson(response, 401, { ok: false, message: "كلمة مرور الإدارة غير صحيحة." }, origin);
    }

    const content = normalizeContent(parsed.content);
    const uploads = sanitizeUploads(parsed.uploads);
    const headers = githubHeaders(token);

    for (const upload of uploads) {
      await putFile({
        owner,
        repo,
        branch,
        path: upload.path,
        contentBase64: upload.contentBase64,
        message: `CMS upload ${upload.path}`,
        headers
      });
    }

    const contentBase64 = Buffer.from(JSON.stringify(content, null, 2), "utf8").toString("base64");
    await putFile({
      owner,
      repo,
      branch,
      path: CONTENT_PATH,
      contentBase64,
      message: "Update portfolio CMS content",
      headers
    });

    return sendJson(response, 200, {
      ok: true,
      message: "تم الحفظ داخل GitHub. انتظر Vercel حتى ينشر التعديل.",
      updatedAt: content.updatedAt,
      uploadedFiles: uploads.length
    }, origin);
  } catch (error) {
    const status = error instanceof ValidationError ? 422 : 500;
    return sendJson(response, status, {
      ok: false,
      message: safeErrorMessage(error),
      details: error instanceof ValidationError ? error.details : undefined
    }, origin);
  }
};
