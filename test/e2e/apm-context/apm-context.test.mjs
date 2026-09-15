import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const skillNames = ["archie", "architecture-assessment", "architecture-docs", "likec4-authoring", "architecture-conformance-onboarding", "architecture-contracts"];

function files(root, directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    return entry.isDirectory() ? files(root, absolute) : statSync(absolute).isFile() ? [absolute.slice(root.length + 1)] : [];
  }).sort();
}

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
      const deployedRoot = join(project, ".agents", "skills", skill);
      const canonicalRoot = join(project, ".apm", "skills", skill);
      assert.ok(existsSync(join(deployedRoot, "SKILL.md")), `APM did not deploy ${skill}`);
      assert.deepEqual(files(deployedRoot), files(canonicalRoot), `${skill} deployed file set differs`);
      for (const relative of files(canonicalRoot)) {
        assert.deepEqual(readFileSync(join(deployedRoot, relative)), readFileSync(join(canonicalRoot, relative)), `${skill}/${relative} differs`);
      }
    }

    const deployedAssessment = join(project, ".agents/skills/architecture-assessment");
    const model = JSON.parse(readFileSync(join(deployedAssessment, "templates/architecture-model.json"), "utf8"));
    const valid = join(base, "valid.json");
    const invalid = join(base, "invalid.json");
    writeFileSync(valid, `${JSON.stringify(model, null, 2)}\n`);
    delete model.interfaces[0].inputs;
    writeFileSync(invalid, `${JSON.stringify(model, null, 2)}\n`);
    const checker = join(deployedAssessment, "scripts/check-model.mjs");
    assert.equal(spawnSync(process.execPath, [checker, valid], { encoding: "utf8" }).status, 0);
    const invalidResult = spawnSync(process.execPath, [checker, invalid], { encoding: "utf8" });
    assert.equal(invalidResult.status, 1, invalidResult.stderr);
    assert.match(invalidResult.stderr, /\$\.interfaces\[0\]\.inputs/);

    const bundle = join(base, "bundle");
    const evidence = join(bundle, "evidence");
    mkdirSync(evidence, { recursive: true });
    cpSync(join(deployedAssessment, "templates/architecture-model.json"), join(bundle, "architecture-model.json"));
    writeFileSync(join(bundle, "assessment.md"), readFileSync(join(deployedAssessment, "templates/assessment.md")));
    writeFileSync(join(evidence, "inventory.md"), readFileSync(join(deployedAssessment, "templates/inventory.md")));
    writeFileSync(join(evidence, "flows.md"), readFileSync(join(deployedAssessment, "templates/flows.md")));
    writeFileSync(join(evidence, "evolution.md"), readFileSync(join(deployedAssessment, "templates/evolution.md")));
    const bundleChecker = join(deployedAssessment, "scripts/check-assessment.mjs");
    assert.equal(spawnSync(process.execPath, [bundleChecker, bundle], { encoding: "utf8" }).status, 0);
    writeFileSync(join(bundle, "assessment.md"), "# Assessment\n\nStatus: `ready`\n\n[model:el-system]\n");
    const invalidBundle = spawnSync(process.execPath, [bundleChecker, bundle], { encoding: "utf8" });
    assert.equal(invalidBundle.status, 1, invalidBundle.stderr);
    assert.match(invalidBundle.stderr, /status ready does not agree/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
