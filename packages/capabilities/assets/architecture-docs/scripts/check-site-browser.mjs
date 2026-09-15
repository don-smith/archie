#!/usr/bin/env node
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { loadArchitectureDocsConfig } from "../src/architecture-docs/config.mjs";

const args = process.argv.slice(2); const configIndex = args.indexOf("--config"); const configPath = configIndex >= 0 ? args[configIndex + 1] : undefined;
if (!configPath) { process.stderr.write("Usage: node scripts/check-site-browser.mjs --config <path>\n"); process.exit(1); }
const config = await loadArchitectureDocsConfig(configPath); const siteRoot = config.paths.outputDirectory;
const manifest = JSON.parse(await readFile(path.join(siteRoot, "assets/views.json"), "utf8"));
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const relative = pathname.endsWith("/") ? `${pathname.replace(/^\//, "")}index.html` : pathname.replace(/^\//, "");
    const filename = path.resolve(siteRoot, relative || "index.html");
    if (filename !== siteRoot && !filename.startsWith(`${siteRoot}${path.sep}`)) return response.writeHead(403).end();
    const info = await stat(filename); if (!info.isFile()) throw new Error("not a file");
    const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };
    response.writeHead(200, { "content-type": types[path.extname(filename)] ?? "application/octet-stream" }); response.end(await readFile(filename));
  } catch { response.writeHead(404).end(); }
});
function scaleOf(transform) { const match = /scale\(([^)]+)\)/.exec(transform ?? ""); assert.ok(match, `missing diagram scale: ${transform}`); return Number(match[1]); }
async function zoomAndPan(page) {
  const flow = page.locator("likec4-view .react-flow").first();
  await flow.scrollIntoViewIfNeeded();
  const viewport = page.locator("likec4-view .react-flow__viewport").first();
  await flow.waitFor();
  await flow.evaluate((element) => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const box = await flow.boundingBox(); assert.ok(box, "diagram has no bounding box");
  const before = scaleOf(await viewport.getAttribute("style"));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, -500); await page.waitForTimeout(250);
  const after = scaleOf(await viewport.getAttribute("style")); assert.ok(after > before, "wheel must zoom the diagram");
  const pane = page.locator("likec4-view .react-flow__pane").first(); const point = await pane.evaluate((element) => { const b = element.getBoundingClientRect(); return { x: b.left + 24, y: b.top + 24 }; });
  const panBefore = await viewport.getAttribute("style"); await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.mouse.move(point.x + 60, point.y + 30, { steps: 4 }); await page.mouse.up();
  assert.notEqual(await viewport.getAttribute("style"), panBefore, "drag must pan the diagram");
}
async function checkRoute(page, route, configuredPage) {
  await page.emulateMedia({ media: null });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors = []; page.on("pageerror", (error) => errors.push(error));
  await page.goto(route, { waitUntil: "networkidle" });
  const hasViews = configuredPage.viewIds.length > 0;
  if (hasViews) {
    await page.waitForFunction(() => customElements.get("likec4-view") && document.documentElement.dataset.architectureViewerReady === "true" && document.querySelectorAll("#architecture-view-select option").length > 1);
    assert.equal(await page.locator("#architecture-view-select option").count(), manifest.views.length);
    assert.equal(await page.locator("likec4-view").count(), 1);
    await zoomAndPan(page);
    const focusButton = page.locator("[data-open-view]").first();
    if (configuredPage.id === config.pages.home.id && await focusButton.count()) { await focusButton.focus(); await page.keyboard.press("Enter"); await page.waitForFunction(() => document.activeElement?.classList.contains("architecture-viewer-canvas")); assert.equal(await page.locator(".architecture-viewer-canvas").evaluate((element) => element === document.activeElement), true); }
  } else {
    assert.equal(await page.locator("likec4-view, #architecture-view-select, #explore").count(), 0, "a viewless page rendered an architecture view");
  }
  assert.ok((await page.locator("main").innerText()).includes(configuredPage.title));
  await page.locator('[data-theme-choice="dark"]').click(); assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.locator('[data-theme-choice="light"]').click(); if (hasViews) assert.equal(await page.locator("likec4-view").getAttribute("color-scheme"), "light");
  await page.setViewportSize({ width: 390, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "page has narrow-layout overflow");
  await page.emulateMedia({ media: "print" }); if (hasViews) assert.equal(await page.locator(".architecture-viewer-canvas").evaluate((element) => getComputedStyle(element).display), "none");
  assert.deepEqual(errors, []);
}
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address(); const base = `http://127.0.0.1:${address.port}`; const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); const page = await context.newPage();
  const pages = [config.pages.home, ...config.pages.areas];
  for (const configuredPage of pages) {
    const route = configuredPage.id === config.pages.home.id ? "/" : `/${configuredPage.slug}/`;
    await checkRoute(page, `${base}${route}`, configuredPage);
  }
  console.log(`Browser checks passed for ${config.repository.name}: ${pages.length} generated pages, themes, narrow layout, keyboard-ready controls, and print.`);
  await context.close();
} finally { await browser.close(); await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
