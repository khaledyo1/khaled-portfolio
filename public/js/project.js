(() => {
  "use strict";

  const $ = selector => document.querySelector(selector);
  const params = new URLSearchParams(location.search);
  const id = params.get("id") || "";

  function lang() {
    return document.documentElement.lang === "ar" ? "ar" : "en";
  }

  function text(value) {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "";
    return value[lang()] || value.en || value.ar || "";
  }

  function safe(value) {
    return String(value ?? "").replace(/[<>]/g, "").trim();
  }

  function renderProject(content) {
    const project = (content.projects || []).find(item => item.id === id) || (content.projects || [])[0];
    if (!project) return;

    document.title = `${text(project.title)} | Khaled ALimawi`;
    $("[data-project-meta]").textContent = text(project.meta);
    $("[data-project-title]").textContent = text(project.title);
    $("[data-project-description]").textContent = text(project.description);
    $("[data-project-problem]").textContent = text(project.problem);
    $("[data-project-delivered]").textContent = text(project.delivered);

    const image = $("[data-project-image]");
    image.src = project.image || "assets/images/og-cover.png";
    image.alt = `${text(project.title)} preview`;

    $("[data-project-tags]").innerHTML = (project.tags || []).map(tag => `<span>${safe(tag)}</span>`).join("");

    const actions = [];
    if (project.liveUrl) actions.push(`<a class="btn btn-primary" href="${project.liveUrl}" target="_blank" rel="noopener noreferrer">${lang() === "ar" ? "فتح المشروع" : "Open live"}</a>`);
    if (project.repoUrl) actions.push(`<a class="btn btn-ghost" href="${project.repoUrl}" target="_blank" rel="noopener noreferrer">GitHub</a>`);
    actions.push(`<a class="btn btn-dark" href="projects.html">${lang() === "ar" ? "العودة للأعمال" : "Back to projects"}</a>`);
    $("[data-project-actions]").innerHTML = actions.join("");
  }

  document.addEventListener("portfolio:content-applied", event => renderProject(event.detail.content));
})();
