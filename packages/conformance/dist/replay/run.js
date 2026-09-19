import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { sha256 } from "../artifacts/digest.js";
import { analyzeTypeScriptProgram } from "../runtime-analysis.js";
import { validateOnboardingState } from "../onboarding-state/validate.js";
import { validateRealizationMap } from "../formats/validate.js";
import { buildOnboardingSummary } from "../onboarding-summary/build.js";
import { renderJson } from "../report/json.js";
import { deriveEvidence, verifiedNormativeInputs } from "../evidence/derive.js";
function readJson(path) { return JSON.parse(readFileSync(path, "utf8")); }
function write(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); }
function readOrEmpty(path) { try {
    return readFileSync(path, "utf8");
}
catch {
    return "";
} }
function divergedNames(targets, expected) {
    return Object.entries(expected).flatMap(([name, value]) => {
        const target = targets[name];
        if (!target)
            return [];
        return readOrEmpty(target) === value ? [] : [readOrEmpty(target) === "" ? `${name} (missing at ${target})` : name];
    });
}
function complete(targets, expected, behavior) {
    if (behavior === "verify") {
        const diverged = divergedNames(targets, expected);
        if (diverged.length > 0)
            throw new Error(`derived evidence differs on disk from the recorded observation: ${diverged.join(", ")}; restore it with 'replay --state ... --regenerate'`);
        return;
    }
    for (const [name, value] of Object.entries(expected))
        write(targets[name], value);
}
export function fromState(path, cwd) {
    const state = validateOnboardingState(readJson(resolve(cwd, path)));
    for (const name of ["graph", "summary", "map", "contract", "report"])
        if (!state.evidence[name])
            throw new Error(`state does not retain ${name} evidence`);
    const inputs = verifiedNormativeInputs(state, cwd);
    const derived = deriveEvidence(state, inputs, cwd);
    const recomputed = { graph: derived.graphJson, summary: derived.summary, report: derived.reportJson };
    const stale = ["graph", "summary", "report"].filter((name) => state.evidence[name] !== sha256(recomputed[name]));
    if (stale.length > 0)
        throw new Error(`derived evidence is stale for ${stale.join(", ")}: current source differs from the recorded observation`
            + ` (normative map and contract${state.evidence.baseline ? " and baseline" : ""} verify) — re-record with 'onboard rerecord --state <state path>'`);
    return { targets: { graph: resolve(cwd, state.paths.graph), summary: resolve(cwd, state.paths.summary), report: resolve(cwd, state.paths.report) }, evidence: recomputed };
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