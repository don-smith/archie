import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { capabilityContracts, selectCapability } from "../../dist/packages/capabilities/src/index.js";
import { PRODUCT_VERSION } from "../../dist/packages/archie-runtime/src/index.js";

const root = JSON.parse(readFileSync("package.json"));
const packages = ["archie-runtime", "archie-cli", "archie-context", "architecture-docs", "capabilities"];
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
test("reviewed source imports and exclusions are recorded", () => {
  const manifest = JSON.parse(readFileSync("source-import-manifest.json"));
  assert.equal(manifest.imports.length, 3);
  assert.ok(manifest.excluded.some((item) => item.path.includes("architecture-review")));
  assert.ok(manifest.migrations.some((item) => item.id === "architecture-docs-and-likec4" && item.destination === "packages/architecture-docs"));
  assert.ok(existsSync("packages/architecture-docs/test/architecture-docs-builder.test.mjs"));
  assert.ok(existsSync("packages/capabilities/assets/assessment/skills/architecture-assessment/SKILL.md"));
  assert.doesNotMatch(readFileSync("packages/capabilities/assets/assessment/skills/architecture-assessment/SKILL.md", "utf8"), /myflow/i);
});
test("private release runbook includes the SSH preflight", () => {
  assert.match(readFileSync("docs/archie/private-release-bundle.md", "utf8"), /git ls-remote git@github\.com:don-smith\/archie\.git/);
});
test("no excluded runtime path is shipped", () => {
  const output = execFileSync("npm", ["run", "pack:check"], { encoding: "utf8" });
  assert.match(output, /package contents passed/);
});
