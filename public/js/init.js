(() => {
  "use strict";

  /**
   * تهيئة مبكرة جداً قبل تحميل CSS لتقليل وميض اللغة/الثيم.
   * المدخلات: قيم localStorage إن وُجدت.
   * المخرجات: ضبط lang/dir/data-theme على <html>.
   */
  const root = document.documentElement;

  try {
    const lang = localStorage.getItem("portfolioLang") === "ar" ? "ar" : "en";
    const theme = localStorage.getItem("portfolioTheme") === "light" ? "light" : "dark";

    root.classList.add("js");
    root.dataset.lang = lang;
    root.dataset.theme = theme;
    root.lang = lang;
    root.dir = lang === "ar" ? "rtl" : "ltr";
  } catch (_) {
    root.classList.add("js");
    root.dataset.lang = "en";
    root.dataset.theme = "dark";
    root.lang = "en";
    root.dir = "ltr";
  }
})();
