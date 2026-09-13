import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

const fixture = path.resolve("test/fixtures/architecture-docs");
const cli = path.resolve("bin/architecture-docs.mjs");

async function copyFixture() {
  const directory = await mkdtemp(path.join(process.cwd(), ".tmp-skill-command-"));
  await cp(fixture, directory, { recursive: true });
  return { directory, config: path.join(directory, "architecture-docs.config.json") };
}

function runCli(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd, env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("exit", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

test("skill:run appends the requested architecture command and options to reviewed argv", async () => {
  const temporary = await copyFixture();
  try {
    const record = path.join(temporary.directory, "record.json");
    const recorder = path.join(temporary.directory, "record-argv.mjs");
    await writeFile(recorder, `import { writeFile } from "node:fs/promises";\nawait writeFile(process.argv[2], JSON.stringify({ argv: process.argv.slice(3), cwd: process.cwd() }));\n`);
    const config = JSON.parse(await readFile(temporary.config, "utf8"));
    config.skillCommand = [process.execPath, recorder, record];
    await writeFile(temporary.config, JSON.stringify(config));

    const result = await runCli(["skill:run", "build", "--config", temporary.config, "--handoff-only"], temporary.directory);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /selected override command/);
    assert.deepEqual(JSON.parse(await readFile(record, "utf8")), {
      argv: ["build", "--config", temporary.config, "--handoff-only"],
      cwd: temporary.directory,
    });
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("skill:run reports a missing override executable with the target root", async () => {
  const temporary = await copyFixture();
  try {
    const config = JSON.parse(await readFile(temporary.config, "utf8"));
    config.skillCommand = ["architecture-docs-command-that-does-not-exist"];
    await writeFile(temporary.config, JSON.stringify(config));

    const result = await runCli(["skill:run", "build", "--config", temporary.config], temporary.directory);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Could not run the configured architecture-docs command/);
    assert.match(result.stderr, new RegExp(temporary.directory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("skill:run preserves a configured command's non-zero exit status", async () => {
  const temporary = await copyFixture();
  try {
    const failing = path.join(temporary.directory, "fails.mjs");
    await writeFile(failing, "process.exitCode = 7;\n");
    const config = JSON.parse(await readFile(temporary.config, "utf8"));
    config.skillCommand = [process.execPath, failing];
    await writeFile(temporary.config, JSON.stringify(config));

    const result = await runCli(["skill:run", "check", "--config", temporary.config], temporary.directory);
    assert.equal(result.code, 7);
    assert.match(result.stderr, /exited with status 7/);
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});
