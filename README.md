# 南屿 · 个人博客

一个安静的静态博客：动态极光背景、深浅色切换、文章 / 归档 / 友链 / 关于 / 搜索，外加 RSS 和站点地图。
纯 HTML + CSS + 一点原生 JS，没有框架、没有 npm 依赖，可以直接扔到 GitHub Pages 上。

## 先看看

- 双击 `preview.cmd`（Windows），会自动打开 <http://localhost:5173>
- 或者在当前目录执行 `node preview.mjs`，再访问 <http://localhost:5173>
- 直接双击 `index.html` 也能看首页，但页面之间的跳转需要本地服务器（因为链接用的是 `/blog/` 这种目录地址）

> 需要 Node.js 18+。命令行里 `node -v` 能出版本号就行。

## 改内容

内容都从源文件生成，**不要直接改生成出来的 `index.html`**，下次构建会被覆盖。

### 1. 站点信息

打开 `build.js`，最上面有一段：

```js
const SITE = {
  name: "南屿",            // 站点名
  author: "阿南",          // 你的名字
  desc: "记录思考，分享观点。",
  url: "https://yourname.github.io",  // 上线后的地址（RSS 用）
  github: "https://github.com/yourname",
  email: "hi@example.com",
};
```

改完执行 `node build.js`。

### 2. 写文章

在 `posts/` 里新建一个 `.md` 文件，文件名就是网址（例如 `my-day.md` → `/blog/my-day/`）：

```md
---
title: 标题
date: 2026-11-18
tags: [随笔, 生活]
excerpt: 列表页显示的一句话摘要。
---

正文从这里开始，支持标题、列表、引用、表格、代码块。

## 小标题

段落……
```

然后 `node build.js`。首页、文章列表、归档、搜索索引、RSS、上下篇都会自动更新。

### 3. 重新构建

```bash
node build.js
```

## 发布到 GitHub Pages

1. 注册 / 登录 GitHub，点右上角 **+ → New repository**
2. 仓库名填 **`你的用户名.github.io`**（例如 `anan.github.io`），选 Public，创建
3. 在这个文件夹里全选文件（`index.html`、`assets`、`posts`、`build.js` 等），拖进 GitHub 网页的上传区，提交
4. 进入仓库 **Settings → Pages**，Source 选 **Deploy from a branch**，分支 `main`、目录 `/ (root)`，保存
5. 等 1～2 分钟，访问 `https://你的用户名.github.io`

> 仓库名不是 `用户名.github.io` 也可以（例如 `blog`），站点会变成 `https://用户名.github.io/blog/`，站内链接是相对路径，仍然能用。但 `build.js` 里的 `SITE.url` 要改成对应地址，RSS 里的链接才正确。

## 站点信息（已上线）

当前部署在 **https://xia0tou.github.io/**，仓库是 `xia0tou/xia0tou.github.io`。

| 位置 | 当前值 | 说明 |
| --- | --- | --- |
| `build.js` → `SITE.name` / `author` | 南屿 / 阿南 | 想换成自己的名字就改这里 |
| `build.js` → `SITE.url` | `https://xia0tou.github.io` | 站点地址，RSS / 分享卡片用 |
| `build.js` → `SITE.github` | `https://github.com/xia0tou` | 首页 GitHub 按钮 |
| `build.js` → `SITE.email` | `hi@example.com` | **还没换成你的邮箱** |
| `assets/img/avatar.svg` | 默认的月亮插画 | 可换成你的头像（同名替换，正方形最好） |
| `assets/img/og.png` | 分享卡片图（1200×630） | 换名字后想更新，可用浏览器打开 `tools/og.html` 重新截图 |
| `build.js` → `FRIENDS` | 几个示例站点 | 换成你真正的友链 |

改完记得 `node build.js`，然后把改动推到 GitHub（网页上传或 `git push` 都行），Pages 会自动重建。

## 更新文章 / 内容

1. 改 `posts/*.md` 或 `build.js`
2. 运行 `node build.js`
3. 把重新生成的文件传到 GitHub（覆盖旧文件），等 1 分钟

## 目录结构

```
blog/
├─ build.js              # 构建脚本：Markdown → 静态页面
├─ posts/                # 文章源文件（Markdown）
├─ assets/
│  ├─ css/style.css      # 全部样式，顶部有颜色变量
│  ├─ js/main.js         # 主题、目录、搜索、菜单等交互
│  ├─ js/shader.js       # 背景着色器（WebGL）
│  ├─ js/posts-index.js  # 自动生成的搜索索引
│  └─ img/avatar.svg     # 头像
├─ index.html            # 以下都是生成的
├─ blog/                 # 文章列表 + 每篇文章
├─ archives/  links/  about/  search/
├─ rss.xml  sitemap.xml  robots.txt  404.html
├─ preview.mjs           # 本地预览服务器
└─ preview.cmd           # Windows 双击预览
```

## 想再改改外观

- 配色：`assets/css/style.css` 顶部的 `:root` 和 `html[data-theme="light"]`，改 `--accent`、`--bg` 就能换主题色
- 背景：`assets/js/shader.js` 里的 GLSL 片段，改颜色系数即可；不喜欢动态效果可以把 `#bg` 删掉，会退回纯 CSS 渐变
- 字体：`--font-sans` / `--font-mono`

## 加评论（可选）

推荐 [giscus](https://giscus.app/zh-CN)：用 GitHub Discussions 存评论，免费、无追踪。
在 giscus 生成一段 `<script>`，粘到 `build.js` 里 `postPage()` 的 `.article-foot` 之后即可。

## 小提示

- 搜索是纯前端的，文章索引在 `assets/js/posts-index.js`，文章变多也不会有额外请求
- 背景动画限制在 30fps，切换标签页会暂停；系统开了「减少动态效果」时只渲染静帧
- 默认深色主题，右上角可手动切换，选择会记在 localStorage
