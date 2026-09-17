import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { approveArchitectureDocsLedger } from "../src/architecture-docs/approval.mjs";
import { buildArchitectureDocs } from "../src/architecture-docs/index.mjs";
import { checkArchitectureDocs } from "../src/architecture-docs/checker.mjs";
import { checkFinalSite } from "../src/architecture-docs/site-checker.mjs";
import { ArchitectureDocsConfigurationError } from "../src/architecture-docs/errors.mjs";
import { markdownToHtml } from "../src/architecture-docs/page-source.mjs";

const fixture = path.resolve("test/fixtures/architecture-docs");
const managedFixture = path.resolve("test/fixtures/architecture-docs-archie-managed");
function statusSnapshot() { return { kind: "archie-architecture-status", version: 1, repository: { name: "Fixture Docs", revision: { commit: "fixture-revision", workingTree: "clean" } }, generatedAt: "2026-01-01T00:00:00.000Z", freshnessPolicy: { maxAgeSeconds: 86400 }, checks: [{ id: "fixture-check", title: "Fixture check", authority: "fixture owner", resultMeaning: "Target-owned meaning", limits: [], execution: { state: "not-run", reason: "disabled" }, result: { state: "unknown", reason: "not-collected" }, evidence: { state: "missing", reason: "not-collected" }, freshness: { state: "unknown", reasons: ["evidence-missing"] } }] }; }

async function addViewlessPage(directory, configPath) {
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
}

