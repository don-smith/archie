import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import * as modelValidation from "../skills/architecture-assessment/scripts/check-model.mjs";

const root = path.resolve(import.meta.dirname, "..");
const checker = path.join(root, "skills/architecture-assessment/scripts/check-model.mjs");
const template = path.join(root, "skills/architecture-assessment/templates/architecture-model.json");
const tempDir = () => mkdtemp(path.join(os.tmpdir(), "architecture-model-test-"));

function run(file) {
  return spawnSync(process.execPath, [checker, file], { cwd: root, encoding: "utf8" });
}

async function modelCopy(mutate) {
  const directory = await tempDir();
  const model = JSON.parse(await readFile(template, "utf8"));
  mutate(model);
  const file = path.join(directory, "architecture-model.json");
  await writeFile(file, `${JSON.stringify(model, null, 2)}\n`);
  return file;
}

test("the architecture model template satisfies the targeted contract through one exported entry point", () => {
  assert.deepEqual(Object.keys(modelValidation), ["validateModel"]);
  const result = run(template);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /valid architecture model/);
});

test("runs schema validation before semantic validation", async () => {
  const file = await modelCopy((model) => {
    delete model.target;
    delete model.scope.drivers;
    model.relationships[0].to = "el-missing";
  });
  const result = run(file);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\$\.target/);
  assert.match(result.stderr, /\$\.scope\.drivers/);
  assert.doesNotMatch(result.stderr, /existing element ID/);
});

test("rejects incomplete interfaces at their repair paths", async () => {
  const fields = ["inputs", "outputs", "invariants", "errors", "ordering", "consistency", "versioning", "trust", "adapters", "testSeam"];
  for (const field of fields) {
    const file = await modelCopy((model) => { delete model.interfaces[0][field]; });
    const result = run(file);
    assert.equal(result.status, 1, `${field}: ${result.stderr}`);
    assert.match(result.stderr, new RegExp(`\\$\\.interfaces\\[0\\]\\.${field}`));
  }
});

test("rejects duplicate and malformed stable IDs with repair-oriented JSON paths", async () => {
  const duplicate = await modelCopy((model) => {
    model.elements.push({ ...model.elements[0] });
  });
  const duplicateResult = run(duplicate);
  assert.equal(duplicateResult.status, 1);
  assert.match(duplicateResult.stderr, /\$\.elements\[2\]\.id/);
  assert.match(duplicateResult.stderr, /el-system/);
  assert.match(duplicateResult.stderr, /unique/);

  const malformed = await modelCopy((model) => {
    model.claims[0].id = "element-wrong-prefix";
  });
  const malformedResult = run(malformed);
  assert.equal(malformedResult.status, 1);
  assert.match(malformedResult.stderr, /\$\.claims\[0\]\.id/);
  assert.match(malformedResult.stderr, /claim-/);
});

test("rejects dangling relationship endpoints and unsupported enums", async () => {
  const dangling = await modelCopy((model) => {
    model.relationships[0].to = "el-missing";
  });
  const danglingResult = run(dangling);
  assert.equal(danglingResult.status, 1);
  assert.match(danglingResult.stderr, /\$\.relationships\[0\]\.to/);
  assert.match(danglingResult.stderr, /existing element/);

  const badEnum = await modelCopy((model) => {
    model.relationships[0].kind = "mystery-edge";
  });
  const badEnumResult = run(badEnum);
  assert.equal(badEnumResult.status, 1);
  assert.match(badEnumResult.stderr, /\$\.relationships\[0\]\.kind/);
  assert.match(badEnumResult.stderr, /source-dependency/);
});

test("enforces certainty, state, and evidence combinations", async () => {
  const unsupported = await modelCopy((model) => {
    model.claims[0].state = "future";
    model.claims[0].certainty = "likely";
  });
  const unsupportedResult = run(unsupported);
  assert.equal(unsupportedResult.status, 1);
  assert.match(unsupportedResult.stderr, /\$\.claims\[0\]\.state/);
  assert.match(unsupportedResult.stderr, /\$\.claims\[0\]\.certainty/);

  const noCode = await modelCopy((model) => {
    model.claims[0].evidence = [{ sourceId: "src-intent", locator: "README.md:3" }];
  });
  const noCodeResult = run(noCode);
  assert.equal(noCodeResult.status, 1);
  assert.match(noCodeResult.stderr, /\$\.claims\[0\]\.evidence/);
  assert.match(noCodeResult.stderr, /code or configuration evidence/);

  const unresolved = await modelCopy((model) => {
    model.claims[0].certainty = "unresolved";
    delete model.claims[0].gap;
  });
  const unresolvedResult = run(unresolved);
  assert.equal(unresolvedResult.status, 1);
  assert.match(unresolvedResult.stderr, /\$\.claims\[0\]\.gap/);
  assert.match(unresolvedResult.stderr, /unresolved/);

  const blended = await modelCopy((model) => {
    model.claims[0].state = "both";
  });
  const blendedResult = run(blended);
  assert.equal(blendedResult.status, 1);
  assert.match(blendedResult.stderr, /tracked intent or developer evidence/);
});

