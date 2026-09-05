import { cpSync, existsSync, rmSync } from "node:fs";
const packages = ["archie-runtime", "archie-cli", "capabilities"];
for (const packageName of packages) {
  const from = `dist/packages/${packageName}/src`;
  const to = `packages/${packageName}/dist`;
  if (!existsSync(from)) throw new Error(`Missing build output: ${from}`);
  rmSync(to, { recursive: true, force: true }); cpSync(from, to, { recursive: true });
}
