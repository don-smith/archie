import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const workspace = "packages/architecture-docs";
const runtimeCommand = "packages/archie-runtime/dist/architecture-docs/bin/architecture-docs.mjs";
const expectedScripts = [
  "approve-architecture-docs.mjs",
  "build-architecture-docs.mjs",
  "check-architecture-docs.mjs",
  "check-final-site-browser.mjs",
  "check-html.mjs",
  "check-site-browser.mjs",
  "check-site.mjs",
];

test("Architecture Docs is a complete first-class Archie workspace", async () => {
  const manifest = JSON.parse(await readFile(`${workspace}/package.json`, "utf8"));
  assert.equal(manifest.name, "@archie/architecture-docs");
  assert.equal(manifest.private, true);
  assert.equal(manifest.bin["architecture-docs"], "./bin/architecture-docs.mjs");
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), ["likec4", "marked", "playwright"]);
  for (const script of expectedScripts) assert.equal(existsSync(`${workspace}/scripts/${script}`), true, `missing ${script}`);
  assert.equal(existsSync(`${workspace}/test/architecture-docs-builder.test.mjs`), true);
  assert.equal(existsSync(`${workspace}/docs/architecture`), false, "generated example site must not migrate");
  assert.equal(existsSync(`${workspace}/architecture-docs.config.json`), false, "example configuration must not become product state");
  assert.equal(existsSync("packages/capabilities/assets/architecture-docs"), false);
});

test("the staged Archie runtime exposes a working Architecture Docs build", async () => {
  const runtime = JSON.parse(await readFile("packages/archie-runtime/package.json", "utf8"));
  assert.equal(runtime.bin["architecture-docs"], "./dist/architecture-docs/bin/architecture-docs.mjs");
  for (const dependency of ["likec4", "marked", "playwright"]) assert.ok(runtime.dependencies[dependency]);
  assert.equal(existsSync(runtimeCommand), true);

  const directory = await mkdtemp(path.join(tmpdir(), "archie-architecture-docs-"));
  try {
    await cp(`${workspace}/test/fixtures/architecture-docs`, directory, { recursive: true });
    const config = path.join(directory, "architecture-docs.config.json");
    const build = spawnSync(process.execPath, [runtimeCommand, "build", "--config", config], { encoding: "utf8" });
    assert.equal(build.status, 0, build.stderr);
    const check = spawnSync(process.execPath, [runtimeCommand, "check", "--config", config, "--mode", "preview"], { encoding: "utf8" });
    assert.equal(check.status, 0, check.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a packed Archie runtime installs the Architecture Docs command", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "archie-packed-runtime-"));
  const packDirectory = path.join(directory, "pack");
  const target = path.join(directory, "target");
  try {
    await mkdir(packDirectory, { recursive: true });
    const pack = spawnSync("npm", ["pack", "--json", "--pack-destination", packDirectory, "--workspace", "@archie/runtime"], { encoding: "utf8" });
    assert.equal(pack.status, 0, pack.stderr);
    const tarball = path.join(packDirectory, JSON.parse(pack.stdout)[0].filename);
    await cp(`${workspace}/test/fixtures/architecture-docs`, target, { recursive: true });
    await writeFile(path.join(target, "package.json"), `${JSON.stringify({ private: true, dependencies: { "@archie/runtime": `file:${tarball}` } }, null, 2)}\n`);
    const install = spawnSync("npm", ["install", "--ignore-scripts"], { cwd: target, encoding: "utf8" });
    assert.equal(install.status, 0, install.stderr);
    const config = path.join(target, "architecture-docs.config.json");
    const build = spawnSync("npx", ["--no-install", "architecture-docs", "build", "--config", config], { cwd: target, encoding: "utf8" });
    assert.equal(build.status, 0, build.stderr);
    const check = spawnSync("npx", ["--no-install", "architecture-docs", "check", "--config", config, "--mode", "preview"], { cwd: target, encoding: "utf8" });
    assert.equal(check.status, 0, check.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
