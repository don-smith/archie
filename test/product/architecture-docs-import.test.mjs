import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const importId = "architecture-docs-and-likec4";
const assetRoot = "packages/capabilities/assets/architecture-docs";

function architectureDocsImport(manifest) {
  const importedSource = manifest.imports.find((item) => item.id === importId);
  assert.ok(importedSource, `${manifest.format} must record ${importId}`);
  return importedSource;
}

test("every Architecture Docs router command has an imported script", () => {
  const router = readFileSync(`${assetRoot}/bin/architecture-docs.mjs`, "utf8");
  const commandTable = router.match(/const commandScripts = \{([\s\S]*?)\n\};/);
  assert.ok(commandTable, "Architecture Docs router must declare commandScripts");

  const scripts = [...commandTable[1].matchAll(/:\s*"([^"]+\.mjs)"/g)].map((match) => match[1]);
  assert.ok(scripts.length > 0, "Architecture Docs router must advertise script-backed commands");
  for (const script of scripts) {
    assert.ok(existsSync(`${assetRoot}/scripts/${script}`), `missing imported router script: ${script}`);
  }
});

test("Architecture Docs import receipt matches its source record", () => {
  const sourceManifest = JSON.parse(readFileSync("source-import-manifest.json", "utf8"));
  const importReceipt = JSON.parse(readFileSync("packages/capabilities/assets/IMPORTS.json", "utf8"));
  const source = architectureDocsImport(sourceManifest);
  const receipt = architectureDocsImport(importReceipt);

  assert.equal(receipt.revision, source.revision);
  assert.deepEqual(receipt.paths, source.paths);
});
