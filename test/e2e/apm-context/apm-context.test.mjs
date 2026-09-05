import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const skillNames = ["archie", "architecture-assessment", "architecture-docs", "likec4-authoring", "architecture-conformance-onboarding", "architecture-contracts"];

test("frozen APM context deployment is replayable and deploys the canonical skills", () => {
  const base = mkdtempSync(join(tmpdir(), "archie-apm-context-"));
  try {
    const project = join(base, "project");
    cpSync("packages/archie-context", project, { recursive: true });
    rmSync(join(project, "apm_modules"), { recursive: true, force: true });
    const before = ["apm.yml", "apm.lock.yaml"].map((file) => readFileSync(join(project, file), "utf8"));
    for (const attempt of [1, 2]) {
      const result = spawnSync("apm", ["install", "--frozen"], { cwd: project, encoding: "utf8" });
      assert.equal(result.status, 0, `frozen APM install ${attempt} failed:\n${result.stdout}\n${result.stderr}`);
      assert.deepEqual(["apm.yml", "apm.lock.yaml"].map((file) => readFileSync(join(project, file), "utf8")), before);
    }
    for (const skill of skillNames) {
      const deployed = join(project, ".agents", "skills", skill, "SKILL.md");
      const canonical = join(project, ".apm", "skills", skill, "SKILL.md");
      assert.ok(existsSync(deployed), `APM did not deploy ${skill}`);
      assert.equal(readFileSync(deployed, "utf8"), readFileSync(canonical, "utf8"));
    }
  } finally { rmSync(base, { recursive: true, force: true }); }
});
