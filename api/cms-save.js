"use strict";

const {
  clientIp,
  isRateLimited,
  parseJsonBody,
  resolveAllowedOrigin,
  sendJson
} = require("../lib/server-utils");
const { ValidationError, cleanString, normalizeContent } = require("../lib/cms-schema");
const { requireAdminSession } = require("../lib/admin-auth");
const { createGitHubClient, safeGitHubErrorMessage } = require("../lib/github-content");
const {
  CONTENT_PATH,
  appendAuditRecordSafe,
  createContentBackup
} = require("../lib/cms-backups");

const LIMITS = Object.freeze({
  bodyBytes: 2_800_000,
  uploadCount: 6,
  uploadBytes: 1_800_000,
  rateWindowMs: 10 * 60 * 1000,
  rateMaxRequests: 12
});
const ALLOWED_UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function safeErrorMessage(error) {
  const raw = String(error?.message || "");
  if (raw.startsWith("missing_env:")) return "إعدادات النشر غير مكتملة داخل Vercel Environment Variables.";
  if (error instanceof ValidationError) return "البيانات غير صالحة. راجع الحقول المطلوبة والروابط.";
  if (/body_too_large/i.test(raw)) return "حجم البيانات كبير جداً. قلل حجم الصور أو عددها.";
  if (/invalid_json/i.test(raw)) return "صيغة الطلب غير صالحة.";
  if (/current_content_invalid/i.test(raw)) return "تعذر إنشاء نسخة احتياطية لأن المحتوى الحالي غير صالح.";
  if (/invalid upload/i.test(raw) || /upload.*large/i.test(raw)) return "أحد ملفات الصور غير صالح أو حجمه أكبر من المسموح.";
  return safeGitHubErrorMessage(error);
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

async function writeUploads(github, uploads) {
  for (const upload of uploads) {
    await github.writeBase64File(
      upload.path,
      upload.contentBase64,
      `CMS upload ${upload.path}`
    );
  }
}

async function publishContent(github, content) {
  return github.writeFile(
    CONTENT_PATH,
    `${JSON.stringify(content, null, 2)}\n`,
    "Update portfolio CMS content"
  );
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

  let github = null;
  let backupPath = "";

  try {
    const session = requireAdminSession(request, { requireCsrf: true });
    if (!session.ok) {
      return sendJson(response, session.status, { ok: false, message: session.message }, origin);
    }

    const parsed = await parseJsonBody(request, LIMITS.bodyBytes);
    const content = normalizeContent(parsed.content);
    const uploads = sanitizeUploads(parsed.uploads);
    github = createGitHubClient();

    const backup = await createContentBackup(github, {
      operation: "cms_save",
      metadata: { uploads: uploads.length, ip },
      message: "CMS backup before content save"
    });
    backupPath = backup.backupPath;

    await appendAuditRecordSafe(github, {
      action: "backup_created",
      status: "success",
      message: "Created backup before CMS save.",
      commitSha: backup.commitSha,
      targetPath: CONTENT_PATH,
      backupPath
    });

    await writeUploads(github, uploads);
    const publish = await publishContent(github, content);

    await appendAuditRecordSafe(github, {
      action: "cms_save",
      status: "success",
      message: "CMS content saved successfully.",
      commitSha: publish.commitSha,
      targetPath: CONTENT_PATH,
      backupPath
    });

    return sendJson(response, 200, {
      ok: true,
      message: "تم الحفظ داخل GitHub بعد إنشاء نسخة احتياطية. انتظر Vercel حتى ينشر التعديل.",
      updatedAt: content.updatedAt,
      uploadedFiles: uploads.length,
      backupPath,
      commitSha: publish.commitSha || ""
    }, origin);
  } catch (error) {
    if (github) {
      await appendAuditRecordSafe(github, {
        action: "cms_save",
        status: "failure",
        message: safeErrorMessage(error),
        targetPath: CONTENT_PATH,
        backupPath
      });
    }

    const status = error instanceof ValidationError ? 422 : 500;
    return sendJson(response, status, {
      ok: false,
      message: safeErrorMessage(error),
      details: error instanceof ValidationError ? error.details : undefined
    }, origin);
  }
};
