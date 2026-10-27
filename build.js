// build.js - Dependency-free static site builder for the AI Image Generation First Steps Guide
// Reads Markdown files from docs/, converts to HTML, and writes the site to site/.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname);
const DOCS_DIR = path.join(ROOT, "docs");
const SITE_DIR = path.join(ROOT, "site");
const ASSETS_DIR = path.join(ROOT, "assets");

// Navigation order matches the guide reading order.
const PAGES = [
  { file: "index.md", title: "Welcome", out: "index.html" },
  { file: "choosing-models.md", title: "Choosing models", out: "choosing-models.html" },
  { file: "writing-prompts.md", title: "Writing prompts", out: "writing-prompts.html" },
  { file: "aspect-ratios.md", title: "Aspect ratios", out: "aspect-ratios.html" },
  { file: "local-vs-cloud.md", title: "Local vs cloud", out: "local-vs-cloud.html" },
  { file: "copyright-basics.md", title: "Copyright basics", out: "copyright-basics.html" },
  { file: "safety-filters.md", title: "Safety filters", out: "safety-filters.html" },
  { file: "prompt-checklist.md", title: "Prompt checklist", out: "prompt-checklist.html" },
];

const SITE_TITLE = "AI Image Generation First Steps Guide";
const SITE_SUBTITLE = "Making AI images for free: models, prompts, aspect ratios, and more";
const CREDIT_LINE = "Written by Dylan Asdale of Asdale Dynamics, LLC";
const COPYRIGHT_LINE = "Copyright (c) 2026 Asdale Dynamics, LLC";

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

// ---------- Minimal Markdown -> HTML converter (no dependencies) ----------

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(markdown) {
  return markdown
    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    // Italic: *text* or _text_
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    // Inline code: `code`
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Links: [text](url) — rewrite .md links to .html for the static site
    .replace(/\[([^\]]+)\]\(([^)]+)\.md\)/g, '<a href="$2.html">$1</a>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function block(markdown) {
  let html = "";
  let lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    let line = lines[i];

    // Fenced code block
    if (line.match(/^```/)) {
      let fence = line;
      let lang = fence.replace(/^```/, "").trim();
      let codeLines = [];
      i++;
      while (i < lines.length && !lines[i].match(/^```/)) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      i++; // skip closing fence
      html += '<pre><code class="lang-' + escapeHtml(lang) + '">' + codeLines.join("\n") + "</code></pre>\n";
      continue;
    }

    // Heading
    let headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      let level = headingMatch[1].length;
      let text = inline(headingMatch[2]).trim();
      html += "<h" + level + ">" + text + "</h" + level + ">\n";
      i++;
      continue;
    }

    // Horizontal rule
    if (line.match(/^(\*\*\*|---|___)\s*$/)) {
      html += "<hr>\n";
      i++;
      continue;
    }

    // Blockquote
    if (line.match(/^>\s/)) {
      let quoteLines = [];
      while (i < lines.length && lines[i].match(/^>\s/)) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      html += "<blockquote>" + inline(quoteLines.join(" ")) + "</blockquote>\n";
      continue;
    }

    // Unordered list
    if (line.match(/^\s*[-*+]\s+/)) {
      let items = [];
      while (i < lines.length && lines[i].match(/^\s*[-*+]\s+/)) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      html += "<ul>\n" + items.map(function (item) { return "  <li>" + inline(item) + "</li>"; }).join("\n") + "\n</ul>\n";
      continue;
    }

    // Ordered list
    if (line.match(/^\s*\d+\.\s+/)) {
      let items = [];
      while (i < lines.length && lines[i].match(/^\s*\d+\.\s+/)) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      html += "<ol>\n" + items.map(function (item) { return "  <li>" + inline(item) + "</li>"; }).join("\n") + "\n</ol>\n";
      continue;
    }

    // Table
    if (line.match(/^\s*\|/) && i + 1 < lines.length && lines[i + 1].match(/^\s*\|/)) {
      let rows = [];
      while (i < lines.length && lines[i].match(/^\s*\|/)) {
        rows.push(lines[i]);
        i++;
      }
      html += "<table>\n";
      rows.forEach(function (row, rowIndex) {
        let cells = row.split("|").map(function (cell) { return cell.trim(); }).filter(function (cell) { return cell !== ""; });
        if (rowIndex === 1) return; // separator row: |---|---|
        let isHeader = rowIndex === 0;
        html += "  <tr>" + cells.map(function (cell) { return "<" + (isHeader ? "th" : "td") + ">" + inline(cell) + "</" + (isHeader ? "th" : "td") + ">"; }).join("") + "</tr>\n";
      });
      html += "</table>\n";
      continue;
    }

    // Blank line -> paragraph break
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph
    let paraLines = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].match(/^(#{1,6})\s/) && !lines[i].match(/^```/) && !lines[i].match(/^\s*[-*+]\s+/) && !lines[i].match(/^\s*\d+\.\s+/) && !lines[i].match(/^>\s/) && !lines[i].match(/^\s*\|/) && !lines[i].match(/^(\*\*\*|---|___)\s*$/)) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      html += "<p>" + inline(paraLines.join(" ")) + "</p>\n";
    }
  }

  return html;
}

function markdownToHtml(markdown) {
  return block(markdown.trim());
}

// ---------- Page shell ----------

function navHtml(currentPage) {
  let items = PAGES.map(function (page) {
    let active = page.out === currentPage ? ' class="active"' : "";
    return '    <li><a href="' + page.out + '"' + active + '>' + page.title + "</a></li>";
  }).join("\n");
  return '<nav class="top-nav">\n  <ul>\n' + items + '\n  </ul>\n</nav>';
}

