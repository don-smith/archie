import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { pathToFileURL } from "node:url";
import {
  validateArchitectureStatusSnapshot,
  serializeArchitectureStatusSnapshot,
  writeArchitectureStatusSnapshotV1,
} from "../../dist/packages/archie-runtime/src/repository-checks/architecture-status-v1.js";

const docsFixture = path.resolve("test/fixtures/architecture-status/docs");
const statusFixture = path.resolve("test/fixtures/architecture-status");
const docsPackage = path.resolve("packages/architecture-docs");
let buildArchitectureDocs;
let validateArchitectureStatusSnapshotConsumer;
let checkArchitectureDocs;
let checkFinalSite;

function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

test.before(async () => {
  const imported = await import(pathToFileURL(path.join(docsPackage, "src/architecture-docs/index.mjs")));
  const config = await import(pathToFileURL(path.join(docsPackage, "src/architecture-docs/config.mjs")));
  const status = await import(pathToFileURL(path.join(docsPackage, "src/architecture-docs/architecture-status.mjs")));
  const checker = await import(pathToFileURL(path.join(docsPackage, "src/architecture-docs/checker.mjs")));
  const siteChecker = await import(pathToFileURL(path.join(docsPackage, "src/architecture-docs/site-checker.mjs")));
  buildArchitectureDocs = imported.buildArchitectureDocs;
  validateArchitectureStatusSnapshotConsumer = status.validateArchitectureStatusSnapshot;
  checkArchitectureDocs = checker.checkArchitectureDocs;
  checkFinalSite = siteChecker.checkFinalSite;
});

async function copyDocsFixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "archie-status-seam-"));
  await cp(docsFixture, directory, { recursive: true });
  await writeFile(path.join(directory, "evidence", "current.json"), "current evidence\n");
  await writeFile(path.join(directory, "evidence", "stale.json"), "stale evidence\n");
  await writeFile(path.join(directory, "evidence", "retained.json"), "retained evidence\n");
  await writeFile(path.join(directory, "evidence", "unknown.json"), "unknown evidence\n");
  await writeFile(path.join(directory, "sentinel.mjs"), "import { writeFileSync } from 'node:fs'; writeFileSync(process.argv[2], 'ran\\n');\\n");
  return { directory, configPath: path.join(directory, "architecture-docs.config.json"), snapshotPath: path.join(directory, "architecture-status.json") };
}

function declaration(id, evidencePath, run, exitMap = { "0": { code: "observed", label: "Observed", summary: "Meaning remains owned by this check.", counts: [{ id: "findings", value: 2 }], findingIds: ["finding-a"] } }, command = "sentinel-command-that-must-not-run") {
  return {
    id,
    title: `${id} title`,
    command,
    authority: "Fixture check owner",
    evidencePath,
    resultMeaning: "Opaque target-owned meaning; not an Archie verdict.",
    adapter: "declared-exit-map-v1",
    exitMap,
    run,
    limits: ["Fixture evidence is intentionally bounded."],
  };
}
const completed = (finishedAt, exitCode = 0, startedAt = finishedAt) => ({ state: "completed", startedAt, finishedAt, exitCode });

