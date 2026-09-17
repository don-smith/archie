import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
const packages = [
  ["@archie/runtime", "archie-runtime"], ["@archie/cli", "archie-cli"],
  ["@archie/context", "archie-context"], ["@archie/architecture-docs", "architecture-docs"],
  ["@archie/assessment", "assessment"], ["@archie/conformance", "conformance"], ["@archie/capabilities", "capabilities"]
];
for (const [name, directory] of packages) {
  const manifest = JSON.parse(readFileSync(`packages/${directory}/package.json`));
  if (manifest.private !== true) throw new Error(`${name} must remain private`);
  if (manifest.publishConfig) throw new Error(`${name} must not configure publication`);
  const unsafeAllowlist = !Array.isArray(manifest.files) || manifest.files.some((file) => /(^|\/)(test|\.myflow|skills)(\/|$)/.test(file) && !((name === "@archie/context" && file === ".apm/skills") || (["@archie/architecture-docs", "@archie/assessment", "@archie/conformance"].includes(name) && file === "skills")));
  if (unsafeAllowlist) throw new Error(`${name} has unsafe package file allowlist`);
}
const runtime = JSON.parse(readFileSync("packages/archie-runtime/package.json"));
if (runtime.dependencies?.["@typescript/typescript-darwin-arm64"] !== "7.0.2") throw new Error("The Darwin analyzer payload must be a runtime dependency");
if (runtime.bin?.["architecture-docs"] !== "./dist/architecture-docs/bin/architecture-docs.mjs") throw new Error("The runtime must expose the Architecture Docs command");
if (runtime.bin?.["architecture-conformance"]) throw new Error("Only @archie/conformance may expose architecture-conformance");
const conformance = JSON.parse(readFileSync("packages/conformance/package.json"));
if (conformance.bin?.["architecture-conformance"] !== "./dist/cli.js") throw new Error("@archie/conformance must expose architecture-conformance");
for (const [dependency, version] of [["likec4", "1.59.2"], ["marked", "15.0.7"], ["playwright", "1.62.1"]]) {
  if (runtime.dependencies?.[dependency] !== version) throw new Error(`The runtime must pin ${dependency}@${version}`);
}
for (const [, directory] of packages.filter(([name]) => name !== "@archie/runtime")) {
  const manifest = JSON.parse(readFileSync(`packages/${directory}/package.json`));
  if (manifest.dependencies?.["@typescript/typescript-darwin-arm64"]) throw new Error(`${directory} must not carry the analyzer platform payload`);
}
for (const legacy of ["packages/capabilities/assets/assessment", "packages/capabilities/assets/conformance"]) {
  if (existsSync(legacy)) throw new Error(`Completed migration still ships legacy imported assets: ${legacy}`);
}
if (!existsSync("dist")) execFileSync("npm", ["run", "build"], { stdio: "inherit" });
for (const [name] of packages) {
  const output = execFileSync("npm", ["pack", "--dry-run", "--json", "--workspace", name], { encoding: "utf8" });
  const packed = JSON.parse(output)[0].files.map((file) => file.path);
  const forbidden = packed.filter((file) => /(^|\/)(\.myflow|test|tests|architecture-review|codebase-locator|codebase-analyzer|release-record-v[12]\.json)(\/|$)/i.test(file) && !(name === "@archie/context" && file.startsWith(".apm/skills/")));
  if (forbidden.length) throw new Error(`${name} would ship forbidden paths: ${forbidden.join(", ")}`);
  if (name === "@archie/context") {
    for (const required of ["apm.yml", "apm.lock.yaml", ".apm/skills/archie/SKILL.md", ".apm/skills/archie/scripts/dispatch-runtime.mjs", ".apm/skills/architecture-assessment/scripts/check-model.mjs", ".apm/skills/architecture-assessment/scripts/check-assessment.mjs", ".apm/skills/architecture-conformance-onboarding/SKILL.md", ".apm/skills/architecture-contracts/SKILL.md"]) {
      if (!packed.includes(required)) throw new Error(`Context package omits required APM asset: ${required}`);
    }
  }
  if (name === "@archie/assessment") {
    for (const required of ["skills/architecture-assessment/SKILL.md", "skills/architecture-assessment/schemas/architecture-model.schema.json", "skills/architecture-assessment/scripts/check-model.mjs", "skills/architecture-assessment/scripts/check-assessment.mjs"]) {
      if (!packed.includes(required)) throw new Error(`Assessment package omits required skill asset: ${required}`);
    }
  }
  if (name === "@archie/conformance") {
    for (const required of ["skills/architecture-conformance-onboarding/SKILL.md", "skills/architecture-contracts/SKILL.md", "dist/formats/conformance-report-v1.js", "dist/replay/run.js", "dist/reconciliation/compare.js"]) {
      if (!packed.includes(required)) throw new Error(`Conformance package omits required asset: ${required}`);
    }
  }
  const expectedEntry = {
    "@archie/runtime": "dist/index.js",
    "@archie/cli": "dist/cli.js",
    "@archie/capabilities": "dist/index.js",
    "@archie/architecture-docs": "bin/architecture-docs.mjs",
    "@archie/conformance": "dist/cli.js"
  }[name];
  if (expectedEntry && !packed.includes(expectedEntry)) throw new Error(`${name} lacks ${expectedEntry}`);
  if (name === "@archie/runtime" && !packed.includes("vendor/html-design/SKILL.md")) throw new Error("Runtime package must carry the immutable HTML snapshot");
  if (name === "@archie/runtime" && !packed.includes("vendor/release-npm-lock-v2.json")) throw new Error("Runtime package omits the v2 dependency lock template");
  if (name === "@archie/runtime" && !packed.includes("dist/architecture-docs/scripts/check-final-site-browser.mjs")) throw new Error("Runtime package omits the complete Architecture Docs command implementation");
  if (name === "@archie/runtime" && !packed.includes("dist/schemas/architecture-status-v1.schema.json")) throw new Error("Runtime package must carry architecture-status-v1 schema");
}
console.log("Private workspace publication guards and package contents passed.");
