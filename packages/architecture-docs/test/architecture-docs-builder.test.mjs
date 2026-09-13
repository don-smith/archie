import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { buildArchitectureDocs } from "../src/architecture-docs/index.mjs";
import { ArchitectureDocsBuildError } from "../src/architecture-docs/errors.mjs";

const fixture = path.resolve("test/fixtures/architecture-docs");
async function copyFixture() { const directory = await mkdtemp(path.join(process.cwd(), ".tmp-builder-")); await cp(fixture, directory, { recursive: true }); await rm(path.join(directory, "preview"), { recursive: true, force: true }); return { directory, config: path.join(directory, "architecture-docs.config.json"), root: directory, output: path.join(directory, "preview"), finalSite: path.join(directory, "site") }; }

test("builds ordered preview routes and a self-contained handoff", async () => {
  const temporary = await copyFixture();
  try {
    const result = await buildArchitectureDocs(temporary.config);
    assert.equal(result.pageCount, 2); assert.deepEqual(result.generatedFiles.slice(0, 2), ["index.html", "runtime/index.html"]);
    const homePreview = await readFile(path.join(temporary.output, "index.html"), "utf8");
    assert.match(homePreview, /Orientation/);
    assert.doesNotMatch(homePreview, /ds-section-lead__summary">A safe orientation\.<\/p>/, "the generated reading guide must not repeat the hero summary");
    assert.doesNotMatch(homePreview, /id="prose-title"/, "the generated reading guide must not duplicate the page title");
    assert.match(await readFile(path.join(temporary.output, "runtime/index.html"), "utf8"), /Runtime/);
    assert.match(await readFile(path.join(temporary.output, "assets/preview.json"), "utf8"), /"product": "architecture-docs"/);
    assert.equal(result.handoffDirectory, path.join(temporary.root, "handoff"));
    const handoffManifest = JSON.parse(await readFile(path.join(temporary.root, "handoff/manifest.json"), "utf8"));
    const pageMap = JSON.parse(await readFile(path.join(temporary.root, "handoff/page-map.json"), "utf8"));
    const claims = JSON.parse(await readFile(path.join(temporary.root, "handoff/claims.json"), "utf8"));
    assert.equal(handoffManifest.ownership.artifact, "handoff");
    assert.equal(handoffManifest.files.views, "assets/views.json");
    assert.equal(pageMap.home.markdown, "pages/home.md");
    assert.equal(pageMap.home.initialViewId, "systemContext");
    assert.equal(pageMap.areas[0].markdown, "pages/runtime.md");
    assert.equal(pageMap.areas[0].initialViewId, "containers");
    assert.equal(claims.claims.length, 2);
    assert.match(await readFile(path.join(temporary.root, "handoff/assets/likec4-views.js"), "utf8"), /likec4/);
    assert.match(await readFile(path.join(temporary.root, "handoff/composition-guide.md"), "utf8"), /site\/assets\/architecture-handoff\.json/);
    assert.equal(JSON.parse(await readFile(path.join(temporary.root, "handoff/delta.json"), "utf8")).kind, "baseline");
    assert.equal(await readFile(path.join(temporary.root, "handoff/pages/home.md"), "utf8"), "# Orientation\n\nA safe orientation.\n");
    assert.equal(await readFile(path.join(temporary.root, "pages/home.md"), "utf8"), "# Orientation\n\nA safe orientation.\n");
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("builds a viewless page without an interactive model section", async () => {
  const temporary = await copyFixture();
  try {
    const config = JSON.parse(await readFile(temporary.config, "utf8"));
    config.pages.areas.push({
      id: "glossary",
      slug: "glossary",
      title: "Glossary",
      summary: "Terms for readers.",
      markdown: "pages/glossary.md",
      viewIds: [],
      claimIds: [],
    });
    await writeFile(path.join(temporary.root, "pages/glossary.md"), "# Terms\n\nA concise vocabulary.\n");
    await writeFile(temporary.config, JSON.stringify(config));

    await buildArchitectureDocs(temporary.config);

    const pageMap = JSON.parse(await readFile(path.join(temporary.root, "handoff/page-map.json"), "utf8"));
    const preview = await readFile(path.join(temporary.output, "glossary/index.html"), "utf8");
    assert.deepEqual(pageMap.areas.at(-1).viewIds, []);
    assert.equal(pageMap.areas.at(-1).initialViewId, null);
    assert.doesNotMatch(preview, /id="explore"/);
    assert.doesNotMatch(preview, /<likec4-view\b/);
    assert.doesNotMatch(preview, /architecture-docs-data/);
    const htmlCheck = spawnSync(process.execPath, ["scripts/check-html.mjs", "--config", temporary.config], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(htmlCheck.status, 0, `${htmlCheck.stdout}\n${htmlCheck.stderr}`);
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("copies opaque supplemental input bytes into the self-describing handoff", async () => {
  const temporary = await copyFixture();
  try {
    const sourceBytes = Buffer.from([0, 255, 10, 13]);
    await writeFile(path.join(temporary.directory, "checks.bin"), sourceBytes);
    const config = JSON.parse(await readFile(temporary.config, "utf8"));
    config.supplementalInputs = [{ id: "checks", source: "checks.bin", destination: "supplemental/checks.bin" }];
    await writeFile(temporary.config, JSON.stringify(config));

    await buildArchitectureDocs(temporary.config);
    const manifest = JSON.parse(await readFile(path.join(temporary.root, "handoff/manifest.json"), "utf8"));
    assert.deepEqual(await readFile(path.join(temporary.root, "handoff/supplemental/checks.bin")), sourceBytes);
    assert.deepEqual(manifest.supplementalInputs, [{
      id: "checks",
      source: "checks.bin",
      destination: "supplemental/checks.bin",
      sha256: "f474676c75e488e84e18f37502e7fc3e7b8850471fae5251290ff6cc4c8843bc",
    }]);
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("compile or Markdown failure leaves the previously generated site and authored siblings intact", async () => {
  const temporary = await copyFixture();
  try {
    await buildArchitectureDocs(temporary.config);
    const before = await readFile(path.join(temporary.output, "index.html"), "utf8");
    const handoffBefore = await readFile(path.join(temporary.root, "handoff/manifest.json"), "utf8");
    await writeFile(path.join(temporary.root, "pages/home.md"), "[unsafe](javascript:alert(1))");
    await assert.rejects(buildArchitectureDocs(temporary.config), (error) => error instanceof ArchitectureDocsBuildError && error.code === "MARKDOWN_INVALID");
    assert.equal(await readFile(path.join(temporary.output, "index.html"), "utf8"), before);
    assert.equal(await readFile(path.join(temporary.root, "handoff/manifest.json"), "utf8"), handoffBefore);
    assert.equal(await readFile(path.join(temporary.root, "model/model.c4"), "utf8").then(Boolean), true);
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("an unmarked existing preview is never force-overwritten", async () => {
  const temporary = await copyFixture();
  try {
    await mkdir(temporary.output, { recursive: true }); await writeFile(path.join(temporary.output, "authored.txt"), "keep");
    await assert.rejects(buildArchitectureDocs(temporary.config), (error) => error.code === "OUTPUT_NOT_OWNED");
    assert.equal(await readFile(path.join(temporary.output, "authored.txt"), "utf8"), "keep");
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("an existing final site is untouched by both build modes", async () => {
  const temporary = await copyFixture();
  try {
    await mkdir(temporary.finalSite, { recursive: true }); await writeFile(path.join(temporary.finalSite, "html-design-marker"), "keep");
    await buildArchitectureDocs(temporary.config);
    await buildArchitectureDocs(temporary.config, { handoffOnly: true });
    assert.equal(await readFile(path.join(temporary.finalSite, "html-design-marker"), "utf8"), "keep");
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("an unmarked existing handoff is never force-overwritten", async () => {
  const temporary = await copyFixture();
  try {
    const handoff = path.join(temporary.root, "handoff");
    await mkdir(handoff, { recursive: true }); await writeFile(path.join(handoff, "authored.txt"), "keep");
    await assert.rejects(buildArchitectureDocs(temporary.config), (error) => error.code === "OUTPUT_NOT_OWNED");
    assert.equal(await readFile(path.join(handoff, "authored.txt"), "utf8"), "keep");
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});
