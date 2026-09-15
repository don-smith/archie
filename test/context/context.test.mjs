import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const context = "packages/archie-context";

function command(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  assert.equal(result.status, 0, `${command} ${args.join(" ")} failed:\n${result.stderr}`);
  return result;
}

test("canonical skill sources exactly match the APM context projection", () => {
  command(process.execPath, ["scripts/sync-context-skills.mjs", "--check"]);
  const manifest = readFileSync(join(context, "apm.yml"), "utf8");
  assert.match(manifest, /^targets:\n  - agent-skills$/m);
  for (const skill of ["archie", "architecture-assessment", "architecture-docs", "likec4-authoring", "architecture-conformance-onboarding", "architecture-contracts"]) {
    assert.ok(readFileSync(join(context, ".apm", "skills", skill, "SKILL.md"), "utf8").includes("name:"));
  }
});

test("projected Assessment validator executes representative valid and invalid models", () => {
  const base = mkdtempSync(join(tmpdir(), "archie-context-assessment-"));
  try {
    const model = JSON.parse(readFileSync("packages/assessment/skills/architecture-assessment/templates/architecture-model.json", "utf8"));
    const valid = join(base, "valid.json");
    const invalid = join(base, "invalid.json");
    writeFileSync(valid, `${JSON.stringify(model, null, 2)}\n`);
    delete model.scope.drivers;
    writeFileSync(invalid, `${JSON.stringify(model, null, 2)}\n`);
    const checker = join(context, ".apm/skills/architecture-assessment/scripts/check-model.mjs");
    assert.equal(spawnSync(process.execPath, [checker, valid], { encoding: "utf8" }).status, 0);
    const result = spawnSync(process.execPath, [checker, invalid], { encoding: "utf8" });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /\$\.scope\.drivers/);

    const skill = join(context, ".apm/skills/architecture-assessment");
    const bundle = join(base, "bundle");
    mkdirSync(join(bundle, "evidence"), { recursive: true });
    cpSync(join(skill, "templates/architecture-model.json"), join(bundle, "architecture-model.json"));
    cpSync(join(skill, "templates/assessment.md"), join(bundle, "assessment.md"));
    for (const file of ["inventory.md", "flows.md", "evolution.md"]) cpSync(join(skill, "templates", file), join(bundle, "evidence", file));
    const bundleChecker = join(skill, "scripts/check-assessment.mjs");
    assert.equal(spawnSync(process.execPath, [bundleChecker, bundle], { encoding: "utf8" }).status, 0);
    writeFileSync(join(bundle, "assessment.md"), "# Assessment\n\nStatus: `ready`\n\n[model:el-system]\n");
    assert.equal(spawnSync(process.execPath, [bundleChecker, bundle], { encoding: "utf8" }).status, 1);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("Archie ships the canonical Drift Detection playbook route and reference", () => {
  const canonicalSkill = readFileSync("skills/archie/SKILL.md", "utf8");
  const canonicalReference = readFileSync("skills/archie/references/drift-detection.md", "utf8");
  assert.match(canonicalSkill, /\[the Drift Detection playbook\]\(references\/drift-detection\.md\)/);
  assert.ok(canonicalReference.length > 0);
  assert.equal(readFileSync(join(context, ".apm", "skills", "archie", "SKILL.md"), "utf8"), canonicalSkill);
  assert.equal(readFileSync(join(context, ".apm", "skills", "archie", "references", "drift-detection.md"), "utf8"), canonicalReference);
});

test("runtime dispatcher invokes only the pinned project-local runtime", () => {
  const base = mkdtempSync(join(tmpdir(), "archie-context-dispatch-"));
  try {
    const target = join(base, "target");
    const runtime = join(target, ".archie", "runtime");
    mkdirSync(join(runtime, "node_modules", "@archie", "runtime", "dist"), { recursive: true });
    mkdirSync(join(target, ".archie", "release"), { recursive: true });
    writeFileSync(join(runtime, "package-lock.json"), "{}\n");
    writeFileSync(join(target, ".archie", "release", "release-record-v1.json"), JSON.stringify({ npm: { package: "@archie/runtime" } }));
    writeFileSync(join(runtime, "node_modules", "@archie", "runtime", "dist", "skill-runtime.js"), "process.stdout.write(JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) }));");
    const result = command(process.execPath, [join(process.cwd(), context, "scripts", "dispatch-runtime.mjs"), target, "--describe"]);
    const dispatched = JSON.parse(result.stdout);
    assert.match(dispatched.cwd, /\/target$/);
    assert.deepEqual(dispatched.args, ["--describe"]);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("context contains no extension or prompt-alias artifact", () => {
  const manifest = JSON.parse(readFileSync(join(context, "package.json"), "utf8"));
  assert.equal(manifest.pi, undefined);
  assert.equal(manifest.extensions, undefined);
  assert.equal(manifest.promptTemplates, undefined);
  assert.ok(!existsSync(join(context, "extensions")));
  assert.ok(!existsSync(join(context, "prompt-templates")));
  assert.match(readFileSync("adapters/pi/TRIAL.md", "utf8"), /\/skill:archie/);
});
