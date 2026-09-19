import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { updateBaseline } from "../baseline/update.js";
import { analyzeTypeScriptProgram } from "../runtime-analysis.js";
import { renderJson } from "../report/json.js";
import { renderText } from "../report/text.js";
import { buildReport } from "../report/build.js";
import { validateArchitectureActiveResultSet, validateArchitectureContract, validateArchitectureDriftRecord, validateBaseline, validateConformanceReport, validateRealizationMap } from "../formats/validate.js";
import { defaultOnboardingState, validateOnboardingState } from "../onboarding-state/validate.js";
import { advanceOnboardingState } from "../onboarding-state/update.js";
import { verifyLocalOnboardingSetup } from "../onboarding-state/setup.js";
import { replay } from "../replay/run.js";
import { rerecord } from "../evidence/rerecord.js";
import { reconcile } from "../reconciliation/compare.js";
import { buildOnboardingSummary } from "../onboarding-summary/build.js";
function parseArgs(args) {
    const values = new Map();
    const flags = new Set();
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (!argument.startsWith("--"))
            throw new Error(`unexpected argument: ${argument}`);
        const next = args[index + 1];
        if (!next || next.startsWith("--"))
            flags.add(argument);
        else {
            values.set(argument, [...(values.get(argument) ?? []), next]);
            index += 1;
        }
    }
    return { values, flags };
}
function required(args, name) { const values = args.values.get(name) ?? []; if (values.length !== 1)
    throw new Error(values.length === 0 ? `missing ${name}` : `multiple ${name} values`); return values[0]; }
function optional(args, name) { const values = args.values.get(name) ?? []; if (values.length > 1)
    throw new Error(`multiple ${name} values`); return values[0]; }
