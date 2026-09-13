import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { cp, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { buildArchitectureDocs } from "../src/architecture-docs/index.mjs";

const fixture = path.resolve("test/fixtures/architecture-docs");

async function run(command, args, options) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output }));
  });
}

async function serve(directory) {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
      const relative = pathname.endsWith("/") ? `${pathname.replace(/^\//, "")}index.html` : pathname.replace(/^\//, "");
      const filename = path.resolve(directory, relative || "index.html");
      if (filename !== directory && !filename.startsWith(`${directory}${path.sep}`)) return response.writeHead(403).end();
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
  return server;
}

test("previews use balanced reading proportions", async () => {
  const directory = await mkdtemp(path.join(process.cwd(), ".tmp-preview-proportions-"));
  let server;
  let browser;
  try {
    await cp(fixture, directory, { recursive: true });
    await rm(path.join(directory, "preview"), { recursive: true, force: true });
    await buildArchitectureDocs(path.join(directory, "architecture-docs.config.json"));
    server = await serve(path.join(directory, "preview"));
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle" });
    const measurements = await page.evaluate(() => ({
      heroHeight: document.querySelector(".ds-statement-hero").getBoundingClientRect().height,
      displaySize: Number.parseFloat(getComputedStyle(document.querySelector(".ds-display")).fontSize),
      sectionTitleSize: Number.parseFloat(getComputedStyle(document.querySelector(".ds-section-title")).fontSize),
      sectionPadding: Number.parseFloat(getComputedStyle(document.querySelector(".ds-rail-document__section")).paddingTop),
    }));
    assert.ok(measurements.heroHeight < 560, `hero is too tall: ${measurements.heroHeight}`);
    assert.ok(measurements.displaySize <= 64, `display type is too large: ${measurements.displaySize}`);
    assert.ok(measurements.sectionTitleSize <= 44, `section title is too large: ${measurements.sectionTitleSize}`);
    assert.ok(measurements.sectionPadding >= 48 && measurements.sectionPadding <= 72, `section padding is not balanced: ${measurements.sectionPadding}`);
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(directory, { recursive: true, force: true });
  }
});

test("viewless previews omit interactive model controls", async () => {
  const directory = await mkdtemp(path.join(process.cwd(), ".tmp-viewless-browser-"));
  let server;
  let browser;
  try {
    await cp(fixture, directory, { recursive: true });
    await rm(path.join(directory, "preview"), { recursive: true, force: true });
    const configPath = path.join(directory, "architecture-docs.config.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    config.pages.areas.push({
      id: "glossary",
      slug: "glossary",
      title: "Glossary",
      summary: "Terms for readers.",
      markdown: "pages/glossary.md",
      viewIds: [],
      claimIds: [],
    });
    await writeFile(path.join(directory, "pages/glossary.md"), "# Terms\n\nA concise vocabulary.\n");
    await writeFile(configPath, JSON.stringify(config));

    await buildArchitectureDocs(configPath);
    server = await serve(path.join(directory, "preview"));
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/glossary/`, { waitUntil: "networkidle" });

    assert.equal(await page.locator("likec4-view, #architecture-view-select, #explore").count(), 0);
    await page.locator('[data-theme-choice="dark"]').click();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.emulateMedia({ media: "print" });
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(directory, { recursive: true, force: true });
  }
});

test("final-site browser checks allow a route with no declared architecture views", async () => {
  const directory = await mkdtemp(path.join(process.cwd(), ".tmp-viewless-final-browser-"));
  try {
    await cp(fixture, directory, { recursive: true });
    await rm(path.join(directory, "preview"), { recursive: true, force: true });
    const configPath = path.join(directory, "architecture-docs.config.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    config.pages.areas.push({
      id: "glossary",
      slug: "glossary",
      title: "Glossary",
      summary: "Terms for readers.",
      markdown: "pages/glossary.md",
      viewIds: [],
      claimIds: [],
    });
    await writeFile(path.join(directory, "pages/glossary.md"), "# Terms\n\nA concise vocabulary.\n");
    await writeFile(configPath, JSON.stringify(config));
    await buildArchitectureDocs(configPath);

    const site = path.join(directory, "site");
    await cp(path.join(directory, "preview"), site, { recursive: true });
    for (const [route, viewIds, initialView] of [["index.html", "systemContext", "systemContext"], ["runtime/index.html", "containers,components", "containers"]]) {
      const filename = path.join(site, route);
      await writeFile(filename, (await readFile(filename, "utf8"))
        .replace('<body class="ds-rail-document ds-ambient-field">', `<body class="ds-rail-document" data-view-ids="${viewIds}" data-initial-view="${initialView}">`)
        .replaceAll("architecture-view-select", "view-select")
        .replace("</head>", "<style>@media print { likec4-view { display: none !important; } .architecture-print-note { display: block !important; } }</style></head>")
        .replace("</body>", '<p class="architecture-print-note" style="display: none">Diagram omitted.</p></body>'));
    }
    const manifest = JSON.parse(await readFile(path.join(directory, "handoff/manifest.json"), "utf8"));
    await writeFile(path.join(site, "assets/architecture-handoff.json"), `${JSON.stringify({ ownership: { product: "html-design", generated: true }, architectureHandoffDigest: manifest.digests.handoff, architectureHandoffSchema: manifest.version })}\n`);

    const result = await run(process.execPath, ["scripts/check-final-site-browser.mjs", "--config", configPath], { cwd: process.cwd() });
    assert.equal(result.code, 0, result.output);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("long repository evidence paths do not overflow narrow previews", async () => {
  const directory = await mkdtemp(path.join(process.cwd(), ".tmp-browser-"));
  let server;
  let browser;
  try {
    await cp(fixture, directory, { recursive: true });
    await rm(path.join(directory, "preview"), { recursive: true, force: true });
    const ledgerPath = path.join(directory, "evidence/claims.json");
    const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
    const longPath = "evidence/arepositorysourcewithadeliberatelylongunbrokenfilenamemicrotypescript.ts";
    await writeFile(path.join(directory, longPath), "export {};\n");
    ledger.claims.find((claim) => claim.id === "runtime").evidence = [{ path: longPath, note: "Long exact source path." }];
    await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);

    await buildArchitectureDocs(path.join(directory, "architecture-docs.config.json"));
    server = await serve(path.join(directory, "preview"));
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`http://127.0.0.1:${server.address().port}/runtime/`, { waitUntil: "networkidle" });

    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      "long evidence path caused narrow-layout overflow",
    );
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(directory, { recursive: true, force: true });
  }
});
