import { assertAgentSkillsTarget, assertPinnedApmProjection } from "./apm-projection.js";
import { requireNative } from "./run-npm.js";
function policyStatus(result) {
    const output = `${result.stdout}\n${result.stderr}`.toLowerCase();
    if (result.exitCode !== 0)
        return "undetermined";
    if (/no policy|not applied|not configured|unavailable/.test(output))
        return "not-applied";
    return "passed";
}
/** Native APM owns lockfile resolution and serialization for the staged manifest. */
export function generateApmLock(targetDirectory, run) {
    requireNative(run, { command: "apm", args: ["lock"], cwd: targetDirectory }, "apm lock");
}
/** Runs APM's frozen install and keeps its baseline and organization-policy outcomes separate. */
export function runApmChecks(pin, run) {
    assertAgentSkillsTarget(pin.apm.manifest);
    requireNative(run, { command: "apm", args: ["install", "--frozen"], cwd: pin.targetDirectory }, "apm install --frozen");
    requireNative(run, { command: "apm", args: ["audit", "--ci", "--no-policy"], cwd: pin.targetDirectory }, "APM no-policy baseline audit");
    const status = run({ command: "apm", args: ["policy", "status"], cwd: pin.targetDirectory });
    let policy = policyStatus(status);
    if (policy === "passed") {
        const audit = run({ command: "apm", args: ["audit", "--ci"], cwd: pin.targetDirectory });
        policy = audit.exitCode === 0 ? "passed" : "blocked";
    }
    assertPinnedApmProjection(pin.record, pin.apm);
    return { frozen: "passed", baseline: "passed", policy, content: "passed" };
}
//# sourceMappingURL=run-apm.js.map