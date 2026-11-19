#!/usr/bin/env node
/**
 * 南屿 · 静态博客生成器
 * 用法：node build.js
 * 读取 posts/*.md，输出 index.html、blog/、archives/、links/、about/、
 * search/、404.html、rss.xml、sitemap.xml、assets/js/posts-index.js
 * 无第三方依赖。
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const POSTS_DIR = path.join(ROOT, "posts");

const SITE = {
  name: "南屿",
  author: "阿南",
  desc: "记录思考，分享观点。",
  tagline: "个人博客",
  url: process.env.SITE_URL || "https://xia0tou.github.io", // 上线后改成你的域名，RSS / 站点地图会用到
  github: process.env.GITHUB_URL || "https://github.com/xia0tou",
  email: "hi@example.com",
  since: 2026,
};

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const pad = (n) => (n < 10 ? "0" + n : String(n));

function dateLabel(d) {
  return d.getFullYear() + "." + pad(d.getMonth() + 1) + "." + pad(d.getDate());
}

function cnDate(d) {
  return d.getFullYear() + " 年 " + (d.getMonth() + 1) + " 月 " + d.getDate() + " 日";
}

function joinLines(a, b) {
  if (/[\u4e00-\u9fff]$/.test(a) || /^[\u4e00-\u9fff]/.test(b)) return a + b;
  return a + " " + b;
}

/* ------------------------------------------------------------------ */
/* Markdown（够用的子集）                                              */
/* ------------------------------------------------------------------ */

function inline(src) {
  const codes = [];
  let s = esc(src);

  s = s.replace(/`([^`]+)`/g, (m, code) => {
    codes.push(code);
    return "\u0000C" + (codes.length - 1) + "\u0000";
  });

  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, src2) => {
    const url = src2.replace(/^\.\//, "");
    return '<img src="' + url + '" alt="' + alt + '" loading="lazy">';
  });

  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, href) => {
    const external = /^https?:\/\//.test(href);
    return (
      '<a href="' +
      href +
      '"' +
      (external ? ' target="_blank" rel="noopener noreferrer"' : "") +
      ">" +
      text +
      "</a>"
    );
  });

  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");

  s = s.replace(/\u0000C(\d+)\u0000/g, (m, i) => "<code>" + codes[Number(i)] + "</code>");
  return s;
}

function mdToHtml(src) {
  const lines = String(src).replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;
  let hIndex = 0;
  let para = [];

  const flush = () => {
    if (!para.length) return;
    out.push("<p>" + inline(para.reduce(joinLines, "")) + "</p>");
    para = [];
  };

  const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line) || /\|/.test(line);

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      flush();
      i++;
      continue;
    }

    // 代码块
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      flush();
      const lang = fence[1] || "text";
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // 跳过结束围栏
      out.push(
        '<div class="code-block" data-lang="' +
          esc(lang) +
          '">' +
          '<div class="code-head"><span>' +
          esc(lang) +
          '</span><button class="copy" type="button" aria-label="复制代码">复制</button></div>' +
          "<pre><code>" +
          esc(buf.join("\n")) +
          "</code></pre></div>"
      );
      continue;
    }

    // 标题
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flush();
      const level = h[1].length;
      if (level === 1) {
        out.push("<h2>" + inline(h[2]) + "</h2>");
      } else {
        hIndex++;
        const tag = "h" + level;
        out.push(
          '<' + tag + ' id="h-' + hIndex + '">' + inline(h[2]) + "</" + tag + ">"
        );
      }
      i++;
      continue;
    }

    // 分割线
    if (/^\s*([-*_])\s*\1\s*\1[\s\S]*$/.test(line) && line.trim().length >= 3) {
      flush();
      out.push("<hr>");
      i++;
      continue;
    }

    // 引用
    if (/^\s*>\s?/.test(line)) {
      flush();
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push("<blockquote><p>" + inline(buf.reduce(joinLines, "")) + "</p></blockquote>");
      continue;
    }

    // 表格
    if (isTableRow(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      flush();
      const rows = [];
      const head = line.replace(/^\s*\||\|\s*$/g, "").split("|");
      i += 2;
      while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim()) {
        rows.push(lines[i].replace(/^\s*\||\|\s*$/g, "").split("|"));
        i++;
      }
      let html = "<table><thead><tr>";
      head.forEach((c) => (html += "<th>" + inline(c.trim()) + "</th>"));
      html += "</tr></thead><tbody>";
      rows.forEach((r) => {
        html += "<tr>";
        r.forEach((c) => (html += "<td>" + inline(c.trim()) + "</td>"));
        html += "</tr>";
      });
      html += "</tbody></table>";
      out.push(html);
      continue;
    }

    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      flush();
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      out.push(
        "<ul>" +
          items.map((t) => "<li>" + inline(t) + "</li>").join("") +
          "</ul>"
      );
      continue;
    }

    // 有序列表
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flush();
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i++;
      }
      out.push(
        "<ol>" +
          items.map((t) => "<li>" + inline(t) + "</li>").join("") +
          "</ol>"
      );
      continue;
    }

    para.push(line.trim());
    i++;
  }
  flush();
  return out.join("\n");
}

/* ------------------------------------------------------------------ */
/* 文章读取                                                            */
/* ------------------------------------------------------------------ */

function parseFrontMatter(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  m[1].split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (!key) return;
    if (/^\[.*\]$/.test(val)) {
      val = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      val = val.replace(/^["']|["']$/g, "");
    }
    meta[key] = val;
  });
  return { meta, body: m[2] };
}

function plainText(md) {
  return String(md)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^[>#*\-\d.\s]+/gm, " ")
    .replace(/[*_`~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loadPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
      const { meta, body } = parseFrontMatter(raw);
      const slug = file.replace(/\.md$/, "");
      const date = new Date((meta.date || "2026-01-01") + "T20:00:00+08:00");
      const text = plainText(body);
      const chars = (text.match(/[\u4e00-\u9fff]/g) || []).length +
        (text.match(/[a-zA-Z]+/g) || []).length;
      return {
        slug,
        title: meta.title || slug,
        date,
        dateISO: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        excerpt: meta.excerpt || text.slice(0, 80),
        body,
        html: mdToHtml(body),
        text,
        minutes: Math.max(1, Math.round(chars / 380)),
        chars,
      };
    })
    .sort((a, b) => b.date - a.date);
}

