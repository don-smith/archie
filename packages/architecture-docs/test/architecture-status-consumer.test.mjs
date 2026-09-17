import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import { buildArchitectureDocs } from "../src/architecture-docs/index.mjs";
import { checkArchitectureDocs } from "../src/architecture-docs/checker.mjs";
import { loadArchitectureDocsConfig } from "../src/architecture-docs/config.mjs";
import { loadArchitectureStatus, projectArchitectureStatus, validateArchitectureStatusSnapshot } from "../src/architecture-docs/architecture-status.mjs";
import { ArchitectureDocsConfigurationError } from "../src/architecture-docs/errors.mjs";

const fixture = path.resolve("test/fixtures/architecture-docs");
async function copyFixture() { const directory = await mkdtemp(path.join(tmpdir(), "architecture-status-consumer-")); await cp(fixture, directory, { recursive: true }); await rm(path.join(directory, "preview"), { recursive: true, force: true }); return { directory, config: path.join(directory, "architecture-docs.config.json") }; }
function snapshot() { return { kind: "archie-architecture-status", version: 1, repository: { name: "Fixture Docs", revision: { commit: "fixture-revision", workingTree: "clean" } }, generatedAt: "2026-01-01T00:00:00.000Z", freshnessPolicy: { maxAgeSeconds: 86400 }, checks: [{ id: "fixture-check", title: "Fixture check", authority: "fixture owner", resultMeaning: "Target-owned meaning", limits: [], execution: { state: "not-run", reason: "disabled" }, result: { state: "unknown", reason: "not-collected" }, evidence: { state: "missing", reason: "not-collected" }, freshness: { state: "unknown", reasons: ["evidence-missing"] } }] }; }

