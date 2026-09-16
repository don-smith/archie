import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { capabilityContracts, selectCapability } from "../../dist/packages/capabilities/src/index.js";
import { PRODUCT_VERSION } from "../../dist/packages/archie-runtime/src/index.js";

const root = JSON.parse(readFileSync("package.json"));
const packages = ["archie-runtime", "archie-cli", "archie-context", "architecture-docs", "assessment", "conformance", "capabilities"];
test("all workspaces use the product version and stay private", () => {
  for (const packageName of packages) { const manifest = JSON.parse(readFileSync(`packages/${packageName}/package.json`)); assert.equal(manifest.version, root.version); assert.equal(manifest.private, true); }
  assert.equal(PRODUCT_VERSION, root.version);
  assert.equal(JSON.parse(readFileSync("packages/archie-context/product-version.json")).version, root.version);
});
test("capabilities preserve independent request, result, and authority contracts", () => {
  assert.equal(capabilityContracts.length, 6);
  assert.notEqual(selectCapability("assessment").resultMeaning, selectCapability("structural-inspection").resultMeaning);
  assert.match(selectCapability("architecture-contracts").authorityStop, /decision/i);
});
test("reviewed source imports, completed migrations, and exclusions are recorded", () => {
  const manifest = JSON.parse(readFileSync("source-import-manifest.json"));
  assert.deepEqual(manifest.imports.map((item) => item.id), ["html-design-snapshot"]);
  assert.ok(manifest.excluded.some((item) => item.path.includes("architecture-review")));
  assert.ok(manifest.migrations.some((item) => item.id === "architecture-docs-and-likec4" && item.destination === "packages/architecture-docs"));
  for (const [id, destination, inventory] of [
    ["architecture-assessment", "packages/assessment", "packages/assessment/migration-inventory.json"],
    ["architecture-conformance", "packages/conformance", "packages/conformance/migration-inventory.json"]
  ]) {
    const migration = manifest.migrations.find((item) => item.id === id);
    assert.equal(migration.destination, destination);
    assert.equal(migration.inventory, inventory);
    assert.ok(migration.gateEvidence.automated.length > 0);
    assert.equal(migration.gateEvidence.manualReview, "deferred-to-phase-8-release-candidate-trial");
  }
  assert.ok(existsSync("packages/architecture-docs/test/architecture-docs-builder.test.mjs"));
  assert.ok(existsSync("packages/assessment/skills/architecture-assessment/SKILL.md"));
  assert.equal(existsSync("packages/capabilities/assets/assessment"), false);
  assert.equal(existsSync("packages/capabilities/assets/conformance"), false);
  assert.doesNotMatch(readFileSync("packages/assessment/skills/architecture-assessment/SKILL.md", "utf8"), /myflow/i);
});
test("private release runbook documents v2 artifacts, SSH preflight, and recovery", () => {
  const runbook = readFileSync("docs/archie/private-release-bundle.md", "utf8");
  assert.match(runbook, /archie-private-bundle-input-v2/);
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
