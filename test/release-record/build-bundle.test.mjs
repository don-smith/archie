import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const { buildReleaseBundle, finalizeRelease } = await import("../../dist/packages/archie-runtime/src/index.js");

const CONTENT_HASH = "sha256:e540bc0ca3c1eb9d7e46956c17416582f88ff7659966b1fca530a3a094c9cc81";
const COMMIT = "04a46e65760d396bb1fbc8158dcf0836613280b3";
const SKILLS = [
  "archie", "architecture-assessment", "architecture-conformance-onboarding", "architecture-contracts",
  "architecture-docs", "architecture-review", "html-design", "likec4-authoring"
];

/** Packs for real so the record carries genuine tarball evidence; stubs APM so the build stays offline. */
function runner(lock) {
  return ({ command, args, cwd }) => {
    if (command === "npm") {
      const result = spawnSync("npm", args, { cwd, encoding: "utf8" });
      return { exitCode: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
    }
    writeFileSync(join(cwd, "apm.lock.yaml"), lock(readFileSync(join(cwd, "apm.yml"), "utf8")));
    return { exitCode: 0, stdout: "", stderr: "" };
  };
}
const lockFor = (ref, virtualPath) => [
  "lockfile_version: '1'",
  "apm_version: 0.29.0",
  "dependencies:",
  "- repo_url: don-smith/archie",
  "  name: archie-context",
  "  host: github.com",
  `  resolved_commit: ${COMMIT}`,
  `  resolved_ref: ${ref}`,
  "  version: 0.3.0",
  ...(virtualPath === undefined ? [] : [`  virtual_path: ${virtualPath}`, "  is_virtual: true"]),
  "  package_type: apm_package",
  `  content_hash: ${CONTENT_HASH}`,
  "  skill_subset:",
  ...SKILLS.map(skill => `  - ${skill}`),
  "deployments: []",
  ""
].join("\n");

function build(root, { ref = COMMIT, path = "packages/archie-context", lock = lockFor(ref, path) } = {}) {
  const bundleDirectory = join(root, "bundle");
  return buildReleaseBundle({
    bundleDirectory, workspaceRoot: process.cwd(), locator: "git@github.com:don-smith/archie.git",
    ref, path, run: runner(() => lock)
  });
}

test("archie-release build produces a bundle input that finalizes with its pinned subfolder", () => {
  const root = mkdtempSync(join(tmpdir(), "archie-build-"));
  try {
    const built = build(root);
    const input = JSON.parse(readFileSync(join(built.bundleDirectory, "bundle.json"), "utf8"));
    assert.equal(input.format, "archie-private-bundle-input-v3");
    assert.deepEqual(input.artifacts.map(artifact => artifact.package), ["@archie/runtime", "@archie/conformance"]);
    assert.deepEqual(input.artifacts.map(artifact => artifact.locator), ["file:npm/archie-runtime.tgz", "file:npm/conformance.tgz"]);
    assert.equal(input.apm.path, "packages/archie-context");
    assert.deepEqual(input.apm.skills, SKILLS);

    const manifest = readFileSync(join(built.bundleDirectory, "apm/apm.yml"), "utf8");
    assert.match(manifest, /^ {6}path: packages\/archie-context$/m);
    assert.match(manifest, /^ {4}- git: git@github\.com:don-smith\/archie\.git$/m);

    const { record } = finalizeRelease({ bundleDirectory: built.bundleDirectory, sourceCommit: COMMIT });
    assert.equal(record.apm.path, "packages/archie-context");
    assert.equal(record.apm.ref, COMMIT);
    assert.equal(record.apm.resolvedCommit, COMMIT);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("finalization rejects a lock whose virtual path differs from the bundle input", () => {
  const root = mkdtempSync(join(tmpdir(), "archie-build-"));
  try {
    const built = build(root, { lock: lockFor(COMMIT, "packages/elsewhere") });
    assert.throws(() => finalizeRelease({ bundleDirectory: built.bundleDirectory, sourceCommit: COMMIT }), /APM virtual path differs from bundle input/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("finalization rejects a virtual path the bundle input does not declare", () => {
  const root = mkdtempSync(join(tmpdir(), "archie-build-"));
  try {
    const bundleDirectory = join(root, "bundle");
    buildReleaseBundle({
      bundleDirectory, workspaceRoot: process.cwd(), locator: "git@github.com:don-smith/archie.git",
      ref: COMMIT, run: runner(() => lockFor(COMMIT, "packages/archie-context"))
    });
    assert.throws(() => finalizeRelease({ bundleDirectory, sourceCommit: COMMIT }), /APM lock pins a virtual path the bundle input does not declare/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("finalization rejects a mutable APM ref", () => {
  const root = mkdtempSync(join(tmpdir(), "archie-build-"));
  try {
    const built = build(root, { ref: "main" });
    assert.throws(() => finalizeRelease({ bundleDirectory: built.bundleDirectory, sourceCommit: COMMIT }), /version does not match the Archie product version authority/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
