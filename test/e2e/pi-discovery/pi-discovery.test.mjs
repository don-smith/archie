import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("Pi adapter deploys Archie to its documented project Agent Skills discovery path", () => {
  const base = mkdtempSync(join(tmpdir(), "archie-pi-discovery-"));
  try {
    const project = join(base, "project");
    const skill = join(project, ".agents", "skills", "archie");
    cpSync("packages/archie-context/.apm/skills/archie", skill, { recursive: true });
    const instruction = readFileSync(join(skill, "SKILL.md"), "utf8");
    assert.match(instruction, /^name: archie$/m);
    assert.match(readFileSync("adapters/pi/TRIAL.md", "utf8"), /\.agents\/skills\/archie\/SKILL\.md/);
    assert.match(readFileSync("adapters/pi/TRIAL.md", "utf8"), /\/skill:archie/);
    const pi = spawnSync("pi", ["--help"], { encoding: "utf8" });
    assert.equal(pi.status, 0, pi.stderr);
    assert.match(pi.stdout, /--no-skills/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
