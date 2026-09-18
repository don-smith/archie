import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ARCHIE_SKILLS, inspectNpmTarball, npmProjection, PRODUCT_VERSION } from "../../../dist/packages/archie-runtime/src/index.js";

const fixture = "test/fixtures/private-bundles/valid";
const sourceCommit = "abcdef0123456789abcdef0123456789abcdef01";
const enabled = process.env.ARCHIE_E2E_PUBLISHED_CONTEXT === "1";
const skip = enabled ? false : `set ARCHIE_E2E_PUBLISHED_CONTEXT=1 to resolve the eight-skill Archie context from the packages/archie-context subfolder of git@github.com:don-smith/archie.git at the fixture's pinned commit (requires SSH access); see docs/archie/private-release-bundle.md`;

function packArtifact(workspace, bundle, file, payload) {
  const output = JSON.parse(execFileSync("npm", ["pack", "--json", "--workspace", workspace, "--pack-destination", join(bundle, "npm")], { encoding: "utf8" }));
  renameSync(join(bundle, "npm", output[0].filename), join(bundle, "npm", `${file}.tgz`));
  const bytes = readFileSync(join(bundle, "npm", `${file}.tgz`));
  const manifest = inspectNpmTarball(bytes).manifest;
  const locator = `file:npm/${file}.tgz`;
  return {
    input: { package: manifest.name, version: manifest.version, locator, lockFile: `npm/${file}.lock.json`, tarball: `npm/${file}.tgz`, requiredPlatformPayload: payload },
    record: { package: manifest.name, version: manifest.version, locator, lockIntegrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`, tarballSha256: createHash("sha256").update(bytes).digest("hex"), requiredPlatformPayload: payload, dependencies: manifest.dependencies ?? {}, engines: manifest.engines ?? {}, binaries: manifest.bin ?? {} }
  };
}

test("bootstrap natively locks and frozen-deploys the published eight-skill context into a clean target", { skip }, () => {
  const base = mkdtempSync(join(tmpdir(), "archie-published-context-"));
  try {
    const bundle = join(base, "bundle");
    const target = join(base, "target");
    cpSync(fixture, bundle, { recursive: true });
    mkdirSync(join(bundle, "npm"));
    const runtime = packArtifact("@archie/runtime", bundle, "archie-runtime", "dist/architecture-docs/bin/architecture-docs.mjs");
    const conformance = packArtifact("@archie/conformance", bundle, "conformance", "dist/cli.js");
    const lock = npmProjection({ version: runtime.record.version, artifacts: [runtime.record, conformance.record] }).lock;
    for (const file of ["archie-runtime", "conformance"]) writeFileSync(join(bundle, "npm", `${file}.lock.json`), lock);
    const input = JSON.parse(readFileSync(join(bundle, "bundle.json"), "utf8"));
    writeFileSync(join(bundle, "bundle.json"), `${JSON.stringify({ ...input, artifacts: [runtime.input, conformance.input] }, null, 2)}\n`);

    const finalized = spawnSync(process.execPath, ["dist/packages/archie-cli/src/release-cli.js", "finalize", "--bundle", bundle, "--source-commit", sourceCommit], { encoding: "utf8" });
    assert.equal(finalized.status, 0, finalized.stderr || finalized.stdout);
    const result = spawnSync(process.execPath, ["dist/packages/archie-cli/src/cli.js", "bootstrap", "--release", bundle, "--target", target], { encoding: "utf8", timeout: 300000 });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const deployedLock = readFileSync(join(target, "apm.lock.yaml"), "utf8");
    assert.match(deployedLock, /repo_url: don-smith\/archie/);
    for (const skill of ARCHIE_SKILLS) assert.ok(existsSync(join(target, ".agents", "skills", skill, "SKILL.md")), `missing ${skill}`);
    const deployedHashes = [...deployedLock.matchAll(/^\s{4}(\.agents\/skills\/[^:]+): sha256:([a-f0-9]{64})$/gm)];
    assert.ok(deployedHashes.length > ARCHIE_SKILLS.length, "native APM lock must bind every deployed skill file");
    for (const [, relativePath, expected] of deployedHashes) {
      assert.equal(createHash("sha256").update(readFileSync(join(target, relativePath))).digest("hex"), expected, `deployed skill byte mismatch: ${relativePath}`);
    }
    const checker = spawnSync(process.execPath, [join(target, ".agents/skills/html-design/scripts/check-artifact.mjs"), "--help"], { encoding: "utf8" });
    assert.doesNotMatch(`${checker.stdout}\n${checker.stderr}`, /Cannot find package/, "the deployed html-design checker needs no installed dependencies");
  } finally { rmSync(base, { recursive: true, force: true }); }
});
