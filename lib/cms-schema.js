"use strict";

/**
 * طبقة تحقق وتنظيف لمحتوى لوحة الإدارة.
 * الهدف: منع حفظ JSON ناقص أو خطير قد يكسر الموقع أو يفتح باب XSS/روابط ضارة.
 */

const ALLOWED_PROJECT_CATEGORIES = new Set(["web", "dashboard", "ai"]);
const ALLOWED_IMAGE_PREFIXES = ["assets/", "public/assets/"];
const MAX_SOCIALS = 12;
const MAX_PROJECTS = 30;
const MAX_BADGES = 6;
const MAX_TAGS = 16;
const MAX_TEXT = 5_000;

class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

function cleanString(value, max = MAX_TEXT) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[ \t]{3,}/g, "  ")
    .trim()
    .slice(0, Math.max(0, max));
}

function cleanId(value, fallback = "item") {
  const id = cleanString(value, 100)
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9\-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return id || fallback;
}

function cleanTextObject(value, fieldName, errors, options = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const en = cleanString(source.en, options.max || MAX_TEXT);
  const ar = cleanString(source.ar, options.max || MAX_TEXT);
  if (options.required && !en && !ar) errors.push(`${fieldName} is required in English or Arabic.`);
  return { en, ar };
}

function normalizeImagePath(value, fieldName, errors) {
  const path = cleanString(value, 260).replace(/\\/g, "/");
  if (!path) return "";
  if (path.includes("..") || path.startsWith("/") || /^https?:/i.test(path) || /^data:/i.test(path)) {
    errors.push(`${fieldName} must be a safe relative asset path.`);
    return "";
  }
  if (!ALLOWED_IMAGE_PREFIXES.some(prefix => path.startsWith(prefix))) {
    errors.push(`${fieldName} should start with assets/ or public/assets/.`);
    return "";
  }
  return path.replace(/[^a-zA-Z0-9_\-./%]/g, "");
}

function normalizeUrl(value, fieldName, errors, options = {}) {
  const url = cleanString(value, 700);
  if (!url) return "";

  if (options.allowMailto && /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(url)) return url;
  if (options.allowTel && /^tel:\+?[0-9\-()\s]{6,32}$/i.test(url)) return url;

  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) {
      errors.push(`${fieldName} must use http or https only.`);
      return "";
    }
    if (parsed.protocol === "http:" && !/^localhost(:\d+)?$/i.test(parsed.host)) {
      errors.push(`${fieldName} should use https in production.`);
      return "";
    }
    return parsed.toString();
  } catch (_) {
    errors.push(`${fieldName} must be a valid URL.`);
    return "";
  }
}

function normalizeEmail(value, errors) {
  const email = cleanString(value, 180).toLowerCase();
  if (!email) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.push("contact.email must be a valid email address.");
    return "";
  }
  return email;
}

function normalizePhone(value) {
  return cleanString(value, 80).replace(/[^0-9+()\-\s]/g, "").slice(0, 80);
}

function normalizeWhatsapp(value) {
  return cleanString(value, 40).replace(/[^0-9]/g, "").slice(0, 20);
}

function normalizeSocials(source, errors) {
  if (!Array.isArray(source)) return [];
  const used = new Set();

  return source.slice(0, MAX_SOCIALS).map((item, index) => {
    const id = cleanId(item?.id, `social-${index + 1}`);
    if (used.has(id)) errors.push(`Duplicate social id: ${id}.`);
    used.add(id);

    return {
      id,
      label: cleanString(item?.label, 80),
      url: normalizeUrl(item?.url, `socials[${index}].url`, errors, { allowMailto: true, allowTel: true }),
      icon: cleanString(item?.icon, 220).replace(/[^a-zA-Z0-9_\-./]/g, ""),
      enabled: item?.enabled !== false
    };
  }).filter(item => item.id && item.url);
}

function syncContactSocialUrls(socials, contact) {
  const email = normalizeEmail(contact?.email, []);
  const whatsappNumber = normalizeWhatsapp(contact?.whatsappNumber || contact?.phone);

  return (Array.isArray(socials) ? socials : []).map(item => {
    if (!item || typeof item !== "object") return item;
    if (item.id === "whatsapp" && whatsappNumber) {
      return { ...item, url: `https://wa.me/${whatsappNumber}` };
    }
    if ((item.id === "gmail" || item.id === "email") && email) {
      return { ...item, url: `mailto:${email}` };
    }
    return item;
  });
}

