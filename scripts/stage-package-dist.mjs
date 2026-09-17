import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { basename, join } from "node:path";

const packages = ["archie-runtime", "archie-cli", "conformance", "capabilities"];
for (const packageName of packages) {
  const from = `dist/packages/${packageName}/src`;
  const to = `packages/${packageName}/dist`;
  if (!existsSync(from)) throw new Error(`Missing build output: ${from}`);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}
mkdirSync("dist/packages/archie-runtime/vendor", { recursive: true });
cpSync("packages/archie-runtime/vendor/release-npm-lock-v2.json", "dist/packages/archie-runtime/vendor/release-npm-lock-v2.json");

const architectureDocsSource = "packages/architecture-docs";
const architectureDocsRuntime = "packages/archie-runtime/dist/architecture-docs";
rmSync(architectureDocsRuntime, { recursive: true, force: true });
mkdirSync(architectureDocsRuntime, { recursive: true });
for (const entry of ["bin", "src", "scripts", "architecture-docs.schema.json", "THIRD_PARTY_NOTICES.md"]) {
  const from = join(architectureDocsSource, entry);
  if (!existsSync(from)) throw new Error(`Missing Architecture Docs runtime input: ${from}`);
  cpSync(from, join(architectureDocsRuntime, basename(entry)), { recursive: true });
}
const runtimeSchema = "packages/archie-runtime/dist/schemas/architecture-status-v1.schema.json";
mkdirSync("packages/archie-runtime/dist/schemas", { recursive: true });
cpSync("schemas/architecture-status-v1.schema.json", runtimeSchema);
