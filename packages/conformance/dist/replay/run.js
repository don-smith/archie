import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { analyzeTypeScriptProgram } from "../runtime-analysis.js";
import { sha256 } from "../artifacts/digest.js";
import { buildReport } from "../report/build.js";
import { renderJson } from "../report/json.js";
import { buildOnboardingSummary } from "../onboarding-summary/build.js";
import { validateArchitectureContract, validateBaseline, validateRealizationMap } from "../formats/validate.js";
import { validateOnboardingState } from "../onboarding-state/validate.js";
function readJson(path) { return JSON.parse(readFileSync(path, "utf8")); }
function input(path, expected, name) {
    const bytes = readFileSync(path);
    if (sha256(bytes) !== expected)
        throw new Error(`${name} input digest mismatch`);
    return JSON.parse(bytes.toString("utf8"));
}
function write(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); }
function outputsMatch(targets, expected) {
    return Object.entries(expected).every(([name, value]) => {
        const target = targets[name];
        return Boolean(target) && (() => { try {
            return readFileSync(target, "utf8") === value;
        }
        catch {
            return false;
        } })();
    });
}
function complete(targets, expected, behavior) {
    if (behavior === "verify") {
        if (!outputsMatch(targets, expected))
            throw new Error("derived evidence mismatch");
        return;
    }
    for (const [name, value] of Object.entries(expected))
        write(targets[name], value);
}
function fromState(path, cwd) {
    const statePath = resolve(cwd, path);
    const state = validateOnboardingState(readJson(statePath));
    for (const name of ["graph", "summary", "map", "contract", "report"])
        if (!state.evidence[name])
            throw new Error(`state does not retain ${name} evidence`);
    const mapPath = resolve(cwd, state.paths.map);
    const contractPath = resolve(cwd, state.paths.contract);
    const map = validateRealizationMap(input(mapPath, state.evidence.map, "realization map"));
    const contract = validateArchitectureContract(input(contractPath, state.evidence.contract, "architecture contract"));
    const graph = analyzeTypeScriptProgram({ rootConfigs: state.scope.rootConfigs, scope: state.scope }, cwd);
    const graphJson = renderJson(graph);
    const summary = buildOnboardingSummary(graph);
    const baseline = state.evidence.baseline ? validateBaseline(input(resolve(cwd, state.paths.baseline), state.evidence.baseline, "baseline")) : undefined;
    const reportJson = renderJson(buildReport(graph, map, contract, baseline));
    if (sha256(graphJson) !== state.evidence.graph || sha256(summary) !== state.evidence.summary || sha256(reportJson) !== state.evidence.report)
        throw new Error("state evidence digest mismatch");
    return { targets: { graph: resolve(cwd, state.paths.graph), summary: resolve(cwd, state.paths.summary), report: resolve(cwd, state.paths.report) }, evidence: { graph: graphJson, summary, report: reportJson } };
}
function fromMap(path, cwd) {
    const mapPath = resolve(cwd, path);
    const map = validateRealizationMap(readJson(mapPath));
    const graph = analyzeTypeScriptProgram({ rootConfigs: map.scope.rootConfigs, scope: map.scope }, cwd);
    const directory = dirname(mapPath);
    return { targets: { graph: resolve(directory, "evidence/observed-graph.json"), summary: resolve(directory, "evidence/onboarding-summary.md") }, evidence: { graph: renderJson(graph), summary: buildOnboardingSummary(graph) } };
}
export function replay(source, behavior, cwd = process.cwd()) {
    const result = source.kind === "state" ? fromState(source.path, cwd) : fromMap(source.path, cwd);
    complete(result.targets, result.evidence, behavior);
}
//# sourceMappingURL=run.js.map