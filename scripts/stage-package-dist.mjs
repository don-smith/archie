import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
const packages = ["archie-runtime", "archie-cli", "capabilities"];
for (const packageName of packages) {
  const from = `dist/packages/${packageName}/src`;
  const to = `packages/${packageName}/dist`;
  if (!existsSync(from)) throw new Error(`Missing build output: ${from}`);
  rmSync(to, { recursive: true, force: true }); cpSync(from, to, { recursive: true });
}
const runtimeSchema = "packages/archie-runtime/dist/schemas/architecture-status-v1.schema.json";
mkdirSync("packages/archie-runtime/dist/schemas", { recursive: true });
cpSync("schemas/architecture-status-v1.schema.json", runtimeSchema);
