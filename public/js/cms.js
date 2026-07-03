(() => {
  "use strict";

  const CONTENT_URL = "content/site-content.json";
  const PREVIEW_KEY = "portfolioCmsPreviewContent";
  const FALLBACK_LANG = "en";

  let activeContent = null;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  function currentLang() {
    return document.documentElement.lang === "ar" ? "ar" : FALLBACK_LANG;
  }

  function text(value, lang = currentLang()) {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "";
    return value[lang] || value.en || value.ar || "";
  }

  function safeText(value) {
    return String(value ?? "").replace(/[<>]/g, "").trim();
  }

  function safeUrl(value) {
    const url = String(value ?? "").trim();
    if (!url) return "";
    if (/^(https?:\/\/|mailto:|tel:|assets\/|content\/|\.\/|\/)/i.test(url)) return url;
    return "";
  }

  function setBilingual(element, value) {
    if (!element || !value) return;
    if (typeof value === "object") {
      if (value.en) element.dataset.en = value.en;
      if (value.ar) element.dataset.ar = value.ar;
    }
    element.textContent = text(value);
  }

  function setImage(img, src, alt = "") {
    if (!img || !src) return;
    const safe = safeUrl(src);
    if (!safe) return;
    img.src = safe;
    img.alt = alt || img.alt || "";
  }

  async function loadContent() {
    const preview = getPreviewContent();
    if (preview) return preview;

    const response = await fetch(`${CONTENT_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load site content");
    return response.json();
  }

  function getPreviewContent() {
    try {
      const raw = localStorage.getItem(PREVIEW_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function getEnabledSocials(content) {
    const socials = Array.isArray(content?.socials) ? content.socials : [];
    const wa = whatsappUrl(content);
    const email = emailUrl(content);

    return socials
      .filter(item => item && item.enabled !== false)
      .map(item => {
        if (item.id === "whatsapp" && wa) return { ...item, url: wa };
        if ((item.id === "gmail" || item.id === "email") && email) return { ...item, url: email };
        return item;
      });
  }

  function whatsappUrl(content) {
    const number = safeText(content?.contact?.whatsappNumber || content?.contact?.phone || "").replace(/[^0-9]/g, "");
    return number ? `https://wa.me/${number}` : "";
  }

  function emailUrl(content) {
    const email = safeText(content?.contact?.email || "");
    return email ? `mailto:${email}` : "";
  }

  function applyProfile(content) {
    const profile = content.profile || {};
    const hero = $(".hero");

    if (hero) {
      setBilingual($(".section-kicker", hero), profile.heroKicker);
      setBilingual($("h1 span", hero), profile.heroHeadline);
      setBilingual($(".lead", hero), profile.heroLead);

      const source = $(".profile-frame picture source", hero);
      const img = $(".profile-frame picture img", hero);
      if (source && profile.heroImage) source.srcset = safeUrl(profile.heroImage);
      setImage(img, profile.heroImage, `${profile.name || "Profile"} portrait`);

      const badges = $$(".profile-frame .float-badge", hero);
      (profile.badges || []).slice(0, badges.length).forEach((badge, index) => setBilingual(badges[index], badge));
    }

    $$(".brand-logo").forEach(img => {
      if (profile.logoImage) setImage(img, profile.logoImage, `${profile.name || "Portfolio"} logo`);
    });
  }

  function iconMarkup(icon, label) {
    const url = safeUrl(icon);
    if (!url) return "";
    return `<img alt="" decoding="async" height="128" src="${url}" width="128"/>`;
  }

  function renderSocialLink(item, compact = false) {
    const url = safeUrl(item.url);
    if (!url) return "";
    const isExternal = /^https?:\/\//i.test(url);
    const rel = isExternal ? ' rel="noopener noreferrer" target="_blank"' : "";
    const whatsappAttr = item.id === "whatsapp" ? " data-whatsapp-direct" : "";
    const label = safeText(item.label || item.id || "Link");
    const display = compact ? label : safeText(item.display || label);
    return `<a class="${compact ? "icon-link" : "social-contact-link"}" aria-label="${label}" href="${url}"${rel}${whatsappAttr}>${iconMarkup(item.icon, label)}${compact ? "" : `<span>${display}</span>`}</a>`;
  }

  function applyContacts(content) {
    const socials = getEnabledSocials(content);
    const email = emailUrl(content);
    const wa = whatsappUrl(content);

    if (email) {
      $$('a[href^="mailto:"]').forEach(link => {
        link.href = email;
        const label = $("span", link);
        if (label && /@/.test(label.textContent || "")) label.textContent = content.contact.email;
      });
    }

    if (wa) {
      $$('[data-whatsapp-direct], a[href*="wa.me"]').forEach(link => {
        link.href = wa;
        const label = $("span", link);
        if (label && /\+?\d/.test(label.textContent || "")) label.textContent = content.contact.phone || content.contact.whatsappNumber;
      });
    }

    const github = socials.find(item => item.id === "github");
    const linkedin = socials.find(item => item.id === "linkedin");
    const instagram = socials.find(item => item.id === "instagram");
    if (github?.url) $$('a[href*="github.com"]').forEach(link => { link.href = github.url; });
    if (linkedin?.url) $$('a[href*="linkedin.com"]').forEach(link => { link.href = linkedin.url; });
    if (instagram?.url) $$('a[href*="instagram.com"]').forEach(link => { link.href = instagram.url; });

    $$(".hero-socials").forEach(container => {
      container.innerHTML = socials.map(item => renderSocialLink(item, true)).join("");
    });

    $$(".footer-contact, .contact-list").forEach(container => {
      container.innerHTML = socials.map(item => renderSocialLink(item, false)).join("");
    });
  }

  function projectHref(project) {
    return safeUrl(project.caseStudyUrl || project.liveUrl || "") || `project.html?id=${encodeURIComponent(project.id)}`;
  }

  function projectCard(project, options = {}) {
    const title = safeText(text(project.title));
    const meta = safeText(text(project.meta));
    const description = safeText(text(project.description));
    const problem = safeText(text(project.problem));
    const delivered = safeText(text(project.delivered));
    const image = safeUrl(project.image || "assets/images/og-cover.png");
    const href = projectHref(project);
    const tags = Array.isArray(project.tags) ? project.tags : [];
    const theme = safeText(project.theme || "project-theme-klik");
    const category = safeText(project.category || "web");

    return `
      <article class="project-card reveal ${theme}" data-category="${category}">
        <a class="project-image" href="${href}">
          <img alt="${title} preview" decoding="async" fetchpriority="low" height="450" loading="lazy" sizes="(max-width: 720px) calc(100vw - 42px), (max-width: 1100px) 50vw, 520px" src="${image}" width="800"/>
        </a>
        <div class="project-body">
          <div class="project-meta"><span>${meta}</span></div>
          <h3><a href="${href}">${title}</a></h3>
          <p>${description}</p>
          ${options.compact ? "" : `
            <div class="case-snapshot">
              <div><span>${currentLang() === "ar" ? "المشكلة" : "Problem"}</span><p>${problem}</p></div>
              <div><span>${currentLang() === "ar" ? "التنفيذ" : "Delivered"}</span><p>${delivered}</p></div>
            </div>`}
          <div class="tag-row">${tags.map(tag => `<span>${safeText(tag)}</span>`).join("")}</div>
          <a class="text-link" href="${href}">${currentLang() === "ar" ? "اقرأ دراسة المشروع" : "Read case study"}</a>
        </div>
      </article>`;
  }

  function applyProjects(content) {
    const projects = Array.isArray(content.projects) ? content.projects.filter(project => project && project.enabled !== false) : [];
    const grids = $$(".project-grid");
    if (!grids.length || !projects.length) return;

    const path = location.pathname.split("/").pop() || "index.html";
    grids.forEach(grid => {
      const isProjectsPage = path === "projects.html";
      const items = isProjectsPage ? projects : projects.filter(project => project.featured).slice(0, 3);
      if (!items.length) return;
      grid.innerHTML = items.map(project => projectCard(project, { compact: !isProjectsPage })).join("");
    });
  }

  function updateMeta(content) {
    const profile = content.profile || {};
    const title = `${profile.name || "Portfolio"} | ${text(profile.title) || "Software Developer"}`;
    if (document.title && location.pathname.endsWith("index.html")) document.title = title;
    const ogImage = profile.heroImage || profile.avatarImage;
    if (ogImage) {
      $('meta[property="og:image"]')?.setAttribute("content", ogImage);
      $('meta[name="twitter:image"]')?.setAttribute("content", ogImage);
    }
  }

  function applyContent(content) {
    activeContent = content;
    applyProfile(content);
    applyContacts(content);
    applyProjects(content);
    updateMeta(content);
    document.dispatchEvent(new CustomEvent("portfolio:content-applied", { detail: { content } }));
  }

  function getRuntimeConfig() {
    const content = activeContent || getPreviewContent() || {};
    return {
      email: content?.contact?.email || "",
      whatsappNumber: String(content?.contact?.whatsappNumber || "").replace(/[^0-9]/g, "")
    };
  }

  window.PortfolioCMS = {
    loadContent,
    applyContent,
    getContent: () => activeContent,
    getRuntimeConfig,
    previewKey: PREVIEW_KEY
  };

  const start = () => {
    loadContent()
      .then(applyContent)
      .catch(error => console.warn("Portfolio CMS disabled:", error.message));
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
