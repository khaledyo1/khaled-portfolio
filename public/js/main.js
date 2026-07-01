(() => {
  "use strict";

  const CONFIG = Object.freeze({
    whatsappNumber: "970599059159",
    contactEmail: "khaled.yous3f19@gmail.com",
    web3FormsAccessKey: "2b9246f9-7995-492b-833c-9f08828996be",
    storage: Object.freeze({
      lang: "portfolioLang",
      theme: "portfolioTheme",
      chat: "khaledPortfolioChatHistory"
    }),
    chat: Object.freeze({
      maxStoredMessages: 30,
      maxUserMessageChars: 500,
      maxReplyChars: 1800,
      requestTimeoutMs: 22000
    }),
    projects: Object.freeze({ pageSize: 4 })
  });

  const root = document.documentElement;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  window.addEventListener("error", () => {
    root.classList.add("lang-ready");
  });

  window.addEventListener("unhandledrejection", () => {
    root.classList.add("lang-ready");
  });

  const storage = {
    get(key, fallback) {
      try {
        return localStorage.getItem(key) || fallback;
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (_) {}
    }
  };

  function safeLang(value) {
    return value === "ar" ? "ar" : "en";
  }

  function safeTheme(value) {
    return value === "light" ? "light" : "dark";
  }

  function normalizeText(value, limit = 500) {
    return String(value ?? "")
      .replace(/\r\n?/g, "\n")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
      .replace(/[ \t]{3,}/g, "  ")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim()
      .slice(0, Math.max(0, limit));
  }

  function textValue(formData, key, limit = 1200) {
    return normalizeText(formData.get(key), limit);
  }

  function optionText(form, name, lang) {
    const field = form.elements[name];
    const option = field?.selectedOptions?.[0];
    return option?.dataset?.[lang] || option?.textContent?.trim() || textValue(new FormData(form), name, 120);
  }

  function whatsappUrl(message) {
    return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(normalizeText(message, 1800))}`;
  }

  function openExternal(url) {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (opened) opened.opener = null;
  }

  function directWhatsappMessage(lang) {
    return lang === "ar"
      ? "مرحباً خالد، شاهدت البورتفوليو الخاص بك وأرغب بمناقشة مشروع برمجي.\n\nنوع المشروع:\nاللغة المطلوبة:\nالموعد المتوقع:\nملاحظات:"
      : "Hi Khaled, I visited your portfolio and I would like to discuss a software project.\n\nProject type:\nRequired language:\nExpected deadline:\nNotes:";
  }

  function updateWhatsappLinks(lang) {
    const url = whatsappUrl(directWhatsappMessage(lang));
    $$("[data-whatsapp-direct]").forEach(link => {
      link.href = url;
    });
  }

  function applyLang(value) {
    const lang = safeLang(value);
    const isArabic = lang === "ar";

    root.lang = lang;
    root.dir = isArabic ? "rtl" : "ltr";
    root.dataset.lang = lang;

    $$("[data-en][data-ar]").forEach(element => {
      element.textContent = element.dataset[lang] || "";
    });

    $$("[data-placeholder-en][data-placeholder-ar]").forEach(element => {
      element.placeholder = element.dataset[`placeholder${isArabic ? "Ar" : "En"}`] || "";
    });

    const label = $(".lang-current");
    const flag = $(".lang-flag");

    if (label) label.textContent = isArabic ? "AR" : "EN";
    if (flag) flag.textContent = isArabic ? "🇵🇸" : "🇬🇧";

    $$("[data-lang-option]").forEach(option => {
      const active = option.dataset.langOption === lang;
      option.classList.toggle("active", active);
      option.setAttribute("aria-current", active ? "true" : "false");
    });

    storage.set(CONFIG.storage.lang, lang);
    updateWhatsappLinks(lang);
    root.classList.add("lang-ready");
  }

  function applyTheme(value) {
    const theme = safeTheme(value);
    const button = $(".theme-toggle");
    const icon = $(".theme-icon");
    const next = theme === "dark" ? "light" : "dark";

    root.dataset.theme = theme;
    storage.set(CONFIG.storage.theme, theme);

    if (icon) icon.textContent = theme === "dark" ? "☀" : "☾";

    if (button) {
      button.setAttribute("aria-label", `Switch to ${next} theme`);
      button.title = `${next[0].toUpperCase()}${next.slice(1)} theme`;
    }
  }

  function initLanguageMenu() {
    const langMenu = $(".language-menu");
    const langToggle = $(".lang-toggle");
    const langDropdown = $(".lang-dropdown");

    const setOpen = open => {
      if (!langMenu || !langToggle || !langDropdown) return;
      langMenu.classList.toggle("open", open);
      langToggle.setAttribute("aria-expanded", String(open));
      langDropdown.hidden = !open;
    };

    langToggle?.addEventListener("click", event => {
      event.stopPropagation();
      setOpen(!langMenu?.classList.contains("open"));
    });

    $$("[data-lang-option]").forEach(option => {
      option.addEventListener("click", () => {
        applyLang(option.dataset.langOption);
        setOpen(false);
      });
    });

    document.addEventListener("click", event => {
      if (langMenu && !langMenu.contains(event.target)) setOpen(false);
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") setOpen(false);
    });
  }

  function initThemeToggle() {
    $(".theme-toggle")?.addEventListener("click", () => {
      applyTheme(root.dataset.theme === "dark" ? "light" : "dark");
    });
  }

  function initFloatingWhatsapp() {
    const floatingWhatsapp = $(".floating-whatsapp");
    if (!floatingWhatsapp) return;

    let compact = false;
    let ticking = false;

    const sync = () => {
      const next = window.scrollY > 180;
      if (next !== compact) {
        compact = next;
        floatingWhatsapp.classList.toggle("is-compact", compact);
      }
    };

    const requestSync = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        sync();
        ticking = false;
      });
    };

    sync();
    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync, { passive: true });
  }

  function initMobileMenu() {
    const menuButton = $(".menu-toggle");
    const mobilePanel = $(".mobile-panel");

    menuButton?.addEventListener("click", () => {
      const open = !mobilePanel?.classList.contains("open");
      mobilePanel?.classList.toggle("open", open);
      menuButton.setAttribute("aria-expanded", String(open));
    });
  }

  function initRevealAnimations() {
    const revealElements = $$(".reveal");

    if (!revealElements.length) return;

    if (!("IntersectionObserver" in window)) {
      revealElements.forEach(element => element.classList.add("active"));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("active");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    revealElements.forEach(element => observer.observe(element));
  }

  function initProjectsPager() {
    const filterButtons = $$("[data-filter]");
    const projectCards = $$(".project-card[data-category]");
    const projectPager = $("[data-project-pager]");
    const projectPrev = $("[data-project-prev]");
    const projectNext = $("[data-project-next]");

    if (!projectCards.length) return;

    let activeFilter = "all";
    let activePage = 0;

    const matchingProjects = () =>
      projectCards.filter(card => activeFilter === "all" || card.dataset.category === activeFilter);

    const render = () => {
      const visible = matchingProjects();
      const totalPages = Math.max(1, Math.ceil(visible.length / CONFIG.projects.pageSize));
      activePage = Math.min(activePage, totalPages - 1);

      const start = activePage * CONFIG.projects.pageSize;
      const end = start + CONFIG.projects.pageSize;
      const visibleSet = new Set(visible.slice(start, end));

      projectCards.forEach(card => {
        card.hidden = !visibleSet.has(card);
      });

      if (projectPager) projectPager.hidden = visible.length <= CONFIG.projects.pageSize;
      if (projectPrev) projectPrev.hidden = activePage === 0;
      if (projectNext) projectNext.hidden = activePage >= totalPages - 1;
    };

    filterButtons.forEach(button => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.filter || "all";
        activePage = 0;
        filterButtons.forEach(item => item.classList.toggle("active", item === button));
        render();
      });
    });

    projectPrev?.addEventListener("click", () => {
      activePage = Math.max(0, activePage - 1);
      render();
    });

    projectNext?.addEventListener("click", () => {
      activePage += 1;
      render();
    });

    render();
  }

  function initChatWidget() {
    const chatWidget = $("[data-chat-widget]");
    const chatPanel = $("[data-chat-panel]");
    const chatToggle = $("[data-chat-toggle]");
    const chatClose = $("[data-chat-close]");
    const chatForm = $("[data-chat-form]");
    const chatInput = $("[data-chat-input]");
    const chatMessages = $("[data-chat-messages]");
    const chatPrompts = $$("[data-chat-prompt]");
    const chatSubmit = $("[data-chat-submit]");

    if (!chatWidget || !chatPanel || !chatToggle || !chatMessages) return;

    let busy = false;
    let closeTimer = null;

    const fallback = () => safeLang(root.lang) === "ar"
      ? "المساعد الذكي غير متاح مؤقتاً على هذه النسخة. استخدم زر التواصل أو واتساب."
      : "The smart assistant is temporarily unavailable on this version. Use the contact form or WhatsApp.";

    const setOpen = open => {
      clearTimeout(closeTimer);
      chatWidget.classList.toggle("is-open", open);
      chatToggle.setAttribute("aria-expanded", String(open));

      if (open) {
        chatPanel.classList.remove("is-closing");
        chatPanel.hidden = false;
        setTimeout(() => chatInput?.focus(), 120);
        return;
      }

      if (chatPanel.hidden) return;

      chatPanel.classList.add("is-closing");
      closeTimer = setTimeout(() => {
        chatPanel.hidden = true;
        chatPanel.classList.remove("is-closing");
      }, 260);
    };

    const appendMessage = (role, text) => {
      const item = document.createElement("div");
      item.className = `chat-message ${role}`;

      const paragraph = document.createElement("p");
      paragraph.textContent = normalizeText(text, CONFIG.chat.maxReplyChars);

      item.appendChild(paragraph);
      chatMessages.appendChild(item);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const setBusy = value => {
      busy = Boolean(value);

      if (chatSubmit) {
        chatSubmit.disabled = busy || !normalizeText(chatInput?.value || "");
      }

      if (chatInput) {
        chatInput.disabled = busy;
      }

      chatPrompts.forEach(button => {
        button.disabled = busy;
      });
    };

    const resizeInput = () => {
      if (!chatInput) return;

      chatInput.style.height = "auto";
      chatInput.style.height = `${Math.min(chatInput.scrollHeight, 126)}px`;

      if (chatSubmit) {
        chatSubmit.disabled = busy || !normalizeText(chatInput.value);
      }
    };

    const sendMessage = async rawText => {
      const message = normalizeText(rawText, CONFIG.chat.maxUserMessageChars);

      if (!message || busy) return;

      setOpen(true);
      appendMessage("user", message);
      setBusy(true);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.chat.requestTimeoutMs);

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, language: safeLang(root.lang), history: [] }),
          cache: "no-store",
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload.reply) {
          throw new Error("Chat unavailable");
        }

        appendMessage("bot", payload.reply);
      } catch (_) {
        appendMessage("bot", fallback());
      } finally {
        setBusy(false);

        if (chatInput) {
          chatInput.value = "";
          resizeInput();
        }
      }
    };

    resizeInput();

    chatToggle.addEventListener("click", () => {
      setOpen(chatPanel.hidden || chatPanel.classList.contains("is-closing"));
    });

    chatClose?.addEventListener("click", () => setOpen(false));

    chatForm?.addEventListener("submit", event => {
      event.preventDefault();
      sendMessage(chatInput?.value || "");
    });

    chatInput?.addEventListener("input", resizeInput);

    chatInput?.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage(chatInput.value);
      }
    });

    chatPrompts.forEach(button => {
      button.addEventListener("click", () => {
        sendMessage(button.dataset[safeLang(root.lang)] || button.textContent);
      });
    });
  }

  function initBriefForm() {
    const briefForm = $("[data-whatsapp-brief-form]");
    if (!briefForm) return;

    briefForm.addEventListener("submit", event => {
      event.preventDefault();

      const lang = safeLang(root.lang);
      const data = new FormData(briefForm);

      const lines = lang === "ar" ? [
        "مرحباً خالد، شاهدت البورتفوليو الخاص بك وأرغب بتنفيذ مشروع.",
        "",
        `الاسم: ${textValue(data, "clientName", 80)}`,
        `نوع المشروع: ${optionText(briefForm, "projectType", "ar")}`,
        `لغة المشروع: ${optionText(briefForm, "projectLanguage", "ar")}`,
        `الصفحات/الأقسام: ${textValue(data, "pages", 160)}`,
        `الموعد المطلوب: ${textValue(data, "deadline", 90) || "غير محدد"}`,
        `الشعار/الهوية: ${optionText(briefForm, "brandAssets", "ar")}`,
        "",
        `ملاحظات: ${textValue(data, "notes", 900) || "لا يوجد"}`
      ] : [
        "Hi Khaled, I visited your portfolio and I would like to build a project.",
        "",
        `Name: ${textValue(data, "clientName", 80)}`,
        `Project type: ${optionText(briefForm, "projectType", "en")}`,
        `Project language: ${optionText(briefForm, "projectLanguage", "en")}`,
        `Pages/sections: ${textValue(data, "pages", 160)}`,
        `Deadline: ${textValue(data, "deadline", 90) || "Not specified"}`,
        `Logo/brand assets: ${optionText(briefForm, "brandAssets", "en")}`,
        "",
        `Notes: ${textValue(data, "notes", 900) || "None"}`
      ];

      openExternal(whatsappUrl(lines.join("\n")));
    });
  }

  function setContactStatus(form, type, message) {
    let status = form.querySelector("[data-contact-status]");

    if (!status) {
      status = document.createElement("p");
      status.className = "form-status";
      status.setAttribute("data-contact-status", "");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      form.appendChild(status);
    }

    status.className = `form-status ${type || ""}`.trim();
    status.textContent = message;
  }

  async function submitWeb3Forms({ name, email, message }) {
    const payload = new FormData();

    payload.append("access_key", CONFIG.web3FormsAccessKey);
    payload.append("subject", `Portfolio contact message from ${name}`);
    payload.append("from_name", "Khaled Portfolio");
    payload.append("name", name);
    payload.append("email", email);
    payload.append("message", message);

    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      body: payload
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success !== true) {
      throw new Error(result.message || "Web3Forms request failed");
    }

    return result;
  }

  function initContactForm() {
    const contactForm = $("[data-contact-form]");
    if (!contactForm) return;

    const submitButton = contactForm.querySelector('button[type="submit"]');

    const copy = {
      en: {
        sending: "Sending your message...",
        success: "Message sent successfully. I will reply as soon as possible.",
        validation: "Please complete all fields correctly.",
        failure: "The message could not be sent. Please try again later."
      },
      ar: {
        sending: "جاري إرسال رسالتك...",
        success: "تم إرسال الرسالة بنجاح. سأرد عليك في أقرب وقت ممكن.",
        validation: "يرجى تعبئة جميع الحقول بشكل صحيح.",
        failure: "تعذر إرسال الرسالة. حاول مرة أخرى لاحقًا."
      }
    };

    contactForm.addEventListener("submit", async event => {
      event.preventDefault();

      const activeLang = safeLang(root.lang || storage.get(CONFIG.storage.lang, "en"));
      const data = new FormData(contactForm);

      const name = textValue(data, "name", 120);
      const email = textValue(data, "email", 180);
      const message = textValue(data, "message", 4000);
      const website = textValue(data, "website", 120);

      if (name.length < 2 || !email.includes("@") || message.length < 10) {
        setContactStatus(contactForm, "error", copy[activeLang].validation);
        return;
      }

      if (website) {
        contactForm.reset();
        setContactStatus(contactForm, "success", copy[activeLang].success);
        return;
      }

      if (!CONFIG.web3FormsAccessKey || CONFIG.web3FormsAccessKey === "PUT_YOUR_WEB3FORMS_ACCESS_KEY_HERE") {
        console.error("Missing Web3Forms access key in public/js/main.js");
        setContactStatus(contactForm, "error", copy[activeLang].failure);
        return;
      }

      const originalButtonText = submitButton?.textContent || "";

      try {
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = copy[activeLang].sending;
        }

        setContactStatus(contactForm, "", copy[activeLang].sending);

        await submitWeb3Forms({ name, email, message });

        contactForm.reset();
        setContactStatus(contactForm, "success", copy[activeLang].success);
      } catch (error) {
        console.error(error);
        setContactStatus(contactForm, "error", copy[activeLang].failure);
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
        }
      }
    });
  }

  function bootstrap() {
    try {
      applyLang(storage.get(CONFIG.storage.lang, "en"));
      applyTheme(storage.get(CONFIG.storage.theme, "dark"));
      initLanguageMenu();
      initThemeToggle();
      initFloatingWhatsapp();
      initMobileMenu();
      initRevealAnimations();
      initProjectsPager();
      initChatWidget();
      initBriefForm();
      initContactForm();
    } catch (error) {
      console.error("Portfolio initialization failed:", error);
    } finally {
      root.classList.add("lang-ready");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();