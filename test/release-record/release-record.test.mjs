import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { selectLocalRelease } from "../../dist/packages/archie-runtime/src/release-install/selection.js";
import { ARCHIE_SKILLS, finalizeRelease, parseReleaseRecord, serializeReleaseRecord, validateBundleLayout } from "../../dist/packages/archie-runtime/src/release-record/release-record-v1.js";

const fixture = "test/fixtures/private-bundles/valid";
const provenance = "packages/archie-runtime/vendor/html-design.provenance.json";
const sourceCommit = "abcdef0123456789abcdef0123456789abcdef01";
function copyFixture() {
  const root = mkdtempSync(join(tmpdir(), "archie-release-record-"));
  const bundle = join(root, "bundle"); cpSync(fixture, bundle, { recursive: true }); return { root, bundle };
}
function finalize(bundle) { return finalizeRelease({ bundleDirectory: bundle, sourceCommit, htmlProvenancePath: provenance }); }

test("canonical unsigned record is deterministic and carries the non-authorization boundary", () => {
  const first = copyFixture(), second = copyFixture();
  try {
    const one = finalize(first.bundle), two = finalize(second.bundle);
    const bytes = readFileSync(one.recordPath, "utf8");
    assert.equal(bytes, readFileSync(two.recordPath, "utf8"));
    assert.equal(one.recordSha256, two.recordSha256);
    assert.deepEqual(parseReleaseRecord(bytes), one.record);
    assert.equal(one.record.authorization.kind, "none");
    assert.match(readFileSync(one.receiptPath, "utf8"), /Archie authorization: NOT ASSESSED — locally reviewed private release selected\./);
  } finally { rmSync(first.root, { recursive: true, force: true }); rmSync(second.root, { recursive: true, force: true }); }
});

test("noncanonical bytes, unknown fields, and authorization variants fail closed", () => {
  const copied = copyFixture();
  try {
    const { recordPath } = finalize(copied.bundle);
    const record = JSON.parse(readFileSync(recordPath, "utf8"));
    assert.throws(() => parseReleaseRecord(`${JSON.stringify(record, null, 2)}\n`), /not canonical/);
    assert.throws(() => parseReleaseRecord(serializeReleaseRecord({ ...record, unexpected: true })), /unsupported or missing fields/);
    assert.throws(() => parseReleaseRecord(serializeReleaseRecord({ ...record, authorization: { kind: "signature", claim: "locally-reviewed-private-trial" } })), /authorization/);
    assert.throws(() => serializeReleaseRecord({ ...record, apm: { ...record.apm, locator: "https://github.com/don-smith/archie.git" } }), /GitHub SSH/);
    assert.throws(() => serializeReleaseRecord({ ...record, apm: { ...record.apm, ref: "main" } }), /immutable version tag/);
    assert.throws(() => serializeReleaseRecord({ ...record, apm: { ...record.apm, ref: "v9.9.9" } }), /immutable version tag/);
  } finally { rmSync(copied.root, { recursive: true, force: true }); }
});

test("malformed final artifact evidence and unsupported layouts reject", () => {
  const copied = copyFixture();
  try {
    writeFileSync(join(copied.bundle, "npm", "archie-runtime.tgz"), "changed");
    assert.throws(() => finalize(copied.bundle), /gzip|integrity/);
    writeFileSync(join(copied.bundle, "npm", "archie-runtime.tgz"), readFileSync(join(fixture, "npm", "archie-runtime.tgz")));
    writeFileSync(join(copied.bundle, "apm", "apm.lock.yaml"), "resolved_commit: nope\n");
    assert.throws(() => finalize(copied.bundle), /exactly one|malformed/);
    writeFileSync(join(copied.bundle, "apm", "apm.lock.yaml"), readFileSync(join(fixture, "apm", "apm.lock.yaml")));
    const manifestPath = join(copied.bundle, "apm", "apm.yml");
    writeFileSync(manifestPath, readFileSync(manifestPath, "utf8").replace("  mcp: []", "        - unrecorded-skill\n  mcp: []"));
    assert.throws(() => finalize(copied.bundle), /skill subset/);
    writeFileSync(join(copied.bundle, "unexpected.txt"), "no");
    assert.throws(() => validateBundleLayout(copied.bundle), /unsupported entry/);
  } finally { rmSync(copied.root, { recursive: true, force: true }); }
});

test("finalization and selection reject mismatched APM lock identity", () => {
  const cases = [
    ["skill subset", (lock) => lock.replace("  - likec4-authoring", "  - likec4-authoring\n  - unrecorded-skill")],
    ["repository", (lock) => lock.replace("repo_url: don-smith/archie", "repo_url: other/archie")]
  ];
  for (const [label, mutate] of cases) {
    const beforeFinalization = copyFixture();
    try {
      const lockPath = join(beforeFinalization.bundle, "apm", "apm.lock.yaml");
      writeFileSync(lockPath, mutate(readFileSync(lockPath, "utf8")));
      assert.throws(() => finalize(beforeFinalization.bundle), new RegExp(label));
    } finally { rmSync(beforeFinalization.root, { recursive: true, force: true }); }

    const afterFinalization = copyFixture();
    try {
      finalize(afterFinalization.bundle);
      const lockPath = join(afterFinalization.bundle, "apm", "apm.lock.yaml");
      writeFileSync(lockPath, mutate(readFileSync(lockPath, "utf8")));
      assert.throws(() => selectLocalRelease(afterFinalization.bundle), new RegExp(label));
    } finally { rmSync(afterFinalization.root, { recursive: true, force: true }); }
  }
});

test("finalization requires a GitHub SSH APM locator", () => {
  const copied = copyFixture();
  try {
    const inputPath = join(copied.bundle, "bundle.json");
    const input = JSON.parse(readFileSync(inputPath, "utf8"));
    input.apm.locator = "https://github.com/don-smith/archie.git";
    writeFileSync(inputPath, `${JSON.stringify(input, null, 2)}\n`);
    const manifestPath = join(copied.bundle, "apm", "apm.yml");
    writeFileSync(manifestPath, readFileSync(manifestPath, "utf8").replace("git@github.com:don-smith/archie.git", input.apm.locator));
    assert.throws(() => finalize(copied.bundle), /GitHub SSH/);
  } finally { rmSync(copied.root, { recursive: true, force: true }); }
});

test("release schema encodes the exact Archie skill set", () => {
  const schema = JSON.parse(readFileSync("schemas/release-record-v1.schema.json", "utf8"));
  const skills = schema.$defs.apm.properties.skills;
  assert.deepEqual(skills.prefixItems.map((item) => item.const), ARCHIE_SKILLS);
  assert.equal(skills.items, false);
});

test("unsupported analyzer compatibility is rejected by the parser", () => {
  const copied = copyFixture();
  try {
    const { recordPath } = finalize(copied.bundle);
    const record = JSON.parse(readFileSync(recordPath, "utf8"));
    record.analyzerCompatibility.platform = "linux";
    assert.throws(() => parseReleaseRecord(`${JSON.stringify(record)}\n`), /unsupported analyzer compatibility/);
  } finally { rmSync(copied.root, { recursive: true, force: true }); }
});
