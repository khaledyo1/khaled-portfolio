(() => {
  "use strict";

  const CONTENT_URL = "content/site-content.json";
  const PREVIEW_KEY = "portfolioCmsPreviewContent";
  const SAVE_URL = "/api/cms-save";
  const DIAGNOSTICS_URL = "/api/diagnostics";
  const MAX_UPLOAD_BYTES = 1_800_000;

  let content = null;
  let pendingUploads = [];

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  const fields = {
    profileName: $("#profileName"),
    profileTitleEn: $("#profileTitleEn"),
    heroHeadlineEn: $("#heroHeadlineEn"),
    heroHeadlineAr: $("#heroHeadlineAr"),
    heroLeadEn: $("#heroLeadEn"),
    heroLeadAr: $("#heroLeadAr"),
    heroImage: $("#heroImage"),
    heroImageUpload: $("#heroImageUpload"),
    heroPreview: $("#heroPreview"),
    contactEmail: $("#contactEmail"),
    contactWhatsapp: $("#contactWhatsapp"),
    contactPhone: $("#contactPhone"),
    socialList: $("#socialList"),
    projectList: $("#projectList"),
    statusBox: $("#statusBox"),
    adminPassword: $("#adminPassword"),
    importFile: $("#importFile")
  };

  function status(message, type = "") {
    fields.statusBox.textContent = message;
    fields.statusBox.className = `status ${type}`.trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function slugify(value) {
    const normalized = String(value || "project")
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    return normalized || `project-${Date.now()}`;
  }

  function ensureObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  async function loadInitialContent() {
    const local = localStorage.getItem(PREVIEW_KEY);
    if (local) {
      try {
        content = JSON.parse(local);
        status("تم تحميل نسخة المعاينة المحلية. إذا أردت النسخة المنشورة اضغط حذف المعاينة المحلية.", "success");
        return;
      } catch (_) {}
    }
    const response = await fetch(`${CONTENT_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("تعذر تحميل ملف المحتوى.");
    content = await response.json();
  }

  function fillForm() {
    const profile = ensureObject(content.profile);
    const contact = ensureObject(content.contact);

    fields.profileName.value = profile.name || "";
    fields.profileTitleEn.value = ensureObject(profile.title).en || "";
    fields.heroHeadlineEn.value = ensureObject(profile.heroHeadline).en || "";
    fields.heroHeadlineAr.value = ensureObject(profile.heroHeadline).ar || "";
    fields.heroLeadEn.value = ensureObject(profile.heroLead).en || "";
    fields.heroLeadAr.value = ensureObject(profile.heroLead).ar || "";
    fields.heroImage.value = profile.heroImage || "";
    fields.heroPreview.src = profile.heroImage || "";

    fields.contactEmail.value = contact.email || "";
    fields.contactWhatsapp.value = contact.whatsappNumber || "";
    fields.contactPhone.value = contact.phone || "";

    renderSocials();
    renderProjects();
  }

  function syncBasicContent() {
    content.profile = ensureObject(content.profile);
    content.profile.name = fields.profileName.value.trim();
    content.profile.title = ensureObject(content.profile.title);
    content.profile.title.en = fields.profileTitleEn.value.trim();
    content.profile.heroHeadline = {
      en: fields.heroHeadlineEn.value.trim(),
      ar: fields.heroHeadlineAr.value.trim()
    };
    content.profile.heroLead = {
      en: fields.heroLeadEn.value.trim(),
      ar: fields.heroLeadAr.value.trim()
    };
    content.profile.heroImage = fields.heroImage.value.trim();

    content.contact = ensureObject(content.contact);
    content.contact.email = fields.contactEmail.value.trim();
    content.contact.whatsappNumber = fields.contactWhatsapp.value.replace(/[^0-9]/g, "");
    content.contact.phone = fields.contactPhone.value.trim();

    content.socials = readSocials();
    content.projects = readProjects();
    content.updatedAt = new Date().toISOString();
  }

  function socialTemplate(item = {}, index = 0) {
    return `
      <details class="social-editor" open data-social-index="${index}">
        <summary>${escapeHtml(item.label || item.id || `Social ${index + 1}`)}</summary>
        <div class="form-grid" style="margin-top: 14px;">
          <label class="field"><span>ID</span><input data-social-field="id" value="${escapeHtml(item.id || "")}" placeholder="github" /></label>
          <label class="field"><span>Label</span><input data-social-field="label" value="${escapeHtml(item.label || "")}" placeholder="GitHub" /></label>
          <label class="field"><span>URL</span><input data-social-field="url" value="${escapeHtml(item.url || "")}" placeholder="https://..." /></label>
          <label class="field"><span>Icon path</span><input data-social-field="icon" value="${escapeHtml(item.icon || "")}" placeholder="assets/social-icons/github.svg" /></label>
          <label class="field"><span>Enabled</span><select data-social-field="enabled"><option value="true" ${item.enabled !== false ? "selected" : ""}>Yes</option><option value="false" ${item.enabled === false ? "selected" : ""}>No</option></select></label>
        </div>
        <div class="editor-actions"><button class="btn danger" data-remove-social type="button">حذف الرابط</button></div>
      </details>`;
  }

  function renderSocials() {
    const socials = Array.isArray(content.socials) ? content.socials : [];
    fields.socialList.innerHTML = socials.map(socialTemplate).join("");
  }

  function readSocials() {
    return $$("[data-social-index]").map(item => ({
      id: item.querySelector('[data-social-field="id"]').value.trim(),
      label: item.querySelector('[data-social-field="label"]').value.trim(),
      url: item.querySelector('[data-social-field="url"]').value.trim(),
      icon: item.querySelector('[data-social-field="icon"]').value.trim(),
      enabled: item.querySelector('[data-social-field="enabled"]').value === "true"
    })).filter(item => item.id && item.url);
  }

  function projectTemplate(project = {}, index = 0) {
    const title = ensureObject(project.title);
    const meta = ensureObject(project.meta);
    const description = ensureObject(project.description);
    const problem = ensureObject(project.problem);
    const delivered = ensureObject(project.delivered);
    const tags = Array.isArray(project.tags) ? project.tags.join(", ") : "";
    return `
      <details class="project-editor" data-project-index="${index}" open>
        <summary>${escapeHtml(title.en || title.ar || project.id || `Project ${index + 1}`)}</summary>
        <div class="form-grid" style="margin-top: 14px;">
          <label class="field"><span>ID</span><input data-project-field="id" value="${escapeHtml(project.id || "")}" placeholder="project-name" /></label>
          <label class="field"><span>Category</span><select data-project-field="category">
            <option value="web" ${project.category === "web" ? "selected" : ""}>Web</option>
            <option value="dashboard" ${project.category === "dashboard" ? "selected" : ""}>Dashboard</option>
            <option value="ai" ${project.category === "ai" ? "selected" : ""}>AI</option>
          </select></label>
          <label class="field"><span>Featured on homepage</span><select data-project-field="featured"><option value="true" ${project.featured ? "selected" : ""}>Yes</option><option value="false" ${!project.featured ? "selected" : ""}>No</option></select></label>
          <label class="field"><span>Theme class</span><input data-project-field="theme" value="${escapeHtml(project.theme || "project-theme-klik")}" /></label>
          <label class="field"><span>Title EN</span><input data-project-field="title.en" value="${escapeHtml(title.en || "")}" /></label>
          <label class="field"><span>Title AR</span><input data-project-field="title.ar" value="${escapeHtml(title.ar || "")}" /></label>
          <label class="field"><span>Meta EN</span><input data-project-field="meta.en" value="${escapeHtml(meta.en || "")}" /></label>
          <label class="field"><span>Meta AR</span><input data-project-field="meta.ar" value="${escapeHtml(meta.ar || "")}" /></label>
          <label class="field"><span>Description EN</span><textarea data-project-field="description.en">${escapeHtml(description.en || "")}</textarea></label>
          <label class="field"><span>Description AR</span><textarea data-project-field="description.ar">${escapeHtml(description.ar || "")}</textarea></label>
          <label class="field"><span>Problem EN</span><textarea data-project-field="problem.en">${escapeHtml(problem.en || "")}</textarea></label>
          <label class="field"><span>Problem AR</span><textarea data-project-field="problem.ar">${escapeHtml(problem.ar || "")}</textarea></label>
          <label class="field"><span>Delivered EN</span><textarea data-project-field="delivered.en">${escapeHtml(delivered.en || "")}</textarea></label>
          <label class="field"><span>Delivered AR</span><textarea data-project-field="delivered.ar">${escapeHtml(delivered.ar || "")}</textarea></label>
          <label class="field"><span>Image path</span><input data-project-field="image" value="${escapeHtml(project.image || "")}" /></label>
          <label class="field"><span>Upload new image</span><input data-project-upload type="file" accept="image/png,image/jpeg,image/webp" /><img class="preview-img" src="${escapeHtml(project.image || "")}" alt="Project image preview" /></label>
          <label class="field"><span>Tags separated by comma</span><input data-project-field="tags" value="${escapeHtml(tags)}" /></label>
          <label class="field"><span>Live URL</span><input data-project-field="liveUrl" value="${escapeHtml(project.liveUrl || "")}" /></label>
          <label class="field"><span>Repository URL</span><input data-project-field="repoUrl" value="${escapeHtml(project.repoUrl || "")}" /></label>
        </div>
        <div class="editor-actions"><button class="btn danger" data-remove-project type="button">حذف المشروع</button></div>
      </details>`;
  }

  function renderProjects() {
    const projects = Array.isArray(content.projects) ? content.projects : [];
    fields.projectList.innerHTML = projects.map(projectTemplate).join("");
  }

  function readProjects() {
    return $$("[data-project-index]").map((item, index) => {
      const get = key => item.querySelector(`[data-project-field="${key}"]`)?.value?.trim() || "";
      const titleEn = get("title.en");
      const generatedId = slugify(titleEn || get("title.ar") || `project-${index + 1}`);
      return {
        id: get("id") || generatedId,
        featured: get("featured") === "true",
        category: get("category") || "web",
        theme: get("theme") || "project-theme-klik",
        title: { en: titleEn, ar: get("title.ar") },
        meta: { en: get("meta.en"), ar: get("meta.ar") },
        description: { en: get("description.en"), ar: get("description.ar") },
        problem: { en: get("problem.en"), ar: get("problem.ar") },
        delivered: { en: get("delivered.en"), ar: get("delivered.ar") },
        image: get("image"),
        tags: get("tags").split(",").map(tag => tag.trim()).filter(Boolean),
        liveUrl: get("liveUrl"),
        repoUrl: get("repoUrl")
      };
    }).filter(project => project.title.en || project.title.ar);
  }

  async function fileToUpload(file, folder, preferredName) {
    if (!file) return null;
    if (!file.type.startsWith("image/")) throw new Error("الملف يجب أن يكون صورة فقط.");
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("حجم الصورة كبير. استخدم صورة أقل من 1.8MB.");
    const ext = file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "webp";
    const safeName = `${slugify(preferredName)}-${Date.now()}.${ext}`;
    const path = `public/assets/uploads/${folder}/${safeName}`;
    const publicPath = `assets/uploads/${folder}/${safeName}`;
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(new Error("فشل قراءة الصورة."));
      reader.readAsDataURL(file);
    });
    return { path, publicPath, contentBase64: base64, contentType: file.type };
  }

  async function handleHeroUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const upload = await fileToUpload(file, "profile", "hero-image");
      pendingUploads.push(upload);
      fields.heroImage.value = upload.publicPath;
      fields.heroPreview.src = URL.createObjectURL(file);
      status("تم تجهيز الصورة. اضغط حفظ ونشر حتى تظهر للجميع.", "success");
    } catch (error) {
      status(error.message, "error");
    }
  }

  async function handleProjectUpload(input) {
    const editor = input.closest("[data-project-index]");
    const title = editor?.querySelector('[data-project-field="title.en"]')?.value || "project";
    const file = input.files?.[0];
    if (!file || !editor) return;
    try {
      const upload = await fileToUpload(file, "projects", title);
      pendingUploads.push(upload);
      editor.querySelector('[data-project-field="image"]').value = upload.publicPath;
      const preview = editor.querySelector(".preview-img");
      if (preview) preview.src = URL.createObjectURL(file);
      status("تم تجهيز صورة المشروع. اضغط حفظ ونشر حتى تظهر للجميع.", "success");
    } catch (error) {
      status(error.message, "error");
    }
  }

  function addProject() {
    syncBasicContent();
    content.projects.push({
      id: `new-project-${Date.now()}`,
      featured: false,
      category: "web",
      theme: "project-theme-klik",
      title: { en: "New Project", ar: "مشروع جديد" },
      meta: { en: "Project Type", ar: "نوع المشروع" },
      description: { en: "Project description.", ar: "وصف المشروع." },
      problem: { en: "Problem statement.", ar: "وصف المشكلة." },
      delivered: { en: "Delivered solution.", ar: "الحل المنفذ." },
      image: "assets/images/og-cover.png",
      tags: ["HTML", "CSS", "JavaScript"],
      liveUrl: "",
      repoUrl: ""
    });
    renderProjects();
  }

  function addSocial() {
    syncBasicContent();
    content.socials.push({ id: "new-link", label: "New Link", url: "https://", icon: "assets/social-icons/github.svg", enabled: true });
    renderSocials();
  }

  function previewLocal() {
    syncBasicContent();
    localStorage.setItem(PREVIEW_KEY, JSON.stringify(content));
    status("تم حفظ المعاينة محلياً. افتح الموقع من نفس المتصفح لمشاهدة التغييرات.", "success");
  }

  function clearPreview() {
    localStorage.removeItem(PREVIEW_KEY);
    status("تم حذف المعاينة المحلية. أعد تحميل الموقع لرؤية النسخة المنشورة.", "success");
  }

  async function runDiagnostics() {
    const password = fields.adminPassword.value.trim();
    if (!password) {
      status("أدخل كلمة مرور الإدارة أولاً حتى يتم فحص الإعدادات بأمان.", "error");
      return;
    }

    status("جاري فحص Vercel Environment Variables و GitHub Token...", "");

    try {
      const response = await fetch(DIAGNOSTICS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "فشل فحص الإعدادات.");

      const env = payload.checks?.env || {};
      const github = payload.checks?.github || {};
      const lines = [
        payload.ok ? "الفحص ناجح: إعدادات النشر الأساسية تبدو صحيحة." : "الفحص اكتمل لكن يوجد نقص في الإعدادات.",
        `ADMIN_PASSWORD: ${env.adminPassword ? "موجود" : "ناقص"}`,
        `GITHUB_TOKEN: ${env.githubToken ? "موجود" : "ناقص"}`,
        `GITHUB_OWNER: ${env.githubOwner ? "موجود" : "ناقص"}`,
        `GITHUB_REPO: ${env.githubRepo ? "موجود" : "ناقص"}`,
        `GitHub Token Valid: ${github.tokenValid ? "نعم" : "لا"}`,
        `Repo Access: ${github.repoReadable ? "نعم" : "لا"}`,
        github.message ? `Message: ${github.message}` : ""
      ].filter(Boolean);

      status(lines.join("\n"), payload.ok ? "success" : "error");
    } catch (error) {
      status(error.message || "فشل فحص الإعدادات.", "error");
    }
  }

  async function saveAndPublish() {
    syncBasicContent();
    const password = fields.adminPassword.value.trim();
    if (!password) {
      status("أدخل كلمة مرور الإدارة أولاً.", "error");
      return;
    }

    status("جاري الحفظ داخل GitHub...", "");

    try {
      const response = await fetch(SAVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, content, uploads: pendingUploads })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.message || "فشل الحفظ.");
      pendingUploads = [];
      localStorage.removeItem(PREVIEW_KEY);
      status("تم الحفظ بنجاح. انتظر دقيقة تقريباً حتى يكتمل Vercel redeploy وتظهر التغييرات للجميع.", "success");
    } catch (error) {
      status(error.message, "error");
    }
  }

  function exportJson() {
    syncBasicContent();
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "site-content.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file) {
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (!imported || typeof imported !== "object") throw new Error("ملف غير صالح.");
      content = imported;
      pendingUploads = [];
      fillForm();
      status("تم استيراد الملف. راجع البيانات ثم احفظ أو عاين.", "success");
    } catch (error) {
      status(error.message, "error");
    }
  }

  function initTabs() {
    $$("[data-tab]").forEach(button => {
      button.addEventListener("click", () => {
        $$("[data-tab]").forEach(item => item.classList.toggle("active", item === button));
        const tab = button.dataset.tab;
        $$("[data-panel]").forEach(panel => panel.classList.toggle("active", panel.dataset.panel === tab));
      });
    });
  }

  function bindEvents() {
    initTabs();
    $("#addProjectBtn").addEventListener("click", addProject);
    $("#addSocialBtn").addEventListener("click", addSocial);
    $("#previewBtn").addEventListener("click", previewLocal);
    $("#clearPreviewBtn").addEventListener("click", clearPreview);
    $("#diagnosticsBtn").addEventListener("click", runDiagnostics);
    $("#saveBtn").addEventListener("click", saveAndPublish);
    $("#exportBtn").addEventListener("click", exportJson);
    fields.importFile.addEventListener("change", event => importJson(event.target.files?.[0]));
    fields.heroImageUpload.addEventListener("change", handleHeroUpload);

    document.addEventListener("click", event => {
      const removeProject = event.target.closest("[data-remove-project]");
      if (removeProject) {
        removeProject.closest("[data-project-index]")?.remove();
      }
      const removeSocial = event.target.closest("[data-remove-social]");
      if (removeSocial) {
        removeSocial.closest("[data-social-index]")?.remove();
      }
    });

    document.addEventListener("change", event => {
      if (event.target.matches("[data-project-upload]")) handleProjectUpload(event.target);
    });
  }

  async function boot() {
    try {
      await loadInitialContent();
      fillForm();
      bindEvents();
    } catch (error) {
      status(error.message, "error");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
