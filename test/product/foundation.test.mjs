import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { capabilityContracts, selectCapability } from "../../dist/packages/capabilities/src/index.js";
import { PRODUCT_VERSION } from "../../dist/packages/archie-runtime/src/index.js";

const root = JSON.parse(readFileSync("package.json"));
const packages = ["archie-runtime", "archie-cli", "archie-context", "capabilities"];
const capabilityFieldIds = ["problem", "when-to-use", "result", "start"];
const requiredTopicIds = ["overview", "working-relationship", "stewardship", "observed-import-graph", "c4-view-selection"];

function markerCount(source, marker) {
  return source.split(marker).length - 1;
}
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
  assert.match(guide, /Architecture Assessment skill[\s\S]*planning artifact/i);
  assert.match(guide, /exact target-local `architecture-conformance` devDependency/);
  assert.match(guide, /Structural inspection starts through Archie[\s\S]*no available owner/i);
  assert.match(guide, /observed import graph/);
  assert.match(guide, /compilation proves syntax and references, not architectural truth/i);
  assert.doesNotMatch(guide, /Architecture Audit/i);
});

test("foundation and catalog use the registered capability vocabulary", () => {
  const foundation = readFileSync("docs/archie/foundation.md", "utf8");
  const catalog = readFileSync("skills/archie/references/capability-catalog.md", "utf8");
  for (const capability of capabilityContracts) {
    assert.ok(foundation.includes(`| \`${capability.id}\` |`));
    assert.ok(catalog.includes(`| \`${capability.id}\` |`));
  }
  assert.doesNotMatch(`${foundation}\n${catalog}`, /Architecture Audit/i);
  assert.doesNotMatch(`${foundation}\n${catalog}`, /module audit/i);
});

test("reviewed source imports and exclusions are recorded", () => {
  const manifest = JSON.parse(readFileSync("source-import-manifest.json"));
  assert.equal(manifest.imports.length, 4);
  assert.ok(manifest.excluded.some((item) => item.path.includes("architecture-review")));
  assert.ok(existsSync("packages/capabilities/assets/assessment/skills/architecture-assessment/SKILL.md"));
  assert.doesNotMatch(readFileSync("packages/capabilities/assets/assessment/skills/architecture-assessment/SKILL.md", "utf8"), /myflow/i);
});
test("no excluded runtime path is shipped", () => {
  const output = execFileSync("npm", ["run", "pack:check"], { encoding: "utf8" });
  assert.match(output, /package contents passed/);
});
