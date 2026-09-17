import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { chromium } from "playwright";
import { buildArchitectureDocs } from "../src/architecture-docs/index.mjs";

const architectureFixture = path.resolve("test/fixtures/architecture-docs");
const consumerFixture = path.resolve("test/fixtures/handoff-consumer/index.html");

async function serve(root) {
  const server = createServer(async (request, response) => {
    try {
      const relative = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname).replace(/^\//, "") || "index.html";
      const filename = path.resolve(root, relative);
      if (filename !== root && !filename.startsWith(`${root}${path.sep}`)) return response.writeHead(403).end();
      const body = await readFile(filename);
      const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".css": "text/css" };
      response.writeHead(200, { "content-type": types[path.extname(filename)] ?? "application/octet-stream" }); response.end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

const htmlDesignSkill = process.env.HTML_DESIGN_SKILL_DIR ?? path.resolve("../html-design/skills/html-design");

async function installCanonicalAssets(root, html) {
  const skill = htmlDesignSkill;
  await mkdir(path.join(root, "config"), { recursive: true });
  const [theme, palette, canonical, profiles] = await Promise.all([
    readFile(path.join(skill, "assets/theme.js"), "utf8"),
    readFile(path.join(skill, "assets/palettes/moss-paper.css"), "utf8"),
    readFile(path.join(skill, "assets/design-system.css"), "utf8"),
    readFile(path.join(skill, "config/profiles.json"), "utf8"),
  ]);
  await writeFile(path.join(root, "config/profiles.json"), profiles);
  return html
    .replace('<html lang="en" data-theme="system">', '<html lang="en" data-theme="system" data-ds-profile="rail-document">')
    .replace("</head>", `<script data-ds-theme>${theme}</script><style data-ds-palette="moss-paper">${palette}</style><style data-ds-canonical>${canonical}</style></head>`);
}

test("an independent consumer composes and exercises a handoff without package source", async () => {
  const directory = await mkdtemp(path.join(process.cwd(), ".tmp-consumer-"));
  let server; let browser;
  try {
    const source = path.join(directory, "source"); const site = path.join(directory, "site");
    await cp(architectureFixture, source, { recursive: true }); await rm(path.join(source, "preview"), { recursive: true, force: true });
    await buildArchitectureDocs(path.join(source, "architecture-docs.config.json"));
    await mkdir(path.join(site, "assets"), { recursive: true });
    await cp(path.join(source, "handoff/assets/views.json"), path.join(site, "assets/views.json"));
    await cp(path.join(source, "handoff/assets/likec4-views.js"), path.join(site, "assets/likec4-views.js"));
    const html = await installCanonicalAssets(site, await readFile(consumerFixture, "utf8"));
    await writeFile(path.join(site, "index.html"), html);
    const manifest = JSON.parse(await readFile(path.join(source, "handoff/manifest.json"), "utf8"));
    await writeFile(path.join(site, "assets/architecture-handoff.json"), `${JSON.stringify({ ownership: { product: "html-design", generated: true }, architectureHandoffDigest: manifest.digests.handoff, architectureHandoffSchema: manifest.version })}\n`);
    assert.equal(html.includes("c4archviewer/src"), false);
    const checker = path.join(htmlDesignSkill, "scripts/check-artifact.mjs");
    const result = spawnSync(process.execPath, [checker, path.join(site, "index.html"), "--profile", "rail-document"], { cwd: site, encoding: "utf8" });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const served = await serve(site); server = served.server;
    browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${served.url}/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => customElements.get("likec4-view") && document.querySelectorAll("#view-select option").length > 1, null, { timeout: 10000 });
    assert.equal(await page.locator("#view-select option").count(), JSON.parse(await readFile(path.join(site, "assets/views.json"), "utf8")).views.length);
    const flow = page.locator("likec4-view .react-flow").first(); await flow.waitFor();
    const viewport = page.locator("likec4-view .react-flow__viewport").first(); const box = await flow.boundingBox(); assert.ok(box);
    const before = Number((await viewport.getAttribute("style")).match(/scale\(([^)]+)/)[1]);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, -400); await page.waitForTimeout(150);
    assert.ok(Number((await viewport.getAttribute("style")).match(/scale\(([^)]+)/)[1]) > before);
    await page.locator("button[data-theme]").click(); assert.equal(await page.locator("likec4-view").getAttribute("color-scheme"), "dark");
    await page.setViewportSize({ width: 390, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
