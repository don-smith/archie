import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { resolveLikeC4Command } from "../src/architecture-docs/likec4-compiler.mjs";

const require = createRequire(import.meta.url);

test("resolves the LikeC4 CLI from its package instead of a nested node_modules bin", async () => {
  const packageJsonPath = require.resolve("likec4/package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const expectedCli = path.resolve(path.dirname(packageJsonPath), packageJson.bin.likec4);

  const command = resolveLikeC4Command();

  assert.equal(command.executable, process.execPath);
  assert.deepEqual(command.arguments, [expectedCli]);
  await access(expectedCli);
});