function exactlyOneFlag(args, first, second) {
    const selected = [first, second].filter((flag) => args.flags.has(flag));
    if (selected.length !== 1)
        throw new Error(`requires exactly one of ${first} or ${second}`);
    return selected[0] === first;
}
function readJson(path, cwd) { return JSON.parse(readFileSync(resolve(cwd, path), "utf8")); }
function emit(value, output, cwd) { if (output) {
    const path = resolve(cwd, output);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, value);
    return "";
} return value; }
function onboardingPaths(args) {
    return Object.fromEntries(["state", "graph", "summary", "map", "contract", "report", "baseline"].flatMap((name) => { const value = args.values.get(`--${name}`)?.[0]; return value ? [[name, value]] : []; }));
}
function exclusions(args) {
    return (args.values.get("--exclude") ?? []).map((path) => ({ path, reason: "command-line exclusion" }));
}
function outcomeSummary(outcome) {
    return {
        version: "onboarding-rerecord/v1",
        checkpoint: outcome.checkpoint,
        reRecorded: outcome.reRecorded,
        verdictUnchanged: outcome.verdictUnchanged,
        counts: {
            sourceModules: outcome.modules,
            graphNodes: outcome.graphNodes,
            graphEdges: outcome.graphEdges,
            reportResults: outcome.reportResults,
            reportGaps: outcome.reportGaps
        }
    };
}
export function runCli(argv, cwd = process.cwd()) {
    try {
        const [command, ...rest] = argv;
        if (command === "onboard") {
            const [operation, ...operationArgs] = rest;
            const onboardingArgs = parseArgs(operationArgs);
            verifyLocalOnboardingSetup(cwd);
            if (operation === "setup")
                return { code: 0, stdout: "local pinned setup verified\n", stderr: "" };
            if (operation === "init") {
                const roots = onboardingArgs.values.get("--root") ?? [required(onboardingArgs, "--config")];
                const state = defaultOnboardingState({ scope: { rootConfigs: roots, include: onboardingArgs.values.get("--include") ?? ["**/*.ts"], exclusions: exclusions(onboardingArgs) }, skillLocation: required(onboardingArgs, "--skill-location"), paths: onboardingPaths(onboardingArgs) });
                return { code: 0, stdout: emit(renderJson(state), state.paths.state, cwd), stderr: "" };
            }
            if (operation === "advance") {
                const statePath = onboardingArgs.values.get("--state")?.[0] ?? ".architecture-conformance/onboarding.json";
                const state = validateOnboardingState(readJson(statePath, cwd), cwd);
                const checkpoint = required(onboardingArgs, "--checkpoint");
                const advanced = advanceOnboardingState(state, { checkpoint }, cwd);
                return { code: 0, stdout: emit(renderJson(advanced), statePath, cwd), stderr: "" };
            }
            if (operation === "rerecord") {
                const statePath = onboardingArgs.values.get("--state")?.[0] ?? ".architecture-conformance/onboarding.json";
                const expectUnchanged = onboardingArgs.flags.has("--expect-unchanged-verdict");
                if (expectUnchanged && onboardingArgs.values.get("--expect-unchanged-verdict"))
                    throw new Error("--expect-unchanged-verdict is a flag and takes no value");
                const { outcome } = rerecord(readJson(statePath, cwd), { expectUnchangedVerdict: expectUnchanged, repositoryRoot: cwd });
                return { code: 0, stdout: emit(renderJson(outcomeSummary(outcome)), undefined, cwd), stderr: "" };
            }
            throw new Error(`unknown onboard operation: ${operation ?? ""}`);
        }
        const args = parseArgs(rest);
        if (command === "replay") {
            const state = optional(args, "--state");
            const map = optional(args, "--map");
            if ((state ? 1 : 0) + (map ? 1 : 0) !== 1)
                throw new Error("requires exactly one of --state or --map");
            const regenerate = exactlyOneFlag(args, "--regenerate", "--verify");
            replay(state ? { kind: "state", path: state } : { kind: "map", path: map }, regenerate ? "regenerate" : "verify", cwd);
            return { code: 0, stdout: "", stderr: "" };
        }
        if (command === "reconcile") {
            const active = validateArchitectureActiveResultSet(readJson(required(args, "--active"), cwd));
            const drift = validateArchitectureDriftRecord(readJson(required(args, "--drift"), cwd));
            return { code: 0, stdout: emit(renderJson(reconcile(active, drift)), optional(args, "--output"), cwd), stderr: "" };
        }
        if (command === "analyze") {
            const roots = args.values.get("--root") ?? [required(args, "--config")];
            const include = args.values.get("--include") ?? ["**/*.ts"];
            const graph = analyzeTypeScriptProgram({ rootConfigs: roots, scope: { rootConfigs: roots, include, exclusions: exclusions(args) } }, cwd);
            const summaryOutput = args.values.get("--summary-output")?.[0];
            if (summaryOutput)
                emit(buildOnboardingSummary(graph), summaryOutput, cwd);
            return { code: 0, stdout: emit(renderJson(graph), args.values.get("--output")?.[0], cwd), stderr: "" };
        }
        if (command === "check") {
            const map = validateRealizationMap(readJson(required(args, "--map"), cwd));
            const contract = validateArchitectureContract(readJson(required(args, "--contract"), cwd));
            const roots = args.values.get("--root") ?? map.scope.rootConfigs;
            if (roots.length === 0)
                throw new Error("no root config supplied");
            const graph = analyzeTypeScriptProgram({ rootConfigs: roots, scope: map.scope }, cwd);
            const baselinePath = args.values.get("--baseline")?.[0];
            const baseline = baselinePath ? validateBaseline(readJson(baselinePath, cwd)) : undefined;
            const report = buildReport(graph, map, contract, baseline);
            const text = args.values.get("--format")?.[0] === "text" ? renderText(report) : renderJson(report);
            const strictIncomplete = args.flags.has("--strict") && (report.gaps.length > 0 || report.results.some((result) => result.category === "coverage" && result.status !== "fixed"));
            const blocking = report.results.some((result) => result.category === "implementation" && !["waived", "proposed", "fixed"].includes(result.status));
            return { code: strictIncomplete ? 2 : blocking ? 1 : 0, stdout: emit(text, args.values.get("--output")?.[0], cwd), stderr: "" };
        }
        if (command === "baseline") {
            const report = validateConformanceReport(JSON.parse(readFileSync(resolve(cwd, required(args, "--report")), "utf8")));
            const output = required(args, "--output");
            const baseline = updateBaseline(report);
            return { code: 0, stdout: emit(renderJson(baseline), output, cwd), stderr: "" };
        }
        throw new Error(`unknown command: ${command ?? ""}`);
    }
    catch (error) {
        return { code: 3, stdout: "", stderr: `${error instanceof Error ? error.message : String(error)}\n` };
    }
}
//# sourceMappingURL=run.js.map