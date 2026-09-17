import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const manifest = JSON.parse(readFileSync(new URL("../source-import-manifest.json", import.meta.url)));
const workspace = new URL("..", import.meta.url).pathname;

function verifyRevision(item) {
  const actual = execFileSync("git", ["-C", item.repository, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (actual !== item.revision) throw new Error(`${item.id} is not at recorded revision ${item.revision}; found ${actual}`);
}

for (const item of manifest.imports) verifyRevision(item);
for (const migration of manifest.migrations ?? []) {
  if (!migration.inventory) continue;
  const inventoryPath = join(workspace, migration.inventory);
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
  if (inventory.source.repository !== migration.repository || inventory.source.revision !== migration.revision) {
    throw new Error(`${migration.id} migration inventory source differs from its completed migration record`);
  }
  const summary = { included: 0, excluded: 0, adapted: 0, generated: 0 };
  for (const entry of inventory.entries) summary[entry.disposition] += 1;
  if (JSON.stringify(summary) !== JSON.stringify(migration.inventorySummary)) {
    throw new Error(`${migration.id} migration inventory summary differs from its completed migration record`);
  }
  if (migration.legacyDestination && existsSync(join(workspace, migration.legacyDestination))) {
    throw new Error(`${migration.id} completed migration still has legacy imported assets at ${migration.legacyDestination}`);
  }
}

for (const item of manifest.imports) {
  const temporary = mkdtempSync(join(tmpdir(), "archie-import-"));
  const archive = join(temporary, "source.tar");
  try {
    writeFileSync(archive, execFileSync("git", ["-C", item.repository, "archive", "--format=tar", item.revision, ...item.paths]));
    execFileSync("tar", ["-xf", archive, "-C", temporary]);
    for (const source of item.paths) {
      const from = join(temporary, source);
      const to = item.id === "html-design-snapshot" ? join(workspace, item.destination) : join(workspace, item.destination, source);
      cpSync(from, to, { recursive: true, force: true });
    }
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
writeFileSync(join(workspace, "packages/capabilities/assets/IMPORTS.json"), `${JSON.stringify({ format: manifest.format, productVersion: manifest.productVersion, imports: manifest.imports.filter((item) => item.id !== "html-design-snapshot"), migrations: manifest.migrations ?? [], excluded: manifest.excluded }, null, 2)}\n`);
console.log(`Verified ${manifest.imports.length} imported source at its immutable revision and ${(manifest.migrations ?? []).length} completed migration records.`);