function writeSnapshot({ directory, snapshotPath, generatedAt }) {
  const root = directory;
  const command = `${process.execPath} ${path.join(root, "sentinel.mjs")} ${path.join(root, "sentinel-ran")}`;
  const check = (id, evidencePath, run, exitMap) => declaration(id, evidencePath, run, exitMap, command);
  const initial = writeArchitectureStatusSnapshotV1({
    outputPath: snapshotPath,
    repositoryRoot: root,
    repository: { name: "Fixture Docs", revision: { commit: "fixture-revision", workingTree: "clean" } },
    generatedAt: "2026-01-01T00:02:00.000Z",
    maxAgeSeconds: 3600,
    checks: [check("retained-check", "evidence/retained.json", completed("2026-01-01T00:01:00.000Z"))],
  });
  assert.equal(initial.checks[0].freshness.state, "current");
  const snapshot = writeArchitectureStatusSnapshotV1({
    outputPath: snapshotPath,
    previousSnapshotPath: snapshotPath,
    repositoryRoot: root,
    repository: { name: "Fixture Docs", revision: { commit: "fixture-revision", workingTree: "clean" } },
    generatedAt,
    maxAgeSeconds: 3600,
    checks: [
      check("current-check", "evidence/current.json", completed("2026-01-03T00:01:00.000Z")),
      check("stale-check", "evidence/stale.json", completed("2026-01-01T00:01:00.000Z")),
      check("missing-check", "evidence/missing.json", completed("2026-01-03T00:01:00.000Z")),
      check("retained-check", "evidence/retained.json", { state: "failed", startedAt: "2026-01-03T00:01:00.000Z", finishedAt: "2026-01-03T00:02:00.000Z", reason: "timeout" }),
      check("not-run-check", "evidence/not-run.json", { state: "not-run", reason: "disabled by target" }),
      check("unknown-check", "evidence/unknown.json", completed("2026-01-03T00:01:00.000Z", 9), {}),
    ],
  });
  return snapshot;
}

async function enableStatus(configPath) {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.architectureStatus = { snapshot: "architecture-status.json" };
  await writeFile(configPath, `${JSON.stringify(config)}\n`);
}

async function createFinalSite(directory) {
  const site = path.join(directory, "site");
  await mkdir(path.join(site, "assets"), { recursive: true });
  await cp(path.join(directory, "preview", "assets", "views.json"), path.join(site, "assets", "views.json"));
  await cp(path.join(directory, "preview", "assets", "likec4-views.js"), path.join(site, "assets", "likec4-views.js"));
  const pageMap = JSON.parse(await readFile(path.join(directory, "handoff", "page-map.json"), "utf8"));
  const pages = [pageMap.home, ...pageMap.areas];
  for (const page of pages) {
    const route = page.id === pageMap.home.id ? "index.html" : path.join(page.slug, "index.html");
    const source = await readFile(path.join(directory, "preview", route), "utf8");
    const views = page.viewIds.join(",");
    const initial = page.initialViewId ?? "";
    const html = source
      .replace("<body class=", `<body data-view-ids="${views}" data-initial-view="${initial}" class=`)
      .replace('id="architecture-view-select"', 'id="view-select"');
    await mkdir(path.dirname(path.join(site, route)), { recursive: true });
    await writeFile(path.join(site, route), html);
  }
  await mkdir(path.join(site, "architecture-status"), { recursive: true });
  await cp(path.join(directory, "preview", "architecture-status", "index.html"), path.join(site, "architecture-status", "index.html"));
  const manifest = JSON.parse(await readFile(path.join(directory, "handoff", "manifest.json"), "utf8"));
  await writeFile(path.join(site, "assets", "architecture-handoff.json"), `${JSON.stringify({ ownership: { product: "html-design", generated: true }, architectureHandoffDigest: manifest.digests.handoff, architectureHandoffSchema: manifest.version })}\n`);
  return site;
}

test("runtime producer and imported architecture-docs consumer share the contract without a reverse dependency", async () => {
  const files = ["valid-snapshot.json", "canonical-bytes.json", "invalid-unsafe-path.json", "invalid-unknown-field.json", "invalid-unknown-report-field.json", "invalid-uri-path.json", "normalized-report.json", "malformed-report.json"];
  const manifest = (await readFile(path.join(statusFixture, "MANIFEST.sha256"), "utf8")).trim().split("\n");
  for (const line of manifest) {
    const [expected, file] = line.split(/\s+/, 2);
    assert.ok(files.includes(file));
    assert.equal(sha256(await readFile(path.join(statusFixture, file))), expected, `${file} mirror digest`);
  }
  const valid = JSON.parse(await readFile(path.join(statusFixture, "valid-snapshot.json"), "utf8"));
  assert.deepEqual(validateArchitectureStatusSnapshot(valid), valid);
  assert.deepEqual(validateArchitectureStatusSnapshotConsumer(valid), valid);
  assert.equal(serializeArchitectureStatusSnapshot(valid), await readFile(path.join(statusFixture, "canonical-bytes.json"), "utf8"));
  const unsafe = JSON.parse(await readFile(path.join(statusFixture, "invalid-unsafe-path.json"), "utf8"));
  assert.throws(() => validateArchitectureStatusSnapshot({ ...valid, checks: [{ ...valid.checks[0], evidence: { state: "present", source: "current", path: unsafe.path, sha256: "a".repeat(64), observedAt: valid.generatedAt, observedRevision: "fixture-revision" }, freshness: { state: "stale", reasons: ["revision-mismatch"] } }] }));
  assert.throws(() => validateArchitectureStatusSnapshotConsumer(unsafe));
  const malformed = await readFile(path.join(statusFixture, "malformed-report.json"), "utf8");
  assert.throws(() => validateArchitectureStatusSnapshot(malformed));
  assert.throws(() => validateArchitectureStatusSnapshotConsumer(malformed));
});

