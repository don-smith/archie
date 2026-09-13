import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

for (const name of ["likec4-authoring", "architecture-docs"]) {
  test(`${name} has a discoverable contract and RED/GREEN/REFACTOR scenarios`, async () => {
    const skill = await readFile(`skills/${name}/SKILL.md`, "utf8");
    const scenarios = await readFile(`test/skills/${name}/scenarios.md`, "utf8");
    assert.match(skill, new RegExp(`name: ${name}`));
    assert.match(skill, /Use when/);
    assert.match(scenarios, /RED baseline/);
    assert.match(scenarios, /GREEN scenarios/);
    assert.match(scenarios, /Variation \/ ReFACTOR evidence|Variation \/ REFACTOR evidence/);
  });
}

test("LikeC4 authoring exposes the method and reference material it requires", async () => {
  const skill = await readFile("skills/likec4-authoring/SKILL.md", "utf8");
  assert.match(skill, /c4-method\.md/);
  assert.match(skill, /likec4-reference\.md/);
  assert.match(skill, /diagram-review-checklist\.md/);
  assert.match(skill, /ARCHIE_RUNTIME_DIR[\s\S]*node_modules\/\.bin\/architecture-docs/);
  assert.doesNotMatch(skill, /PACKAGE_DIR|c4archviewer|npx --no-install architecture-docs/);
});

test("architecture docs exposes target-local command guidance", async () => {
  const skill = await readFile("skills/architecture-docs/SKILL.md", "utf8");
  assert.match(skill, /ARCHIE_RUNTIME_DIR[\s\S]*node_modules\/\.bin\/architecture-docs/);
  assert.match(skill, /skillCommand/);
  assert.doesNotMatch(skill, /PACKAGE_DIR/);
  assert.match(skill, /preview/);
  assert.match(skill, /publication/);
});
