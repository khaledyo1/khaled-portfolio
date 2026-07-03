(() => {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("id") || "";

  function getLang() {
    return document.documentElement.lang === "ar" ? "ar" : "en";
  }

  function getText(value) {
    if (typeof value === "string") return value.trim();
    if (!value || typeof value !== "object") return "";
    const lang = getLang();
    return String(value[lang] || value.en || value.ar || "").trim();
  }

  function cleanText(value) {
    return String(value ?? "")
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanUrl(value) {
    const url = String(value ?? "").trim();

    if (!url) return "";

    const isAllowed =
      /^(https?:\/\/|mailto:|tel:|assets\/|content\/|\.\/|\/)/i.test(url);

    if (!isAllowed) return "";

    return url.replace(/["<>]/g, "");
  }

  function setText(selector, value) {
    const element = $(selector);
    if (!element) return;
    element.textContent = cleanText(value);
  }

  function setOptionalText(selector, cardSelector, value) {
    const text = cleanText(value);
    const card = cardSelector ? $(cardSelector) : null;
    const element = $(selector);

    if (!text) {
      if (card) card.hidden = true;
      return;
    }

    if (card) card.hidden = false;
    if (element) element.textContent = text;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function projectTitle(project) {
    return getText(project?.title) || "Project";
  }

  function projectMeta(project) {
    return getText(project?.meta) || (getLang() === "ar" ? "مشروع" : "Project");
  }

  function projectDescription(project) {
    return getText(project?.description);
  }

  function projectOverview(project) {
    return (
      getText(project?.overview) ||
      getText(project?.caseStudy) ||
      getText(project?.description)
    );
  }

  function projectProblem(project) {
    return getText(project?.problem);
  }

  function projectDelivered(project) {
    return getText(project?.delivered) || getText(project?.solution);
  }

  function projectResult(project) {
    const explicit = getText(project?.result) || getText(project?.impact);
    if (explicit) return explicit;

    return getLang() === "ar"
      ? "تم تنظيم التجربة في واجهة واضحة، قابلة للتصفح، وسهلة الفهم للمستخدم النهائي."
      : "The experience was organized into a clearer, easier-to-navigate interface for the end user.";
  }

  function projectTags(project) {
    return Array.isArray(project?.tags)
      ? project.tags.map(cleanText).filter(Boolean)
      : [];
  }

  function projectFeatures(project) {
    if (Array.isArray(project?.features)) {
      return project.features.map(getText).map(cleanText).filter(Boolean);
    }

    const tags = projectTags(project);

    if (!tags.length) return [];

    return tags.slice(0, 5).map(tag => {
      return getLang() === "ar"
        ? `تم توظيف ${tag} لدعم تجربة استخدام واضحة وقابلة للتوسع.`
        : `${tag} was used to support a clean, scalable user experience.`;
    });
  }

  function projectDetailImage(project) {
    const explicit =
      cleanUrl(project?.detailImage) ||
      cleanUrl(project?.heroImage) ||
      cleanUrl(project?.fullImage);

    if (explicit) return explicit;

    const image = cleanUrl(project?.image);

    if (!image) return "assets/images/og-cover.png";

    /*
      إذا كانت صورة المشروع هي نسخة البطاقة الصغيرة -card.webp،
      يتم استخدام نسخة العرض الكبيرة تلقائياً داخل صفحة التفاصيل.
    */
    return image
      .replace("-preview-card.webp", "-preview.webp")
      .replace("-card.webp", ".webp");
  }

  function findProject(content) {
    const projects = Array.isArray(content?.projects)
      ? content.projects.filter(project => project && project.enabled !== false)
      : [];

    if (!projects.length) return null;

    return (
      projects.find(project => String(project.id || "") === requestedId) ||
      projects.find(project => String(project.slug || "") === requestedId) ||
      projects[0]
    );
  }

  function renderSummary(project) {
    const container = $("[data-project-summary]");
    if (!container) return;

    const tags = projectTags(project);
    const stack = tags.slice(0, 3).join(", ");
    const category = cleanText(project.category || "");
    const meta = projectMeta(project);

    const items = [
      {
        label: getLang() === "ar" ? "النوع" : "Type",
        value: meta
      },
      {
        label: getLang() === "ar" ? "التصنيف" : "Category",
        value: category || (getLang() === "ar" ? "ويب" : "Web")
      },
      {
        label: getLang() === "ar" ? "التقنيات" : "Stack",
        value: stack || (getLang() === "ar" ? "واجهة أمامية" : "Front-End")
      }
    ];

    container.innerHTML = items
      .filter(item => item.value)
      .map(item => {
        return `
          <div class="project-summary-item">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
          </div>
        `;
      })
      .join("");
  }

  function renderTags(project) {
    const container = $("[data-project-tags]");
    if (!container) return;

    const tags = projectTags(project);

    if (!tags.length) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = tags
      .map(tag => `<span>${escapeHtml(tag)}</span>`)
      .join("");
  }

  function renderFeatures(project) {
    const card = $("[data-project-features-card]");
    const list = $("[data-project-features]");

    if (!card || !list) return;

    const features = projectFeatures(project);

    if (!features.length) {
      card.hidden = true;
      return;
    }

    card.hidden = false;

    list.innerHTML = features
      .map(feature => `<li>${escapeHtml(feature)}</li>`)
      .join("");
  }

  function renderActions(project) {
    const container = $("[data-project-actions]");
    if (!container) return;

    const actions = [];
    const liveUrl = cleanUrl(project?.liveUrl);
    const repoUrl = cleanUrl(project?.repoUrl);

    if (liveUrl) {
      actions.push(`
        <a class="btn btn-primary" href="${escapeHtml(liveUrl)}" target="_blank" rel="noopener noreferrer">
          ${getLang() === "ar" ? "فتح المشروع" : "Open live"}
        </a>
      `);
    }

    if (repoUrl) {
      actions.push(`
        <a class="btn btn-ghost" href="${escapeHtml(repoUrl)}" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      `);
    }

    actions.push(`
      <a class="btn btn-dark" href="projects.html">
        ${getLang() === "ar" ? "العودة للأعمال" : "Back to projects"}
      </a>
    `);

    container.innerHTML = actions.join("");
  }

  function renderImage(project) {
    const image = $("[data-project-image]");
    if (!image) return;

    const title = projectTitle(project);
    const src = projectDetailImage(project);

    image.src = src;
    image.alt = `${title} preview`;
  }

  function updatePageMeta(project) {
    const title = projectTitle(project);
    const description = projectDescription(project) || projectOverview(project);

    document.title = `${title} | Khaled ALimawi`;

    const metaDescription = $('meta[name="description"]');
    if (metaDescription && description) {
      metaDescription.setAttribute("content", description);
    }
  }

  function renderProject(content) {
    const project = findProject(content);

    if (!project) {
      setText("[data-project-title]", getLang() === "ar" ? "المشروع غير موجود" : "Project not found");
      setText(
        "[data-project-description]",
        getLang() === "ar"
          ? "لم يتم العثور على بيانات هذا المشروع."
          : "No project data was found."
      );
      return;
    }

    const title = projectTitle(project);
    const meta = projectMeta(project);
    const description = projectDescription(project);
    const overview = projectOverview(project);
    const problem = projectProblem(project);
    const delivered = projectDelivered(project);
    const result = projectResult(project);

    updatePageMeta(project);

    setText("[data-project-meta]", meta);
    setText("[data-project-title]", title);
    setText("[data-project-description]", description || overview);

    setOptionalText("[data-project-overview]", "[data-project-overview-card]", overview);
    setOptionalText("[data-project-problem]", "[data-project-problem-card]", problem);
    setOptionalText("[data-project-delivered]", "[data-project-delivered-card]", delivered);
    setOptionalText("[data-project-result]", "[data-project-result-card]", result);

    renderSummary(project);
    renderImage(project);
    renderTags(project);
    renderFeatures(project);
    renderActions(project);
  }

  document.addEventListener("portfolio:content-applied", event => {
    renderProject(event.detail.content);
  });

  document.addEventListener("portfolio:language-changed", event => {
    if (event.detail?.content) {
      renderProject(event.detail.content);
    }
  });
})();
