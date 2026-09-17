import { existsSync, readFileSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { sha256 } from "../artifacts/digest.js";
import { exactKeys, fail, record, string } from "../formats/helpers.js";
import { defaultOnboardingPaths } from "./defaults.js";
const checkpoints = ["scope-selected", "evidence-generated", "classification-drafted", "proposed-contract-checked", "active-contract-checked", "baseline-created"];
const evidenceNames = ["graph", "summary", "map", "contract", "report", "baseline"];
const pathNames = ["state", "graph", "summary", "map", "contract", "report", "baseline"];
const requiredEvidence = {
    "scope-selected": [], "evidence-generated": ["graph", "summary"], "classification-drafted": ["graph", "summary", "map"],
    "proposed-contract-checked": ["graph", "summary", "map", "contract", "report"], "active-contract-checked": ["graph", "summary", "map", "contract", "report"],
    "baseline-created": ["graph", "summary", "map", "contract", "report", "baseline"]
};
function path(value, label) { const result = string(value, label); if (isAbsolute(result) || result.split(/[\\/]/).includes("..") || result === ".")
    fail(`${label} must be a repository-relative path`); return result.replaceAll("\\", "/"); }
function scope(value) {
    const raw = record(value, "scope");
    exactKeys(raw, ["rootConfigs", "include", "exclusions"], "scope");
    const strings = (input, label) => { if (!Array.isArray(input))
        fail(`${label} must be an array`); return input.map((item, index) => path(item, `${label}[${index}]`)); };
    if (!Array.isArray(raw.exclusions))
        fail("scope.exclusions must be an array");
    return { rootConfigs: strings(raw.rootConfigs, "scope.rootConfigs"), include: strings(raw.include, "scope.include"), exclusions: raw.exclusions.map((item, index) => { const exclusion = record(item, `scope.exclusions[${index}]`); exactKeys(exclusion, ["path", "reason"], `scope.exclusions[${index}]`); return { path: path(exclusion.path, "exclusion.path"), reason: string(exclusion.reason, "exclusion.reason") }; }) };
}
export function requiredEvidenceFor(checkpoint) { return requiredEvidence[checkpoint]; }
export function defaultOnboardingState(input) {
    return validateOnboardingState({ version: "onboarding-state/v1", scope: input.scope, skillLocation: input.skillLocation, paths: { ...defaultOnboardingPaths, ...input.paths }, checkpoint: "scope-selected", evidence: {} });
}
export function validateOnboardingState(value, repositoryRoot) {
    const raw = record(value, "onboarding state");
    exactKeys(raw, ["version", "scope", "skillLocation", "paths", "checkpoint", "evidence"], "onboarding state");
    if (raw.version !== "onboarding-state/v1")
        fail(`unsupported document version: ${String(raw.version)}`);
    const pathsRaw = record(raw.paths, "paths");
    exactKeys(pathsRaw, pathNames, "paths");
    const paths = Object.fromEntries(pathNames.map((name) => [name, path(pathsRaw[name], `paths.${name}`)]));
    const checkpoint = string(raw.checkpoint, "checkpoint");
    if (!checkpoints.includes(checkpoint))
        fail("checkpoint is invalid");
    const evidenceRaw = record(raw.evidence, "evidence");
    exactKeys(evidenceRaw, evidenceNames, "evidence");
    const evidence = {};
    for (const name of evidenceNames)
        if (evidenceRaw[name] !== undefined)
            evidence[name] = string(evidenceRaw[name], `evidence.${name}`);
    for (const name of requiredEvidenceFor(checkpoint))
        if (!evidence[name])
            fail(`checkpoint ${checkpoint} requires ${name} evidence`);
    if (repositoryRoot)
        for (const [name, digest] of Object.entries(evidence)) {
            const candidate = resolve(repositoryRoot, paths[name]);
            if (relative(repositoryRoot, candidate).startsWith("..") || !existsSync(candidate))
                fail(`missing ${name} evidence at ${paths[name]}`);
            if (sha256(readFileSync(candidate)) !== digest)
                fail(`${name} evidence digest mismatch`);
        }
    return { version: "onboarding-state/v1", scope: scope(raw.scope), skillLocation: path(raw.skillLocation, "skillLocation"), paths, checkpoint, evidence };
}
//# sourceMappingURL=validate.js.map