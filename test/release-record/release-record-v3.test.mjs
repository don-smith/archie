import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ARCHIE_SKILLS, bootstrapTarget, finalizeRelease, npmProjection, parseReleaseRecord, RELEASE_RECORD_FILE, selectLocalRelease, serializeReleaseRecord, validateBundleLayout } from "../../dist/packages/archie-runtime/src/index.js";
import { bootstrapAndVerifyTarget, ReleaseInstallFailure, upgradeAndVerifyTarget } from "../../dist/packages/archie-runtime/src/release-install/verify.js";
import { finalizedBundle, fixture, installRunner, makeBundle, sourceCommit } from "../support/release-bundle.mjs";

function withBase(prefix, body) {
  const base = mkdtempSync(join(tmpdir(), prefix));
  try { return body(base); } finally { rmSync(base, { recursive: true, force: true }); }
}
const finalize = (bundle) => finalizeRelease({ bundleDirectory: bundle, sourceCommit });

test("the release skill set is the complete sorted eight-skill Archie membership", () => {
  assert.deepEqual(ARCHIE_SKILLS, ["archie", "architecture-assessment", "architecture-conformance-onboarding", "architecture-contracts", "architecture-docs", "architecture-review", "html-design", "likec4-authoring"]);
  assert.deepEqual([...ARCHIE_SKILLS].sort(), ARCHIE_SKILLS);
});

test("finalization is deterministic, orders both local artifacts, and carries the non-authorization boundary", () => withBase("archie-v3-record-", (base) => {
  const one = finalize(makeBundle(base, "one"));
  const two = finalize(makeBundle(base, "two"));
  const bytes = readFileSync(one.recordPath, "utf8");
  assert.equal(one.record.schemaVersion, 3);
  assert.equal(bytes, readFileSync(two.recordPath, "utf8"));
  assert.equal(one.recordSha256, two.recordSha256);
  assert.deepEqual(parseReleaseRecord(bytes), one.record);
  assert.equal(Object.hasOwn(one.record, "htmlDesignSnapshot"), false);
  assert.deepEqual(one.record.artifacts.map((artifact) => artifact.package), ["@archie/runtime", "@archie/conformance"]);
  assert.deepEqual(one.record.apm.skills, ARCHIE_SKILLS);
  assert.equal(one.record.authorization.kind, "none");
  const receipt = readFileSync(one.receiptPath, "utf8");
  assert.match(receipt, /Archie authorization: NOT ASSESSED — locally reviewed private release selected\./);
  assert.match(receipt, /Skills: archie, .*html-design, likec4-authoring/);
  const projection = npmProjection(one.record);
  assert.deepEqual(Object.keys(JSON.parse(projection.manifest).dependencies), ["@archie/runtime", "@archie/conformance"]);
  assert.ok(JSON.parse(projection.lock).packages["node_modules/likec4"], "the lock retains the runtime dependency closure");
  assert.equal(selectLocalRelease(join(base, "one")).record.schemaVersion, 3);
}));

test("noncanonical bytes, unknown fields, authorization variants, and APM identity drift fail closed", () => withBase("archie-v3-parse-", (base) => {
  const { recordPath } = finalize(makeBundle(base));
  const record = JSON.parse(readFileSync(recordPath, "utf8"));
  assert.throws(() => parseReleaseRecord(`${JSON.stringify(record, null, 2)}\n`), /not canonical/);
  assert.throws(() => serializeReleaseRecord({ ...record, unexpected: true }), /unsupported or missing fields/);
  assert.throws(() => serializeReleaseRecord({ ...record, authorization: { kind: "signature", claim: "locally-reviewed-private-trial" } }), /authorization/);
  assert.throws(() => serializeReleaseRecord({ ...record, apm: { ...record.apm, locator: "https://github.com/don-smith/archie.git" } }), /GitHub SSH/);
  assert.throws(() => serializeReleaseRecord({ ...record, apm: { ...record.apm, ref: "main" } }), /immutable version tag/);
  assert.throws(() => serializeReleaseRecord({ ...record, apm: { ...record.apm, skills: record.apm.skills.slice(0, 6) } }), /complete sorted Archie skill set/);
  const mutated = structuredClone(record);
  mutated.analyzerCompatibility.platform = "linux";
  assert.throws(() => parseReleaseRecord(`${JSON.stringify(mutated)}\n`), /unsupported analyzer compatibility/);
}));