function pageHtml(title, body, currentPage) {
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '  <title>' + escapeHtml(title) + " — " + SITE_TITLE + '</title>',
    '  <link rel="stylesheet" href="style.css">',
    '</head>',
    '<body>',
    '  <header class="site-header">',
    '    <div class="wrapper">',
    '      <h1 class="site-title"><a href="index.html">' + escapeHtml(SITE_TITLE) + '</a></h1>',
    '      <p class="site-subtitle">' + escapeHtml(SITE_SUBTITLE) + '</p>',
    '    </div>',
    '  </header>',
    navHtml(currentPage),
    '  <main class="wrapper">',
    body,
    '  </main>',
    '  <footer class="site-footer">',
    '    <div class="wrapper">',
    '      <p>' + escapeHtml(CREDIT_LINE) + '.</p>',
    '      <p>' + escapeHtml(COPYRIGHT_LINE) + '. This guide is open source under the MIT License.</p>',
    '    </div>',
    '  </footer>',
    '</body>',
    '</html>',
    "",
  ].join("\n");
}

// ---------- Build ----------

function build() {
  ensureDir(SITE_DIR);

  // Copy CSS asset if it exists.
  let cssSource = path.join(ASSETS_DIR, "style.css");
  if (fs.existsSync(cssSource)) {
    fs.copyFileSync(cssSource, path.join(SITE_DIR, "style.css"));
  } else {
    writeFile(path.join(SITE_DIR, "style.css"), defaultCss());
  }

  let results = [];
  PAGES.forEach(function (page) {
    let sourcePath = path.join(DOCS_DIR, page.file);
    let markdown = readFile(sourcePath);
    let body = markdownToHtml(markdown);
    let html = pageHtml(page.title, body, page.out);
    writeFile(path.join(SITE_DIR, page.out), html);
    results.push({ source: page.file, out: page.out, bytes: Buffer.byteLength(html, "utf8") });
  });

  return results;
}

function defaultCss() {
  return [
    "/* AI Image Generation First Steps Guide - simple, warm, polished styles */",
    "* { box-sizing: border-box; }",
    "body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #222; margin: 0; background: #fafafa; }",
    ".wrapper { max-width: 720px; margin: 0 auto; padding: 0 16px; }",
    "header.site-header { background: #ffffff; border-bottom: 1px solid #ddd; padding: 24px 0; margin-bottom: 16px; }",
    ".site-title { font-size: 1.5rem; margin: 0 0 6px 0; }",
    ".site-title a { color: #1a3c6a; text-decoration: none; }",
    ".site-title a:hover { text-decoration: underline; }",
    ".site-subtitle { margin: 0; color: #555; font-size: 1rem; }",
    ".top-nav { background: #eef2f7; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; }",
    ".top-nav ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }",
    ".top-nav li { margin: 0; }",
    ".top-nav a { display: block; padding: 8px 12px; color: #1a3c6a; text-decoration: none; border-radius: 6px; }",
    ".top-nav a:hover { background: #dde6f0; }",
    ".top-nav a.active { background: #1a3c6a; color: #ffffff; }",
    "main { background: #ffffff; border: 1px solid #ddd; border-radius: 8px; padding: 24px 32px; }",
    "h1 { font-size: 1.75rem; margin-top: 0; border-bottom: 2px solid #1a3c6a; padding-bottom: 8px; }",
    "h2 { font-size: 1.35rem; margin-top: 24px; color: #1a3c6a; }",
    "h3 { font-size: 1.15rem; color: #1a3c6a; }",
    "h4, h5, h6 { font-size: 1.05rem; color: #333; }",
    "p { margin: 10px 0; }",
    "a { color: #1a5fb4; }",
    "a:hover { text-decoration: underline; }",
    "ul, ol { margin: 10px 0 10px 24px; }",
    "li { margin: 6px 0; }",
    "blockquote { border-left: 4px solid #1a3c6a; margin: 16px 0; padding: 8px 16px; background: #f4f7fb; font-style: italic; }",
    "pre { background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; padding: 12px 16px; overflow-x: auto; }",
    "code { background: #eee; padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }",
    "pre code { background: transparent; padding: 0; font-size: 0.9rem; }",
    "table { border-collapse: collapse; width: 100%; margin: 16px 0; }",
    "th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }",
    "th { background: #eef2f7; }",
    "hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }",
    "footer.site-footer { margin-top: 32px; padding: 24px 0; color: #666; font-size: 0.9rem; border-top: 1px solid #ddd; }",
    "footer.site-footer p { margin: 4px 0; }",
    "@media (max-width: 600px) { main { padding: 16px; } .top-nav ul { flex-direction: column; align-items: flex-start; } }",
    // Print-friendly styles so the checklist prints cleanly on paper.
    "@media print {",
    "  body { background: #ffffff; color: #000000; }",
    "  header.site-header, .top-nav, footer.site-footer { display: none; }",
    "  main { border: none; padding: 0; box-shadow: none; }",
    "  .wrapper { max-width: 100%; padding: 0; }",
    "  a { color: #000000; text-decoration: none; }",
    "  a::after { content: ' (' attr(href) ')'; font-size: 0.8rem; }",
    "  code, pre { background: #ffffff; color: #000000; border: 1px solid #999999; }",
    "  table, th, td { border: 1px solid #000000; }",
    "  h1, h2, h3 { color: #000000; page-break-after: avoid; }",
    "}",
    "",
  ].join("\n");
}

if (require.main === module) {
  let results = build();
  console.log("Built " + results.length + " pages:");
  results.forEach(function (r) {
    console.log("  " + r.source + " -> " + r.out + " (" + r.bytes + " bytes)");
  });
}

module.exports = { build, PAGES, markdownToHtml };
