import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => entry.isDirectory() ? sourceFiles(join(directory, entry.name)) : [join(directory, entry.name)]));
  return nested.flat();
}

test("keeps the TypeScript compiler inside Runtime's versioned adapter", async () => {
  const runtimeFiles = (await sourceFiles("packages/archie-runtime/src")).filter((file) => file.endsWith(".ts"));
  const conformanceFiles = (await sourceFiles("packages/conformance/src")).filter((file) => file.endsWith(".ts"));
  const imports = await Promise.all([...runtimeFiles, ...conformanceFiles].map(async (file) => [file, await readFile(file, "utf8")]));
  assert.deepEqual(imports.filter(([, content]) => /from ["']typescript(?:\/unstable[^"']*)?["']/.test(content)).map(([file]) => file), ["packages/archie-runtime/src/analysis/typescript-program-v1-core.ts"]);
  const conformanceManifest = JSON.parse(await readFile("packages/conformance/package.json", "utf8"));
  assert.equal(conformanceManifest.dependencies.typescript, undefined);
  assert.equal(conformanceManifest.dependencies["@archie/runtime"], "0.3.0");
});