/* ------------------------------------------------------------------ */
/* 布局                                                                */
/* ------------------------------------------------------------------ */

const NAV = [
  { key: "home", label: "首页", path: "" },
  { key: "blog", label: "文章", path: "blog/" },
  { key: "archives", label: "归档", path: "archives/" },
  { key: "links", label: "友链", path: "links/" },
  { key: "about", label: "关于", path: "about/" },
];

function header(root, navKey) {
  const links = NAV.map(
    (n) =>
      `<a href="${root}${n.path}"${n.key === navKey ? ' aria-current="page"' : ""}>${n.label}</a>`
  ).join("");
  const mob = NAV.map(
    (n, i) =>
      `<a href="${root}${n.path}"${n.key === navKey ? ' aria-current="page"' : ""}>${
        n.label
      }<span>0${i + 1}</span></a>`
  ).join("");

  return `<header class="site-header" id="site-header">
  <div class="nav-inner">
    <a class="brand" href="${root}" aria-label="${SITE.name} 首页">
      <span class="brand-mark" aria-hidden="true"></span>
      <span>${SITE.name}</span>
    </a>
    <nav class="nav-links" aria-label="主导航">${links}</nav>
    <div class="nav-actions">
      <a class="icon-btn" href="${root}search/" aria-label="搜索（按 / 键）" title="搜索 /">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
      </a>
      <button class="icon-btn" id="theme-toggle" type="button" aria-label="切换深浅色">
        <svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.3M12 19.7V22M2 12h2.3M19.7 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6"/></svg>
        <svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4A8.6 8.6 0 1 1 10.6 3.4a7 7 0 0 0 10 10Z"/></svg>
      </button>
      <button class="icon-btn menu-btn" id="menu-btn" type="button" aria-label="打开菜单" aria-expanded="false" aria-controls="mobile-menu">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>
    </div>
  </div>
</header>
<div class="mobile-menu" id="mobile-menu">
  <nav aria-label="移动端导航">${mob}
    <a href="${root}search/">搜索<span>06</span></a>
  </nav>
</div>
<div class="menu-backdrop" id="menu-backdrop"></div>`;
}

