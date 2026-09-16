import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

test("onboarding skill names local setup, resume, deterministic evidence, and maintainer-only boundaries", async () => {
  const skill = await readFile(join(process.cwd(), "skills", "architecture-conformance-onboarding", "SKILL.md"), "utf8");
  assert.match(skill, /\.archie\/runtime\/node_modules\/\.bin\/architecture-conformance onboard setup/);
  assert.doesNotMatch(skill, /install a published exact `architecture-conformance`/);
  assert.match(skill, /onboarding-state\/v1/);
  assert.equal((skill.match(/--exclude/g) ?? []).length, 2);
  assert.match(skill, /maintainer/i);
  assert.match(skill, /must not.*architecture ID|must not.*approval|must not.*baseline/i);
});
