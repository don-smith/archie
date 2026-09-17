import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("README distinguishes blocking duplicate routes from defensive Archie evaluation", async () => {
  const readme = await readFile("README.md", "utf8");
  assert.match(readme, /Duplicate configured page IDs and slugs are blocking configuration errors/);
  assert.match(readme, /`ARCHIE_AREA_DUPLICATE` is defensive evaluator-only behavior/);
  assert.doesNotMatch(readme, /Warning codes include[^\n]*`ARCHIE_AREA_DUPLICATE`/);
});

test("package exposes both architecture skills from one source and runtime dependencies", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assert.deepEqual(packageJson.pi.skills, ["./skills/architecture-docs", "./skills/likec4-authoring"]);
  assert.ok(packageJson.dependencies.likec4);
  assert.ok(packageJson.dependencies.marked);
  assert.ok(packageJson.dependencies.playwright);
  assert.match(packageJson.scripts.build, /build-architecture-docs/);
  assert.match(packageJson.scripts.check, /check-architecture-docs/);
  assert.equal(packageJson.bin["architecture-docs"], "./bin/architecture-docs.mjs");
  for (const path of [
    "bin/architecture-docs.mjs",
    "skills/architecture-docs/package-commands.md",
    "skills/likec4-authoring/c4-method.md",
    "skills/likec4-authoring/diagram-review-checklist.md",
  ]) {
    assert.ok(await readFile(path, "utf8"), `expected packaged file ${path}`);
  }
});