test("cross-seam build preserves recorded states, skips the sentinel check, and is wall-clock/Git independent", async () => {
  const temporary = await copyDocsFixture();
  try {
    await enableStatus(temporary.configPath);
    const snapshot = writeSnapshot({ ...temporary, generatedAt: "2026-01-03T00:10:00.000Z" });
    const byId = new Map(snapshot.checks.map((check) => [check.id, check]));
    assert.equal(byId.get("current-check").freshness.state, "current");
    assert.equal(byId.get("stale-check").freshness.state, "stale");
    assert.equal(byId.get("missing-check").evidence.state, "missing");
    assert.equal(byId.get("retained-check").execution.state, "failed");
    assert.equal(byId.get("retained-check").evidence.source, "retained");
    assert.equal(byId.get("retained-check").freshness.state, "stale");
    assert.equal(byId.get("not-run-check").execution.state, "not-run");
    assert.equal(byId.get("unknown-check").result.state, "unknown");

    const modelBefore = await readFile(path.join(temporary.directory, "model", "model.c4"));
    await buildArchitectureDocs(temporary.configPath);
    const sentinel = path.join(temporary.directory, "sentinel-ran");
    assert.equal(false, (await readFile(sentinel).catch(() => null)) !== null, "docs must not execute configured check commands");
    const statusHtml = await readFile(path.join(temporary.directory, "preview/architecture-status/index.html"), "utf8");
    assert.match(statusHtml, /Architecture status/);
    assert.match(statusHtml, /2026-01-03T00:10:00\.000Z/);
    assert.match(statusHtml, /does not run checks or produce an aggregate architecture verdict/);
    assert.match(statusHtml, /Authority stop/);
    assert.match(statusHtml, /https:\/\/example\.com\/fixture\/blob\/main\/evidence\/current\.json/);
    assert.doesNotMatch(statusHtml, /history\//i);
    assert.doesNotMatch(statusHtml, /stdout|stderr/);
    assert.deepEqual(await readFile(path.join(temporary.directory, "model", "model.c4")), modelBefore);

    const manifestBefore = JSON.parse(await readFile(path.join(temporary.directory, "handoff/manifest.json"), "utf8"));
    assert.equal(manifestBefore.version, 2);
    assert.equal(manifestBefore.files.architectureStatus, "architecture-status.json");
    assert.equal(JSON.parse(await readFile(path.join(temporary.directory, "handoff/page-map.json"), "utf8")).status.route, "architecture-status/index.html");
    const statusBytesBefore = await readFile(path.join(temporary.directory, "handoff/architecture-status.json"));
    assert.deepEqual(statusBytesBefore, await readFile(temporary.snapshotPath));
    assert.equal(manifestBefore.counts.provisionalClaimCount, 2, "status records do not contribute to claim counts");
    assert.doesNotMatch(statusBytesBefore.toString("utf8"), /stdout|stderr/);

    // A new snapshot is the only changed architecture input, so the v2 delta is status-only.
    writeSnapshot({ ...temporary, generatedAt: "2026-01-03T00:11:00.000Z" });
    await buildArchitectureDocs(temporary.configPath);
    const delta = JSON.parse(await readFile(path.join(temporary.directory, "handoff/delta.json"), "utf8"));
    assert.equal(delta.version, 2);
    assert.deepEqual(delta.summary.affectedPageIds, ["architecture-status"]);
    assert.equal(delta.summary.architectureStatus.changed, true);
    assert.equal(delta.summary.architectureStatus.available, true);

    const stableStatusHtml = await readFile(path.join(temporary.directory, "preview/architecture-status/index.html"), "utf8");
    const stableStatusBytes = await readFile(path.join(temporary.directory, "handoff/architecture-status.json"));
    const stableDigest = JSON.parse(await readFile(path.join(temporary.directory, "handoff/manifest.json"), "utf8")).digests.architectureStatus;
    execFileSync("git", ["init", "--quiet"], { cwd: temporary.directory });
    await writeFile(path.join(temporary.directory, "untracked-git-state"), "changed\n");
    assert.notEqual(execFileSync("git", ["status", "--porcelain"], { cwd: temporary.directory, encoding: "utf8" }).trim(), "");
    const originalDateNow = Date.now;
    Date.now = () => Date.parse("2099-12-31T23:59:59.999Z");
    try { await buildArchitectureDocs(temporary.configPath); } finally { Date.now = originalDateNow; }
    assert.equal(await readFile(path.join(temporary.directory, "preview/architecture-status/index.html"), "utf8"), stableStatusHtml);
    assert.deepEqual(await readFile(path.join(temporary.directory, "handoff/architecture-status.json")), stableStatusBytes);
    assert.equal(JSON.parse(await readFile(path.join(temporary.directory, "handoff/manifest.json"), "utf8")).digests.architectureStatus, stableDigest);

    const previewBeforeInvalid = await readFile(path.join(temporary.directory, "preview/architecture-status/index.html"));
    const handoffBeforeInvalid = await readFile(path.join(temporary.directory, "handoff/manifest.json"));
    const snapshotBeforeInvalid = await readFile(temporary.snapshotPath);
    const handoffStatusBeforeInvalid = await readFile(path.join(temporary.directory, "handoff/architecture-status.json"));
    await writeFile(temporary.snapshotPath, "{ malformed");
    await assert.rejects(buildArchitectureDocs(temporary.configPath), (error) => error.code === "ARCHITECTURE_STATUS_INVALID");
    assert.deepEqual(await readFile(path.join(temporary.directory, "preview/architecture-status/index.html")), previewBeforeInvalid);
    assert.deepEqual(await readFile(path.join(temporary.directory, "handoff/manifest.json")), handoffBeforeInvalid);
    assert.deepEqual(await readFile(path.join(temporary.directory, "handoff/architecture-status.json")), handoffStatusBeforeInvalid);
    await writeFile(temporary.snapshotPath, snapshotBeforeInvalid);

    const previewCheck = await checkArchitectureDocs(temporary.configPath, { mode: "preview" });
    assert.equal(previewCheck.ok, true, JSON.stringify(previewCheck.diagnostics));
    await createFinalSite(temporary.directory);
    const siteCheck = await checkFinalSite(temporary.configPath);
    assert.equal(siteCheck.ok, true, JSON.stringify(siteCheck.diagnostics));
    assert.equal(siteCheck.pageCount, 3);
    const navigation = statusHtml.indexOf("index.html") < statusHtml.indexOf("architecture-status/index.html") && statusHtml.indexOf("architecture-status/index.html") < statusHtml.indexOf("runtime/index.html");
    assert.equal(navigation, true, "status route follows home and precedes areas");
  } finally {
    await rm(temporary.directory, { recursive: true, force: true });
  }
});

test("configured missing snapshot remains an explicit v2 absence", async () => {
  const temporary = await copyDocsFixture();
  try {
    await enableStatus(temporary.configPath);
    await buildArchitectureDocs(temporary.configPath);
    const html = await readFile(path.join(temporary.directory, "preview/architecture-status/index.html"), "utf8");
    const manifest = JSON.parse(await readFile(path.join(temporary.directory, "handoff/manifest.json"), "utf8"));
    assert.match(html, /No architecture status snapshot/);
    assert.equal(manifest.version, 2);
    assert.equal(manifest.architectureStatus.available, false);
    assert.equal(manifest.files.architectureStatus, undefined);
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});
