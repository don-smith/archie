import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { analyzeTypeScriptProgramV2 } from "../../dist/packages/archie-runtime/src/index.js";

function analyze(input, repositoryRoot) {
  return analyzeTypeScriptProgramV2({
    contractVersion: "analysis-request-v1",
    repositoryRoot,
    rootConfigs: input.rootConfigs,
    include: input.scope.include,
    exclusions: input.scope.exclusions
  }).graph;
}

test("analysis-response-v2 preserves the normalized graph required by conformance", async () => {
  const repository = await mkdtemp(join(tmpdir(), "archie-analysis-v2-"));
  try {
    await mkdir(join(repository, "src"));
    await writeFile(join(repository, "src", "app.ts"), 'import { core } from "./core.js"; export { core };\n');
    await writeFile(join(repository, "src", "core.ts"), "export const core = 1;\n");
    await writeFile(join(repository, "tsconfig.json"), JSON.stringify({ compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" }, include: ["src"] }));
    const graph = analyze({ rootConfigs: ["tsconfig.json"], scope: { include: ["src/**/*.ts"], exclusions: [] } }, repository);
    assert.equal(graph.version, "normalized-graph/v1");
    assert.deepEqual(graph.nodes.filter((node) => node.kind === "source-module").map((node) => node.module), ["src/app", "src/core"]);
    assert.equal(graph.edges[0].source, "module:src/app");
    assert.equal(graph.edges[0].target, "module:src/core");
    assert.equal(graph.edges[0].specifier, "./core.js");
    assert.equal(graph.provenance.adapter, "typescript-program-v1");
  } finally { await rm(repository, { recursive: true, force: true }); }
});

test("analysis-response-v2 resolves compiler-mapped workspace imports", async () => {
  const repository = await mkdtemp(join(tmpdir(), "archie-analysis-v2-workspace-"));
  await mkdir(join(repository, "src"));
  await writeFile(join(repository, "tsconfig.json"), JSON.stringify({ compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", baseUrl: ".", paths: { "@workspace/core": ["src/core.ts"] } }, include: ["src"] }));
  await writeFile(join(repository, "src", "app.ts"), 'import { core } from "@workspace/core"; export { core };\n');
  await writeFile(join(repository, "src", "core.ts"), "export const core = 1;\n");
  const graph = analyze({ rootConfigs: ["tsconfig.json"], scope: { include: ["src/**/*.ts"], exclusions: [] } }, repository);
  const edge = graph.edges.find((candidate) => candidate.specifier === "@workspace/core");
  assert.equal(graph.nodes.find((node) => node.id === edge?.target)?.module, "src/core");
  assert.equal(edge?.status, "resolved");
});

test("analysis-response-v2 resolves declaration exports and directory barrels", async () => {
  const repository = await mkdtemp(join(tmpdir(), "archie-analysis-v2-output-"));
  await mkdir(join(repository, "packages", "core", "src"), { recursive: true }); await mkdir(join(repository, "packages", "core", "dist"), { recursive: true }); await mkdir(join(repository, "packages", "app", "src", "local"), { recursive: true });
  await writeFile(join(repository, "packages", "core", "tsconfig.json"), JSON.stringify({ compilerOptions: { module: "ESNext", moduleResolution: "Bundler", rootDir: "src", outDir: "dist", declaration: true }, include: ["src"] }));
  await writeFile(join(repository, "packages", "app", "tsconfig.json"), JSON.stringify({ compilerOptions: { module: "ESNext", moduleResolution: "Bundler", baseUrl: ".", paths: { "@workspace/core": ["../core/dist/index.d.ts"] } }, include: ["src"] }));
  await writeFile(join(repository, "packages", "core", "src", "index.ts"), "export const core = 1;\n"); await writeFile(join(repository, "packages", "core", "dist", "index.d.ts"), "export declare const core: number;\n");
  await writeFile(join(repository, "packages", "app", "src", "local", "index.ts"), "export const local = 1;\n"); await writeFile(join(repository, "packages", "app", "src", "app.ts"), 'import { core } from "@workspace/core"; import { local } from "./local"; export { core, local };\n');
  const roots = ["packages/core/tsconfig.json", "packages/app/tsconfig.json"];
  const graph = analyze({ rootConfigs: roots, scope: { include: ["packages/**/src/**/*.ts"], exclusions: [] } }, repository);
  const moduleFor = (specifier) => graph.nodes.find((node) => node.id === graph.edges.find((edge) => edge.specifier === specifier)?.target)?.module;
  assert.equal(moduleFor("@workspace/core"), "packages/core/src/index"); assert.equal(moduleFor("./local"), "packages/app/src/local/index");
  assert.equal(graph.gaps.some((gap) => gap.kind === "workspace-source-outside-scope" || gap.kind === "unresolved-static-import"), false);
});

test("analysis-response-v2 keeps declarations unresolved without output geometry", async () => {
  const repository = await mkdtemp(join(tmpdir(), "archie-analysis-v2-output-missing-"));
  await mkdir(join(repository, "packages", "core", "src"), { recursive: true }); await mkdir(join(repository, "packages", "core", "dist"), { recursive: true }); await mkdir(join(repository, "packages", "app", "src"), { recursive: true });
  await writeFile(join(repository, "packages", "core", "tsconfig.json"), JSON.stringify({ compilerOptions: { module: "ESNext", moduleResolution: "Bundler", declaration: true }, include: ["src"] }));
  await writeFile(join(repository, "packages", "app", "tsconfig.json"), JSON.stringify({ compilerOptions: { module: "ESNext", moduleResolution: "Bundler", baseUrl: ".", paths: { "@workspace/core": ["../core/dist/index.d.ts"] } }, include: ["src"] }));
  await writeFile(join(repository, "packages", "core", "src", "index.ts"), "export const core = 1;\n"); await writeFile(join(repository, "packages", "core", "dist", "index.d.ts"), "export declare const core: number;\n"); await writeFile(join(repository, "packages", "app", "src", "app.ts"), 'import { core } from "@workspace/core"; export { core };\n');
  const roots = ["packages/core/tsconfig.json", "packages/app/tsconfig.json"];
  const graph = analyze({ rootConfigs: roots, scope: { include: ["packages/**/src/**/*.ts"], exclusions: [] } }, repository);
  assert.equal(graph.edges.some((edge) => edge.specifier === "@workspace/core" && edge.target), false);
  assert.ok(graph.gaps.some((gap) => gap.kind === "workspace-source-outside-scope" && gap.message.includes("packages/core/dist/index.d.ts")));
});

test("analysis-response-v2 reports workspace source outside scope", async () => {
  const repository = await mkdtemp(join(tmpdir(), "archie-analysis-v2-scope-"));
  await mkdir(join(repository, "src")); await mkdir(join(repository, "shared"));
  await writeFile(join(repository, "tsconfig.json"), JSON.stringify({ compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", baseUrl: ".", paths: { "@workspace/shared": ["shared/value.ts"] } }, include: ["src", "shared"] }));
  await writeFile(join(repository, "src", "app.ts"), 'import { value } from "@workspace/shared"; export { value };\n'); await writeFile(join(repository, "shared", "value.ts"), "export const value = 1;\n");
  const graph = analyze({ rootConfigs: ["tsconfig.json"], scope: { include: ["src/**/*.ts"], exclusions: [] } }, repository);
  assert.ok(graph.gaps.some((gap) => gap.kind === "workspace-source-outside-scope" && gap.message.includes("@workspace/shared") && gap.message.includes("shared/value.ts")));
  assert.equal(graph.edges.some((edge) => edge.specifier === "@workspace/shared"), false);
});

test("analysis-response-v2 retains dynamic import evidence and gaps", async () => {
  const repository = await mkdtemp(join(tmpdir(), "archie-analysis-v2-dynamic-"));
  await mkdir(join(repository, "src"));
  await writeFile(join(repository, "tsconfig.json"), JSON.stringify({ compilerOptions: { module: "ESNext", moduleResolution: "Bundler" }, include: ["src"] }));
  await writeFile(join(repository, "src", "a.ts"), 'const name = "./b.js"; export const literal = import("./b.js"); export const unknown = import(name);\n'); await writeFile(join(repository, "src", "b.ts"), "export const b = 1;\n");
  const graph = analyze({ rootConfigs: ["tsconfig.json"], scope: { include: ["src/**/*.ts"], exclusions: [] } }, repository);
  const literal = graph.edges.find((edge) => edge.specifier === "./b.js");
  assert.equal(literal?.kind, "runtime"); assert.equal(graph.nodes.find((node) => node.id === literal?.target)?.module, "src/b");
  assert.equal(graph.gaps.filter((gap) => gap.kind === "unsupported-dynamic-import").length, 1);
});

test("analysis-response-v2 normalizes provenance across repository locations", async () => {
  const createRepository = async (prefix) => {
    const repository = await mkdtemp(join(tmpdir(), prefix)); await mkdir(join(repository, "src"));
    await writeFile(join(repository, "tsconfig.json"), JSON.stringify({ compilerOptions: { module: "ESNext", moduleResolution: "Bundler", rootDir: "src", outDir: "dist" }, include: ["src"] }));
    await writeFile(join(repository, "src", "index.ts"), "export const value = 1;\n"); return repository;
  };
  const first = await createRepository("archie-analysis-v2-a-"); const second = await createRepository("archie-analysis-v2-b-");
  const input = { rootConfigs: ["tsconfig.json"], scope: { include: ["src/**/*.ts"], exclusions: [] } };
  const firstGraph = analyze(input, first); const secondGraph = analyze(input, second);
  assert.deepEqual(firstGraph.provenance, secondGraph.provenance);
  assert.equal(firstGraph.provenance.compilerOptions.configFilePath, "tsconfig.json"); assert.equal(firstGraph.provenance.compilerOptions.rootDir, "src"); assert.equal(firstGraph.provenance.compilerOptions.outDir, "dist");
});

test("analysis-response-v2 creates deterministic runtime, type, and external evidence", async () => {
  const repository = await mkdtemp(join(tmpdir(), "archie-analysis-v2-evidence-")); await mkdir(join(repository, "src"));
  await writeFile(join(repository, "tsconfig.json"), JSON.stringify({ compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" }, include: ["src"] }));
  await writeFile(join(repository, "src", "a.ts"), 'import { b } from "./b.js"; import type { Thing } from "./types.js"; import "node:fs"; export { b };\n');
  await writeFile(join(repository, "src", "b.ts"), "export const b = 1;\n"); await writeFile(join(repository, "src", "types.ts"), "export interface Thing { id: string }\n");
  const graph = analyze({ rootConfigs: ["tsconfig.json"], scope: { include: ["src/**/*.ts"], exclusions: [] } }, repository);
  assert.deepEqual(graph.edges.map((edge) => [edge.kind, edge.specifier]), [["runtime", "./b.js"], ["type", "./types.js"], ["runtime", "node:fs"]]);
  assert.equal(graph.nodes.find((node) => node.module === "external:node:fs")?.kind, "external-module"); assert.equal(graph.gaps.length, 0);
});