test("release records before v3 are rejected with an explicit version message", () => withBase("archie-v3-legacy-", (base) => {
  const { recordPath } = finalize(makeBundle(base));
  const record = JSON.parse(readFileSync(recordPath, "utf8"));
  for (const schemaVersion of [1, 2]) {
    assert.throws(() => parseReleaseRecord(`${JSON.stringify({ ...record, schemaVersion, htmlDesignSnapshot: {} })}\n`), /unsupported release record schema version: .*reads only release record v3/);
  }
}));

test("a target pinned to a pre-v3 release is refused rather than upgraded in place", () => withBase("archie-v3-legacy-pin-", (base) => {
  const selected = selectLocalRelease(finalizedBundle(base));
  const target = join(base, "target");
  mkdirSync(join(target, ".archie", "release"), { recursive: true });
  writeFileSync(join(target, ".archie", "release", "release-record-v2.json"), "{}\n");
  assert.throws(() => bootstrapTarget(target, selected), /pre-v3 Archie release pin/);
  assert.equal(existsSync(join(target, ".archie", "release", RELEASE_RECORD_FILE)), false);
}));

test("malformed artifact evidence, locks, payloads, and layouts reject finalization", () => withBase("archie-v3-malformed-", (base) => {
  const tarball = makeBundle(base, "tarball");
  writeFileSync(join(tarball, "npm", "archie-runtime.tgz"), "changed");
  assert.throws(() => finalize(tarball), /gzip|tar|integrity/i);

  const incompleteLock = makeBundle(base, "incomplete-lock");
  const input = JSON.parse(readFileSync(join(incompleteLock, "bundle.json"), "utf8"));
  const lockPath = join(incompleteLock, input.artifacts[0].lockFile);
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  delete lock.packages[""];
  writeFileSync(lockPath, JSON.stringify(lock));
  assert.throws(() => finalize(incompleteLock), /exact generated projection/);

  for (const [payload, expected] of [["dist/missing.js", /omits required platform payload/], ["../escape", /payload path is unsafe/], ["/absolute", /payload path is unsafe/], ["dist/../cli.js", /payload path is unsafe/]]) {
    const bundle = makeBundle(base, `payload-${expected.source.length}-${payload.length}`);
    const inputPath = join(bundle, "bundle.json");
    const payloadInput = JSON.parse(readFileSync(inputPath, "utf8"));
    payloadInput.artifacts[1].requiredPlatformPayload = payload;
    writeFileSync(inputPath, JSON.stringify(payloadInput));
    assert.throws(() => finalize(bundle), expected);
  }

  const apmLock = makeBundle(base, "apm-lock");
  writeFileSync(join(apmLock, "apm", "apm.lock.yaml"), "resolved_commit: nope\n");
  assert.throws(() => finalize(apmLock), /exactly one|malformed/);

  const layout = makeBundle(base, "layout");
  writeFileSync(join(layout, "unexpected.txt"), "no");
  assert.throws(() => validateBundleLayout(layout), /unsupported entry/);
}));

test("finalization and selection reject mismatched and reordered APM skill evidence", () => withBase("archie-v3-apm-", (base) => {
  const mutations = [
    ["apm/apm.lock.yaml", (text) => text.replace("  - likec4-authoring", "  - likec4-authoring\n  - unrecorded-skill"), /skill subset/],
    ["apm/apm.lock.yaml", (text) => text.replace("repo_url: don-smith/archie", "repo_url: other/archie"), /repository/],
    ["apm/apm.yml", (text) => text.replace("  mcp: []", "        - unrecorded-skill\n  mcp: []"), /skill subset/],
    ["apm/apm.yml", (text) => text.replace(/^(\s*)- archie\n\1- architecture-assessment$/m, "$1- architecture-assessment\n$1- archie"), /skill subset/],
    ["apm/apm.lock.yaml", (text) => text.replace(/^(\s*)- archie\n\1- architecture-assessment$/m, "$1- architecture-assessment\n$1- archie"), /skill subset/]
  ];
  mutations.forEach(([relativePath, mutate, expected], index) => {
    const before = makeBundle(base, `before-${index}`);
    const beforePath = join(before, relativePath);
    const mutatedText = mutate(readFileSync(beforePath, "utf8"));
    assert.notEqual(mutatedText, readFileSync(beforePath, "utf8"), `mutation ${index} must change ${relativePath}`);
    writeFileSync(beforePath, mutatedText);
    assert.throws(() => finalize(before), expected);

    const after = finalizedBundle(base, `after-${index}`);
    const afterPath = join(after, relativePath);
    writeFileSync(afterPath, mutate(readFileSync(afterPath, "utf8")));
    assert.throws(() => selectLocalRelease(after), /differs|skill subset|repository/);
  });

  const locator = makeBundle(base, "locator");
  const inputPath = join(locator, "bundle.json");
  const input = JSON.parse(readFileSync(inputPath, "utf8"));
  input.apm.locator = "https://github.com/don-smith/archie.git";
  writeFileSync(inputPath, `${JSON.stringify(input, null, 2)}\n`);
  const manifestPath = join(locator, "apm", "apm.yml");
  writeFileSync(manifestPath, readFileSync(manifestPath, "utf8").replace("git@github.com:don-smith/archie.git", input.apm.locator));
  assert.throws(() => finalize(locator), /GitHub SSH/);
}));