function normalizeProjects(source, errors) {
  if (!Array.isArray(source)) return [];
  const used = new Set();

  return source.slice(0, MAX_PROJECTS).map((item, index) => {
    const title = cleanTextObject(item?.title, `projects[${index}].title`, errors, { required: true, max: 180 });
    const id = cleanId(item?.id || title.en || title.ar, `project-${index + 1}`);
    if (used.has(id)) errors.push(`Duplicate project id: ${id}.`);
    used.add(id);

    const category = ALLOWED_PROJECT_CATEGORIES.has(item?.category) ? item.category : "web";
    const tags = Array.isArray(item?.tags)
      ? item.tags.slice(0, MAX_TAGS).map(tag => cleanString(tag, 60)).filter(Boolean)
      : [];

    return {
      id,
      featured: item?.featured === true,
      category,
      theme: cleanString(item?.theme || "project-theme-klik", 80).replace(/[^a-zA-Z0-9_ -]/g, ""),
      title,
      meta: cleanTextObject(item?.meta, `projects[${index}].meta`, errors, { max: 180 }),
      description: cleanTextObject(item?.description, `projects[${index}].description`, errors, { required: true }),
      problem: cleanTextObject(item?.problem, `projects[${index}].problem`, errors),
      delivered: cleanTextObject(item?.delivered, `projects[${index}].delivered`, errors),
      image: normalizeImagePath(item?.image, `projects[${index}].image`, errors),
      tags,
      liveUrl: normalizeUrl(item?.liveUrl, `projects[${index}].liveUrl`, errors),
      repoUrl: normalizeUrl(item?.repoUrl, `projects[${index}].repoUrl`, errors),
      enabled: item?.enabled !== false
    };
  }).filter(item => item.title.en || item.title.ar);
}

function normalizeContent(input) {
  const errors = [];
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const profile = source.profile && typeof source.profile === "object" && !Array.isArray(source.profile) ? source.profile : {};
  const contact = source.contact && typeof source.contact === "object" && !Array.isArray(source.contact) ? source.contact : {};

  const content = {
    version: 1,
    updatedAt: new Date().toISOString(),
    profile: {
      name: cleanString(profile.name, 120),
      title: cleanTextObject(profile.title, "profile.title", errors, { required: true, max: 180 }),
      heroKicker: cleanTextObject(profile.heroKicker, "profile.heroKicker", errors, { max: 180 }),
      heroHeadline: cleanTextObject(profile.heroHeadline, "profile.heroHeadline", errors, { required: true, max: 260 }),
      heroLead: cleanTextObject(profile.heroLead, "profile.heroLead", errors, { required: true, max: 900 }),
      heroImage: normalizeImagePath(profile.heroImage, "profile.heroImage", errors),
      avatarImage: normalizeImagePath(profile.avatarImage, "profile.avatarImage", errors),
      logoImage: normalizeImagePath(profile.logoImage, "profile.logoImage", errors),
      badges: Array.isArray(profile.badges)
        ? profile.badges.slice(0, MAX_BADGES).map((badge, index) => cleanTextObject(badge, `profile.badges[${index}]`, errors, { max: 80 })).filter(item => item.en || item.ar)
        : []
    },
    contact: {
      email: normalizeEmail(contact.email, errors),
      phone: normalizePhone(contact.phone),
      whatsappNumber: normalizeWhatsapp(contact.whatsappNumber),
      location: cleanTextObject(contact.location, "contact.location", errors, { max: 180 })
    },
    socials: normalizeSocials(source.socials, errors),
    projects: normalizeProjects(source.projects, errors)
  };

  content.socials = syncContactSocialUrls(content.socials, content.contact);

  if (!content.profile.name) errors.push("profile.name is required.");
  if (!content.contact.email && !content.contact.whatsappNumber) {
    errors.push("At least one contact method is required: email or whatsappNumber.");
  }
  if (!content.projects.length) errors.push("At least one project is required.");

  if (errors.length) {
    throw new ValidationError("Content validation failed.", errors.slice(0, 20));
  }

  return content;
}

module.exports = {
  ValidationError,
  cleanString,
  normalizeContent,
  normalizeImagePath,
  normalizeUrl,
  syncContactSocialUrls
};
