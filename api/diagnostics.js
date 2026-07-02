"use strict";

const {
  cleanText,
  clientIp,
  isRateLimited,
  parseJsonBody,
  resolveAllowedOrigin,
  sendJson
} = require("../lib/server-utils");

const CONTENT_PATH = "public/content/site-content.json";

function envFlag(name) {
  return Boolean(process.env[name]);
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "khaled-portfolio-diagnostics"
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

function safeGitHubMessage(status, payload) {
  const message = cleanText(payload?.message || "", 160);
  if (status === 401) return "Bad credentials: GITHUB_TOKEN غير صحيح أو انتهت صلاحيته.";
  if (status === 403) return "Forbidden: التوكن لا يملك الصلاحية المطلوبة أو وصل لحد GitHub API.";
  if (status === 404) return "Not found: تحقق من GITHUB_OWNER / GITHUB_REPO / GITHUB_BRANCH.";
  return message || `GitHub check failed with status ${status}.`;
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
  if (isRateLimited(`diagnostics:${ip}`, { windowMs: 10 * 60 * 1000, max: 20 })) {
    return sendJson(response, 429, { ok: false, message: "طلبات الفحص كثيرة جداً. حاول بعد دقائق." }, origin);
  }

  try {
    const parsed = await parseJsonBody(request, 4_000);
    if (cleanText(parsed.password, 240) !== process.env.ADMIN_PASSWORD) {
      return sendJson(response, 401, { ok: false, message: "كلمة مرور الإدارة غير صحيحة." }, origin);
    }

    const owner = process.env.GITHUB_OWNER || "";
    const repo = process.env.GITHUB_REPO || "";
    const branch = process.env.GITHUB_BRANCH || "main";
    const token = process.env.GITHUB_TOKEN || "";

    const checks = {
      env: {
        adminPassword: envFlag("ADMIN_PASSWORD"),
        githubToken: envFlag("GITHUB_TOKEN"),
        githubOwner: envFlag("GITHUB_OWNER"),
        githubRepo: envFlag("GITHUB_REPO"),
        githubBranch: branch,
        geminiKey: envFlag("GEMINI_API_KEY")
      },
      github: {
        tokenValid: false,
        repoReadable: false,
        contentWritableTarget: CONTENT_PATH,
        message: "Not checked."
      }
    };

    if (token && owner && repo) {
      const headers = githubHeaders(token);
      const userCheck = await fetchJson("https://api.github.com/user", { headers });
      checks.github.tokenValid = userCheck.ok;

      if (!userCheck.ok) {
        checks.github.message = safeGitHubMessage(userCheck.status, userCheck.payload);
      } else {
        const path = encodeURIComponent(CONTENT_PATH).replace(/%2F/g, "/");
        const contentUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
        const contentCheck = await fetchJson(contentUrl, { headers });
        checks.github.repoReadable = contentCheck.ok;
        checks.github.message = contentCheck.ok ? "GitHub token and repository access look valid." : safeGitHubMessage(contentCheck.status, contentCheck.payload);
      }
    } else {
      checks.github.message = "GitHub environment variables are incomplete.";
    }

    return sendJson(response, 200, {
      ok: checks.env.adminPassword && checks.github.tokenValid && checks.github.repoReadable,
      service: "khaled-portfolio-diagnostics",
      checks
    }, origin);
  } catch (_) {
    return sendJson(response, 500, { ok: false, message: "فشل الفحص التشخيصي." }, origin);
  }
};
