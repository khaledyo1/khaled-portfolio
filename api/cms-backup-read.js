"use strict";

const {
  clientIp,
  isRateLimited,
  resolveAllowedOrigin,
  sendJson
} = require("../lib/server-utils");
const { requireAdminSession } = require("../lib/admin-auth");
const { createGitHubClient, safeGitHubErrorMessage } = require("../lib/github-content");
const { extractBackupContent, timestampFromBackupPath, validateBackupPath } = require("../lib/cms-backups");

function queryParam(request, key) {
  const host = request.headers.host || "localhost";
  const url = new URL(request.url || "/", `https://${host}`);
  return url.searchParams.get(key) || "";
}

module.exports = async function handler(request, response) {
  const originCheck = resolveAllowedOrigin(request);
  const origin = originCheck.allowed ? originCheck.origin : "";

  if (request.method === "OPTIONS") return sendJson(response, 204, {}, origin);
  if (!originCheck.allowed) return sendJson(response, 403, { ok: false, message: "Origin not allowed." }, origin);
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET, OPTIONS");
    return sendJson(response, 405, { ok: false, message: "Method not allowed." }, origin);
  }

  const ip = clientIp(request);
  if (isRateLimited(`cms-backup-read:${ip}`, { windowMs: 10 * 60 * 1000, max: 60 })) {
    return sendJson(response, 429, { ok: false, message: "طلبات كثيرة جداً. حاول بعد دقائق." }, origin);
  }

  try {
    const session = requireAdminSession(request, { requireCsrf: false });
    if (!session.ok) return sendJson(response, session.status, { ok: false, message: session.message }, origin);

    const backupPath = validateBackupPath(queryParam(request, "path"));
    if (!backupPath) {
      return sendJson(response, 400, { ok: false, message: "مسار النسخة الاحتياطية غير صالح." }, origin);
    }

    const github = createGitHubClient();
    const file = await github.readFile(backupPath);
    const envelope = JSON.parse(file.content);
    const content = extractBackupContent(file.content);

    return sendJson(response, 200, {
      ok: true,
      backup: {
        path: backupPath,
        sha: file.sha,
        size: file.size,
        timestamp: envelope.timestamp || timestampFromBackupPath(backupPath),
        sourceSha: envelope.sourceSha || "",
        operation: envelope.operation || "unknown",
        metadata: envelope.metadata || {}
      },
      content
    }, origin);
  } catch (error) {
    const message = /invalid_backup_json/i.test(String(error?.message || ""))
      ? "ملف النسخة الاحتياطية غير صالح."
      : safeGitHubErrorMessage(error);
    return sendJson(response, 500, { ok: false, message }, origin);
  }
};
