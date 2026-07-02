const MAX_BODY_CHARS = 2_500_000;
const CONTENT_PATH = "public/content/site-content.json";

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", chunk => {
      body += chunk;
      if (body.length > MAX_BODY_CHARS) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} environment variable.`);
  return value;
}

function githubHeaders(token) {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "khaled-portfolio-cms"
  };
}

async function githubRequest(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || `GitHub request failed with ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function cleanString(value, max = 5000) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .slice(0, max);
}

function cleanTextObject(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    en: cleanString(source.en, 5000),
    ar: cleanString(source.ar, 5000)
  };
}

function sanitizePath(value) {
  const path = cleanString(value, 180).replace(/\\/g, "/");
  if (!path.startsWith("public/assets/uploads/")) return "";
  if (path.includes("..")) return "";
  return path.replace(/[^a-zA-Z0-9_\-./]/g, "");
}

function sanitizeContent(input) {
  const source = input && typeof input === "object" ? input : {};
  const profile = source.profile && typeof source.profile === "object" ? source.profile : {};
  const contact = source.contact && typeof source.contact === "object" ? source.contact : {};

  const socials = Array.isArray(source.socials) ? source.socials.slice(0, 12).map(item => ({
    id: cleanString(item?.id, 60).replace(/[^a-zA-Z0-9_-]/g, ""),
    label: cleanString(item?.label, 80),
    url: cleanString(item?.url, 500),
    icon: cleanString(item?.icon, 220),
    enabled: item?.enabled !== false
  })).filter(item => item.id && item.url) : [];

  const projects = Array.isArray(source.projects) ? source.projects.slice(0, 24).map(item => ({
    id: cleanString(item?.id, 90).replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, "-") || `project-${Date.now()}`,
    featured: item?.featured === true,
    category: ["web", "dashboard", "ai"].includes(item?.category) ? item.category : "web",
    theme: cleanString(item?.theme || "project-theme-klik", 80).replace(/[^a-zA-Z0-9_ -]/g, ""),
    title: cleanTextObject(item?.title),
    meta: cleanTextObject(item?.meta),
    description: cleanTextObject(item?.description),
    problem: cleanTextObject(item?.problem),
    delivered: cleanTextObject(item?.delivered),
    image: cleanString(item?.image, 220),
    tags: Array.isArray(item?.tags) ? item.tags.slice(0, 12).map(tag => cleanString(tag, 50)).filter(Boolean) : [],
    liveUrl: cleanString(item?.liveUrl, 500),
    repoUrl: cleanString(item?.repoUrl, 500),
    enabled: item?.enabled !== false
  })).filter(item => item.title.en || item.title.ar) : [];

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    profile: {
      name: cleanString(profile.name, 120),
      title: cleanTextObject(profile.title),
      heroKicker: cleanTextObject(profile.heroKicker),
      heroHeadline: cleanTextObject(profile.heroHeadline),
      heroLead: cleanTextObject(profile.heroLead),
      heroImage: cleanString(profile.heroImage, 220),
      avatarImage: cleanString(profile.avatarImage, 220),
      logoImage: cleanString(profile.logoImage, 220),
      badges: Array.isArray(profile.badges) ? profile.badges.slice(0, 3).map(cleanTextObject) : []
    },
    contact: {
      email: cleanString(contact.email, 180),
      phone: cleanString(contact.phone, 80),
      whatsappNumber: cleanString(contact.whatsappNumber, 40).replace(/[^0-9]/g, ""),
      location: cleanTextObject(contact.location)
    },
    socials,
    projects
  };
}

function sanitizeUploads(uploads) {
  if (!Array.isArray(uploads)) return [];
  return uploads.slice(0, 8).map(upload => {
    const path = sanitizePath(upload?.path);
    const contentBase64 = cleanString(upload?.contentBase64, 2_000_000).replace(/[^a-zA-Z0-9+/=]/g, "");
    const contentType = cleanString(upload?.contentType, 80);
    return { path, contentBase64, contentType };
  }).filter(upload => upload.path && upload.contentBase64 && upload.contentType.startsWith("image/"));
}

async function getFileSha({ owner, repo, branch, path, headers }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`;
  try {
    const payload = await githubRequest(url, { headers });
    return payload.sha || null;
  } catch (error) {
    if (/not found/i.test(error.message)) return null;
    throw error;
  }
}

async function putFile({ owner, repo, branch, path, contentBase64, message, headers }) {
  const sha = await getFileSha({ owner, repo, branch, path, headers });
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
  const body = { message, content: contentBase64, branch };
  if (sha) body.sha = sha;
  return githubRequest(url, { method: "PUT", headers, body: JSON.stringify(body) });
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { ok: false, message: "Method not allowed." });
  }

  try {
    const adminPassword = requiredEnv("ADMIN_PASSWORD");
    const token = requiredEnv("GITHUB_TOKEN");
    const owner = requiredEnv("GITHUB_OWNER");
    const repo = requiredEnv("GITHUB_REPO");
    const branch = process.env.GITHUB_BRANCH || "main";

    const raw = await readBody(request);
    const parsed = JSON.parse(raw || "{}");

    if (parsed.password !== adminPassword) {
      return sendJson(response, 401, { ok: false, message: "كلمة مرور الإدارة غير صحيحة." });
    }

    const content = sanitizeContent(parsed.content);
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

    return sendJson(response, 200, { ok: true, message: "Content saved to GitHub." });
  } catch (error) {
    return sendJson(response, 500, {
      ok: false,
      message: error.message || "Unexpected CMS save error."
    });
  }
};
