"use strict";

/**
 * أدوات النسخ الاحتياطي وسجل التدقيق للـ Portfolio CMS.
 * كل الدوال هنا تتجنب الأسرار، وتتعامل مع GitHub كطبقة تخزين للـ CMS الإداري منخفض التكرار.
 */

const crypto = require("crypto");
const { cleanText } = require("./server-utils");

const CONTENT_PATH = "public/content/site-content.json";
const BACKUP_DIR = "public/content/backups";
const AUDIT_LOG_PATH = "public/content/audit-log.json";
const MAX_AUDIT_RECORDS = 100;
const MAX_BACKUP_LIST = 20;

function safeIsoTimestamp(date = new Date()) {
  return date.toISOString();
}

function safeTimestampForFilename(date = new Date()) {
  return safeIsoTimestamp(date).replace(/[:.]/g, "-");
}

function generateAuditId() {
  return `audit_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;
}

function generateBackupPath(date = new Date()) {
  return `${BACKUP_DIR}/site-content-${safeTimestampForFilename(date)}.json`;
}

function validateBackupPath(path) {
  const value = cleanText(path, 260).replace(/\\/g, "/");
  const pattern = /^public\/content\/backups\/site-content-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/;
  if (!pattern.test(value)) return "";
  if (value.includes("..") || value.startsWith("/")) return "";
  return value;
}

function timestampFromBackupPath(path) {
  const match = String(path || "").match(/site-content-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.json$/);
  if (!match) return "";
  return match[1].replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z");
}

function buildBackupEnvelope({ content, sourceSha = "", operation = "cms_save", metadata = {} }) {
  return {
    version: 1,
    timestamp: safeIsoTimestamp(),
    sourcePath: CONTENT_PATH,
    sourceSha: cleanText(sourceSha, 120),
    operation: cleanText(operation, 60),
    metadata: sanitizeMetadata(metadata),
    content
  };
}

function sanitizeMetadata(metadata = {}) {
  const allowed = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    const safeKey = cleanText(key, 60).replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safeKey) continue;
    if (["password", "token", "secret", "cookie", "authorization"].some(term => safeKey.toLowerCase().includes(term))) continue;
    allowed[safeKey] = typeof value === "object" ? cleanText(JSON.stringify(value), 500) : cleanText(value, 500);
  }
  return allowed;
}

function parseJsonObject(raw, fallback) {
  try {
    const parsed = JSON.parse(String(raw || ""));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

function extractBackupContent(rawBackup) {
  const parsed = parseJsonObject(rawBackup, null);
  if (!parsed) throw new Error("invalid_backup_json");
  if (parsed.content && typeof parsed.content === "object" && !Array.isArray(parsed.content)) return parsed.content;
  return parsed;
}

function normalizeAuditLog(raw) {
  const parsed = parseJsonObject(raw, { records: [] });
  const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed.records) ? parsed.records : [];
  return {
    version: 1,
    updatedAt: safeIsoTimestamp(),
    records: records.filter(record => record && typeof record === "object").slice(-MAX_AUDIT_RECORDS)
  };
}

function auditRecord(input = {}) {
  return {
    id: input.id || generateAuditId(),
    action: cleanText(input.action || "cms_operation", 80),
    timestamp: input.timestamp || safeIsoTimestamp(),
    status: input.status === "failure" ? "failure" : "success",
    message: cleanText(input.message || "CMS operation completed.", 240),
    commitSha: cleanText(input.commitSha || "", 120),
    targetPath: cleanText(input.targetPath || "", 260),
    backupPath: cleanText(input.backupPath || "", 260)
  };
}

async function appendAuditRecord(github, input) {
  let current = { content: "", sha: null };
  try {
    current = await github.readFile(AUDIT_LOG_PATH);
  } catch (error) {
    if (Number(error.status) !== 404 && !/not found/i.test(error.message)) throw error;
  }

  const log = normalizeAuditLog(current.content || "");
  log.records.push(auditRecord(input));
  log.records = log.records.slice(-MAX_AUDIT_RECORDS);
  log.updatedAt = safeIsoTimestamp();

  const result = await github.writeFile(
    AUDIT_LOG_PATH,
    `${JSON.stringify(log, null, 2)}\n`,
    `CMS audit log: ${cleanText(input.action || "operation", 60)}`,
    { sha: current.sha || null }
  );

  return { ...result, recordsCount: log.records.length };
}

async function appendAuditRecordSafe(github, input) {
  try {
    return await appendAuditRecord(github, input);
  } catch (_) {
    return null;
  }
}

async function createContentBackup(github, options = {}) {
  const current = await github.readFile(CONTENT_PATH);
  const currentContent = parseJsonObject(current.content, null);
  if (!currentContent) throw new Error("current_content_invalid");

  const backupPath = options.backupPath || generateBackupPath();
  const backupEnvelope = buildBackupEnvelope({
    content: currentContent,
    sourceSha: current.sha,
    operation: options.operation || "cms_save",
    metadata: options.metadata || {}
  });

  const result = await github.writeFile(
    backupPath,
    `${JSON.stringify(backupEnvelope, null, 2)}\n`,
    options.message || `CMS backup ${backupPath}`,
    { sha: null }
  );

  return {
    backupPath,
    previousSha: current.sha,
    previousContent: currentContent,
    commitSha: result.commitSha || "",
    fileSha: result.sha || ""
  };
}

function backupListItem(item) {
  const path = item.path || `${BACKUP_DIR}/${item.name || ""}`;
  const timestamp = timestampFromBackupPath(path);
  return {
    name: item.name || path.split("/").pop(),
    path,
    sha: item.sha || "",
    size: Number(item.size || 0),
    timestamp,
    htmlUrl: item.html_url || ""
  };
}

function sortBackupsNewestFirst(items) {
  return items
    .filter(item => validateBackupPath(item.path || `${BACKUP_DIR}/${item.name || ""}`))
    .map(backupListItem)
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
    .slice(0, MAX_BACKUP_LIST);
}

module.exports = {
  AUDIT_LOG_PATH,
  BACKUP_DIR,
  CONTENT_PATH,
  MAX_AUDIT_RECORDS,
  MAX_BACKUP_LIST,
  appendAuditRecord,
  appendAuditRecordSafe,
  buildBackupEnvelope,
  createContentBackup,
  extractBackupContent,
  generateBackupPath,
  safeIsoTimestamp,
  safeTimestampForFilename,
  sortBackupsNewestFirst,
  timestampFromBackupPath,
  validateBackupPath
};
