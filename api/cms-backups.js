"use strict";

const {
  clientIp,
  isRateLimited,
  resolveAllowedOrigin,
  sendJson
} = require("../lib/server-utils");
const { requireAdminSession } = require("../lib/admin-auth");
const { createGitHubClient, safeGitHubErrorMessage } = require("../lib/github-content");
const { BACKUP_DIR, sortBackupsNewestFirst } = require("../lib/cms-backups");

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
  if (isRateLimited(`cms-backups:${ip}`, { windowMs: 10 * 60 * 1000, max: 40 })) {
    return sendJson(response, 429, { ok: false, message: "طلبات كثيرة جداً. حاول بعد دقائق." }, origin);
  }

  try {
    const session = requireAdminSession(request, { requireCsrf: false });
    if (!session.ok) return sendJson(response, session.status, { ok: false, message: session.message }, origin);

    const github = createGitHubClient();
    const items = await github.listDirectory(BACKUP_DIR);
    const backups = sortBackupsNewestFirst(items);

    return sendJson(response, 200, {
      ok: true,
      backups,
      count: backups.length
    }, origin);
  } catch (error) {
    return sendJson(response, 500, {
      ok: false,
      message: safeGitHubErrorMessage(error)
    }, origin);
  }
};
