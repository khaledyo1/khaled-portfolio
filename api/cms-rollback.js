"use strict";

const {
  clientIp,
  isRateLimited,
  parseJsonBody,
  resolveAllowedOrigin,
  sendJson
} = require("../lib/server-utils");
const { requireAdminSession } = require("../lib/admin-auth");
const { ValidationError, normalizeContent } = require("../lib/cms-schema");
const { createGitHubClient, safeGitHubErrorMessage } = require("../lib/github-content");
const {
  CONTENT_PATH,
  appendAuditRecordSafe,
  createContentBackup,
  extractBackupContent,
  validateBackupPath
} = require("../lib/cms-backups");

function safeRollbackError(error) {
  const raw = String(error?.message || "");
  if (error instanceof ValidationError) return "محتوى النسخة الاحتياطية غير صالح ولا يمكن استرجاعه.";
  if (/invalid_backup_json/i.test(raw)) return "ملف النسخة الاحتياطية غير صالح.";
  if (/current_content_invalid/i.test(raw)) return "تعذر إنشاء نسخة أمان قبل الاسترجاع لأن المحتوى الحالي غير صالح.";
  return safeGitHubErrorMessage(error);
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
  if (isRateLimited(`cms-rollback:${ip}`, { windowMs: 15 * 60 * 1000, max: 8 })) {
    return sendJson(response, 429, { ok: false, message: "محاولات الاسترجاع كثيرة جداً. حاول لاحقاً." }, origin);
  }

  let github = null;
  let backupPath = "";
  let safetyBackupPath = "";

  try {
    const session = requireAdminSession(request, { requireCsrf: true });
    if (!session.ok) return sendJson(response, session.status, { ok: false, message: session.message }, origin);

    const parsed = await parseJsonBody(request, 12_000);
    github = createGitHubClient();
    backupPath = validateBackupPath(parsed.path);
    if (!backupPath) {
      await appendAuditRecordSafe(github, {
        action: "rollback_failed",
        status: "failure",
        message: "Rejected invalid backup path.",
        targetPath: CONTENT_PATH,
        backupPath: ""
      });
      return sendJson(response, 400, { ok: false, message: "مسار النسخة الاحتياطية غير صالح." }, origin);
    }

    await appendAuditRecordSafe(github, {
      action: "rollback_started",
      status: "success",
      message: "Rollback started by admin session.",
      targetPath: CONTENT_PATH,
      backupPath
    });

    const selectedBackup = await github.readFile(backupPath);
    const restoredContent = normalizeContent(extractBackupContent(selectedBackup.content));

    const safetyBackup = await createContentBackup(github, {
      operation: "rollback_safety_backup",
      metadata: { rollbackFrom: backupPath, ip },
      message: "CMS safety backup before rollback"
    });
    safetyBackupPath = safetyBackup.backupPath;

    await appendAuditRecordSafe(github, {
      action: "backup_created",
      status: "success",
      message: "Created safety backup before rollback.",
      commitSha: safetyBackup.commitSha,
      targetPath: CONTENT_PATH,
      backupPath: safetyBackupPath
    });

    const publish = await github.writeFile(
      CONTENT_PATH,
      `${JSON.stringify(restoredContent, null, 2)}\n`,
      `Rollback CMS content from ${backupPath}`
    );

    await appendAuditRecordSafe(github, {
      action: "rollback_completed",
      status: "success",
      message: "Rollback completed successfully.",
      commitSha: publish.commitSha,
      targetPath: CONTENT_PATH,
      backupPath
    });

    return sendJson(response, 200, {
      ok: true,
      message: "تم استرجاع النسخة بنجاح. انتظر Vercel حتى ينشر التعديل.",
      restoredFrom: backupPath,
      safetyBackupPath,
      commitSha: publish.commitSha || ""
    }, origin);
  } catch (error) {
    if (github) {
      await appendAuditRecordSafe(github, {
        action: "rollback_failed",
        status: "failure",
        message: safeRollbackError(error),
        targetPath: CONTENT_PATH,
        backupPath: backupPath || safetyBackupPath
      });
    }

    const status = error instanceof ValidationError ? 422 : 500;
    return sendJson(response, status, {
      ok: false,
      message: safeRollbackError(error),
      details: error instanceof ValidationError ? error.details : undefined
    }, origin);
  }
};
