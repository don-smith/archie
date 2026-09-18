import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { uninstallTarget } from "../../../dist/packages/archie-runtime/src/release-install/uninstall.js";

function put(path, contents) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, contents);
}

/** A target as bootstrap leaves it: Archie's own files, a journal, and content Archie does not own. */
function installedTarget() {
  const target = mkdtempSync(join(tmpdir(), "archie-uninstall-"));
  put(join(target, "README.md"), "the project\n");
  put(join(target, ".archie", "version"), "0.1.0-private.1\n");
  put(join(target, ".archie", "release", "release-record-v3.json"), "{}\n");
  put(join(target, ".archie", "runtime", "package-lock.json"), "{}\n");
  put(join(target, ".archie", "runtime", "npm", "archie-runtime.tgz"), "tarball\n");
  put(join(target, ".archie", "runtime", "node_modules", "marker"), "installed\n");
  put(join(target, ".archie", "assessments", "2026-09-18.md"), "developer work product\n");
  put(join(target, ".archie", ".gitignore"), "runtime/node_modules/\n");
  put(join(target, ".agents", "skills", "archie", "SKILL.md"), "archie\n");
  put(join(target, ".agents", "skills", "mine", "SKILL.md"), "not archie\n");
  put(join(target, "apm.yml"), "name: consumer\n");

  const restoreRoots = [
    join(target, ".archie", "runtime", "npm"),
    join(target, ".archie", "runtime", "node_modules"),
    join(target, ".agents", "skills", "archie")
  ];
  const journal = {
    format: "archie-release-install-journal-v1",
    phase: "installed",
    restoreRoots,
    // Every entry has no bytes, meaning none of these paths existed before Archie installed.
    entries: [
      join(target, ".archie", "version"),
      join(target, ".archie", "release", "release-record-v3.json"),
      join(target, ".archie", "runtime", "package.json"),
      join(target, ".archie", "runtime", "package-lock.json"),
      join(target, "apm.yml"),
      join(target, "apm.lock.yaml")
    ].map(path => ({ path }))
  };
  put(join(target, ".archie", "release", "install-journal.json"), `${JSON.stringify(journal, null, 2)}\n`);
  return target;
}

test("uninstall removes what Archie owns and keeps everything else", () => {
  const target = installedTarget();
  try {
    const result = uninstallTarget(target);
    assert.deepEqual(result.preserved, [".archie/assessments"]);

    assert.ok(!existsSync(join(target, ".archie", "release")), "the pin is removed");
    assert.ok(!existsSync(join(target, ".archie", "runtime")), "the runtime is removed");
    assert.ok(!existsSync(join(target, ".agents", "skills", "archie")), "Archie's skill tree is removed");
    assert.ok(!existsSync(join(target, "apm.yml")), "a manifest Archie created is removed");
    assert.ok(!existsSync(join(target, ".archie", ".gitignore")), "Archie's gitignore is removed");

    assert.equal(readFileSync(join(target, ".archie", "assessments", "2026-09-18.md"), "utf8"), "developer work product\n");
    assert.equal(readFileSync(join(target, ".agents", "skills", "mine", "SKILL.md"), "utf8"), "not archie\n");
    assert.equal(readFileSync(join(target, "README.md"), "utf8"), "the project\n");
  } finally { rmSync(target, { recursive: true, force: true }); }
});

test("uninstall restores a manifest that existed before Archie installed", () => {
  const target = installedTarget();
  try {
    const journalFile = join(target, ".archie", "release", "install-journal.json");
    const journal = JSON.parse(readFileSync(journalFile, "utf8"));
    journal.entries = journal.entries.map(entry => entry.path.endsWith("apm.yml")
      ? { path: entry.path, bytes: Buffer.from("name: theirs\n").toString("base64") }
      : entry);
    writeFileSync(journalFile, `${JSON.stringify(journal, null, 2)}\n`);

    uninstallTarget(target);
    assert.equal(readFileSync(join(target, "apm.yml"), "utf8"), "name: theirs\n");
  } finally { rmSync(target, { recursive: true, force: true }); }
});

test("uninstall removes the .archie directory when no work product remains", () => {
  const target = installedTarget();
  try {
    rmSync(join(target, ".archie", "assessments"), { recursive: true, force: true });
    const result = uninstallTarget(target);
    assert.deepEqual(result.preserved, []);
    assert.ok(!existsSync(join(target, ".archie")), "nothing of Archie's is left behind");
  } finally { rmSync(target, { recursive: true, force: true }); }
});

test("uninstall refuses a target with no journal", () => {
  const target = mkdtempSync(join(tmpdir(), "archie-uninstall-"));
  try {
    assert.throws(() => uninstallTarget(target), /no Archie install journal/);
  } finally { rmSync(target, { recursive: true, force: true }); }
});
