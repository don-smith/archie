import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const importId = "architecture-docs-and-likec4";
const assetRoot = "packages/capabilities/assets/architecture-docs";
const router = path.resolve(assetRoot, "bin/architecture-docs.mjs");
const managedFixture = path.resolve("test/fixtures/architecture-docs-managed-site");

function architectureDocsImport(manifest) {
  const importedSource = manifest.imports.find((item) => item.id === importId);
  assert.ok(importedSource, `${manifest.format} must record ${importId}`);
  return importedSource;
}

test("every Architecture Docs router command has an imported script", () => {
  const router = readFileSync(`${assetRoot}/bin/architecture-docs.mjs`, "utf8");
  const commandTable = router.match(/const commandScripts = \{([\s\S]*?)\n\};/);
  assert.ok(commandTable, "Architecture Docs router must declare commandScripts");

  const scripts = [...commandTable[1].matchAll(/:\s*"([^"]+\.mjs)"/g)].map((match) => match[1]);
  assert.ok(scripts.length > 0, "Architecture Docs router must advertise script-backed commands");
  for (const script of scripts) {
    assert.ok(existsSync(`${assetRoot}/scripts/${script}`), `missing imported router script: ${script}`);
  }
});

test("Architecture Docs import receipt matches its source record", () => {
  const sourceManifest = JSON.parse(readFileSync("source-import-manifest.json", "utf8"));
  const importReceipt = JSON.parse(readFileSync("packages/capabilities/assets/IMPORTS.json", "utf8"));
  const source = architectureDocsImport(sourceManifest);
  const receipt = architectureDocsImport(importReceipt);

  assert.equal(receipt.revision, source.revision);
  assert.deepEqual(receipt.paths, source.paths);
});

function filesBelow(directory, root = directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(filename, root) : [[path.relative(root, filename), readFileSync(filename)]];
  });
}

function siteSnapshot(scenario) {
  const directory = path.join(managedFixture, scenario, "site");
  return new Map(filesBelow(directory).map(([filename, bytes]) => {
    const stats = statSync(path.join(directory, filename), { bigint: true });
    return [filename, { bytes: bytes.toString("base64"), modified: stats.mtimeNs }];
  }));
}

function checkSite(config) {
  return spawnSync(process.execPath, [router, "check:site", "--config", path.join(managedFixture, config)], {
    cwd: managedFixture,
    encoding: "utf8",
  });
}

test("managed fixture preserves configured Archie handoff order and authored content", () => {
  const config = JSON.parse(readFileSync(path.join(managedFixture, "architecture-docs.config.json"), "utf8"));
  const pageMap = JSON.parse(readFileSync(path.join(managedFixture, "complete/handoff/page-map.json"), "utf8"));
  assert.deepEqual(config.pages.areas.map(({ id }) => id), ["repository", "archie"]);
  assert.deepEqual(pageMap.areas.map(({ id }) => id), ["repository", "archie"]);
  assert.deepEqual(pageMap.areas[1], {
    id: "archie",
    title: "Archie",
    summary: "How this repository works with Archie.",
    markdown: "pages/archie.md",
    viewIds: [],
    claimIds: ["archie-guidance"],
    initialViewId: null,
    slug: "archie",
  });
  const authoredArchie = readFileSync(path.join(managedFixture, "complete/pages/archie.md"), "utf8");
  const handoffArchie = readFileSync(path.join(managedFixture, "complete/handoff/pages/archie.md"), "utf8");
  assert.equal(handoffArchie, authoredArchie);
  assert.match(authoredArchie, /Conformance onboarding can produce an observed TypeScript import graph/);
  const previewArchie = readFileSync(path.join(managedFixture, "complete/preview/archie/index.html"), "utf8");
  assert.match(previewArchie, /Conformance onboarding can produce an observed TypeScript import graph/);
  assert.ok(existsSync(path.join(managedFixture, "complete/preview/archie/index.html")));
  const finalArchie = readFileSync(path.join(managedFixture, "complete/site/archie/index.html"), "utf8");
  assert.match(finalArchie, /<nav aria-label="Architecture documentation pages">/);
  assert.match(finalArchie, /Conformance onboarding can produce an observed TypeScript import graph/);
  assert.match(finalArchie, /<h3>Assessment<\/h3>/);
  assert.match(finalArchie, /Conformance onboarding/);
  assert.match(finalArchie, /Structural inspection/);
  assert.match(finalArchie, /target-local <code>architecture-conformance<\/code>/);
  assert.match(finalArchie, /@media print/);
  assert.match(finalArchie, /data-theme-choice="dark" aria-pressed="false"/);
  assert.match(finalArchie, /root\.dataset\.theme = choice/);
  assert.match(finalArchie, /--text:#111/);
  for (const scenario of ["complete", "missing-marker", "warning-diagnostic"]) {
    const receipt = JSON.parse(readFileSync(path.join(managedFixture, scenario, "site/assets/architecture-handoff.json"), "utf8"));
    assert.deepEqual(receipt.ownership, { product: "html-design", generated: true });
  }
});

test("imported check:site preserves warning-only and blocking exit behavior without writing site", () => {
  const scenarios = ["complete", "missing-marker", "warning-diagnostic"];
  const before = Object.fromEntries(scenarios.map((scenario) => [scenario, siteSnapshot(scenario)]));

  const complete = checkSite("architecture-docs.config.json");
  assert.equal(complete.status, 0, `${complete.stdout}\n${complete.stderr}`);
  assert.match(complete.stdout, /Final site contract passed for 3 pages\./);
  assert.doesNotMatch(`${complete.stdout}\n${complete.stderr}`, /warning ARCHIE_/);

  const warning = checkSite("architecture-docs-missing-marker.config.json");
  assert.equal(warning.status, 0, `${warning.stdout}\n${warning.stderr}`);
  assert.match(`${warning.stdout}\n${warning.stderr}`, /warning ARCHIE_MARKER_MISSING:/);
  assert.match(warning.stdout, /Final site contract passed for 3 pages\./);

  const blocked = checkSite("architecture-docs-warning-diagnostic.config.json");
  assert.equal(blocked.status, 1, `${blocked.stdout}\n${blocked.stderr}`);
  assert.match(`${blocked.stdout}\n${blocked.stderr}`, /warning ARCHIE_MARKER_MISSING:/);
  assert.match(blocked.stdout, /final site route repository\/index\.html is missing/);

  for (const scenario of scenarios) assert.deepEqual(siteSnapshot(scenario), before[scenario], `check:site wrote ${scenario}/site`);
});
