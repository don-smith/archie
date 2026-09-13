import assert from "node:assert/strict";
import { chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

const fixture = path.resolve("test/fixtures/architecture-docs");
const skillSource = "skills/architecture-docs/SKILL.md";
const commandGuide = "skills/architecture-docs/package-commands.md";
const deployments = [
  ["Pi", ".agents/skills/architecture-docs/SKILL.md"],
  ["Claude Code", ".claude/skills/architecture-docs/SKILL.md"],
  ["Codex", ".codex/skills/architecture-docs/SKILL.md"],
  ["Copilot", ".github/skills/architecture-docs/SKILL.md"],
  ["Cursor", ".cursor/skills/architecture-docs/SKILL.md"],
];

function run(command, args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env } });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("exit", (code) => resolve({ code, stderr }));
  });
}

test("generated skill deployments are exact copies that use the target-local offline command", async () => {
  const source = await readFile(skillSource, "utf8");
  const guide = await readFile(commandGuide, "utf8");
  assert.match(source, /ARCHIE_RUNTIME_DIR[\s\S]*node_modules\/\.bin\/architecture-docs/);
  assert.match(guide, /ARCHIE_RUNTIME_DIR[\s\S]*node_modules\/\.bin\/architecture-docs/);
  assert.doesNotMatch(source, /PACKAGE_DIR/);
  assert.doesNotMatch(guide, /PACKAGE_DIR/);

  for (const [name, relativeSkillPath] of deployments) {
    const target = await mkdtemp(path.join(process.cwd(), ".tmp-deployment-"));
    try {
      await cp(fixture, target, { recursive: true });
      const deployedSkill = path.join(target, relativeSkillPath);
      await mkdir(path.dirname(deployedSkill), { recursive: true });
      await writeFile(deployedSkill, source);
      assert.equal(await readFile(deployedSkill, "utf8"), source, `${name} deployment changed the portable skill source`);

      const record = path.join(target, "local-bin-record.json");
      const localBin = path.join(target, ".archie/runtime/node_modules/.bin/architecture-docs");
      await mkdir(path.dirname(localBin), { recursive: true });
      await writeFile(localBin, "#!/usr/bin/env node\nimport { writeFile } from 'node:fs/promises';\nawait writeFile(process.env.ARCH_DOCS_RECORD, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }));\n");
      await chmod(localBin, 0o755);

      const config = path.join(target, "architecture-docs.config.json");
      const result = await run(localBin, ["build", "--config", config, "--handoff-only"], target, { ARCH_DOCS_RECORD: record });
      assert.equal(result.code, 0, `${name}: ${result.stderr}`);
      assert.deepEqual(JSON.parse(await readFile(record, "utf8")), {
        argv: ["build", "--config", config, "--handoff-only"],
        cwd: target,
      });
    } finally { await rm(target, { recursive: true, force: true }); }
  }
});