function footer(root) {
  return `<footer class="site-footer">
  <div class="wrap footer-inner">
    <p>© <span data-year>${SITE.since}</span> ${SITE.name} · ${SITE.desc}</p>
    <div class="footer-links">
      <a href="${root}rss.xml">RSS</a>
      <a href="${SITE.github}" target="_blank" rel="noopener noreferrer">GitHub</a>
      <a href="${root}about/">关于</a>
    </div>
  </div>
</footer>
<button class="to-top" id="to-top" type="button" aria-label="回到顶部">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>
</button>`;
}

function layout(opts) {
  const {
    title,
    description,
    root = "",
    navKey = "",
    content,
    bodyClass = "",
    head = "",
    article = false,
    ogType = "website",
  } = opts;

  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="dark">
<head>
<meta charset="utf-8">
<script>(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t="dark";document.documentElement.setAttribute("data-theme",t);}catch(e){}})();</script>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="author" content="${esc(SITE.author)}">
<meta name="theme-color" content="#07080b">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE.url}/assets/img/og.png">
<meta property="og:locale" content="zh_CN">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${root}assets/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${root}assets/css/style.css">
<link rel="alternate" type="application/rss+xml" title="${esc(SITE.name)}" href="${root}rss.xml">
${head}
</head>
<body data-root="${root}"${bodyClass ? ' class="' + bodyClass + '"' : ""}>
<div id="bg"><canvas id="bg-canvas"></canvas></div>
${article ? '<div class="progress" id="progress"></div>' : ""}
${header(root, navKey)}
${content}
${footer(root)}
<script src="${root}assets/js/shader.js" defer></script>
<script src="${root}assets/js/main.js" defer></script>
</body>
</html>
`;
}

/* ------------------------------------------------------------------ */
/* 片段                                                                */
/* ------------------------------------------------------------------ */

const ARROW = '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

function postItem(p, root, opts) {
  const o = opts || {};
  const tags = o.tags
    ? `<div class="tags">${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>`
    : "";
  return `<a class="post-item" href="${root}blog/${p.slug}/" data-tags="${esc(p.tags.join(","))}">
  <time datetime="${p.dateISO}">${dateLabel(p.date)}</time>
  <h3>${esc(p.title)}</h3>
  <p>${esc(p.excerpt)}</p>
  ${tags}
  ${ARROW}
</a>`;
}

/* ------------------------------------------------------------------ */
/* 页面                                                                */
/* ------------------------------------------------------------------ */

function homePage(posts) {
  const content = `<main class="wrap main">
  <section class="hero reveal">
    <div class="avatar-ring"><img src="assets/img/avatar.svg" alt="${esc(SITE.author)}的头像" width="96" height="96"></div>
    <h1>${esc(SITE.author)}</h1>
    <p class="hero-tagline">${esc(SITE.tagline)} · ${esc(SITE.desc)}</p>
    <div class="hero-actions">
      <a class="btn" href="${SITE.github}" target="_blank" rel="noopener noreferrer">
        <svg class="solid" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
        GitHub
      </a>
      <a class="btn" href="rss.xml">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.2"/></svg>
        RSS 订阅
      </a>
    </div>
  </section>

  <section class="card about-card reveal">
    <h2 class="eyebrow">关于</h2>
    <p><strong>你好，我是${esc(SITE.author)}。</strong>白天写代码，晚上写字。这里放一些关于生活、产品和自我观察的碎片，偶尔也写点技术。不追热点，只写自己真正想过的事。</p>
    <a class="text-link" href="about/">更多关于我 <span aria-hidden="true">→</span></a>
  </section>

  <section class="card now reveal">
    <h2 class="eyebrow">现在</h2>
    <ul class="now-list">
      <li><span class="now-key">在写</span><span>一组关于城市与散步的随笔</span></li>
      <li><span class="now-key">在读</span><span>《小于一》· 布罗茨基</span></li>
      <li><span class="now-key">在听</span><span>坂本龙一 · async</span></li>
    </ul>
  </section>

  <section class="reveal">
    <div class="section-head">
      <h2>最近文章</h2>
      <a class="more" href="blog/">全部文章 <span aria-hidden="true">→</span></a>
    </div>
    <div class="post-list">${posts
      .slice(0, 5)
      .map((p) => postItem(p, ""))
      .join("\n")}</div>
  </section>

  <section class="reveal" style="margin-top:54px">
    <p style="color:var(--faint);font-size:12.5px;line-height:1.9">
      本站使用纯静态页面，没有广告、没有追踪脚本。<br>
      如果愿意，可以用 <a class="text-link" style="margin:0" href="rss.xml">RSS</a> 订阅这里的更新。
    </p>
  </section>
</main>`;

  return layout({
    title: `${SITE.name} · ${SITE.desc}`,
    description: `${SITE.name}的个人博客，${SITE.desc}`,
    content,
    navKey: "home",
  });
}

function blogPage(posts) {
  const tagCount = new Map();
  posts.forEach((p) => p.tags.forEach((t) => tagCount.set(t, (tagCount.get(t) || 0) + 1)));
  const tags = Array.from(tagCount.keys()).sort((a, b) => tagCount.get(b) - tagCount.get(a));
  const chips = ['<button class="chip is-active" type="button" data-tag="all">全部</button>']
    .concat(
      tags.map(
        (t) =>
          `<button class="chip" type="button" data-tag="${esc(t)}">${esc(t)} <span style="opacity:.55">${tagCount.get(t)}</span></button>`
      )
    )
    .join("");

  const content = `<main class="wrap main">
  <header class="page-head reveal">
    <p class="eyebrow">Blog</p>
    <h1>文章</h1>
    <p class="page-desc">共 ${posts.length} 篇 · 记录生活、工具与一些还没想明白的事。</p>
  </header>
  <div class="tag-filter reveal" id="tag-filter" role="group" aria-label="按标签筛选">${chips}</div>
  <div class="post-list" id="post-list">
    ${posts.map((p) => postItem(p, "../", { tags: true })).join("\n")}
  </div>
  <p class="empty" id="empty" hidden>这个标签下还没有文章。</p>
</main>`;

  return layout({
    title: `文章 · ${SITE.name}`,
    description: `全部文章，共 ${posts.length} 篇。`,
    root: "../",
    navKey: "blog",
    content,
  });
}

function archivesPage(posts) {
  const byYear = new Map();
  posts.forEach((p) => {
    const y = p.date.getFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(p);
  });
  const years = Array.from(byYear.keys()).sort((a, b) => b - a);
  const allTags = new Set();
  posts.forEach((p) => p.tags.forEach((t) => allTags.add(t)));
  const totalChars = posts.reduce((n, p) => n + p.chars, 0);

  const groups = years
    .map(
      (y) => `<section class="archive-group reveal">
    <h2>${y}<span class="count">${byYear.get(y).length} 篇</span></h2>
    <ul class="archive-list">
      ${byYear
        .get(y)
        .map(
          (p) =>
            `<li><time datetime="${p.dateISO}">${pad(p.date.getMonth() + 1)}.${pad(
              p.date.getDate()
            )}</time><a href="../blog/${p.slug}/">${esc(p.title)}</a></li>`
        )
        .join("\n      ")}
    </ul>
  </section>`
    )
    .join("\n");

  const content = `<main class="wrap main">
  <header class="page-head reveal">
    <p class="eyebrow">Archive</p>
    <h1>归档</h1>
    <p class="page-desc">按时间排列的全部记录。</p>
  </header>
  ${groups}
  <div class="archive-total reveal">
    <div><b>${posts.length}</b><span>篇文章</span></div>
    <div><b>${allTags.size}</b><span>个标签</span></div>
    <div><b>${(totalChars / 1000).toFixed(1)}k</b><span>字</span></div>
  </div>
</main>`;

  return layout({
    title: `归档 · ${SITE.name}`,
    description: `全部文章归档，共 ${posts.length} 篇。`,
    root: "../",
    navKey: "archives",
    content,
  });
}

const FRIENDS = [
  { name: "阮一峰的网络日志", desc: "科技爱好者周刊，每周五更新", url: "https://www.ruanyifeng.com/blog/", c1: "#3b5bdb", c2: "#1b2a6b", letter: "阮" },
  { name: "Overreacted", desc: "Dan Abramov 关于 React 与写作", url: "https://overreacted.io/", c1: "#c2410c", c2: "#7c2d12", letter: "D" },
  { name: "酷 壳", desc: "技术、职业与思考的长期主义者", url: "https://coolshell.cn/", c1: "#0f766e", c2: "#134e4a", letter: "酷" },
  { name: "少数派", desc: "高效工作，品质生活", url: "https://sspai.com/", c1: "#b91c1c", c2: "#7f1d1d", letter: "少" },
  { name: "Astro", desc: "本站的构建思路来源", url: "https://astro.build/", c1: "#7c3aed", c2: "#3b1178", letter: "A" },
  { name: "Pure 主题", desc: "参考站使用的 Astro 主题", url: "https://github.com/cworld1/astro-theme-pure", c1: "#1d4ed8", c2: "#172554", letter: "P" },
];

function linksPage() {
  const cards = FRIENDS.map(
    (f) => `<a class="link-card" href="${f.url}" target="_blank" rel="noopener noreferrer">
    <span class="link-avatar" style="--c1:${f.c1};--c2:${f.c2}">${f.letter}</span>
    <span class="link-body"><strong>${esc(f.name)}</strong><small>${esc(f.desc)}</small></span>
  </a>`
  ).join("\n  ");

  const content = `<main class="wrap main">
  <header class="page-head reveal">
    <p class="eyebrow">Links</p>
    <h1>友链</h1>
    <p class="page-desc">一些我常读的站点，也是这个小站的灵感来源。</p>
  </header>
  <div class="link-grid reveal">
  ${cards}
  <a class="link-card ghost" href="mailto:${SITE.email}">
    想交换友链？写信给我<br><span style="font-family:var(--font-mono);font-size:11px">${SITE.email}</span>
  </a>
  </div>
  <section class="reveal" style="margin-top:46px">
    <h2 class="eyebrow">说明</h2>
    <p style="color:var(--muted);font-size:13.5px;line-height:1.9;margin-top:14px">
      欢迎交换友链：站点有持续更新的原创内容、能正常访问即可。<br>
      把「名称 / 一句话介绍 / 链接 / 头像」发到上面的邮箱，我看到后会加上。
    </p>
  </section>
</main>`;

  return layout({
    title: `友链 · ${SITE.name}`,
    description: "常读的站点与友链。",
    root: "../",
    navKey: "links",
    content,
  });
}

function aboutPage() {
  const content = `<main class="wrap main">
  <header class="page-head reveal">
    <p class="eyebrow">About</p>
    <h1>关于</h1>
    <p class="page-desc">一个普通人，和一些不普通的日子。</p>
  </header>
  <article class="prose reveal" style="margin-top:34px">
    <p>你好，我是${esc(SITE.author)}。住在南方，写代码，也写字。</p>
    <p>这个博客开始于 ${SITE.since} 年。那时候我发现自己每天接收很多信息，却很少真正想清楚一件事。于是我给自己留了这块地方：不追热点，不写正确的废话，只记录那些反复出现在脑子里的问题。</p>
    <h2>关于这个博客</h2>
    <p>这里大概会写三类东西：生活里的小事、读书和看电影之后的余震、以及工作时踩过的坑。更新频率随缘，通常在想说话的时候。</p>
    <p>站点是纯静态的，由我自己写的一个小脚本生成，托管在 GitHub Pages 上。没有广告，没有统计脚本，也不会收集你的任何信息。</p>
    <h2>现在</h2>
    <ul>
      <li>在写：一组关于城市与散步的随笔</li>
      <li>在读：《小于一》，布罗茨基</li>
      <li>在学：把想法做成能用的东西</li>
    </ul>
    <h2>联系</h2>
    <p>如果你想聊聊，欢迎写信：<a href="mailto:${SITE.email}">${SITE.email}</a>。也可以在这些地方找到我：</p>
    <ul>
      <li><a href="${SITE.github}" target="_blank" rel="noopener noreferrer">GitHub</a></li>
      <li><a href="../rss.xml">RSS 订阅</a></li>
    </ul>
    <hr>
    <blockquote><p>写作不是为了被看见，而是为了看清楚。</p></blockquote>
  </article>
</main>`;

  return layout({
    title: `关于 · ${SITE.name}`,
    description: `关于${SITE.author}和这个博客。`,
    root: "../",
    navKey: "about",
    content,
  });
}

function searchPage(posts) {
  const content = `<main class="wrap main">
  <header class="page-head reveal">
    <p class="eyebrow">Search</p>
    <h1>搜索</h1>
    <p class="page-desc">在 ${posts.length} 篇文章里找找看。</p>
  </header>
  <div class="search-box reveal">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
    <label class="sr-only" for="search-input">搜索文章</label>
    <input id="search-input" type="search" placeholder="标题、标签或正文关键词…" autocomplete="off" spellcheck="false">
    <kbd>/</kbd>
  </div>
  <p class="search-status" id="search-status" aria-live="polite"></p>
  <div class="search-results post-list" id="search-results"></div>
  <noscript><p class="empty">搜索需要启用 JavaScript。你也可以直接浏览 <a href="../archives/">归档</a>。</p></noscript>
</main>`;

  const head = `<script src="../assets/js/posts-index.js" defer></script>`;

  return layout({
    title: `搜索 · ${SITE.name}`,
    description: "搜索站内文章。",
    root: "../",
    navKey: "",
    content,
    head,
  });
}

function notFoundPage() {
  const content = `<main class="wrap main">
  <div class="not-found reveal">
    <p class="code">404 · LOST IN FOG</p>
    <h1>这一页不在了</h1>
    <p>可能是我删掉了，也可能是链接写错了。</p>
    <a class="btn" href="./">回到首页</a>
  </div>
</main>`;
  return layout({
    title: `页面不存在 · ${SITE.name}`,
    description: "404",
    root: "",
    content,
  });
}

function postPage(post, posts) {
  const idx = posts.findIndex((p) => p.slug === post.slug);
  const newer = posts[idx - 1];
  const older = posts[idx + 1];

  const navParts = [];
  if (newer) {
    navParts.push(`<a class="prev" href="../${newer.slug}/"><span class="label">上一篇</span><span class="title">${esc(
      newer.title
    )}</span></a>`);
  }
  if (older) {
    navParts.push(`<a class="next" href="../${older.slug}/"><span class="label">下一篇</span><span class="title">${esc(
      older.title
    )}</span></a>`);
  }

  const tags = post.tags
    .map((t) => `<span class="tag">${esc(t)}</span>`)
    .join("");

  const content = `<main class="wrap main article">
  <a class="back" href="../"><span aria-hidden="true">←</span> 返回文章列表</a>
  <header class="article-head">
    <div class="tags">${tags}</div>
    <h1>${esc(post.title)}</h1>
    <div class="article-meta">
      <time datetime="${post.dateISO}">${cnDate(post.date)}</time>
      <span class="dot"></span>
      <span>约 ${post.minutes} 分钟</span>
      <span class="dot"></span>
      <span>${post.chars} 字</span>
    </div>
  </header>
  <nav class="toc" id="toc" hidden aria-label="文章目录"><p class="toc-title">目录</p></nav>
  <article class="prose" id="article">
${post.html}
  </article>
  <div class="article-foot">
    <div class="tags">${tags}</div>
    <a class="share" href="../">全部文章 <span aria-hidden="true">→</span></a>
  </div>
  ${navParts.length ? `<nav class="post-nav" aria-label="上下篇">${navParts.join("")}</nav>` : ""}
</main>`;

  const head = `<meta property="og:url" content="${SITE.url}/blog/${post.slug}/">
<meta property="article:published_time" content="${post.dateISO}">
<meta property="article:tag" content="${esc(post.tags.join(", "))}">`;

  return layout({
    title: `${post.title} · ${SITE.name}`,
    description: post.excerpt,
    root: "../../",
    navKey: "blog",
    content,
    bodyClass: "article-page",
    head,
    article: true,
    ogType: "article",
  });
}

/* ------------------------------------------------------------------ */
/* RSS / sitemap / 搜索索引                                             */
/* ------------------------------------------------------------------ */

function rss(posts) {
  const items = posts
    .map(
      (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${SITE.url}/blog/${p.slug}/</link>
      <guid isPermaLink="true">${SITE.url}/blog/${p.slug}/</guid>
      <pubDate>${p.date.toUTCString()}</pubDate>
      <description>${esc(p.excerpt)}</description>
${p.tags.map((t) => `      <category>${esc(t)}</category>`).join("\n")}
    </item>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(SITE.name)}</title>
    <link>${SITE.url}/</link>
    <description>${esc(SITE.desc)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${(posts[0] ? posts[0].date : new Date()).toUTCString()}</lastBuildDate>
    <atom:link href="${SITE.url}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

function sitemap(posts) {
  const urls = [
    { loc: `${SITE.url}/`, lastmod: posts[0] ? posts[0].dateISO : "" },
    { loc: `${SITE.url}/blog/`, lastmod: posts[0] ? posts[0].dateISO : "" },
    { loc: `${SITE.url}/archives/`, lastmod: posts[0] ? posts[0].dateISO : "" },
    { loc: `${SITE.url}/links/`, lastmod: "" },
    { loc: `${SITE.url}/about/`, lastmod: "" },
    { loc: `${SITE.url}/search/`, lastmod: "" },
  ].concat(
    posts.map((p) => ({ loc: `${SITE.url}/blog/${p.slug}/`, lastmod: p.dateISO }))
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`
  )
  .join("\n")}
