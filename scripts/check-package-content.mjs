import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
const packages = [
  ["@archie/runtime", "archie-runtime"], ["@archie/cli", "archie-cli"],
  ["@archie/context", "archie-context"], ["@archie/capabilities", "capabilities"]
];
for (const [name, directory] of packages) {
  const manifest = JSON.parse(readFileSync(`packages/${directory}/package.json`));
  if (manifest.private !== true) throw new Error(`${name} must remain private`);
  if (manifest.publishConfig) throw new Error(`${name} must not configure publication`);
  const unsafeAllowlist = !Array.isArray(manifest.files) || manifest.files.some((file) => /(^|\/)(test|\.myflow|skills)(\/|$)/.test(file) && !(name === "@archie/context" && file === ".apm/skills"));
  if (unsafeAllowlist) throw new Error(`${name} has unsafe package file allowlist`);
}
const runtime = JSON.parse(readFileSync("packages/archie-runtime/package.json"));
if (runtime.dependencies?.["@typescript/typescript-darwin-arm64"] !== "7.0.2") throw new Error("The Darwin analyzer payload must be a runtime dependency");
for (const [, directory] of packages.filter(([name]) => name !== "@archie/runtime")) {
  const manifest = JSON.parse(readFileSync(`packages/${directory}/package.json`));
  if (manifest.dependencies?.["@typescript/typescript-darwin-arm64"]) throw new Error(`${directory} must not carry the analyzer platform payload`);
}
if (!existsSync("dist")) execFileSync("npm", ["run", "build"], { stdio: "inherit" });
for (const [name] of packages) {
  const output = execFileSync("npm", ["pack", "--dry-run", "--json", "--workspace", name], { encoding: "utf8" });
  const packed = JSON.parse(output)[0].files.map((file) => file.path);
  const forbidden = packed.filter((file) => /(^|\/)(\.myflow|test|tests|architecture-review|codebase-locator|codebase-analyzer|release-record-v1\.json)(\/|$)/i.test(file) && !(name === "@archie/context" && file.startsWith(".apm/skills/")));
  if (forbidden.length) throw new Error(`${name} would ship forbidden paths: ${forbidden.join(", ")}`);
  if (name === "@archie/context") {
    for (const required of ["apm.yml", "apm.lock.yaml", ".apm/skills/archie/SKILL.md", ".apm/skills/archie/scripts/dispatch-runtime.mjs"]) {
      if (!packed.includes(required)) throw new Error(`Context package omits required APM asset: ${required}`);
    }
  }
  if (name !== "@archie/context" && !packed.some((file) => file === "dist/index.js" || file === "dist/cli.js")) throw new Error(`${name} lacks prebuilt runtime code`);
  if (name === "@archie/runtime" && !packed.includes("vendor/html-design/SKILL.md")) throw new Error("Runtime package must carry the immutable HTML snapshot");
}
console.log("Private workspace publication guards and package contents passed.");