test("rejects dangling scenario, contract, data authority, and source evidence references", async () => {
  const scopeScenario = await modelCopy((model) => { model.scope.scenarioIds = ["scn-missing"]; });
  assert.match(run(scopeScenario).stderr, /\$\.scope\.scenarioIds\[0\].*existing scenario ID/);

  const contract = await modelCopy((model) => { model.scenarios[0].changeSurface.contracts = ["if-missing"]; });
  assert.match(run(contract).stderr, /\$\.scenarios\[0\]\.changeSurface\.contracts\[0\].*existing interface ID/);

  const authority = await modelCopy((model) => { model.data[0].authority = "el-missing"; });
  assert.match(run(authority).stderr, /\$\.data\[0\]\.authority.*existing element ID/);

  const owner = await modelCopy((model) => { model.data[0].owners = ["el-missing"]; });
  assert.match(run(owner).stderr, /\$\.data\[0\]\.owners\[0\].*existing element ID/);

  const evidence = await modelCopy((model) => { model.claims[0].evidence[0].sourceId = "src-missing"; });
  assert.match(run(evidence).stderr, /\$\.claims\[0\]\.evidence\[0\]\.sourceId.*existing source ID/);
});

test("requires complete approved-file inventory coverage", async () => {
  const missing = await modelCopy((model) => {
    model.inventory = model.inventory.filter((item) => item.path !== "README.md");
  });
  const missingResult = run(missing);
  assert.equal(missingResult.status, 1);
  assert.match(missingResult.stderr, /\$\.scope\.expectedFiles/);
  assert.match(missingResult.stderr, /README\.md/);
  assert.match(missingResult.stderr, /inventory/);

  const unread = await modelCopy((model) => {
    model.inventory[1].coverage = "not-read";
  });
  const unreadResult = run(unread);
  assert.equal(unreadResult.status, 1);
  assert.match(unreadResult.stderr, /\$\.inventory\[1\]\.coverage/);
  assert.match(unreadResult.stderr, /included production files must be read/);
});

test("ready and blocked model states require complete machine-readable review state", async () => {
  const uncorrected = await modelCopy((model) => {
    model.status = "ready";
    model.blockers = [];
  });
  assert.match(run(uncorrected).stderr, /\$\.factualCorrection\.status.*completed/);

  const correctionWithoutSummary = await modelCopy((model) => {
    model.status = "ready";
    model.blockers = [];
    model.factualCorrection.status = "completed";
  });
  assert.match(run(correctionWithoutSummary).stderr, /\$\.factualCorrection\.summary.*non-empty/);

  const pending = await modelCopy((model) => {
    model.status = "ready";
    model.blockers = [];
    model.factualCorrection.status = "completed";
    model.recommendations.push({
      id: "rec-boundary",
      title: "Preserve the current boundary",
      outcome: "pending",
      reason: "",
      dependencies: [],
      candidateChecks: [],
    });
  });
  const pendingResult = run(pending);
  assert.match(pendingResult.stderr, /\$\.recommendations\[0\]\.outcome.*accepted, rejected, or deferred/);
  assert.match(pendingResult.stderr, /\$\.recommendations\[0\]\.reason.*non-empty triage reason/);

  const blocker = await modelCopy((model) => {
    model.status = "ready";
    model.factualCorrection.status = "completed";
  });
  assert.match(run(blocker).stderr, /\$\.blockers.*ready models cannot retain blockers/);

  const blockedWithoutReason = await modelCopy((model) => {
    model.status = "blocked";
    model.blockers = [];
  });
  assert.match(run(blockedWithoutReason).stderr, /\$\.blockers.*actionable blockers/);
});
