import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

test("managed-site guide projections match the authoritative documentation", () => {
  const authoritative = readFileSync("docs/archie/managed-site-guide.md");
  assert.deepEqual(readFileSync("skills/archie/references/managed-site-guide.md"), authoritative);
  assert.deepEqual(readFileSync(join(context, ".apm", "skills", "archie", "references", "managed-site-guide.md")), authoritative);
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
