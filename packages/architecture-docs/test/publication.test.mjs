import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { approveArchitectureDocsLedger } from "../src/architecture-docs/approval.mjs";
import { buildArchitectureDocs } from "../src/architecture-docs/index.mjs";
import { assertPublication, checkArchitectureDocs } from "../src/architecture-docs/checker.mjs";
import { pageMapDigest } from "../src/architecture-docs/evidence-ledger.mjs";
import { ArchitectureDocsConfigurationError } from "../src/architecture-docs/errors.mjs";

const fixture = path.resolve("test/fixtures/architecture-docs");
const managedFixture = path.resolve("test/fixtures/architecture-docs-archie-managed");
async function setup() { const directory = await mkdtemp(path.join(process.cwd(), ".tmp-publication-")); await cp(fixture, directory, { recursive: true }); return { directory, config: path.join(directory, "architecture-docs.config.json"), ledger: path.join(directory, "evidence/claims.json") }; }
async function setupManaged(markerCase = "complete", { status = false } = {}) {
  const directory = await mkdtemp(path.join(process.cwd(), ".tmp-managed-publication-"));
  await cp(managedFixture, directory, { recursive: true });
  const configPath = path.join(directory, "architecture-docs.config.json");
  const pagePath = path.join(directory, "pages/archie.md");
  let page = await readFile(pagePath, "utf8");
  if (markerCase === "missing") page = page.replace("<!-- archie-topic:stewardship -->\n", "");
  if (markerCase === "duplicate") page += "<!-- archie-topic:stewardship -->\n";
  if (markerCase === "stale") page = page.replace("archie-guide:v1", "archie-guide:v0");
  await writeFile(pagePath, page);
  const config = JSON.parse(await readFile(configPath, "utf8"));
  if (status) {
    config.architectureStatus = { snapshot: "status.json" };
    await writeFile(configPath, JSON.stringify(config));
    const snapshot = statusSnapshot();
    snapshot.repository.name = config.repository.name;
    await writeFile(path.join(directory, "status.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
  }
  const pages = [config.pages.home, ...config.pages.areas];
  await approveArchitectureDocsLedger(path.join(directory, "evidence/claims.json"), { claimIds: ["purpose", "runtime", "archie-guidance"], pages, reviewer: "maintainer@example.test" });
  await buildArchitectureDocs(configPath);
  return { directory, config: configPath };
}
function statusSnapshot() { return { kind: "archie-architecture-status", version: 1, repository: { name: "Fixture Docs", revision: { commit: "fixture-revision", workingTree: "clean" } }, generatedAt: "2026-01-01T00:00:00.000Z", freshnessPolicy: { maxAgeSeconds: 86400 }, checks: [{ id: "fixture-check", title: "Fixture check", authority: "fixture owner", resultMeaning: "Target-owned meaning", limits: [], execution: { state: "not-run", reason: "disabled" }, result: { state: "unknown", reason: "not-collected" }, evidence: { state: "missing", reason: "not-collected" }, freshness: { state: "unknown", reasons: ["evidence-missing"] } }] }; }

test("preview accepts provisional claims and reports the current page-map digest", async () => {
  const temporary = await setup();
  try {
    await buildArchitectureDocs(temporary.config);
    const report = await checkArchitectureDocs(temporary.config, { mode: "preview" });
    assert.equal(report.ok, true); assert.deepEqual(report.warnings, []); assert.equal(report.warningCount, 0); assert.equal(report.provisionalClaimCount, 2); assert.equal(report.pageMapDigest, pageMapDigest([{ id: "home", title: "Orientation", summary: "A safe orientation.", markdown: "pages/home.md", viewIds: ["systemContext"], claimIds: ["purpose"], initialViewId: "systemContext" }, { id: "runtime", title: "Runtime", summary: "The worker area.", markdown: "pages/runtime.md", viewIds: ["containers", "components"], claimIds: ["runtime"], initialViewId: "containers", slug: "runtime" }]));
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("preview and publication report complete, missing, duplicate, and stale Archie markers as non-blocking warnings", async () => {
  const cases = [
    ["complete", []],
    ["missing", ["ARCHIE_MARKER_MISSING"]],
    ["duplicate", ["ARCHIE_MARKER_DUPLICATE"]],
    ["stale", ["ARCHIE_GUIDE_VERSION_MISMATCH"]],
  ];
  for (const [markerCase, expectedCodes] of cases) {
    const temporary = await setupManaged(markerCase);
    try {
      for (const mode of ["preview", "publication"]) {
        const report = await checkArchitectureDocs(temporary.config, { mode });
        assert.equal(report.ok, true, `${markerCase} ${mode}: ${report.diagnostics.map(({ message }) => message).join("\n")}`);
        assert.deepEqual(report.warnings.map(({ code }) => code), expectedCodes, `${markerCase} ${mode}`);
        assert.equal(report.warningCount, expectedCodes.length);
        assert.doesNotThrow(() => assertPublication(report));
      }
    } finally { await rm(temporary.directory, { recursive: true, force: true }); }
  }
});

test("preview and publication reject installed duplicate Archie IDs during config loading", async () => {
  const temporary = await setupManaged();
  try {
    const config = JSON.parse(await readFile(temporary.config, "utf8"));
    config.pages.areas.push({ ...config.pages.areas.at(-1), slug: "archie-copy" });
    await writeFile(temporary.config, JSON.stringify(config));

    for (const mode of ["preview", "publication"]) {
      await assert.rejects(checkArchitectureDocs(temporary.config, { mode }), (error) => error instanceof ArchitectureDocsConfigurationError
        && error.issues.some((issue) => issue.message === "contains duplicate page IDs"));
    }

    const checked = spawnSync(process.execPath, ["scripts/check-architecture-docs.mjs", "--config", temporary.config, "--mode", "publication"], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(checked.status, 1, `${checked.stdout}\n${checked.stderr}`);
    assert.match(checked.stderr, /CONFIGURATION_INVALID:/);
    assert.doesNotMatch(`${checked.stdout}\n${checked.stderr}`, /ARCHIE_AREA_DUPLICATE|Architecture docs publication checks passed/);
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("an Archie-managed site with architecture status keeps both generated contracts", async () => {
  for (const [markerCase, expectedCodes] of [["complete", []], ["missing", ["ARCHIE_MARKER_MISSING"]]]) {
    const temporary = await setupManaged(markerCase, { status: true });
    try {
      const handoff = path.join(temporary.directory, "handoff");
      const manifest = JSON.parse(await readFile(path.join(handoff, "manifest.json"), "utf8"));
      const pageMap = JSON.parse(await readFile(path.join(handoff, "page-map.json"), "utf8"));
      assert.equal(manifest.version, 2);
      assert.equal(manifest.files.architectureStatus, "architecture-status.json");
      assert.deepEqual(pageMap.areas.map(({ id }) => id), ["runtime", "archie"]);
      assert.equal(pageMap.status.availability, "present");

      assert.match(await readFile(path.join(temporary.directory, "preview/architecture-status/index.html"), "utf8"), /Fixture check/);
      const archiePreview = await readFile(path.join(temporary.directory, "preview/archie/index.html"), "utf8");
      if (markerCase === "complete") assert.match(archiePreview, /<!-- archie-guide:v1 -->/);

      const guide = await readFile(path.join(handoff, "composition-guide.md"), "utf8");
      assert.match(guide, /preserve all `archie-\*` comments from `pages\/archie\.md`/);
      assert.match(guide, /## Deterministic architecture status/);

      for (const mode of ["preview", "publication"]) {
        const report = await checkArchitectureDocs(temporary.config, { mode });
        assert.equal(report.ok, true, `${markerCase} ${mode}: ${report.diagnostics.map(({ message }) => message).join("\n")}`);
        assert.deepEqual(report.warnings.map(({ code }) => code), expectedCodes, `${markerCase} ${mode}`);
      }
    } finally { await rm(temporary.directory, { recursive: true, force: true }); }
  }
});

test("the architecture-docs CLI prints warning codes without making them blockers", async () => {
  const temporary = await setupManaged("missing");
  try {
    const warningOnly = spawnSync(process.execPath, ["scripts/check-architecture-docs.mjs", "--config", temporary.config, "--mode", "publication"], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(warningOnly.status, 0, `${warningOnly.stdout}\n${warningOnly.stderr}`);
    assert.match(`${warningOnly.stdout}\n${warningOnly.stderr}`, /warning ARCHIE_MARKER_MISSING:/);

    await rm(path.join(temporary.directory, "preview/runtime"), { recursive: true, force: true });
    const report = await checkArchitectureDocs(temporary.config, { mode: "publication" });
    assert.equal(report.ok, false);
    assert.deepEqual(report.warnings.map(({ code }) => code), ["ARCHIE_MARKER_MISSING"]);
    assert.throws(() => assertPublication(report), (error) => error.code === "PUBLICATION_CHECK_FAILED" && error.issues === report.diagnostics);
    const blocked = spawnSync(process.execPath, ["scripts/check-architecture-docs.mjs", "--config", temporary.config, "--mode", "publication"], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(blocked.status, 1, `${blocked.stdout}\n${blocked.stderr}`);
    assert.match(`${blocked.stdout}\n${blocked.stderr}`, /warning ARCHIE_MARKER_MISSING:/);
    assert.match(blocked.stderr, /generated preview route is missing/);
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("approval CLI keeps a rooted configuration's page-map review current", async () => {
  const directory = await mkdtemp(path.join(process.cwd(), ".tmp-rooted-approval-"));
  try {
    const authoredRoot = path.join(directory, "architecture");
    await cp(fixture, directory, { recursive: true });
    await cp(fixture, authoredRoot, { recursive: true });
    const configPath = path.join(directory, "architecture-docs.config.json");
    const config = JSON.parse(await readFile(path.join(authoredRoot, "architecture-docs.config.json"), "utf8"));
    config.root = "architecture";
    await writeFile(configPath, JSON.stringify(config));
    await buildArchitectureDocs(configPath);

    const approval = spawnSync(process.execPath, ["scripts/approve-architecture-docs.mjs", "--config", configPath, "--reviewer", "maintainer@example.test", "--claims", "purpose,runtime"], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(approval.status, 0, approval.stderr);
    const report = await checkArchitectureDocs(configPath, { mode: "publication" });
    assert.equal(report.diagnostics.some((entry) => entry.path === "$.pageMapReview"), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("publication allows a prose-only area page", async () => {
  const temporary = await setup();
  try {
    const config = JSON.parse(await readFile(temporary.config, "utf8"));
    config.pages.areas[0].viewIds = [];
    delete config.pages.areas[0].initialViewId;
    await writeFile(temporary.config, JSON.stringify(config));
    await buildArchitectureDocs(temporary.config);
    const pages = [config.pages.home, ...config.pages.areas];
    await approveArchitectureDocsLedger(temporary.ledger, { claimIds: ["purpose", "runtime"], pages, reviewer: "maintainer@example.test" });
    const report = await checkArchitectureDocs(temporary.config, { mode: "publication" });
    assert.equal(report.diagnostics.some((entry) => entry.path === "$.pages.areas[0].viewIds"), false);
    assert.deepEqual(report.warnings, []);
    assert.equal(report.warningCount, 0);
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("publication rejects a stale handoff after authored Markdown changes", async () => {
  const temporary = await setup();
  try {
    await buildArchitectureDocs(temporary.config);
    await writeFile(path.join(temporary.directory, "pages/home.md"), "# Changed narrative\\n");
    const report = await checkArchitectureDocs(temporary.config, { mode: "publication" });
    assert.ok(report.diagnostics.some((entry) => entry.code === "HANDOFF_STALE" && entry.path.includes("pages.home")));
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("publication rejects a valid status snapshot mutated after handoff", async () => {
  const temporary = await setup();
  try {
    const config = JSON.parse(await readFile(temporary.config, "utf8"));
    config.architectureStatus = { snapshot: "status.json" };
    await writeFile(temporary.config, JSON.stringify(config));
    await writeFile(path.join(temporary.directory, "status.json"), `${JSON.stringify(statusSnapshot(), null, 2)}\n`);
    await buildArchitectureDocs(temporary.config);

    const changed = statusSnapshot();
    changed.checks[0].title = "Changed after handoff";
    await writeFile(path.join(temporary.directory, "status.json"), `${JSON.stringify(changed, null, 2)}\n`);
    const report = await checkArchitectureDocs(temporary.config, { mode: "publication" });
    assert.ok(report.diagnostics.some((entry) => entry.code === "HANDOFF_STALE" && entry.path === "$.handoff.digests.architectureStatus"));
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("publication rejects changed supplemental bytes until a rebuild copies the current bytes", async () => {
  const temporary = await setup();
  try {
    await writeFile(path.join(temporary.directory, "checks.bin"), Buffer.from([0, 255, 10, 13]));
    const config = JSON.parse(await readFile(temporary.config, "utf8"));
    config.supplementalInputs = [{ id: "checks", source: "checks.bin", destination: "supplemental/checks.bin" }];
    await writeFile(temporary.config, JSON.stringify(config));
    await buildArchitectureDocs(temporary.config);

    await writeFile(path.join(temporary.directory, "checks.bin"), Buffer.from([1, 2, 3]));
    const stale = await checkArchitectureDocs(temporary.config, { mode: "publication" });
    assert.ok(stale.diagnostics.some((entry) => entry.code === "HANDOFF_STALE" && entry.path === "$.handoff.supplementalInputs[0]"));

    await buildArchitectureDocs(temporary.config);
    const rebuilt = await checkArchitectureDocs(temporary.config, { mode: "publication" });
    assert.equal(rebuilt.diagnostics.some((entry) => entry.code === "HANDOFF_STALE" && entry.path === "$.handoff.supplementalInputs[0]"), false);
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("publication rejects a stale or incomplete approval rather than hiding provisional claims", async () => {
  const temporary = await setup();
  try {
    await buildArchitectureDocs(temporary.config);
    const report = await checkArchitectureDocs(temporary.config, { mode: "publication" });
    assert.equal(report.ok, false);
    assert.ok(report.diagnostics.some((entry) => entry.path === "$.pageMapReview"));
    assert.ok(report.diagnostics.some((entry) => entry.message.includes("purpose") || entry.message.includes("actors")));
    const config = JSON.parse(await readFile(temporary.config, "utf8"));
    const pages = [config.pages.home, ...config.pages.areas];
    await approveArchitectureDocsLedger(temporary.ledger, { claimIds: ["purpose", "runtime"], pages, reviewer: "maintainer@example.test" });
    const stale = JSON.parse(await readFile(temporary.ledger, "utf8")); stale.claims[0].statement = "Changed after approval"; await writeFile(temporary.ledger, JSON.stringify(stale));
    await assert.rejects(checkArchitectureDocs(temporary.config, { mode: "publication" }));
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});
