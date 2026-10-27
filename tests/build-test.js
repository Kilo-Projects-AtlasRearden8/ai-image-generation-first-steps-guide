// tests/build-test.js - Verifies the static site build output.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SITE_DIR = path.join(ROOT, "site");

const EXPECTED_PAGES = [
  "index.html",
  "choosing-models.html",
  "writing-prompts.html",
  "aspect-ratios.html",
  "local-vs-cloud.html",
  "copyright-basics.html",
  "safety-filters.html",
  "prompt-checklist.html",
];

function read(file) {
  return fs.readFileSync(path.join(SITE_DIR, file), "utf8");
}

let failures = 0;

function check(name, condition) {
  if (!condition) {
    console.error("FAIL: " + name);
    failures++;
  } else {
    console.log("ok: " + name);
  }
}

// 1. Build first
const { build } = require(path.join(ROOT, "build.js"));
let results = build();
console.log("Build produced " + results.length + " pages.");

// 2. Every expected page exists
EXPECTED_PAGES.forEach(function (page) {
  check("site contains " + page, fs.existsSync(path.join(SITE_DIR, page)));
});

// 3. style.css exists
check("site contains style.css", fs.existsSync(path.join(SITE_DIR, "style.css")));

// 4. Content spot checks
let index = read("index.html");
check("index has site title", index.includes("AI Image Generation First Steps Guide"));
check("index credits Asdale Dynamics", index.includes("Asdale Dynamics, LLC"));
check("index links to choosing models page", index.includes('href="choosing-models.html"'));
check("index links to checklist page", index.includes('href="prompt-checklist.html"'));
check("index has no dangling .md links", !index.includes(".md"));

// 5. Each page has the credit footer and copyright line
EXPECTED_PAGES.forEach(function (page) {
  let html = read(page);
  check(page + " credits Asdale Dynamics", html.includes("Asdale Dynamics, LLC"));
  check(page + " has copyright line", html.includes("Copyright (c) 2026 Asdale Dynamics, LLC"));
  check(page + " has no dangling .md links", !html.includes(".md"));
  check(page + " has nav", html.includes('<nav class="top-nav">'));
});

// 6. Specific content
check("choosing models page mentions Bing Image Creator", read("choosing-models.html").includes("Bing Image Creator"));
check("writing prompts page mentions Subject + Action", read("writing-prompts.html").includes("Subject + Action + Setting + Style"));
check("aspect ratios page mentions 1:1", read("aspect-ratios.html").includes("1:1"));
check("local vs cloud page mentions Stable Diffusion", read("local-vs-cloud.html").includes("Stable Diffusion"));
check("copyright page mentions U.S. Copyright Office", read("copyright-basics.html").includes("U.S. Copyright Office"));
check("safety filters page mentions false positive", read("safety-filters.html").includes("false positive"));
check("checklist page has master checklist", read("prompt-checklist.html").includes("Master checklist"));
check("checklist page is printable checklist", read("prompt-checklist.html").includes("Print this page"));

if (failures > 0) {
  console.error("\n" + failures + " test(s) failed.");
  process.exit(1);
}
console.log("\nAll tests passed.");
