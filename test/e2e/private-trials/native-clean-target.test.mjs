import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const fixture = "test/fixtures/private-bundles/valid";
const provenance = "packages/archie-runtime/vendor/html-design.provenance.json";
const sourceCommit = "abcdef0123456789abcdef0123456789abcdef01";
const skills = ["archie", "architecture-assessment", "architecture-conformance-onboarding", "architecture-contracts", "architecture-docs", "likec4-authoring"];

test("bootstrap creates a native APM lock and frozen-deploys the complete private Git bundle into a clean target", () => {
  const base = mkdtempSync(join(tmpdir(), "archie-native-clean-target-"));
  try {
    const bundle = join(base, "bundle");
    const target = join(base, "target");
    cpSync(fixture, bundle, { recursive: true });
    const finalized = spawnSync(process.execPath, ["dist/packages/archie-cli/src/release-cli.js", "finalize", "--bundle", bundle, "--source-commit", sourceCommit, "--html-provenance", provenance], { encoding: "utf8" });
    assert.equal(finalized.status, 0, finalized.stderr || finalized.stdout);
    assert.ok(!existsSync(join(target, ".apm")), "clean target must not contain a staged APM source context");
    const result = spawnSync(process.execPath, ["dist/packages/archie-cli/src/cli.js", "bootstrap", "--release", bundle, "--target", target], { encoding: "utf8", timeout: 120000 });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const manifest = readFileSync(join(target, "apm.yml"), "utf8");
    const lock = readFileSync(join(target, "apm.lock.yaml"), "utf8");
    assert.match(manifest, /^name: archie-private-runtime$/m);
    assert.match(manifest, /git@github\.com:don-smith\/archie\.git/);
    assert.match(lock, /repo_url: don-smith\/archie/);
    for (const skill of skills) assert.ok(existsSync(join(target, ".agents", "skills", skill, "SKILL.md")), `missing ${skill}`);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
