import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { capabilityContracts, selectCapability } from "../../dist/packages/capabilities/src/index.js";
import { PRODUCT_VERSION } from "../../dist/packages/archie-runtime/src/index.js";

const root = JSON.parse(readFileSync("package.json"));
const packages = ["archie-runtime", "archie-cli", "archie-context", "architecture-docs", "assessment", "conformance", "html-design", "architecture-review", "capabilities"];
const capabilityFieldIds = ["problem", "when-to-use", "result", "start"];
const requiredTopicIds = ["overview", "working-relationship", "stewardship", "observed-import-graph", "c4-view-selection"];

function markerCount(source, marker) {
  return source.split(marker).length - 1;
}
test("all workspaces use the product version and stay private", () => {
  for (const packageName of packages) { const manifest = JSON.parse(readFileSync(`packages/${packageName}/package.json`)); assert.equal(manifest.version, root.version); assert.equal(manifest.private, true); }
  assert.equal(PRODUCT_VERSION, root.version);
  assert.equal(JSON.parse(readFileSync("packages/archie-context/product-version.json")).version, root.version);
  for (const apmManifest of ["packages/archie-context/apm.yml", "test/fixtures/private-bundles/valid/apm/apm.yml"]) {
    const versionLine = readFileSync(apmManifest, "utf8").split("\n").find((line) => line.startsWith("version:"));
    assert.ok(versionLine, `${apmManifest} is missing its version line`);
    assert.equal(versionLine.split(":")[1].trim(), root.version, `${apmManifest} version`);
  }
});
test("capabilities preserve independent request, result, and authority contracts", () => {
  assert.equal(capabilityContracts.length, 7);
  assert.notEqual(selectCapability("assessment").resultMeaning, selectCapability("architecture-review").resultMeaning);
  assert.match(selectCapability("architecture-contracts").authorityStop, /decision/i);
});
test("managed-site guide covers the registered capabilities and marker contract", () => {
  const guide = readFileSync("docs/archie/managed-site-guide.md", "utf8");
  assert.equal(markerCount(guide, "<!-- archie-guide:v1 -->"), 1);
  for (const topicId of requiredTopicIds) {
    assert.equal(markerCount(guide, `<!-- archie-topic:${topicId} -->`), 1, `topic ${topicId}`);
  }
  for (const capability of capabilityContracts) {
    for (const fieldId of capabilityFieldIds) {
      const marker = `<!-- archie-capability:${capability.id}:${fieldId} -->`;
      assert.equal(markerCount(guide, marker), 1, `${capability.id} ${fieldId}`);
    }
  }
  assert.match(guide, /Architecture Assessment skill[\s\S]*optional brief/i);
  assert.doesNotMatch(guide, /planning artifact|workstream/i);
  // The conformance CLI ships inside the pinned Archie runtime, so a target
  // needs no dependency of its own. Both halves are asserted: the guide must
  // name the runtime executable, and must not send anyone back to installing
  // the deprecated standalone package or reaching for npx.
  assert.match(guide, /\.archie\/runtime\/node_modules\/\.bin\/architecture-conformance onboard setup/);
  assert.doesNotMatch(guide, /target-local `architecture-conformance` devDependency/);
  assert.doesNotMatch(guide, /npx --no-install architecture-conformance/);
  assert.match(guide, /Architecture Review[\s\S]*\.archie\/reviews\//);
  assert.match(guide, /HTML Design[\s\S]*without any extra installation/);
  assert.doesNotMatch(guide, /structural-inspection|no available owner/i);
  assert.match(guide, /observed import graph/);
  assert.match(guide, /compilation proves syntax and references, not architectural truth/i);
  assert.doesNotMatch(guide, /Architecture Audit/i);
});

test("product spec and catalog use the registered capability vocabulary", () => {
  const productSpec = readFileSync("context/01-product/spec.md", "utf8");
  const catalog = readFileSync("skills/archie/references/capability-catalog.md", "utf8");
  for (const capability of capabilityContracts) {
    assert.ok(productSpec.includes(`| \`${capability.id}\` |`));
    assert.ok(catalog.includes(`| \`${capability.id}\` |`));
  }
  assert.doesNotMatch(`${productSpec}\n${catalog}`, /Architecture Audit/i);
  assert.doesNotMatch(`${productSpec}\n${catalog}`, /module audit/i);
});

test("managed-site packaging is the sole exception to target-owned architecture documents", () => {
  const productSpec = readFileSync("context/01-product/spec.md", "utf8");
  assert.match(
    productSpec,
    /packaged managed-site Archie page[\s\S]*sole narrow exception[\s\S]*ID `archie`[\s\S]*title `Archie`[\s\S]*slug `archie`[\s\S]*hidden completeness markers/i,
  );
  assert.match(
    productSpec,
    /target repository still owns every other page, model, glossary, evidence source, local adaptation of the Archie page, and review rule/i,
  );
  assert.match(productSpec, /does not create an Archie-wide architecture-document format/i);
  assert.doesNotMatch(productSpec, /Archie (?:defines|imposes|requires) an Archie-wide architecture-document format/i);
});

test("reviewed source imports, completed migrations, and exclusions are recorded", () => {
  const manifest = JSON.parse(readFileSync("source-import-manifest.json"));
  assert.deepEqual(manifest.imports, []);
  for (const migration of manifest.migrations) {
    assert.ok(migration.gateEvidence?.automated.length > 0, `${migration.id} records automated gate evidence`);
    assert.equal(migration.gateEvidence.manualReview, "not-performed: verified through use until an evaluation system exists", `${migration.id} records that manual review was not performed`);
  }
  for (const migration of manifest.migrations) {
    if (migration.legacyDestination) assert.equal(existsSync(migration.legacyDestination), false, `${migration.id} legacy assets remain`);
    if (!migration.inventory) continue;
    const inventory = JSON.parse(readFileSync(migration.inventory));
    assert.equal(inventory.source.repository, migration.repository, `${migration.id} inventory repository`);
    assert.equal(inventory.source.revision, migration.revision, `${migration.id} inventory revision`);
    const summary = { included: 0, excluded: 0, adapted: 0, generated: 0 };
    for (const entry of inventory.entries) summary[entry.disposition] += 1;
    assert.deepEqual(summary, migration.inventorySummary, `${migration.id} inventory summary`);
  }
  assert.equal(manifest.excluded.some((item) => item.path.includes("architecture-review")), false);
  assert.ok(manifest.migrations.some((item) => item.id === "architecture-review" && item.destination === "packages/architecture-review"));
  assert.ok(manifest.migrations.some((item) => item.id === "architecture-docs-and-likec4" && item.destination === "packages/architecture-docs"));
  assert.ok(manifest.migrations.some((item) => item.id === "html-design" && item.destination === "packages/html-design"));
  for (const [id, destination, inventory] of [
    ["architecture-assessment", "packages/assessment", "packages/assessment/migration-inventory.json"],
    ["architecture-conformance", "packages/conformance", "packages/conformance/migration-inventory.json"]
  ]) {
    const migration = manifest.migrations.find((item) => item.id === id);
    assert.equal(migration.destination, destination);
    assert.equal(migration.inventory, inventory);
    assert.ok(migration.gateEvidence.automated.length > 0);
    assert.equal(migration.gateEvidence.manualReview, "not-performed: verified through use until an evaluation system exists");
  }
  assert.ok(existsSync("packages/architecture-docs/test/architecture-docs-builder.test.mjs"));
  assert.ok(existsSync("packages/assessment/skills/architecture-assessment/SKILL.md"));
  assert.equal(existsSync("packages/capabilities/assets/assessment"), false);
  assert.equal(existsSync("packages/capabilities/assets/conformance"), false);
  assert.doesNotMatch(readFileSync("packages/assessment/skills/architecture-assessment/SKILL.md", "utf8"), /myflow/i);
});
test("release bundle runbook documents bundle input, SSH preflight, and recovery", () => {
  const runbook = readFileSync("context/03-delivery/guides/release-bundle-operations.md", "utf8");
  assert.match(runbook, /archie-private-bundle-input-v3/);
  assert.match(runbook, /@archie\/runtime/);
  assert.match(runbook, /@archie\/conformance/);
  assert.match(runbook, /git ls-remote git@github\.com:don-smith\/archie\.git/);
  assert.match(runbook, /compensation/i);
  assert.match(runbook, /failure-report\.json/);
});
test("no excluded runtime path is shipped", () => {
  const output = execFileSync("npm", ["run", "pack:check"], { encoding: "utf8" });
  assert.match(output, /package contents passed/);
});