test("parser and selection reject network, reordered, and mutated artifact evidence", () => withBase("archie-v3-artifacts-", (base) => {
  const bundle = makeBundle(base);
  const result = finalize(bundle);
  const record = JSON.parse(readFileSync(result.recordPath, "utf8"));
  record.artifacts[0].locator = "https://registry.npmjs.org/archie-runtime.tgz";
  assert.throws(() => parseReleaseRecord(`${JSON.stringify(record)}\n`), /local tarballs|malformed|not canonical/);
  const inputPath = join(bundle, "bundle.json");
  const input = JSON.parse(readFileSync(inputPath, "utf8"));
  [input.artifacts[0], input.artifacts[1]] = [input.artifacts[1], input.artifacts[0]];
  writeFileSync(inputPath, JSON.stringify(input));
  assert.throws(() => selectLocalRelease(bundle), /ordered|identity|differs|package/);
}));

test("the release schema encodes the exact skill set and no HTML snapshot", () => {
  const schema = JSON.parse(readFileSync("schemas/release-record-v3.schema.json", "utf8"));
  const skills = schema.$defs.apm.properties.skills;
  assert.deepEqual(skills.prefixItems.map((item) => item.const), ARCHIE_SKILLS);
  assert.equal(skills.items, false);
  assert.equal(schema.properties.schemaVersion.const, 3);
  assert.equal(JSON.stringify(schema).includes("htmlDesignSnapshot"), false);
  assert.equal(existsSync("schemas/release-record-v1.schema.json") || existsSync("schemas/release-record-v2.schema.json"), false);
});

test("bootstrap stages both tarballs and exposes both project-local binaries", () => withBase("archie-v3-install-", (base) => {
  const target = join(base, "target");
  mkdirSync(target);
  const calls = [];
  const result = bootstrapAndVerifyTarget(target, selectLocalRelease(finalizedBundle(base)), { run: installRunner({ calls }), verifyApmDeployment: () => undefined });
  assert.equal(result.record.schemaVersion, 3);
  assert.ok(calls.some((call) => call.join(" ") === "npm ci --ignore-scripts --offline"));
  assert.ok(readFileSync(join(target, ".archie/runtime/package.json"), "utf8").includes("@archie/conformance"));
  assert.ok(existsSync(join(target, ".archie/runtime/node_modules/.bin/architecture-docs")));
  assert.ok(existsSync(join(target, ".archie/runtime/node_modules/.bin/architecture-conformance")));
  assert.ok(readFileSync(join(target, ".archie/release", RELEASE_RECORD_FILE), "utf8").length > 0);
  assert.equal(fixture.length > 0, true);
}));

test("a failed upgrade compensates to the verified installed target", () => withBase("archie-v3-compensation-", (base) => {
  const selected = selectLocalRelease(finalizedBundle(base));
  const target = join(base, "target");
  mkdirSync(target);
  const stable = { run: installRunner(), verifyApmDeployment: () => undefined };
  bootstrapAndVerifyTarget(target, selected, stable);
  const recordPath = join(target, ".archie/release", RELEASE_RECORD_FILE);
  const before = readFileSync(recordPath, "utf8");
  let failure;
  try { upgradeAndVerifyTarget(target, selected, { ...stable, run: installRunner({ failNpm: true }) }); } catch (error) { failure = error; }
  assert.ok(failure instanceof ReleaseInstallFailure);
  assert.equal(failure.report.compensation, "passed");
  assert.equal(readFileSync(recordPath, "utf8"), before);
}));
