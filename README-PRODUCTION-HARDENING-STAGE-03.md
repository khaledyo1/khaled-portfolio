# Stage 03 — Backups + Rollback + Audit Log

This stage adds production-grade data safety to the adjustable portfolio CMS.

## New API endpoints

- `GET /api/cms-backups`
  - Requires a valid admin session cookie.
  - Returns the latest 20 backup files from `public/content/backups/`, newest first.
  - Returns metadata only.

- `GET /api/cms-backup-read?path=...`
  - Requires a valid admin session cookie.
  - Validates that `path` is inside `public/content/backups/`.
  - Rejects path traversal attempts.
  - Returns selected backup metadata and content.

- `POST /api/cms-rollback`
  - Requires a valid admin session cookie and CSRF token.
  - Validates selected backup path.
  - Reads selected backup.
  - Validates backup content using the CMS schema.
  - Creates a safety backup of current live content before rollback.
  - Restores selected content into `public/content/site-content.json`.
  - Appends rollback audit records.

## Modified endpoint

- `POST /api/cms-save`
  - Validates incoming content before any GitHub write.
  - Reads current `site-content.json` from GitHub.
  - Creates backup under `public/content/backups/` before publishing.
  - Stops publishing if backup creation fails.
  - Updates `public/content/audit-log.json` with bounded latest 100 records.

## New helper files

- `lib/github-content.js`
  - Shared GitHub Contents API client.
  - Functions: read file, write file, write base64 file, list directory, safe Base64 encode/decode.

- `lib/cms-backups.js`
  - Backup filename generation.
  - Backup path validation.
  - Backup envelope creation.
  - Audit log append.
  - Bounded audit log retention.

## Modified admin panel

- `public/admin.html`
  - New tab: `النسخ الاحتياطية والاسترجاع` / Backups & Rollback.

- `public/js/admin.js`
  - Loads backups.
  - Previews selected backup.
  - Restores selected backup with confirmation.
  - Uses existing admin session and CSRF protection.

- `public/css/admin.css`
  - Styles backup list, preview, restore buttons, and responsive layout.

## Assumptions

- The project remains static-first and deployed on Vercel.
- GitHub Contents API is used as the publishing backend.
- Rollback and backup writes are sequential GitHub commits because the Contents API does not provide a simple multi-file atomic transaction.
- Audit logging is best-effort after critical safety operations. Backup creation remains blocking before any CMS publish.
- No secrets are stored in backup files or audit records.

## Testing checklist

1. Open `/api/health` and confirm `ok: true`.
2. Open `/admin.html` and log in securely.
3. Run diagnostics from the admin panel.
4. Change a small field and click Save & Publish.
5. Confirm `public/content/backups/` contains a timestamped backup.
6. Confirm `public/content/audit-log.json` contains `backup_created` and `cms_save` records.
7. Open Backups & Rollback tab and click Load Backups.
8. Preview a backup and confirm JSON appears.
9. Restore a backup and confirm a safety backup is created first.
10. Confirm the restored content appears in `public/content/site-content.json` on GitHub.
11. Try `/api/cms-backup-read?path=../../package.json` and confirm it is rejected.
12. Test unauthenticated access to `/api/cms-backups` and confirm it is rejected.
13. Test POST `/api/cms-rollback` without CSRF and confirm it is rejected.
14. Temporarily use a bad GitHub token in Preview and confirm the UI shows a safe error.