async function composeFinalSite(directory) {
  const site = path.join(directory, "site");
  const handoff = path.join(directory, "handoff");
  const pageMap = JSON.parse(await readFile(path.join(handoff, "page-map.json"), "utf8"));
  const pages = [pageMap.home, ...pageMap.areas];
  await mkdir(path.join(site, "assets"), { recursive: true });
  await cp(path.join(handoff, "assets/views.json"), path.join(site, "assets/views.json"));
  const navigation = pages.map((candidate) => `<a href="${candidate.id === pageMap.home.id ? "index.html" : `${candidate.slug}/index.html`}">${candidate.title}</a>`).join(" · ");
  for (const page of pages) {
    const route = page.id === pageMap.home.id ? "index.html" : path.join(page.slug, "index.html");
    const filename = path.join(site, route);
    await mkdir(path.dirname(filename), { recursive: true });
    const markdown = await readFile(path.join(handoff, page.markdown), "utf8");
    const pageHtml = markdownToHtml(markdown, { preserveArchieMarkers: page.id === "archie" });
    const hasViews = page.viewIds.length > 0;
    const viewMarkup = hasViews
      ? `<label for="view-select">Architecture view</label><select id="view-select">${page.viewIds.map((viewId) => `<option>${viewId}</option>`).join("")}</select><div class="ds-scroll-x" tabindex="0" role="region" aria-label="Scrollable architecture diagram"><likec4-view view-id="${page.initialViewId}" browser="true"></likec4-view></div>`
      : "";
    await writeFile(filename, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${page.title}</title><style>body{font:16px system-ui;max-width:72rem;margin:auto;padding:2rem;background:#f7f5ef;color:#17211d}nav{display:flex;gap:1rem;flex-wrap:wrap}main{max-width:52rem}a{color:#205c49}a:focus,button:focus,select:focus{outline:3px solid #06c;outline-offset:3px}.ds-scroll-x{overflow:auto;padding:1rem;border:1px solid #c7d2cc}@media(prefers-color-scheme:dark){body{background:#111713;color:#f4f1e8}}@media print{nav,button,select,.ds-scroll-x{display:none}}</style></head><body${hasViews ? ` data-view-ids="${page.viewIds.join(",")}" data-initial-view="${page.initialViewId}"` : ""}><a href="#main">Skip to content</a><header><p>Architecture docs</p><nav aria-label="Architecture documentation pages">${navigation}</nav><div aria-label="Theme"><button type="button">System</button><button type="button">Light</button><button type="button">Dark</button></div></header><main id="main"><h1>${page.title}</h1><p>${page.summary}</p><article>${pageHtml}</article>${viewMarkup}</main></body></html>`);
  }
  const manifest = JSON.parse(await readFile(path.join(directory, "handoff/manifest.json"), "utf8"));
  await writeFile(path.join(site, "assets/architecture-handoff.json"), `${JSON.stringify({ ownership: { product: "html-design", generated: true }, architectureHandoffDigest: manifest.digests.handoff, architectureHandoffSchema: manifest.version })}\n`);
  return site;
}

async function setupManaged(markerCase = "complete") {
  const directory = await mkdtemp(path.join(process.cwd(), ".tmp-managed-site-"));
  await cp(managedFixture, directory, { recursive: true });
  const configPath = path.join(directory, "architecture-docs.config.json");
  const pagePath = path.join(directory, "pages/archie.md");
  let page = await readFile(pagePath, "utf8");
  if (markerCase === "missing") page = page.replace("<!-- archie-topic:stewardship -->\n", "");
  if (markerCase === "duplicate") page += "<!-- archie-topic:stewardship -->\n";
  if (markerCase === "stale") page = page.replace("archie-guide:v1", "archie-guide:v0");
  await writeFile(pagePath, page);
  const config = JSON.parse(await readFile(configPath, "utf8"));
  await approveArchitectureDocsLedger(path.join(directory, "evidence/claims.json"), { claimIds: ["purpose", "runtime", "archie-guidance"], pages: [config.pages.home, ...config.pages.areas], reviewer: "maintainer@example.test" });
  await buildArchitectureDocs(configPath);
  const site = await composeFinalSite(directory);
  return { directory, config: configPath, site };
}

test("publication validates a final-site handoff receipt without modifying site", async () => {
  const directory = await mkdtemp(path.join(process.cwd(), ".tmp-receipt-"));
  try {
    await cp(fixture, directory, { recursive: true });
    const config = path.join(directory, "architecture-docs.config.json");
    await buildArchitectureDocs(config);
    const manifest = JSON.parse(await readFile(path.join(directory, "handoff/manifest.json"), "utf8"));
    const site = path.join(directory, "site");
    await mkdir(path.join(site, "assets"), { recursive: true });
    const receipt = { ownership: { product: "html-design", generated: true, markerVersion: 1 }, architectureHandoffDigest: manifest.digests.handoff, architectureHandoffSchema: manifest.version };
    await writeFile(path.join(site, "assets/architecture-handoff.json"), `${JSON.stringify(receipt)}\n`);
    await writeFile(path.join(site, "owned-by-html-design"), "keep\n");
    const report = await checkArchitectureDocs(config, { mode: "publication" });
    assert.ok(!report.diagnostics.some((entry) => entry.path.startsWith("$.site.receipt")));
    assert.equal(await readFile(path.join(site, "owned-by-html-design"), "utf8"), "keep\n");
    receipt.architectureHandoffDigest = "stale";
    await writeFile(path.join(site, "assets/architecture-handoff.json"), `${JSON.stringify(receipt)}\n`);
    const stale = await checkArchitectureDocs(config, { mode: "publication" });
    assert.ok(stale.diagnostics.some((entry) => entry.path === "$.site.receipt.architectureHandoffDigest"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("final-site checks validate every route against its page-map views", async () => {
  const directory = await mkdtemp(path.join(process.cwd(), ".tmp-site-check-"));
  try {
    await cp(fixture, directory, { recursive: true });
    const config = path.join(directory, "architecture-docs.config.json");
    await buildArchitectureDocs(config);
    const site = path.join(directory, "site");
    await cp(path.join(directory, "preview"), site, { recursive: true });
    const home = path.join(site, "index.html");
    const runtime = path.join(site, "runtime/index.html");
    await writeFile(home, (await readFile(home, "utf8"))
      .replace('<body class="ds-rail-document ds-ambient-field">', '<body class="ds-rail-document" data-view-ids="systemContext" data-initial-view="systemContext">')
      .replace('id="architecture-view-select"', 'id="view-select"'));
    await writeFile(runtime, (await readFile(runtime, "utf8"))
      .replace('<body class="ds-rail-document ds-ambient-field">', '<body class="ds-rail-document" data-view-ids="containers,components" data-initial-view="containers">')
      .replace('id="architecture-view-select"', 'id="view-select"'));
    const manifest = JSON.parse(await readFile(path.join(directory, "handoff/manifest.json"), "utf8"));
    await writeFile(path.join(site, "assets/architecture-handoff.json"), `${JSON.stringify({ ownership: { product: "html-design", generated: true }, architectureHandoffDigest: manifest.digests.handoff, architectureHandoffSchema: manifest.version })}\n`);
    const report = await checkFinalSite(config);
    assert.equal(report.ok, true, report.diagnostics.map((entry) => entry.message).join("\n"));
    assert.deepEqual(report.warnings, []);
    assert.equal(report.warningCount, 0);
    await writeFile(runtime, (await readFile(runtime, "utf8")).replace('data-initial-view="containers"', 'data-initial-view="components"'));
    const mismatch = await checkFinalSite(config);
    assert.ok(mismatch.diagnostics.some((entry) => entry.code === "SITE_INITIAL_VIEW_MISMATCH"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("final-site checks report complete, missing, duplicate, and stale Archie markers without blocking", async () => {
  const cases = [
    ["complete", []],
    ["missing", ["ARCHIE_MARKER_MISSING"]],
    ["duplicate", ["ARCHIE_MARKER_DUPLICATE"]],
    ["stale", ["ARCHIE_GUIDE_VERSION_MISMATCH"]],
  ];
  for (const [markerCase, expectedCodes] of cases) {
    const temporary = await setupManaged(markerCase);
    try {
      const report = await checkFinalSite(temporary.config);
      assert.equal(report.ok, true, `${markerCase}: ${report.diagnostics.map(({ message }) => message).join("\n")}`);
      assert.deepEqual(report.warnings.map(({ code }) => code), expectedCodes, markerCase);
      assert.equal(report.warningCount, expectedCodes.length);
      if (markerCase === "complete") {
        const finalHtml = await readFile(path.join(temporary.site, "archie/index.html"), "utf8");
        assert.match(finalHtml, /<!-- archie-guide:v1 -->/);
        assert.match(finalHtml, /<!-- archie-capability:architecture-docs:start -->/);
      }
    } finally { await rm(temporary.directory, { recursive: true, force: true }); }
  }
});

test("final-site checks reject installed duplicate Archie IDs and slugs during config loading", async () => {
  const temporary = await setupManaged();
  try {
    const config = JSON.parse(await readFile(temporary.config, "utf8"));
    config.pages.areas.push({ ...config.pages.areas.at(-1) });
    await writeFile(temporary.config, JSON.stringify(config));

    await assert.rejects(checkFinalSite(temporary.config), (error) => error instanceof ArchitectureDocsConfigurationError
      && error.issues.some((issue) => issue.message === "contains duplicate page IDs")
      && error.issues.some((issue) => issue.message === "contains duplicate page slugs"));

    const checked = spawnSync(process.execPath, ["scripts/check-site.mjs", "--config", temporary.config], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(checked.status, 1, `${checked.stdout}\n${checked.stderr}`);
    assert.match(checked.stderr, /CONFIGURATION_INVALID:/);
    assert.doesNotMatch(`${checked.stdout}\n${checked.stderr}`, /ARCHIE_AREA_DUPLICATE|Final site contract passed/);
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("preview and final-site Archie checks read the configured area slug", async () => {
  const temporary = await setupManaged();
  try {
    const config = JSON.parse(await readFile(temporary.config, "utf8"));
    config.pages.areas.at(-1).slug = "assistant";
    await writeFile(temporary.config, JSON.stringify(config));
    await rename(path.join(temporary.directory, "preview/archie"), path.join(temporary.directory, "preview/assistant"));
    await rename(path.join(temporary.site, "archie"), path.join(temporary.site, "assistant"));

    const preview = await checkArchitectureDocs(temporary.config, { mode: "preview" });
    assert.deepEqual(preview.warnings.map(({ code }) => code), ["ARCHIE_AREA_METADATA_INVALID"]);
    const finalSite = await checkFinalSite(temporary.config);
    assert.equal(finalSite.ok, true, finalSite.diagnostics.map(({ message }) => message).join("\\n"));
    assert.deepEqual(finalSite.warnings.map(({ code }) => code), ["ARCHIE_AREA_METADATA_INVALID"]);
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("the final-site CLI prints warning codes and keeps diagnostics as the exit source", async () => {
  const temporary = await setupManaged("missing");
  try {
    const warningOnly = spawnSync(process.execPath, ["scripts/check-site.mjs", "--config", temporary.config], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(warningOnly.status, 0, `${warningOnly.stdout}\n${warningOnly.stderr}`);
    assert.match(`${warningOnly.stdout}\n${warningOnly.stderr}`, /warning ARCHIE_MARKER_MISSING:/);

    await rm(path.join(temporary.site, "runtime"), { recursive: true, force: true });
    const report = await checkFinalSite(temporary.config);
    assert.equal(report.ok, false);
    assert.deepEqual(report.warnings.map(({ code }) => code), ["ARCHIE_MARKER_MISSING"]);
    const blocked = spawnSync(process.execPath, ["scripts/check-site.mjs", "--config", temporary.config], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(blocked.status, 1, `${blocked.stdout}\n${blocked.stderr}`);
    assert.match(`${blocked.stdout}\n${blocked.stderr}`, /warning ARCHIE_MARKER_MISSING:/);
    assert.match(blocked.stdout, /final site route runtime\/index\.html is missing/);
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("final-site status checks require handoff v2 and its matching generated page record", async () => {
  const directory = await mkdtemp(path.join(process.cwd(), ".tmp-status-site-check-"));
  try {
    await cp(fixture, directory, { recursive: true });
    const config = path.join(directory, "architecture-docs.config.json");
    const configValue = JSON.parse(await readFile(config, "utf8"));
    configValue.architectureStatus = { snapshot: "status.json" };
    await writeFile(config, JSON.stringify(configValue));
    await buildArchitectureDocs(config);
    const site = path.join(directory, "site");
    await cp(path.join(directory, "preview"), site, { recursive: true });
    for (const [route, viewIds, initialView] of [["index.html", "systemContext", "systemContext"], ["runtime/index.html", "containers,components", "containers"]]) {
      const filename = path.join(site, route);
      await writeFile(filename, (await readFile(filename, "utf8"))
        .replace('<body class="ds-rail-document ds-ambient-field">', `<body class="ds-rail-document" data-view-ids="${viewIds}" data-initial-view="${initialView}">`)
        .replace('id="architecture-view-select"', 'id="view-select"'));
    }
    const handoff = path.join(directory, "handoff");
    const manifest = JSON.parse(await readFile(path.join(handoff, "manifest.json"), "utf8"));
    await writeFile(path.join(site, "assets/architecture-handoff.json"), `${JSON.stringify({ ownership: { product: "html-design", generated: true }, architectureHandoffDigest: manifest.digests.handoff, architectureHandoffSchema: manifest.version })}\n`);
    assert.equal((await checkFinalSite(config)).ok, true);

    const pageMapPath = path.join(handoff, "page-map.json");
    const pageMap = JSON.parse(await readFile(pageMapPath, "utf8"));
    pageMap.status.availability = "present";
    await writeFile(pageMapPath, `${JSON.stringify(pageMap)}\n`);
    const pageMapMismatch = await checkFinalSite(config);
    assert.ok(pageMapMismatch.diagnostics.some((entry) => entry.code === "SITE_STATUS_PAGE_MAP_MISMATCH"));

    manifest.version = 1;
    await writeFile(path.join(handoff, "manifest.json"), `${JSON.stringify(manifest)}\n`);
    const versionMismatch = await checkFinalSite(config);
    assert.ok(versionMismatch.diagnostics.some((entry) => entry.code === "SITE_STATUS_HANDOFF_VERSION_MISMATCH"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("final-site checks reject a valid status snapshot mutated after handoff", async () => {
  const directory = await mkdtemp(path.join(process.cwd(), ".tmp-status-freshness-"));
  try {
    await cp(fixture, directory, { recursive: true });
    const config = path.join(directory, "architecture-docs.config.json");
    const configValue = JSON.parse(await readFile(config, "utf8"));
    configValue.architectureStatus = { snapshot: "status.json" };
    await writeFile(config, JSON.stringify(configValue));
    await writeFile(path.join(directory, "status.json"), `${JSON.stringify(statusSnapshot(), null, 2)}\n`);
    await buildArchitectureDocs(config);
    const site = path.join(directory, "site");
    await cp(path.join(directory, "preview"), site, { recursive: true });
    for (const [route, viewIds, initialView] of [["index.html", "systemContext", "systemContext"], ["runtime/index.html", "containers,components", "containers"]]) {
      const filename = path.join(site, route);
      await writeFile(filename, (await readFile(filename, "utf8"))
        .replace('<body class="ds-rail-document ds-ambient-field">', `<body class="ds-rail-document" data-view-ids="${viewIds}" data-initial-view="${initialView}">`)
        .replace('id="architecture-view-select"', 'id="view-select"'));
    }
    const manifest = JSON.parse(await readFile(path.join(directory, "handoff/manifest.json"), "utf8"));
    await writeFile(path.join(site, "assets/architecture-handoff.json"), `${JSON.stringify({ ownership: { product: "html-design", generated: true }, architectureHandoffDigest: manifest.digests.handoff, architectureHandoffSchema: manifest.version })}\n`);
    assert.equal((await checkFinalSite(config)).ok, true);

    const changed = statusSnapshot();
    changed.checks[0].title = "Changed after handoff";
    await writeFile(path.join(directory, "status.json"), `${JSON.stringify(changed, null, 2)}\n`);
    const stale = await checkFinalSite(config);
    assert.ok(stale.diagnostics.some((entry) => entry.code === "SITE_STALE" && entry.path === "$.handoff.digests.architectureStatus"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("final-site checks allow a route with no declared architecture views", async () => {
  const directory = await mkdtemp(path.join(process.cwd(), ".tmp-viewless-site-"));
  try {
    await cp(fixture, directory, { recursive: true });
    const config = path.join(directory, "architecture-docs.config.json");
    await addViewlessPage(directory, config);
    await buildArchitectureDocs(config);
    const site = path.join(directory, "site");
    await cp(path.join(directory, "preview"), site, { recursive: true });
    for (const [route, viewIds, initialView] of [["index.html", "systemContext", "systemContext"], ["runtime/index.html", "containers,components", "containers"]]) {
      const filename = path.join(site, route);
      await writeFile(filename, (await readFile(filename, "utf8"))
        .replace('<body class="ds-rail-document ds-ambient-field">', `<body class="ds-rail-document" data-view-ids="${viewIds}" data-initial-view="${initialView}">`)
        .replace('id="architecture-view-select"', 'id="view-select"'));
    }
    const manifest = JSON.parse(await readFile(path.join(directory, "handoff/manifest.json"), "utf8"));
    await writeFile(path.join(site, "assets/architecture-handoff.json"), `${JSON.stringify({ ownership: { product: "html-design", generated: true }, architectureHandoffDigest: manifest.digests.handoff, architectureHandoffSchema: manifest.version })}\n`);
    const report = await checkFinalSite(config);
    assert.equal(report.ok, true, report.diagnostics.map((entry) => entry.message).join("\n"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
