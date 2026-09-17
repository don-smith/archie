#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

import { canonicalize } from "../dist/packages/archie-runtime/src/analysis/canonical-json.js";

const repositoryRoot = resolve(import.meta.dirname, "..");
const fixtureRoot = resolve(repositoryRoot, "packages/conformance/test/fixtures/parity");
const manifest = JSON.parse(readFileSync(join(fixtureRoot, "cases.json"), "utf8"));
const requestedUpstream = process.argv[process.argv.indexOf("--upstream") + 1];
if (!requestedUpstream || requestedUpstream.startsWith("--")) {
  console.error("usage: node scripts/compare-conformance.mjs --upstream /path/to/arch-conformance");
  process.exit(2);
}
const upstreamRoot = resolve(requestedUpstream);
const localCli = resolve(repositoryRoot, "packages/conformance/dist/cli.js");
const upstreamCli = resolve(upstreamRoot, "dist/src/cli.js");
if (!existsSync(localCli)) throw new Error(`missing Archie CLI at ${localCli}; run npm run build first`);
if (!existsSync(upstreamCli)) throw new Error(`missing upstream CLI at ${upstreamCli}; build the pinned upstream checkout first`);

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function writeJson(path, value) { mkdirSync(resolve(path, ".."), { recursive: true }); writeFileSync(path, `${canonicalize(value)}\n`); }
function filesUnder(root) {
  const result = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else result.push(relative(root, path));
    }
  }
  visit(root);
  return result.sort();
}
function snapshot(root) {
  return Object.fromEntries(filesUnder(root).map((path) => [path, readFileSync(join(root, path))]));
}
function generatedSnapshot(root, initial) {
  const current = snapshot(root);
  return Object.fromEntries(Object.keys(current).filter((path) => !Object.hasOwn(initial, path)).map((path) => [path, current[path]]));
}
function normalized(text, root) { return text.replaceAll(root, "<FIXTURE_ROOT>"); }
function invoke(cli, root, args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root, encoding: "utf8", env: { ...process.env, npm_config_user_agent: "npm/11.19.0 node/v24.20.0" }
  });
  if (result.error) throw result.error;
  return { exit: result.status ?? 3, stdout: result.stdout ?? "", stderr: normalized(result.stderr ?? "", root) };
}
function sourceFiles(root, kind = "normal") {
  mkdirSync(join(root, "src"), { recursive: true });
  writeJson(join(root, "tsconfig.json"), { compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" }, include: ["src"] });
  if (kind === "cycle") {
    writeFileSync(join(root, "src/a.ts"), 'import { b } from "./b.js"; export const a = b;\n');
    writeFileSync(join(root, "src/b.ts"), 'import { a } from "./a.js"; export const b = a;\n');
  } else if (kind === "dependency") {
    writeFileSync(join(root, "src/a.ts"), 'import type { B } from "./b.js"; export const a: B = { value: 1 };\n');
    writeFileSync(join(root, "src/b.ts"), "export interface B { value: number }\n");
  } else {
    writeFileSync(join(root, "src/a.ts"), 'import { b } from "./b.js"; export const a = b;\n');
    writeFileSync(join(root, "src/b.ts"), "export const b = 1;\n");
  }
}
function map(root, missing = false) {
  writeJson(join(root, "map.json"), { version: "realization-map/v1", scope: { rootConfigs: ["tsconfig.json"], include: ["src/**/*.ts"], exclusions: [] }, elements: [{ id: "core" }, { id: "infra" }], mappings: missing ? [{ elementId: "core", path: "src/a.ts" }] : [{ elementId: "core", path: "src/a.ts" }, { elementId: "infra", path: "src/b.ts" }] });
}
function contract(root, rule = "valid", exceptions = []) {
  const rules = rule === "valid" ? [] : rule === "cycle" ? [{ id: "no-cycles", kind: "acyclic", intent: "keep layers acyclic", enforcement: "active", severity: "error", world: "open", domain: ["core", "infra"], edgeKinds: ["runtime"], approval: { approvedBy: "maintainer", approvedAt: "2026-09-15" } }] : [{ id: rule === "dependency" ? "no-core-infra-types" : "no-core-infra", kind: "dependency-policy", intent: "forbid", enforcement: "active", severity: "error", world: "open", sources: ["core"], forbiddenTargets: ["infra"], edgeKinds: [rule === "dependency" ? "type" : "runtime"], approval: { approvedBy: "maintainer", approvedAt: "2026-09-15" } }];
  writeJson(join(root, "contract.json"), { version: "architecture-contract/v1", exceptions, rules });
}
function setup(root, name) {
  sourceFiles(root, name === "cycle" ? "cycle" : name === "dependency" ? "dependency" : "normal");
  map(root, name === "strict-gap");
  const exception = name === "exception" ? [{ ruleId: "no-core-infra", fingerprint: "5ea585a56e6ffb66dec53b2acc31ffd152574d137e5a77d10adb0118b38a6cc4", rationale: "temporary migration waiver", expiresOn: "2099-12-31", owner: "maintainer" }] : [];
  contract(root, name === "cycle" || name === "dependency" || name === "violation" || name === "exception" || name === "baseline" ? name : "valid", exception);
  if (name === "reconciliation") {
    writeJson(join(root, "active.json"), { version: "architecture-active-result-set/v1", results: [{ id: "b", fingerprint: "same" }, { id: "a", fingerprint: "old" }, { id: "b", fingerprint: "same" }] });
    writeJson(join(root, "drift.json"), { version: "architecture-drift-record/v1", records: [{ id: "a", fingerprint: "new", state: "open" }, { id: "c", fingerprint: "gone", state: "open" }, { id: "c", fingerprint: "gone", state: "open" }] });
  }
  if (name === "malformed") writeFileSync(join(root, "malformed.json"), "{\"version\":\"realization-map/v2\"}\n");
  if (name === "onboarding" || name === "replay" || name === "stale-state") {
    mkdirSync(join(root, "node_modules/architecture-conformance"), { recursive: true });
    mkdirSync(join(root, "node_modules/.bin"), { recursive: true });
    writeJson(join(root, "package.json"), { private: true, devDependencies: { "architecture-conformance": "0.1.0" } });
    writeJson(join(root, "package-lock.json"), { name: "parity-target", lockfileVersion: 3, packages: { "": { devDependencies: { "architecture-conformance": "0.1.0" } }, "node_modules/architecture-conformance": { version: "0.1.0" } } });
    writeJson(join(root, "node_modules/architecture-conformance/package.json"), { name: "architecture-conformance", version: "0.1.0", bin: { "architecture-conformance": "dist/src/cli.js" } });
    writeFileSync(join(root, "node_modules/.bin/architecture-conformance"), "#!/bin/sh\n");
  }
}
function replayState(root) {
  const paths = { state: "onboarding.json", graph: "evidence/observed-graph.json", summary: "evidence/onboarding-summary.md", map: "map.json", contract: "contract.json", report: "evidence/report.json", baseline: "baseline.json" };
  const evidence = Object.fromEntries(["graph", "summary", "map", "contract", "report"].map((name) => [name, sha256(readFileSync(join(root, paths[name])))]));
  writeJson(join(root, paths.state), { version: "onboarding-state/v1", scope: { rootConfigs: ["tsconfig.json"], include: ["src/**/*.ts"], exclusions: [] }, skillLocation: "skills/onboarding", paths, checkpoint: "active-contract-checked", evidence });
}
function commandsFor(name) {
  if (name === "valid") return [["check", "--map", "map.json", "--contract", "contract.json", "--output", "report.json"]];
  if (name === "violation" || name === "dependency" || name === "cycle") return [["check", "--map", "map.json", "--contract", "contract.json", "--output", "report.json"]];
  if (name === "strict-gap") return [["check", "--map", "map.json", "--contract", "contract.json", "--strict", "--output", "report.json"]];
  if (name === "exception") return [["check", "--map", "map.json", "--contract", "contract.json", "--output", "report.json"]];
  if (name === "baseline") return [["check", "--map", "map.json", "--contract", "contract.json", "--output", "report.json"], ["baseline", "--report", "report.json", "--output", "baseline.json"], ["check", "--map", "map.json", "--contract", "contract.json", "--baseline", "baseline.json"]];
  if (name === "reconciliation") return [["reconcile", "--active", "active.json", "--drift", "drift.json", "--output", "reconciliation.json"]];
  if (name === "malformed") return [["check", "--map", "malformed.json", "--contract", "contract.json"]];
  if (name === "onboarding") return [["onboard", "init", "--root", "tsconfig.json", "--include", "src/**/*.ts", "--skill-location", "skills/onboarding"]];
  if (name === "replay" || name === "stale-state") return [["analyze", "--root", "tsconfig.json", "--include", "src/**/*.ts", "--output", "evidence/observed-graph.json", "--summary-output", "evidence/onboarding-summary.md"], ["check", "--map", "map.json", "--contract", "contract.json", "--output", "evidence/report.json"], ["__write-state"], ["replay", "--state", "onboarding.json", "--regenerate"], ["replay", "--state", "onboarding.json", "--verify"]];
  throw new Error(`unknown parity case ${name}`);
}
function runOne(cli, name) {
  const root = mkdtempSync(join(tmpdir(), `archie-conformance-${name}-`));
  try {
    setup(root, name);
    const initial = snapshot(root);
    const records = [];
    for (const command of commandsFor(name)) {
      if (command[0] === "__write-state") { replayState(root); records.push({ command, exit: 0, stdout: "", stderr: "" }); continue; }
      const result = invoke(cli, root, command);
      const generated = generatedSnapshot(root, initial);
      for (const [path, bytes] of Object.entries(generated)) if (path.endsWith(".json") && !path.endsWith("package-lock.json") && !path.includes("node_modules/")) {
        const expected = `${canonicalize(JSON.parse(bytes.toString("utf8")))}\n`;
        if (bytes.toString("utf8") !== expected) throw new Error(`${name}: ${path} is not canonical JSON`);
      }
      records.push({ command, ...result, files: Object.keys(generated), hashes: Object.fromEntries(Object.entries(generated).map(([path, bytes]) => [path, sha256(bytes)])) });
    }
    if (name === "stale-state") writeFileSync(join(root, "src/a.ts"), "export const changed = 1;\n");
    if (name === "stale-state") {
      const result = invoke(cli, root, ["replay", "--state", "onboarding.json", "--verify"]);
      records.push({ command: ["replay", "--state", "onboarding.json", "--verify", "(stale)"], ...result });
    }
    return { records, generated: generatedSnapshot(root, initial), files: Object.keys(generatedSnapshot(root, initial)) };
  } finally { rmSync(root, { recursive: true, force: true }); }
}
function compareRecords(name, left, right) {
  if (left.records.length !== right.records.length) throw new Error(`${name}: command count differs`);
  for (let index = 0; index < left.records.length; index += 1) {
    const a = left.records[index]; const b = right.records[index];
    if (a.exit !== b.exit || a.stdout !== b.stdout || a.stderr !== b.stderr) throw new Error(`${name}: CLI output differs for ${a.command.join(" ")}\nupstream=${JSON.stringify(a)}\narchie=${JSON.stringify(b)}`);
    if (JSON.stringify(a.files ?? []) !== JSON.stringify(b.files ?? [])) throw new Error(`${name}: generated file set differs`);
    if (JSON.stringify(a.hashes ?? {}) !== JSON.stringify(b.hashes ?? {})) throw new Error(`${name}: generated artifact hashes differ`);
  }
  if (JSON.stringify(left.files) !== JSON.stringify(right.files)) throw new Error(`${name}: final file set differs`);
  const leftHashes = Object.fromEntries(Object.entries(left.generated).map(([path, bytes]) => [path, sha256(bytes)]));
  const rightHashes = Object.fromEntries(Object.entries(right.generated).map(([path, bytes]) => [path, sha256(bytes)]));
  if (JSON.stringify(leftHashes) !== JSON.stringify(rightHashes)) throw new Error(`${name}: final artifact hashes differ`);
}
const results = [];
for (const name of manifest.cases) {
  const upstreamFirst = runOne(upstreamCli, name);
  const upstreamSecond = runOne(upstreamCli, name);
  const archieFirst = runOne(localCli, name);
  const archieSecond = runOne(localCli, name);
  compareRecords(`${name} upstream rerun`, upstreamFirst, upstreamSecond);
  compareRecords(`${name} Archie rerun`, archieFirst, archieSecond);
  compareRecords(`${name} upstream/Archie`, upstreamFirst, archieFirst);
  results.push({ name, commands: upstreamFirst.records.map((record) => ({ command: record.command.join(" "), exit: record.exit, generatedFiles: record.files ?? [], artifactHashes: record.hashes ?? {} })), generatedFiles: upstreamFirst.files, artifactHashes: Object.fromEntries(Object.entries(upstreamFirst.generated).map(([path, bytes]) => [path, sha256(bytes)])) });
}
console.log(`${canonicalize({ version: "conformance-parity-report/v1", sourceRevision: manifest.sourceRevision, allowedUnstableFields: manifest.allowedUnstableFields, cases: results })}\n`);
