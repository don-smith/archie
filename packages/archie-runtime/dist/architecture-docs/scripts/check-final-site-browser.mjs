#!/usr/bin/env node
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { loadArchitectureDocsConfig } from "../src/architecture-docs/config.mjs";

const args = process.argv.slice(2);
const index = args.indexOf("--config");
const configPath = index >= 0 ? args[index + 1] : undefined;
if (!configPath) {
  process.stderr.write("Usage: node scripts/check-final-site-browser.mjs --config <path>\n");
  process.exit(1);
}

const config = await loadArchitectureDocsConfig(configPath);
const siteRoot = path.join(config.paths.rootDirectory, "site");
const pages = [config.pages.home, ...config.pages.areas];
const routeFor = (page) => page.id === config.pages.home.id ? "/" : `/${page.slug}/`;
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const relative = pathname.endsWith("/") ? `${pathname.replace(/^\//, "")}index.html` : pathname.replace(/^\//, "");
    const filename = path.resolve(siteRoot, relative || "index.html");
    if (filename !== siteRoot && !filename.startsWith(`${siteRoot}${path.sep}`)) return response.writeHead(403).end();
    const info = await stat(filename);
    if (!info.isFile()) throw new Error("not a file");
    const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };
    response.writeHead(200, { "content-type": types[path.extname(filename)] ?? "application/octet-stream" });
    response.end(await readFile(filename));
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const base = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  for (const configuredPage of pages) {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => errors.push(`${request.url()} ${request.failure()?.errorText}`));
    await page.goto(`${base}${routeFor(configuredPage)}`, { waitUntil: "networkidle" });
    const hasViews = configuredPage.viewIds.length > 0;
    if (hasViews) {
      await page.waitForFunction(() => document.querySelectorAll("#view-select option").length > 0);
      await page.locator("likec4-view .react-flow").waitFor({ timeout: 30000 });
      const optionValues = await page.locator("#view-select option").evaluateAll((options) => options.map((option) => option.value));
      for (const viewId of configuredPage.viewIds) assert.ok(optionValues.includes(viewId), `${configuredPage.id}: selector is missing ${viewId}`);
      const initialView = configuredPage.initialViewId ?? configuredPage.viewIds[0] ?? config.model.initialView;
      assert.equal(await page.locator("#view-select").inputValue(), initialView, `${configuredPage.id}: wrong initial selector value`);
      assert.equal(await page.locator("likec4-view").getAttribute("view-id"), initialView, `${configuredPage.id}: wrong initial mounted view`);
      const flow = page.locator("likec4-view .react-flow").first();
      await flow.scrollIntoViewIfNeeded();
      const viewport = page.locator("likec4-view .react-flow__viewport").first();
      const before = Number((await viewport.getAttribute("style")).match(/scale\(([^)]+)/)[1]);
      const box = await flow.boundingBox();
      assert.ok(box, `${configuredPage.id}: diagram has no bounding box`);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, -400);
      await page.waitForTimeout(150);
      const after = Number((await viewport.getAttribute("style")).match(/scale\(([^)]+)/)[1]);
      assert.ok(after > before, `${configuredPage.id}: wheel must zoom the diagram`);
    } else {
      assert.equal(await page.locator("likec4-view, #view-select, #views").count(), 0, `${configuredPage.id}: a viewless page rendered an architecture view`);
    }
    await page.locator('[data-theme-choice="dark"]').click();
    if (hasViews) assert.equal(await page.locator("likec4-view").getAttribute("color-scheme"), "dark", `${configuredPage.id}: theme did not sync`);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${configuredPage.id}: narrow page overflow`);
    await page.emulateMedia({ media: "print" });
    if (hasViews) {
      assert.equal(await page.locator("likec4-view").evaluate((element) => getComputedStyle(element).display), "none", `${configuredPage.id}: viewer is not hidden in print`);
      assert.equal(await page.locator(".architecture-print-note").evaluate((element) => getComputedStyle(element).display), "block", `${configuredPage.id}: print fallback is missing`);
    }
    assert.deepEqual(errors, [], `${configuredPage.id}: browser errors`);
    await page.emulateMedia({ media: "screen" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    console.log(`${configuredPage.id} ok · ${configuredPage.viewIds.length} declared views · initial fit · zoom · theme · narrow · print`);
    page.removeAllListeners();
  }
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
