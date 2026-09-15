import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sha256 } from "../artifacts/digest.js";
import { requiredEvidenceFor, validateOnboardingState } from "./validate.js";
const order = ["scope-selected", "evidence-generated", "classification-drafted", "proposed-contract-checked", "active-contract-checked", "baseline-created"];
/** Advances only one evidence-backed operational checkpoint; it never edits normative artifacts. */
export function advanceOnboardingState(stateInput, update, repositoryRoot = process.cwd()) {
    const state = validateOnboardingState(stateInput, repositoryRoot);
    const expected = order[order.indexOf(state.checkpoint) + 1];
    if (update.checkpoint !== expected)
        throw new TypeError(`invalid checkpoint transition: ${state.checkpoint} to ${update.checkpoint}`);
    const evidence = { ...state.evidence };
    for (const name of requiredEvidenceFor(update.checkpoint))
        evidence[name] = sha256(readFileSync(resolve(repositoryRoot, state.paths[name])));
    return validateOnboardingState({ ...state, checkpoint: update.checkpoint, evidence }, repositoryRoot);
}
//# sourceMappingURL=update.js.map