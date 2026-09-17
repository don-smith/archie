import { readFileSync, writeFileSync } from "node:fs";
const root = JSON.parse(readFileSync("package.json"));
const workspaceManifests = ["packages/archie-runtime/package.json", "packages/archie-cli/package.json", "packages/archie-context/package.json", "packages/architecture-docs/package.json", "packages/assessment/package.json", "packages/conformance/package.json", "packages/html-design/package.json", "packages/architecture-review/package.json", "packages/capabilities/package.json"];
for (const file of workspaceManifests) {
  const value = JSON.parse(readFileSync(file));
  if (value.version !== root.version) throw new Error(`${file} version ${value.version} does not match product version ${root.version}`);
}
for (const file of ["packages/archie-runtime/src/product-version.ts", "packages/archie-cli/src/product-version.ts"]) writeFileSync(file, `/** Generated from the root product version authority. */\nexport const PRODUCT_VERSION = ${JSON.stringify(root.version)} as const;\n`);
writeFileSync("packages/archie-context/product-version.json", `${JSON.stringify({ product: "archie", version: root.version })}\n`);
console.log(`Product version ${root.version} aligned across private workspaces.`);