</urlset>
`;
}

function searchIndex(posts) {
  const data = posts.map((p) => ({
    title: p.title,
    date: p.dateISO,
    dateLabel: dateLabel(p.date),
    tags: p.tags,
    excerpt: p.excerpt,
    url: "../blog/" + p.slug + "/",
    text: p.text.slice(0, 1200),
  }));
  return "window.POSTS = " + JSON.stringify(data, null, 2) + ";\n";
}

/* ------------------------------------------------------------------ */
/* 输出                                                                */
/* ------------------------------------------------------------------ */

function write(rel, content) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
  console.log("  ✓ " + rel);
}

// 删掉 posts 里已经不存在的文章目录，避免旧页面残留
function cleanRemovedPosts(posts) {
  const blogDir = path.join(ROOT, "blog");
  if (!fs.existsSync(blogDir)) return;
  const keep = new Set(posts.map((p) => p.slug));
  fs.readdirSync(blogDir, { withFileTypes: true }).forEach((entry) => {
    if (entry.isDirectory() && !keep.has(entry.name)) {
      fs.rmSync(path.join(blogDir, entry.name), { recursive: true, force: true });
      console.log("  - 移除已删除文章：" + entry.name);
    }
  });
}

function main() {
  const posts = loadPosts();
  console.log(`南屿 · 构建中（${posts.length} 篇文章）`);

  cleanRemovedPosts(posts);

  write("index.html", homePage(posts));
  write("blog/index.html", blogPage(posts));
  write("archives/index.html", archivesPage(posts));
  write("links/index.html", linksPage());
  write("about/index.html", aboutPage());
  write("search/index.html", searchPage(posts));
  write("404.html", notFoundPage());

  posts.forEach((p) => write(`blog/${p.slug}/index.html`, postPage(p, posts)));

  write("rss.xml", rss(posts));
  write("sitemap.xml", sitemap(posts));
  write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${SITE.url}/sitemap.xml\n`);
  write("assets/js/posts-index.js", searchIndex(posts));
  write(".nojekyll", "");

  console.log("完成。");
}

main();
