import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { ANALYZER_ID, SUPPORTED_ANALYZER, assertSupportedEnvironment } from "../../dist/packages/archie-runtime/src/analysis/contracts.js";
import { analyzeTypeScriptProgramV1 } from "../../dist/packages/archie-runtime/src/analysis/typescript-program-v1.js";

test("retains pinned adapter compatibility and both characterized defects", () => {
  assert.equal(ANALYZER_ID, "typescript-program-v1");
  assert.deepEqual(SUPPORTED_ANALYZER.knownDefects, ["named-type-only-re-export-classified-as-runtime", "config-diagnostic-repeated-per-source-file"]);
  const runtime = JSON.parse(readFileSync("packages/archie-runtime/package.json"));
  assert.equal(runtime.dependencies["@typescript/typescript-darwin-arm64"], "7.0.2");
});
test("rejects unsupported analyzer environments before analysis", () => assert.throws(() => assertSupportedEnvironment({ node: "22.0.0", platform: "linux", architecture: "x64" }), /Unsupported analyzer environment/));
test("normalizes observations and retains named re-export behavior", () => {
  const root = mkdtempSync(join(tmpdir(), "archie-analysis-"));
  try { writeFileSync(join(root, "entry.ts"), 'export type { Name } from "./types.js";\nexport { type Other } from "./other.js";\n');
    writeFileSync(join(root, "types.ts"), "export interface Name {}\n"); writeFileSync(join(root, "other.ts"), "export interface Other {}\n");
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", target: "ES2024" }, include: ["*.ts"] }));
    const result = analyzeTypeScriptProgramV1({ contractVersion: "analysis-request-v1", repositoryRoot: root, rootConfigs: ["tsconfig.json"], include: ["**/*.ts"], exclusions: [] });
    assert.deepEqual(result.observations.map((item) => item.effect), ["type", "runtime"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("retains the repeated config-diagnostic compatibility defect", () => {
  const root = mkdtempSync(join(tmpdir(), "archie-analysis-config-"));
  try {
    writeFileSync(join(root, "a.ts"), "export {};\n"); writeFileSync(join(root, "b.ts"), "export {};\n");
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { notAnOption: true, module: "NodeNext", moduleResolution: "NodeNext" }, include: ["*.ts"] }));
    const result = analyzeTypeScriptProgramV1({ contractVersion: "analysis-request-v1", repositoryRoot: root, rootConfigs: ["tsconfig.json"], include: ["**/*.ts"], exclusions: [] });
    assert.equal(result.gaps.filter((gap) => gap.kind === "compiler-diagnostic").length, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
