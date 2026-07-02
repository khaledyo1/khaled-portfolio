(() => {
  "use strict";

  const CONFIG = Object.freeze({
    whatsappNumber: "970599059159",
    email: "khaled.yous3f19@gmail.com",
    storage: Object.freeze({
      lang: "portfolioLang",
      theme: "portfolioTheme",
      chat: "khaledPortfolioChatHistory"
    }),
    chat: Object.freeze({
      maxStoredMessages: 30,
      maxApiHistoryItems: 6,
      maxApiHistoryChars: 450,
      maxUserMessageChars: 500,
      maxReplyChars: 1800,
      requestTimeoutMs: 22_000
    }),
    projects: Object.freeze({
      pageSize: 4
    })
  });

  const root = document.documentElement;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const storage = {
    /**
     * قراءة قيمة من localStorage مع fallback آمن.
     * @param {string} key المفتاح.
     * @param {string} fallback القيمة الاحتياطية.
     * @returns {string} القيمة المخزنة أو fallback.
     */
    get(key, fallback) {
      try {
        return localStorage.getItem(key) || fallback;
      } catch (_) {
        return fallback;
      }
    },

    /**
     * حفظ قيمة في localStorage بدون تعطيل الصفحة عند منع التخزين.
     * @param {string} key المفتاح.
     * @param {string} value القيمة.
     * @returns {void}
     */
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (_) {}
    }
  };

  /** @param {unknown} value */
  const safeLang = value => (value === "ar" ? "ar" : "en");

  /** @param {unknown} value */
  const safeTheme = value => (value === "light" ? "light" : "dark");

  /**
   * تنظيف النصوص القادمة من النماذج قبل إدخالها في WhatsApp/mailto.
   * @param {unknown} value النص الخام.
   * @param {number} limit أقصى طول.
   * @returns {string} نص آمن ومقصوص.
   */
  function normalizeText(value, limit = 500) {
    return String(value ?? "")
      .replace(/\r\n?/g, "\n")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
      .replace(/[ \t]{3,}/g, "  ")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim()
      .slice(0, Math.max(0, limit));
  }

  /**
   * قراءة قيمة حقل نصي من FormData مع تنظيفها.
   * @param {FormData} formData بيانات النموذج.
   * @param {string} key اسم الحقل.
   * @param {number} limit أقصى طول.
   * @returns {string} القيمة النظيفة.
   */
  function textValue(formData, key, limit = 1200) {
    return normalizeText(formData.get(key), limit);
  }

  /**
   * جلب النص المعروض للـ selected option حسب اللغة الحالية.
   * @param {HTMLFormElement} form النموذج.
   * @param {string} name اسم select.
   * @param {"ar"|"en"} lang اللغة.
   * @returns {string} نص الخيار.
   */
  function optionText(form, name, lang) {
    const field = form.elements[name];
    const option = field?.selectedOptions?.[0];
    return option?.dataset?.[lang] || option?.textContent?.trim() || textValue(new FormData(form), name, 120);
  }

  /**
   * قراءة بيانات التواصل القابلة للتعديل من طبقة CMS مع fallback آمن.
   * @returns {{email: string, whatsappNumber: string}} إعدادات التواصل الحالية.
   */
  function runtimeContactConfig() {
    const cmsConfig = window.PortfolioCMS?.getRuntimeConfig?.() || {};
    return {
      email: cmsConfig.email || CONFIG.email,
      whatsappNumber: cmsConfig.whatsappNumber || CONFIG.whatsappNumber
    };
  }

  /**
   * إنشاء رابط WhatsApp مع قص الرسالة لتفادي روابط طويلة جداً.
   * @param {string} message الرسالة.
   * @returns {string} رابط wa.me.
   */
  function whatsappUrl(message) {
    const { whatsappNumber } = runtimeContactConfig();
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(normalizeText(message, 1800))}`;
  }

  /**
   * فتح رابط خارجي مع عزل window.opener لتقليل مخاطر tabnabbing.
   * @param {string} url الرابط.
   * @returns {void}
   */
  function openExternal(url) {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (opened) opened.opener = null;
  }

  /**
   * رسالة WhatsApp الافتراضية حسب اللغة.
   * @param {"ar"|"en"} lang اللغة.
   * @returns {string} نص الرسالة.
   */
  function directWhatsappMessage(lang) {
    return lang === "ar"
      ? "مرحباً خالد، شاهدت البورتفوليو الخاص بك وأرغب بمناقشة مشروع برمجي.\n\nنوع المشروع:\nاللغة المطلوبة:\nالموعد المتوقع:\nملاحظات:"
      : "Hi Khaled, I visited your portfolio and I would like to discuss a software project.\n\nProject type:\nRequired language:\nExpected deadline:\nNotes:";
  }

  /**
   * تحديث كل روابط WhatsApp المباشرة عند تغيير اللغة.
   * @param {"ar"|"en"} lang اللغة الحالية.
   * @returns {void}
   */
  function updateWhatsappLinks(lang) {
    const url = whatsappUrl(directWhatsappMessage(lang));
    $$('[data-whatsapp-direct]').forEach(link => {
      link.href = url;
    });
  }

  /**
   * تطبيق اللغة على النصوص، الاتجاه، placeholders، وقائمة اللغة.
   * @param {unknown} value قيمة اللغة الخام.
   * @returns {void}
   */
  function applyLang(value) {
    const lang = safeLang(value);
    const isArabic = lang === "ar";

    root.lang = lang;
    root.dir = isArabic ? "rtl" : "ltr";
    root.dataset.lang = lang;

    $$('[data-en][data-ar]').forEach(element => {
      element.textContent = element.dataset[lang] || "";
    });

    $$('[data-placeholder-en][data-placeholder-ar]').forEach(element => {
      element.placeholder = element.dataset[`placeholder${isArabic ? "Ar" : "En"}`] || "";
    });

    const label = $('.lang-current');
    const flag = $('.lang-flag');
    if (label) label.textContent = isArabic ? "AR" : "EN";
    if (flag) flag.textContent = isArabic ? "🇵🇸" : "🇬🇧";

    $$('[data-lang-option]').forEach(option => {
      const active = option.dataset.langOption === lang;
      option.classList.toggle("active", active);
      option.setAttribute("aria-current", active ? "true" : "false");
    });

    storage.set(CONFIG.storage.lang, lang);
    updateWhatsappLinks(lang);
    root.classList.add("lang-ready");
  }

  /**
   * تطبيق الثيم على الصفحة وتحديث زر التبديل.
   * @param {unknown} value قيمة الثيم الخام.
   * @returns {void}
   */
  function applyTheme(value) {
    const theme = safeTheme(value);
    const button = $('.theme-toggle');
    const icon = $('.theme-icon');
    const next = theme === "dark" ? "light" : "dark";

    root.dataset.theme = theme;
    storage.set(CONFIG.storage.theme, theme);

    if (icon) icon.textContent = theme === "dark" ? "☀" : "☾";
    if (button) {
      button.setAttribute("aria-label", `Switch to ${next} theme`);
      button.title = `${next[0].toUpperCase()}${next.slice(1)} theme`;
    }
  }

  /**
   * تهيئة قائمة اللغة المنسدلة.
   * @returns {void}
   */
  function initLanguageMenu() {
    const langMenu = $('.language-menu');
    const langToggle = $('.lang-toggle');
    const langDropdown = $('.lang-dropdown');

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

    $$('[data-lang-option]').forEach(option => {
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

  /**
   * تهيئة زر الثيم.
   * @returns {void}
   */
  function initThemeToggle() {
    $('.theme-toggle')?.addEventListener("click", () => {
      applyTheme(root.dataset.theme === "dark" ? "light" : "dark");
    });
  }

  /**
   * ضغط زر WhatsApp العائم بعد التمرير لتقليل تشويش الواجهة.
   * @returns {void}
   */
  function initFloatingWhatsapp() {
    const floatingWhatsapp = $('.floating-whatsapp');
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

  /**
   * تهيئة قائمة الموبايل.
   * @returns {void}
   */
  function initMobileMenu() {
    const menuButton = $('.menu-toggle');
    const mobilePanel = $('.mobile-panel');

    menuButton?.addEventListener("click", () => {
      const open = !mobilePanel?.classList.contains("open");
      mobilePanel?.classList.toggle("open", open);
      menuButton.setAttribute("aria-expanded", String(open));
    });
  }

  /**
   * تهيئة ظهور العناصر عند دخولها الشاشة.
   * @returns {void}
   */
  function initRevealAnimations() {
    const revealElements = $$('.reveal');
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

  /**
   * تهيئة فلترة وتقسيم مشاريع صفحة الأعمال، مع دعم المشاريع التي يتم توليدها من لوحة الإدارة.
   * @returns {void}
   */
  function initProjectsPager() {
    const filterButtons = $$('[data-filter]');
    const projectPager = $('[data-project-pager]');
    const projectPrev = $('[data-project-prev]');
    const projectNext = $('[data-project-next]');

    if (!filterButtons.length && !projectPager) return;
    if (document.body.dataset.projectsPagerBound === "true") return;
    document.body.dataset.projectsPagerBound = "true";

    let activeFilter = "all";
    let activePage = 0;

    const matchingProjects = () => {
      const cards = $$('.project-card[data-category]');
      return cards.filter(card => activeFilter === "all" || card.dataset.category === activeFilter);
    };

    const render = () => {
      const allCards = $$('.project-card[data-category]');
      if (!allCards.length) return;

      const visible = matchingProjects();
      const totalPages = Math.max(1, Math.ceil(visible.length / CONFIG.projects.pageSize));
      activePage = Math.min(activePage, totalPages - 1);
      const start = activePage * CONFIG.projects.pageSize;
      const end = start + CONFIG.projects.pageSize;
      const visibleSet = new Set(visible.slice(start, end));

      allCards.forEach(card => {
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

    document.addEventListener("portfolio:content-applied", () => {
      activePage = 0;
      render();
      initRevealAnimations();
    });

    render();
  }

  /**
   * تهيئة شات البورتفوليو وحفظ المحادثة محلياً.
   * @returns {void}
   */
  function initChatWidget() {
    const chatWidget = $('[data-chat-widget]');
    const chatPanel = $('[data-chat-panel]');
    const chatToggle = $('[data-chat-toggle]');
    const chatClose = $('[data-chat-close]');
    const chatForm = $('[data-chat-form]');
    const chatInput = $('[data-chat-input]');
    const chatMessages = $('[data-chat-messages]');
    const chatPromptsWrap = $('.chat-prompts');
    const chatPrompts = $$('[data-chat-prompt]');
    const chatSubmit = $('[data-chat-submit]');

    if (!chatWidget || !chatPanel || !chatToggle || !chatMessages) return;

    let chatHistory = loadChatHistory();
    let chatBusy = false;
    let chatAbort = null;
    let chatCloseTimer = null;

    /**
     * تحميل سجل المحادثة من الجهاز فقط.
     * @returns {{role:"user"|"assistant",content:string}[]} السجل النظيف.
     */
    function loadChatHistory() {
      try {
        const parsed = JSON.parse(localStorage.getItem(CONFIG.storage.chat) || "[]");
        if (!Array.isArray(parsed)) return [];
        return parsed
          .map(item => {
            const role = item?.role === "assistant" ? "assistant" : item?.role === "user" ? "user" : "";
            const content = normalizeText(item?.content, CONFIG.chat.maxReplyChars);
            return role && content ? { role, content } : null;
          })
          .filter(Boolean)
          .slice(-CONFIG.chat.maxStoredMessages);
      } catch (_) {
        return [];
      }
    }

    /** @returns {void} */
    function saveChatHistory() {
      storage.set(CONFIG.storage.chat, JSON.stringify(chatHistory.slice(-CONFIG.chat.maxStoredMessages)));
    }

    /** @returns {boolean} */
    function hasUserMessage() {
      return chatHistory.some(item => item.role === "user");
    }

    /**
     * تقليل سجل المحادثة قبل إرساله للـ API.
     * @returns {{role:"user"|"assistant",content:string}[]} سجل مختصر.
     */
    function apiHistory() {
      return chatHistory
        .slice(-CONFIG.chat.maxApiHistoryItems)
        .map(item => ({
          role: item.role,
          content: normalizeText(item.content, CONFIG.chat.maxApiHistoryChars)
        }))
        .filter(item => item.content);
    }

    /** @returns {void} */
    function syncPrompts() {
      const hide = hasUserMessage();
      chatPrompts.forEach(button => {
        button.hidden = hide;
      });
      chatPromptsWrap?.classList.toggle("has-used-prompts", hide);
    }

    /**
     * فتح/إغلاق لوحة الشات مع احترام الأنيميشن.
     * @param {boolean} open الحالة المطلوبة.
     * @returns {void}
     */
    function setOpen(open) {
      window.clearTimeout(chatCloseTimer);
      chatWidget.classList.toggle("is-open", open);
      chatToggle.setAttribute("aria-expanded", String(open));

      if (open) {
        chatPanel.classList.remove("is-closing");
        chatPanel.hidden = false;
        if (chatInput) window.setTimeout(() => chatInput.focus(), 120);
        return;
      }

      if (chatPanel.hidden) return;
      chatPanel.classList.add("is-closing");
      chatCloseTimer = window.setTimeout(() => {
        chatPanel.hidden = true;
        chatPanel.classList.remove("is-closing");
      }, 260);
    }

    /**
     * إزالة تنسيق Markdown الخفيف لأن صندوق الشات يعرض نصاً آمناً فقط.
     * @param {string} value النص.
     * @returns {string} نص بدون رموز Markdown.
     */
    function stripMarkdown(value) {
      return String(value || "")
        .replace(/^#{1,6}\s+/g, "")
        .replace(/\*\*/g, "")
        .replace(/`/g, "")
        .trim();
    }

    /**
     * إضافة فقرة نصية باستخدام textContent لمنع XSS.
     * @param {HTMLElement} parent الحاوية.
     * @param {string} text النص.
     * @returns {void}
     */
    function appendParagraph(parent, text) {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      parent.appendChild(paragraph);
    }

    /**
     * عرض رد الشات كسطور وفقرات وقوائم بسيطة بدون innerHTML.
     * @param {HTMLElement} parent الحاوية.
     * @param {string} text النص.
     * @param {"user"|"bot"} role نوع الرسالة.
     * @returns {void}
     */
    function renderContent(parent, text, role) {
      const clean = normalizeText(text, CONFIG.chat.maxReplyChars);
      if (role === "user") {
        appendParagraph(parent, clean || "...");
        return;
      }

      const lines = clean.split("\n").map(line => stripMarkdown(line)).filter(Boolean);
      if (!lines.length) {
        appendParagraph(parent, "...");
        return;
      }

      let list = null;
      lines.forEach(line => {
        const bullet = line.match(/^(?:[-•*]|\d+[.)])\s+(.+)$/);
        if (bullet) {
          if (!list) {
            list = document.createElement("ul");
            parent.appendChild(list);
          }
          const item = document.createElement("li");
          item.textContent = stripMarkdown(bullet[1]);
          list.appendChild(item);
          return;
        }

        list = null;
        appendParagraph(parent, line);
      });
    }

    /**
     * إضافة رسالة جديدة إلى صندوق الشات.
     * @param {"user"|"bot"} role نوع الرسالة.
     * @param {string} text النص.
     * @param {boolean=} loading هل الرسالة مؤشر كتابة.
     * @returns {HTMLDivElement|null} عنصر الرسالة.
     */
    function appendMessage(role, text, loading = false) {
      const item = document.createElement("div");
      item.className = `chat-message ${role}${loading ? " loading" : ""}`;

      if (loading) {
        const dots = document.createElement("span");
        dots.className = "chat-typing-dots";
        dots.setAttribute("aria-hidden", "true");
        for (let index = 0; index < 3; index += 1) dots.appendChild(document.createElement("span"));
        item.appendChild(dots);
      } else {
        renderContent(item, text, role);
      }

      chatMessages.appendChild(item);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return item;
    }

    /** @returns {void} */
    function renderSavedChat() {
      if (!chatHistory.length) return;
      chatMessages.textContent = "";
      chatHistory.forEach(item => appendMessage(item.role === "assistant" ? "bot" : "user", item.content));
      syncPrompts();
    }

    /**
     * تعطيل/تفعيل إدخال الشات أثناء الطلب.
     * @param {boolean} value الحالة.
     * @returns {void}
     */
    function setBusy(value) {
      chatBusy = Boolean(value);
      if (chatSubmit) chatSubmit.disabled = chatBusy || !normalizeText(chatInput?.value || "");
      if (chatInput) chatInput.disabled = chatBusy;
      chatPrompts.forEach(button => {
        button.disabled = chatBusy;
      });
    }

    /** @returns {void} */
    function resizeInput() {
      if (!chatInput) return;
      chatInput.style.height = "auto";
      chatInput.style.height = `${Math.min(chatInput.scrollHeight, 126)}px`;
      if (chatSubmit) chatSubmit.disabled = chatBusy || !normalizeText(chatInput.value);
    }

    /** @returns {string} */
    function fallbackMessage() {
      return safeLang(root.lang) === "ar"
        ? "الاتصال بالمساعد تعذّر مؤقتاً. جرّب إرسال الرسالة مرة ثانية، أو اضغط تواصل معنا."
        : "The assistant connection timed out. Try sending again, or use the DM button.";
    }

    /**
     * إرسال رسالة للـ API مع timeout وتنظيف كامل للمدخلات والمخرجات.
     * @param {string} rawText نص المستخدم.
     * @returns {Promise<void>} لا يعيد قيمة؛ يحدث الواجهة مباشرة.
     */
    async function sendMessage(rawText) {
      const message = normalizeText(rawText, CONFIG.chat.maxUserMessageChars);
      if (!message || chatBusy) return;

      setOpen(true);
      const requestHistory = apiHistory();
      appendMessage("user", message);
      chatHistory.push({ role: "user", content: message });
      chatHistory = chatHistory.slice(-CONFIG.chat.maxStoredMessages);
      saveChatHistory();
      syncPrompts();
      setBusy(true);

      const loading = appendMessage("bot", "", true);
      if (chatAbort) chatAbort.abort();
      chatAbort = new AbortController();
      const timeoutId = window.setTimeout(() => chatAbort.abort(), CONFIG.chat.requestTimeoutMs);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, language: safeLang(root.lang), history: requestHistory }),
          cache: "no-store",
          credentials: "same-origin",
          signal: chatAbort.signal
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.reply) throw new Error(payload.error || "Chat request failed");

        loading?.remove();
        const reply = normalizeText(payload.reply, CONFIG.chat.maxReplyChars);
        appendMessage("bot", reply);
        chatHistory.push({ role: "assistant", content: reply });
      } catch (_) {
        loading?.remove();
        const fallback = fallbackMessage();
        appendMessage("bot", fallback);
        chatHistory.push({ role: "assistant", content: fallback });
      } finally {
        chatHistory = chatHistory.slice(-CONFIG.chat.maxStoredMessages);
        saveChatHistory();
        window.clearTimeout(timeoutId);
        chatAbort = null;
        setBusy(false);
        if (chatInput) {
          chatInput.value = "";
          resizeInput();
        }
      }
    }

    renderSavedChat();
    syncPrompts();
    resizeInput();

    chatToggle.addEventListener("click", () => setOpen(chatPanel.hidden || chatPanel.classList.contains("is-closing")));
    chatClose?.addEventListener("click", () => setOpen(false));

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !chatPanel.hidden) setOpen(false);
    });

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
      button.addEventListener("click", () => sendMessage(button.dataset[safeLang(root.lang)] || button.textContent));
    });
  }

  /**
   * تهيئة نموذج ملخص المشروع وإرساله إلى WhatsApp.
   * @returns {void}
   */
  function initBriefForm() {
    const briefForm = $('[data-whatsapp-brief-form]');
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

  /**
   * تهيئة نموذج التواصل عبر mailto مع ترميز آمن للحقول.
   * @returns {void}
   */
  function initContactForm() {
    const contactForm = $('[data-contact-form]');
    if (!contactForm) return;

    contactForm.addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(contactForm);
      const body = [
        `Name: ${textValue(data, "name", 120)}`,
        `Email: ${textValue(data, "email", 180)}`,
        "",
        textValue(data, "message", 4000)
      ].join("\n");
      const subject = encodeURIComponent("Portfolio contact message");
      const { email } = runtimeContactConfig();
      window.location.assign(`mailto:${email}?subject=${subject}&body=${encodeURIComponent(body)}`);
    });
  }

  /**
   * نقطة تشغيل الواجهة.
   * @returns {void}
   */
  function bootstrap() {
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