test("configured missing snapshot renders an explicit status route and handoff v2 without a status source", async () => {
  const temporary = await copyFixture();
  try {
    const config = JSON.parse(await readFile(temporary.config, "utf8")); config.architectureStatus = { snapshot: "status.json" }; await writeFile(temporary.config, JSON.stringify(config));
    const result = await buildArchitectureDocs(temporary.config); const handoff = path.join(temporary.directory, "handoff");
    assert.equal(result.pageCount, 3); assert.match(await readFile(path.join(temporary.directory, "preview/architecture-status/index.html"), "utf8"), /No architecture status snapshot/);
    const manifest = JSON.parse(await readFile(path.join(handoff, "manifest.json"))); const pageMap = JSON.parse(await readFile(path.join(handoff, "page-map.json")));
    assert.equal(manifest.version, 2); assert.equal(manifest.architectureStatus.available, false); assert.equal(manifest.files.architectureStatus, undefined); assert.equal(manifest.digests.architectureStatus, undefined);
    assert.deepEqual(pageMap.status, { id: "architecture-status", title: "Architecture status", route: "architecture-status/index.html", kind: "generated", availability: "missing" });
    await assert.rejects(readFile(path.join(handoff, "architecture-status.json")), { code: "ENOENT" });
    const report = await checkArchitectureDocs(temporary.config, { mode: "publication" });
    assert.equal(report.diagnostics.some((issue) => issue.path.startsWith("$.handoff.architectureStatus")), false);
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("present snapshot is projected without interpreting opaque result codes", async () => {
  const temporary = await copyFixture();
  try { const config = JSON.parse(await readFile(temporary.config, "utf8")); config.architectureStatus = { snapshot: "status.json" }; await writeFile(temporary.config, JSON.stringify(config)); await writeFile(path.join(temporary.directory, "status.json"), JSON.stringify(snapshot())); await buildArchitectureDocs(temporary.config); const html = await readFile(path.join(temporary.directory, "preview/architecture-status/index.html"), "utf8"); assert.match(html, /Fixture check/); assert.doesNotMatch(html, /No architecture status snapshot/); assert.match(html, /does not run checks or produce an aggregate architecture verdict/); } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("config resolves the status snapshot relative to the configuration directory", async () => {
  const temporary = await copyFixture();
  try {
    const authoredRoot = path.join(temporary.directory, "docs");
    await mkdir(authoredRoot);
    for (const name of ["model", "pages", "evidence"]) {
      await cp(path.join(temporary.directory, name), path.join(authoredRoot, name), { recursive: true });
      await rm(path.join(temporary.directory, name), { recursive: true });
    }
    const ledgerPath = path.join(authoredRoot, "evidence/claims.json");
    const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
    for (const entry of Object.values(ledger.inventory)) entry.paths = entry.paths.map((value) => value === "architecture-docs.config.json" ? value : `docs/${value}`);
    for (const claim of ledger.claims) for (const evidence of claim.evidence) evidence.path = `docs/${evidence.path}`;
    await writeFile(ledgerPath, JSON.stringify(ledger));
    const config = JSON.parse(await readFile(temporary.config, "utf8"));
    config.root = "docs";
    config.architectureStatus = { snapshot: "status.json" };
    await writeFile(temporary.config, JSON.stringify(config));
    const loaded = await loadArchitectureDocsConfig(temporary.config);
    assert.equal(loaded.paths.architectureStatusSnapshot, path.join(temporary.directory, "status.json"));
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("config rejects status snapshots in generated directories", async () => {
  const temporary = await copyFixture();
  try { const config = JSON.parse(await readFile(temporary.config, "utf8")); config.architectureStatus = { snapshot: "preview/status.json" }; await writeFile(temporary.config, JSON.stringify(config)); await assert.rejects(loadArchitectureDocsConfig(temporary.config), (error) => error instanceof ArchitectureDocsConfigurationError && error.issues.some((issue) => issue.path === "$.architectureStatus.snapshot")); } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("config rejects generated directories nested below a status snapshot path", async () => {
  const temporary = await copyFixture();
  try {
    await symlink(temporary.directory, path.join(temporary.directory, "status-root"));
    const config = JSON.parse(await readFile(temporary.config, "utf8"));
    config.architectureStatus = { snapshot: "status-root" };
    await writeFile(temporary.config, JSON.stringify(config));
    await assert.rejects(loadArchitectureDocsConfig(temporary.config), (error) => error instanceof ArchitectureDocsConfigurationError && error.issues.some((issue) => issue.path === "$.architectureStatus.snapshot"));
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("config rejects a dangling status snapshot symlink escaping its directory", async () => {
  const temporary = await copyFixture();
  try {
    const danglingTarget = path.join(path.dirname(temporary.directory), "missing-architecture-status.json");
    await rm(danglingTarget, { force: true });
    await symlink(danglingTarget, path.join(temporary.directory, "status.json"));
    const config = JSON.parse(await readFile(temporary.config, "utf8"));
    config.architectureStatus = { snapshot: "status.json" };
    await writeFile(temporary.config, JSON.stringify(config));
    await assert.rejects(loadArchitectureDocsConfig(temporary.config), (error) => error instanceof ArchitectureDocsConfigurationError && error.issues.some((issue) => issue.path === "$.architectureStatus.snapshot"));
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("consumer enforces the finding ID bound and runtime revision character set", () => {
  const tooMany = snapshot();
  tooMany.checks[0].result = { state: "reported", code: "neutral", label: "Neutral", summary: "Many findings", findingIds: Array.from({ length: 1001 }, (_, index) => `finding-${String(index).padStart(4, "0")}`) };
  assert.throws(() => validateArchitectureStatusSnapshot(tooMany), (error) => error.code === "ARCHITECTURE_STATUS_INVALID");
  const unsafeRevision = snapshot();
  unsafeRevision.repository.revision.commit = "revision with spaces";
  assert.throws(() => validateArchitectureStatusSnapshot(unsafeRevision), (error) => error.code === "ARCHITECTURE_STATUS_INVALID");
});

test("unknown results are incomplete and included in unknown counts", () => {
  const value = snapshot(); value.generatedAt = "2026-01-01T00:00:01.000Z"; value.checks[0].execution = { state: "completed", startedAt: "2026-01-01T00:00:00.000Z", finishedAt: "2026-01-01T00:00:01.000Z", exitCode: 0 }; value.checks[0].evidence = { state: "present", source: "current", path: "evidence.json", sha256: "a".repeat(64), observedAt: "2026-01-01T00:00:00.000Z", observedRevision: "fixture-revision" }; value.checks[0].freshness = { state: "current", reasons: [] };
  const projection = projectArchitectureStatus(validateArchitectureStatusSnapshot(value));
  assert.equal(projection.counts.unknown, 1); assert.equal(projection.checks[0].incomplete, true);
});

test("consumer validation rejects unknown fields, duplicate count IDs, URI evidence paths, and symlink escapes", async () => {
  const fixtureNames = ["invalid-unknown-field.json", "invalid-duplicate-count-id.json"];
  for (const name of fixtureNames) {
    const fixtureValue = JSON.parse(await readFile(path.join("test/fixtures/architecture-status-contract", name), "utf8"));
    assert.throws(() => validateArchitectureStatusSnapshot(fixtureValue), (error) => error.code === "ARCHITECTURE_STATUS_INVALID");
  }
  const value = snapshot(); value.stdout = "no"; assert.throws(() => validateArchitectureStatusSnapshot(value), (error) => error.code === "ARCHITECTURE_STATUS_INVALID");
  const unsafe = snapshot(); unsafe.checks[0].evidence = { state: "present", source: "current", path: JSON.parse(await readFile(path.join("test/fixtures/architecture-status-contract", "invalid-uri-path.json"), "utf8")).path, sha256: "a".repeat(64), observedAt: "2026-01-01T00:00:00.000Z", observedRevision: "fixture-revision" }; unsafe.checks[0].freshness = { state: "stale", reasons: ["revision-mismatch"] }; assert.throws(() => validateArchitectureStatusSnapshot(unsafe), (error) => error.code === "ARCHITECTURE_STATUS_INVALID");
  const temporary = await copyFixture();
  try {
    const config = JSON.parse(await readFile(temporary.config, "utf8")); config.architectureStatus = { snapshot: "status.json" }; await writeFile(temporary.config, JSON.stringify(config));
    const outside = path.join(path.dirname(temporary.directory), "architecture-status-outside-evidence.json"); await writeFile(outside, "outside evidence\n"); await symlink(outside, path.join(temporary.directory, "escaped-evidence.json"));
    const escaped = snapshot(); escaped.checks[0].execution = { state: "completed", startedAt: "2026-01-01T00:00:00.000Z", finishedAt: "2026-01-01T00:00:01.000Z", exitCode: 0 }; escaped.checks[0].evidence = { state: "present", source: "current", path: "escaped-evidence.json", sha256: createHash("sha256").update("outside evidence\n").digest("hex"), observedAt: "2026-01-01T00:00:00.000Z", observedRevision: "fixture-revision" }; escaped.checks[0].freshness = { state: "current", reasons: [] };
    await writeFile(path.join(temporary.directory, "status.json"), JSON.stringify(escaped));
    await assert.rejects(loadArchitectureStatus(await loadArchitectureDocsConfig(temporary.config)), (error) => error.code === "ARCHITECTURE_STATUS_INVALID");
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});
