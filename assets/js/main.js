/* ============================================================
   站点交互
   - 深浅色主题（记忆选择）
   - 导航滚动状态 / 移动端菜单
   - 入场动画
   - 文章目录、代码复制、阅读进度
   - 标签筛选、全站搜索
   ============================================================ */
(function () {
  "use strict";

  var root = document.body.getAttribute("data-root") || "";
  var $ = function (sel, ctx) {
    return (ctx || document).querySelector(sel);
  };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  /* ---------- 主题 ---------- */
  var themeMeta = $('meta[name="theme-color"]');
  var themeToggle = $("#theme-toggle");

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("theme", theme);
    } catch (e) {}
    if (themeMeta) {
      themeMeta.setAttribute("content", theme === "light" ? "#f4f6f9" : "#07080b");
    }
    if (themeToggle) {
      themeToggle.setAttribute(
        "aria-label",
        theme === "light" ? "切换到深色模式" : "切换到浅色模式"
      );
    }
    window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var next =
        document.documentElement.getAttribute("data-theme") === "light"
          ? "dark"
          : "light";
      applyTheme(next);
    });
  }

  // 首次访问默认深色主题（之后尊重用户的切换）
  try {
    if (!localStorage.getItem("theme")) {
      applyTheme("dark");
    }
  } catch (e) {}

  /* ---------- 导航 ---------- */
  var header = $("#site-header");
  var onScroll = function () {
    if (header) {
      header.classList.toggle("is-scrolled", window.scrollY > 6);
    }
    var top = $("#to-top");
    if (top) {
      top.classList.toggle("is-visible", window.scrollY > 600);
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var menuBtn = $("#menu-btn");
  var mobileMenu = $("#mobile-menu");
  function closeMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.remove("is-open");
    document.body.classList.remove("menu-open");
    if (menuBtn) {
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.setAttribute("aria-label", "打开菜单");
    }
  }
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener("click", function () {
      var open = mobileMenu.classList.toggle("is-open");
      document.body.classList.toggle("menu-open", open);
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      menuBtn.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
    var backdrop = $("#menu-backdrop");
    if (backdrop) backdrop.addEventListener("click", closeMenu);
    window.addEventListener("resize", function () {
      if (window.innerWidth > 860) closeMenu();
    });
  }

  var toTop = $("#to-top");
  if (toTop) {
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---------- 入场动画 ---------- */
  var reveals = $$(".reveal");
  if (reveals.length) {
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-in");
              io.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "0px 0px -2% 0px", threshold: 0 }
      );
      reveals.forEach(function (el) {
        io.observe(el);
      });
    } else {
      reveals.forEach(function (el) {
        el.classList.add("is-in");
      });
    }
  }

  /* ---------- 年份 ---------- */
  $$("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---------- 文章：目录 ---------- */
  var article = $("#article");
  var toc = $("#toc");
  if (article && toc) {
    var heads = $$("h2, h3", article).filter(function (h) {
      return h.id;
    });
    if (heads.length >= 2) {
      var list = document.createElement("ol");
      heads.forEach(function (h, i) {
        var li = document.createElement("li");
        li.className = h.tagName === "H3" ? "toc-h3" : "toc-h2";
        var a = document.createElement("a");
        a.href = "#" + h.id;
        a.textContent = h.textContent;
        a.addEventListener("click", function (e) {
          e.preventDefault();
          var target = document.getElementById(h.id);
          if (!target) return;
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          history.replaceState(null, "", "#" + h.id);
        });
        li.appendChild(a);
        list.appendChild(li);
      });
      toc.appendChild(list);
      toc.hidden = false;
    }
  }

  /* ---------- 文章：阅读进度 ---------- */
  var progress = $("#progress");
  if (progress && article) {
    var updateProgress = function () {
      var rect = article.getBoundingClientRect();
      var total = rect.height - window.innerHeight * 0.55;
      var passed = -rect.top + window.innerHeight * 0.35;
      var ratio = total > 0 ? passed / total : 0;
      ratio = Math.max(0, Math.min(1, ratio));
      progress.style.width = (ratio * 100).toFixed(2) + "%";
    };
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    updateProgress();
  }

  /* ---------- 代码复制 ---------- */
  $$(".code-block").forEach(function (block) {
    var btn = $(".copy", block);
    var code = $("code", block);
    if (!btn || !code) return;
    btn.addEventListener("click", function () {
      var text = code.innerText;
      var done = function () {
        btn.classList.add("is-done");
        btn.textContent = "已复制";
        setTimeout(function () {
          btn.classList.remove("is-done");
          btn.textContent = "复制";
        }, 1600);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
      function fallback() {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
          done();
        } catch (e) {}
        document.body.removeChild(ta);
      }
    });
  });

  /* ---------- 标签筛选 ---------- */
  var filter = $("#tag-filter");
  var postList = $("#post-list");
  if (filter && postList) {
    var items = $$(".post-item", postList);
    var empty = $("#empty");
    filter.addEventListener("click", function (e) {
      var btn = e.target.closest(".chip");
      if (!btn) return;
      var tag = btn.getAttribute("data-tag");
      $$(".chip", filter).forEach(function (c) {
        c.classList.toggle("is-active", c === btn);
      });
      var shown = 0;
      items.forEach(function (item) {
        var tags = (item.getAttribute("data-tags") || "").split(",");
        var ok = tag === "all" || tags.indexOf(tag) !== -1;
        item.hidden = !ok;
        if (ok) shown++;
      });
      if (empty) empty.hidden = shown !== 0;
    });
  }

  /* ---------- 搜索 ---------- */
  var input = $("#search-input");
  var results = $("#search-results");
  var status = $("#search-status");
  if (input && results) {
    var posts = window.POSTS || [];
    var escapeHtml = function (s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    };
    var escapeReg = function (s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    };
    var highlight = function (text, terms) {
      var out = escapeHtml(text);
      terms.forEach(function (t) {
        if (!t) return;
        out = out.replace(
          new RegExp("(" + escapeReg(escapeHtml(t)) + ")", "gi"),
          "<mark>$1</mark>"
        );
      });
      return out;
    };
    var render = function (query) {
      var q = query.trim();
      var terms = q ? q.split(/\s+/).filter(Boolean) : [];
      var list = posts;

      if (terms.length) {
        list = posts
          .map(function (p) {
            var hay = [
              p.title,
              p.excerpt,
              (p.tags || []).join(" "),
              p.text || "",
            ]
              .join(" ")
              .toLowerCase();
            var score = 0;
            for (var i = 0; i < terms.length; i++) {
              var t = terms[i].toLowerCase();
              if (hay.indexOf(t) === -1) return null;
              if (p.title.toLowerCase().indexOf(t) !== -1) score += 8;
              if ((p.tags || []).join(" ").toLowerCase().indexOf(t) !== -1)
                score += 4;
              if ((p.excerpt || "").toLowerCase().indexOf(t) !== -1) score += 2;
              score += 1;
            }
            p._score = score;
            return p;
          })
          .filter(Boolean)
          .sort(function (a, b) {
            return b._score - a._score;
          });
      }

      results.innerHTML = list
        .map(function (p) {
          return (
            '<a class="post-item" href="' +
            p.url +
            '">' +
            '<time>' +
            highlight(p.dateLabel, terms) +
            "</time>" +
            "<h3>" +
            highlight(p.title, terms) +
            "</h3>" +
            "<p>" +
            (highlight(p.excerpt, terms) || "&nbsp;") +
            "</p>" +
            '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
            "</a>"
          );
        })
        .join("");

      if (status) {
        if (!terms.length) {
          status.textContent = "共 " + posts.length + " 篇文章，输入关键词试试";
        } else if (!list.length) {
          status.textContent = '没有找到与「' + q + '」相关的内容';
        } else {
          status.textContent =
            '找到 ' + list.length + " 篇与「" + q + "」相关的文章";
        }
      }
    };

    var timer;
    var sync = function (value) {
      clearTimeout(timer);
      timer = setTimeout(function () {
        render(value);
        try {
          var url = new URL(window.location.href);
          if (value.trim()) url.searchParams.set("q", value.trim());
          else url.searchParams.delete("q");
          history.replaceState(null, "", url);
        } catch (e) {}
      }, 90);
    };

    input.addEventListener("input", function () {
      sync(input.value);
    });

    var params = new URLSearchParams(window.location.search);
    if (params.get("q")) {
      input.value = params.get("q");
    }
    render(input.value);

    // 按 / 聚焦搜索
    document.addEventListener("keydown", function (e) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      var el = document.activeElement;
      var typing =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      input.focus();
      input.select();
    });
  } else {
    // 其它页面按 / 跳转到搜索页
    document.addEventListener("keydown", function (e) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      var el = document.activeElement;
      var typing =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      window.location.href = root + "search/";
    });
  }
})();
