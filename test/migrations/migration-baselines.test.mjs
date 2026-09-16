import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const assessmentPackage = path.join(root, "packages/assessment");
const conformancePackage = path.join(root, "packages/conformance");
const assessmentUpstream = "/Users/don/projects/architecture-assessment";
const conformanceCli = "/Users/don/projects/arch-conformance/dist/src/cli.js";

function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: "utf8" });
}

test("completed migrations verify pinned sources without recreating legacy asset trees", () => {
  const result = run("npm", ["run", "import:owned"], root);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Verified 1 imported source and 3 completed migrations/);
  for (const legacy of ["packages/capabilities/assets/assessment", "packages/capabilities/assets/conformance"]) {
    assert.equal(run(process.execPath, ["-e", `process.exit(require('node:fs').existsSync('${legacy}') ? 1 : 0)`], root).status, 0, legacy);
  }
});

test("migration inventories cover both pinned source trees and reject an unmapped path", async () => {
  const result = run(process.execPath, ["scripts/check-migration-inventory.mjs"], root);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /assessment: 62 paths mapped/);
  assert.match(result.stdout, /conformance: 98 paths mapped/);

  const inventory = JSON.parse(await readFile(path.join(assessmentPackage, "migration-inventory.json"), "utf8"));
  inventory.entries.shift();
  const directory = await mkdtemp(path.join(os.tmpdir(), "archie-inventory-characterization-"));
  const incompletePath = path.join(directory, "migration-inventory.json");
  await writeFile(incompletePath, `${JSON.stringify(inventory, null, 2)}\n`);
  const incomplete = run(process.execPath, ["scripts/check-migration-inventory.mjs", incompletePath], root);
  assert.equal(incomplete.status, 1);
  assert.match(incomplete.stderr, /inventory mismatch; missing \[\.gitignore\]/);
});

test("Assessment preserves current schema gaps and false-ready behavior as Phase 2 red cases", async () => {
  const cases = JSON.parse(await readFile(path.join(assessmentPackage, "test/fixtures/validator-characterization.json"), "utf8"));
  const template = JSON.parse(await readFile(path.join(assessmentPackage, "test/fixtures/architecture-model.json"), "utf8"));
  const checker = path.join(assessmentUpstream, "skills/architecture-assessment/scripts/check-model.mjs");
  const bundleChecker = path.join(assessmentUpstream, "skills/architecture-assessment/scripts/check-assessment.mjs");

  for (const fixture of cases.modelCases) {
    const model = structuredClone(template);
    if (fixture.mutation === "delete-target") delete model.target;
    if (fixture.mutation === "delete-scope-drivers") delete model.scope.drivers;
    if (fixture.mutation === "dangling-scope-scenario") model.scope.scenarioIds = ["scn-missing"];
    if (fixture.mutation === "incomplete-interface") delete model.interfaces[0].inputs;
    const directory = await mkdtemp(path.join(os.tmpdir(), "archie-assessment-characterization-"));
    const modelPath = path.join(directory, "architecture-model.json");
    await writeFile(modelPath, `${JSON.stringify(model, null, 2)}\n`);
    const result = run(process.execPath, [checker, modelPath], assessmentUpstream);
    assert.equal(result.status, fixture.currentExit, `${fixture.id}: ${result.stderr}`);
    assert.equal(result.stdout.replace(modelPath, "<MODEL>"), fixture.currentStdout, `${fixture.id}: stdout drifted`);
    assert.equal(result.stderr, fixture.currentStderr, `${fixture.id}: stderr drifted`);
    assert.equal(fixture.phase2ExpectedExit, 1, `${fixture.id} must stay visibly red for Phase 2`);
  }

  const falseReady = cases.bundleCases.find((fixture) => fixture.id === "ready-without-correction-or-triage");
  const directory = await mkdtemp(path.join(os.tmpdir(), "archie-assessment-ready-characterization-"));
  const evidence = path.join(directory, "evidence");
  await mkdir(evidence);
  const model = structuredClone(template);
  model.status = "ready";
  model.blockers = [];
  await writeFile(path.join(directory, "architecture-model.json"), `${JSON.stringify(model, null, 2)}\n`);
  for (const relative of ["assessment.md", "evidence/inventory.md", "evidence/flows.md", "evidence/evolution.md"]) {
    await writeFile(path.join(directory, relative), "# Evidence\n\n[model:el-system]\n");
  }
  await writeFile(path.join(directory, "packet.html"), "<!doctype html><title>Packet</title>\n");
  const htmlSkill = path.join(directory, "html-design");
  await mkdir(path.join(htmlSkill, "scripts"), { recursive: true });
  await writeFile(path.join(htmlSkill, "scripts/check-artifact.mjs"), "process.exitCode = 0;\n");
  const result = run(process.execPath, [bundleChecker, directory, "--html-skill-dir", htmlSkill], assessmentUpstream);
  assert.equal(result.status, falseReady.currentExit, result.stderr);
  assert.equal(result.stdout.replace(directory, "<BUNDLE>"), falseReady.currentStdout);
  assert.equal(result.stderr, falseReady.currentStderr);
  assert.equal(falseReady.phase2ExpectedExit, 1, "false-ready behavior must stay visibly red for Phase 2");
});

test("Conformance CLI reproduces frozen exits, canonical JSON, text, and allowed unstable fields", async () => {
  const fixtureRoot = path.join(conformancePackage, "test/fixtures/cli");
  const expected = JSON.parse(await readFile(path.join(fixtureRoot, "expected.json"), "utf8"));
  const cases = [
    ["valid", ["check", "--map", "map.json", "--contract", "contract-valid.json"]],
    ["violationJson", ["check", "--map", "map.json", "--contract", "contract-violation.json"]],
    ["violationText", ["check", "--map", "map.json", "--contract", "contract-violation.json", "--format", "text"]],
    ["strictGap", ["check", "--map", "map-gap.json", "--contract", "contract-violation.json", "--strict"]],
    ["usageError", ["check", "--map", "missing.json", "--contract", "contract-valid.json"]],
  ];

  for (const [id, args] of cases) {
    const result = run(process.execPath, [conformanceCli, ...args], fixtureRoot);
    assert.equal(result.status, expected.cases[id].exit, `${id}: ${result.stderr}`);
    assert.equal(result.stdout, expected.cases[id].stdout, `${id}: stdout drifted`);
    const stderr = id === "usageError" ? result.stderr.replaceAll(fixtureRoot, "<FIXTURE_ROOT>") : result.stderr;
    assert.equal(stderr, expected.cases[id].stderr, `${id}: stderr drifted`);
  }
  assert.deepEqual(expected.allowedUnstableFields, ["cases.usageError.stderr.absoluteFixtureRoot"]);
});
