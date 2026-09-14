import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  adaptDeclaredExitMapV1, adaptNormalizedJsonReportV1,
  serializeArchitectureStatusSnapshotV1, validateArchitectureStatusSnapshotV1,
  writeArchitectureStatusSnapshotV1
} from "../../dist/packages/archie-runtime/src/repository-checks/architecture-status-v1.js";

const revision = { commit: "fixture-revision", workingTree: "clean" };
const baseCheck = (overrides = {}) => ({ id: "fixture-check", command: "unused", authority: "fixture owner", evidencePath: "evidence.json", resultMeaning: "target-owned meaning", adapter: "declared-exit-map-v1", exitMap: { "0": { code: "observed", label: "Observed", summary: "Target-owned result" } }, run: { state: "completed", startedAt: "2026-01-01T00:00:00.000Z", finishedAt: "2026-01-01T00:00:01.000Z", exitCode: 0 }, ...overrides });
const options = (root, checks, generatedAt = "2026-01-01T00:01:00.000Z") => ({ outputPath: join(root, "latest.json"), repositoryRoot: root, repository: { name: "fixture-repository", revision }, generatedAt, checks });

function evidence(root, value = "evidence") {
  writeFileSync(join(root, "evidence.json"), value);
  return createHash("sha256").update(value).digest("hex");
}

test("canonical serialization has stable bytes and validates the shared fixture", () => {
  const fixture = JSON.parse(readFileSync("test/fixtures/architecture-status/valid-snapshot.json", "utf8"));
  const bytes = serializeArchitectureStatusSnapshotV1(fixture);
  assert.equal(bytes, readFileSync("test/fixtures/architecture-status/canonical-bytes.json", "utf8"));
  assert.deepEqual(validateArchitectureStatusSnapshotV1(fixture), fixture);
});

test("closed adapters preserve opaque target meaning and reject malformed reports", () => {
  assert.deepEqual(adaptDeclaredExitMapV1(0, { "0": { code: "findings", label: "Findings", summary: "target meaning" } }), { state: "reported", code: "findings", label: "Findings", summary: "target meaning" });
  assert.deepEqual(adaptDeclaredExitMapV1(9, {}), { state: "unknown", reason: "exit-unmapped" });
  const report = JSON.parse(readFileSync("test/fixtures/architecture-status/normalized-report.json", "utf8"));
  assert.equal(adaptNormalizedJsonReportV1(report, "fixture-check").result.code, "findings");
  assert.throws(() => adaptNormalizedJsonReportV1(readFileSync("test/fixtures/architecture-status/malformed-report.json", "utf8")), /malformed JSON/);
});

test("producer represents current, stale, missing, failed, and not-run state independently", () => {
  const root = mkdtempSync(join(tmpdir(), "architecture-status-"));
  const hash = evidence(root);
  const current = writeArchitectureStatusSnapshotV1(options(root, [baseCheck({ adapter: "declared-exit-map-v1" })]));
  assert.equal(current.checks[0].freshness.state, "current");
  assert.equal(current.checks[0].evidence.state, "present");
  const stale = writeArchitectureStatusSnapshotV1(options(root, [baseCheck()], "2026-01-03T00:01:00.000Z"));
  assert.equal(stale.checks[0].freshness.state, "stale");
  assert.ok(stale.checks[0].freshness.reasons.includes("age-exceeded"));
  assert.equal(stale.checks[0].evidence.sha256, hash);
  const missing = writeArchitectureStatusSnapshotV1(options(root, [baseCheck({ run: { state: "completed", startedAt: "2026-01-01T00:00:00.000Z", finishedAt: "2026-01-01T00:00:01.000Z", exitCode: 1 }, evidencePath: "absent.json" })], "2026-01-03T00:01:00.000Z"));
  assert.equal(missing.checks[0].evidence.state, "missing");
  const failed = writeArchitectureStatusSnapshotV1(options(root, [baseCheck({ run: { state: "failed", startedAt: "2026-01-01T00:00:00.000Z", finishedAt: "2026-01-01T00:00:01.000Z", reason: "timeout" } })]));
  assert.equal(failed.checks[0].execution.state, "failed");
  assert.equal(failed.checks[0].result.state, "unknown");
  const notRun = writeArchitectureStatusSnapshotV1(options(root, [baseCheck({ run: { state: "not-run", reason: "disabled" } })]));
  assert.equal(notRun.checks[0].execution.state, "not-run");
  assert.equal(notRun.checks[0].freshness.state, "unknown");
});

test("retention and fatal input errors preserve the previous latest snapshot", () => {
  const root = mkdtempSync(join(tmpdir(), "architecture-status-"));
  evidence(root, "retained");
  writeArchitectureStatusSnapshotV1(options(root, [baseCheck()]));
  const before = readFileSync(join(root, "latest.json"), "utf8");
  const retained = writeArchitectureStatusSnapshotV1({ ...options(root, [baseCheck({ reportPath: "missing-report.json", adapter: "normalized-json-v1" })]), previousSnapshotPath: join(root, "latest.json") });
  assert.equal(retained.checks[0].evidence.source, "retained");
  const retainedBytes = readFileSync(join(root, "latest.json"), "utf8");
  assert.equal(retainedBytes, serializeArchitectureStatusSnapshotV1(retained));
  assert.throws(() => writeArchitectureStatusSnapshotV1({ ...options(root, [baseCheck({ report: "{", adapter: "normalized-json-v1" })]), previousSnapshotPath: join(root, "latest.json") }), /malformed JSON/);
  assert.equal(readFileSync(join(root, "latest.json"), "utf8"), retainedBytes);
  assert.notEqual(retainedBytes, before);
});

test("unsafe evidence paths, missing digests, and contradictory times are rejected", () => {
  const root = mkdtempSync(join(tmpdir(), "architecture-status-"));
  assert.throws(() => writeArchitectureStatusSnapshotV1(options(root, [baseCheck({ evidencePath: "../outside.json" })])), /unsafe/);
  assert.throws(() => validateArchitectureStatusSnapshotV1({ kind: "archie-architecture-status", version: 1, repository: { name: "x", revision }, generatedAt: "2026-01-01T00:00:00.000Z", freshnessPolicy: { maxAgeSeconds: 10 }, checks: [{ id: "x", title: "x", authority: "x", resultMeaning: "x", limits: [], execution: { state: "not-run", reason: "x" }, result: { state: "unknown", reason: "x" }, evidence: { state: "present", source: "current", path: "x.json", sha256: "bad", observedAt: "2026-01-01T00:00:00.000Z", observedRevision: "fixture-revision" }, freshness: { state: "current", reasons: [] } }] }), /digest/);
});
