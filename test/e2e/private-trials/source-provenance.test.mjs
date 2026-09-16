import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";

const repository = resolve(".");
const evaluator = join(repository, "scripts/run-private-trial-evaluation.mjs");
const retained = JSON.parse(readFileSync(join(repository, "evaluation/private-trials/latest.json"), "utf8"));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 600000, ...options });
  assert.equal(result.status, 0, `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result;
}

function rejectedEvaluation(cwd, output) {
  const result = spawnSync(process.execPath, [evaluator, "--output", output], { cwd, encoding: "utf8", timeout: 30000 });
  assert.notEqual(result.status, 0, "dirty source state was accepted");
  assert.match(result.stderr, /requires a clean Git working tree before packing/);
  assert.equal(existsSync(output), false);
}

test("private-trial evaluation rejects tracked and untracked non-ignored source changes before packing", () => {
  const root = mkdtempSync(join(tmpdir(), "archie-dirty-source-"));
  const packageRoot = join(root, "packages/archie-runtime");
  const output = join(root, "evidence.json");
  try {
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(join(packageRoot, "package.json"), '{"name":"@archie/runtime"}\n');
    run("git", ["init", "-q"], { cwd: root });
    run("git", ["add", "packages/archie-runtime/package.json"], { cwd: root });
    run("git", ["-c", "user.name=Source Test", "-c", "user.email=source-test@example.invalid", "commit", "-q", "-m", "fixture"], { cwd: root });

    writeFileSync(join(packageRoot, "package.json"), '{"name":"changed"}\n');
    rejectedEvaluation(root, output);
    run("git", ["checkout", "--", "packages/archie-runtime/package.json"], { cwd: root });

    writeFileSync(join(packageRoot, "untracked-input.js"), "export {};\n");
    rejectedEvaluation(root, output);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("retained private-trial evidence is reproduced by its recorded ancestor", { skip: retained.format !== "archie-private-trial-evidence-v2" }, () => {
  const sourceCommit = retained.candidate.sourceCommit;
  run("git", ["cat-file", "-e", `${sourceCommit}^{commit}`], { cwd: repository });
  run("git", ["merge-base", "--is-ancestor", sourceCommit, "HEAD"], { cwd: repository });

  const root = mkdtempSync(join(tmpdir(), "archie-retained-source-"));
  const source = join(root, "source");
  const output = join(root, "reproduced.json");
  let worktreeAdded = false;
  try {
    run("git", ["worktree", "add", "--quiet", "--detach", source, sourceCommit], { cwd: repository });
    worktreeAdded = true;
    run("npm", ["ci"], { cwd: source });
    run("npm", ["run", "build", "--silent"], { cwd: source });
    run(process.execPath, ["scripts/run-private-trial-evaluation.mjs", "--output", output], { cwd: source });

    const reproduced = JSON.parse(readFileSync(output, "utf8"));
    assert.equal(reproduced.candidate.sourceCommit, sourceCommit);
    assert.equal(reproduced.finalization.recordSha256, retained.finalization.recordSha256);
    assert.deepEqual(reproduced.finalization.artifactManifest, retained.finalization.artifactManifest);
    assert.deepEqual(reproduced.finalization.repeatedArtifactManifest, retained.finalization.repeatedArtifactManifest);
    assert.equal(run("git", ["status", "--porcelain=v1"], { cwd: source }).stdout, "");
  } finally {
    if (worktreeAdded) spawnSync("git", ["worktree", "remove", "--force", source], { cwd: repository, encoding: "utf8" });
    rmSync(root, { recursive: true, force: true });
  }
});
