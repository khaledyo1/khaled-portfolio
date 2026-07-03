"use strict";

/**
 * GitHub Contents API helper layer.
 * الهدف: منع تكرار منطق GitHub داخل Serverless Functions، وتوحيد الأخطاء والترميز.
 */

const DEFAULT_USER_AGENT = "khaled-portfolio-cms";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`missing_env:${name}`);
  return value;
}

function repoConfig() {
  return {
    token: requiredEnv("GITHUB_TOKEN"),
    owner: requiredEnv("GITHUB_OWNER"),
    repo: requiredEnv("GITHUB_REPO"),
    branch: process.env.GITHUB_BRANCH || "main"
  };
}

function githubHeaders(token, extra = {}) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": DEFAULT_USER_AGENT,
    ...extra
  };
}

function encodeRepoPath(path) {
  return String(path || "")
    .split("/")
    .map(part => encodeURIComponent(part))
    .join("/");
}

function safeBase64Encode(value) {
  return Buffer.from(String(value ?? ""), "utf8").toString("base64");
}

function safeBase64Decode(value) {
  const normalized = String(value || "").replace(/\s/g, "");
  return Buffer.from(normalized, "base64").toString("utf8");
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

function createGitHubClient(config = repoConfig()) {
  const headers = githubHeaders(config.token);
  const repoBase = `https://api.github.com/repos/${config.owner}/${config.repo}`;

  async function readFile(path, options = {}) {
    const ref = options.ref || config.branch;
    const url = `${repoBase}/contents/${encodeRepoPath(path)}?ref=${encodeURIComponent(ref)}`;
    const payload = await githubRequest(url, { headers });
    if (Array.isArray(payload) || payload.type !== "file") {
      throw new Error("GitHub path is not a file.");
    }
    return {
      path,
      sha: payload.sha || "",
      size: Number(payload.size || 0),
      content: safeBase64Decode(payload.content || ""),
      encoding: payload.encoding || "base64",
      htmlUrl: payload.html_url || ""
    };
  }

  async function getFileSha(path) {
    try {
      const file = await readFile(path);
      return file.sha || null;
    } catch (error) {
      if (Number(error.status) === 404 || /not found/i.test(error.message)) return null;
      throw error;
    }
  }

  async function writeFile(path, content, message, options = {}) {
    const url = `${repoBase}/contents/${encodeRepoPath(path)}`;
    const body = {
      message: String(message || `Update ${path}`).slice(0, 240),
      content: safeBase64Encode(content),
      branch: options.branch || config.branch
    };

    const sha = options.sha === undefined ? await getFileSha(path) : options.sha;
    if (sha) body.sha = sha;

    const payload = await githubRequest(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(body)
    });

    return {
      path,
      sha: payload?.content?.sha || "",
      commitSha: payload?.commit?.sha || "",
      htmlUrl: payload?.content?.html_url || ""
    };
  }

  async function writeBase64File(path, contentBase64, message, options = {}) {
    const url = `${repoBase}/contents/${encodeRepoPath(path)}`;
    const body = {
      message: String(message || `Update ${path}`).slice(0, 240),
      content: String(contentBase64 || ""),
      branch: options.branch || config.branch
    };

    const sha = options.sha === undefined ? await getFileSha(path) : options.sha;
    if (sha) body.sha = sha;

    const payload = await githubRequest(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(body)
    });

    return {
      path,
      sha: payload?.content?.sha || "",
      commitSha: payload?.commit?.sha || "",
      htmlUrl: payload?.content?.html_url || ""
    };
  }

  async function listDirectory(path) {
    const url = `${repoBase}/contents/${encodeRepoPath(path)}?ref=${encodeURIComponent(config.branch)}`;
    try {
      const payload = await githubRequest(url, { headers });
      return Array.isArray(payload) ? payload : [];
    } catch (error) {
      if (Number(error.status) === 404 || /not found/i.test(error.message)) return [];
      throw error;
    }
  }

  return {
    config,
    getFileSha,
    listDirectory,
    readFile,
    writeBase64File,
    writeFile
  };
}

function safeGitHubErrorMessage(error) {
  const raw = String(error?.message || "");
  if (raw.startsWith("missing_env:")) return "إعدادات GitHub داخل Vercel غير مكتملة.";
  if (/bad credentials/i.test(raw) || Number(error?.status) === 401) return "GitHub Token غير صحيح أو انتهت صلاحيته.";
  if (/forbidden/i.test(raw) || Number(error?.status) === 403) return "GitHub Token لا يملك الصلاحيات المطلوبة أو وصل لحد GitHub API.";
  if (/not found/i.test(raw) || Number(error?.status) === 404) return "لم يتم العثور على الريبو أو الملف. راجع GITHUB_OWNER و GITHUB_REPO واسم الفرع.";
  if (/rate limit/i.test(raw)) return "تم تجاوز حد GitHub API مؤقتاً. حاول لاحقاً.";
  return "فشل اتصال GitHub بشكل آمن. حاول مرة أخرى.";
}

module.exports = {
  createGitHubClient,
  encodeRepoPath,
  githubHeaders,
  githubRequest,
  repoConfig,
  requiredEnv,
  safeBase64Decode,
  safeBase64Encode,
  safeGitHubErrorMessage
};
