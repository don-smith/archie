import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { buildArchitectureDocs } from "../src/architecture-docs/index.mjs";
import { checkArchitectureDocs } from "../src/architecture-docs/checker.mjs";
import { checkFinalSite } from "../src/architecture-docs/site-checker.mjs";

const fixture = path.resolve("test/fixtures/architecture-docs");

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
    await writeFile(runtime, (await readFile(runtime, "utf8")).replace('data-initial-view="containers"', 'data-initial-view="components"'));
    const mismatch = await checkFinalSite(config);
    assert.ok(mismatch.diagnostics.some((entry) => entry.code === "SITE_INITIAL_VIEW_MISMATCH"));
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
