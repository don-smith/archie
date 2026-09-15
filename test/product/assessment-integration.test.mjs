import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const canonical = "packages/assessment/skills/architecture-assessment";
const projected = "packages/archie-context/.apm/skills/architecture-assessment";

function runValidator(skill, file) {
  return spawnSync(process.execPath, [join(skill, "scripts/check-model.mjs"), file], { encoding: "utf8" });
}

function runBundleValidator(skill, directory) {
  return spawnSync(process.execPath, [join(skill, "scripts/check-assessment.mjs"), directory], { encoding: "utf8" });
}

function bundleFixture(skill = canonical) {
  const directory = mkdtempSync(join(tmpdir(), "archie-assessment-bundle-"));
  mkdirSync(join(directory, "evidence"));
  cpSync(join(skill, "templates/architecture-model.json"), join(directory, "architecture-model.json"));
  cpSync(join(skill, "templates/assessment.md"), join(directory, "assessment.md"));
  for (const file of ["inventory.md", "flows.md", "evolution.md"]) cpSync(join(skill, "templates", file), join(directory, "evidence", file));
  return directory;
}

function validAndInvalidFiles() {
  const directory = mkdtempSync(join(tmpdir(), "archie-assessment-validator-"));
  const model = JSON.parse(readFileSync(join(canonical, "templates/architecture-model.json"), "utf8"));
  const valid = join(directory, "valid.json");
  const invalid = join(directory, "invalid.json");
  writeFileSync(valid, `${JSON.stringify(model, null, 2)}\n`);
  delete model.target;
  writeFileSync(invalid, `${JSON.stringify(model, null, 2)}\n`);
  return { directory, valid, invalid };
}

test("Assessment workspace is canonical and the old capability asset tree is absent", () => {
  assert.ok(existsSync(join(canonical, "SKILL.md")));
  assert.ok(existsSync("packages/assessment/evaluation/run-evals.mjs"));
  assert.ok(existsSync("packages/assessment/test/architecture-assessment-model.test.mjs"));
  assert.equal(existsSync("packages/capabilities/assets/assessment"), false);
});

test("canonical and projected validators accept and reject the same representative models and bundles", () => {
  const fixture = validAndInvalidFiles();
  try {
    for (const skill of [canonical, projected]) {
      assert.equal(runValidator(skill, fixture.valid).status, 0, skill);
      const invalid = runValidator(skill, fixture.invalid);
      assert.equal(invalid.status, 1, `${skill}: ${invalid.stderr}`);
      assert.match(invalid.stderr, /\$\.target/);

      const bundle = bundleFixture(skill);
      try {
        assert.equal(runBundleValidator(skill, bundle).status, 0, skill);
        writeFileSync(join(bundle, "assessment.md"), "# Assessment\n\nStatus: `blocked`\n\n[model:el-system]\n");
        const invalidBundle = runBundleValidator(skill, bundle);
        assert.equal(invalidBundle.status, 1, invalidBundle.stderr);
        assert.match(invalidBundle.stderr, /status blocked does not agree/);
      } finally {
        rmSync(bundle, { recursive: true, force: true });
      }
    }
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("the packed Assessment validator executes without workspace files", () => {
  const directory = mkdtempSync(join(tmpdir(), "archie-assessment-pack-"));
  try {
    const packed = spawnSync("npm", ["pack", "--json", "--workspace", "@archie/assessment", "--pack-destination", directory], { encoding: "utf8" });
    assert.equal(packed.status, 0, packed.stderr);
    const archive = join(directory, JSON.parse(packed.stdout)[0].filename);
    const extracted = join(directory, "extracted");
    mkdirSync(extracted);
    const untar = spawnSync("tar", ["-xzf", archive, "-C", extracted], { encoding: "utf8" });
    assert.equal(untar.status, 0, untar.stderr);
    const fixture = validAndInvalidFiles();
    try {
      const skill = join(extracted, "package", "skills", "architecture-assessment");
      assert.equal(runValidator(skill, fixture.valid).status, 0);
      const invalid = runValidator(skill, fixture.invalid);
      assert.equal(invalid.status, 1, invalid.stderr);
      assert.match(invalid.stderr, /\$\.target/);
      const bundle = bundleFixture(skill);
      try {
        assert.equal(runBundleValidator(skill, bundle).status, 0);
        writeFileSync(join(bundle, "assessment.md"), "# Assessment\n\nStatus: `ready`\n\n[model:el-system]\n");
        assert.equal(runBundleValidator(skill, bundle).status, 1);
      } finally {
        rmSync(bundle, { recursive: true, force: true });
      }
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
