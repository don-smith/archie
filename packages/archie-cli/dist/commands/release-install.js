import { bootstrapTarget, selectLocalRelease, upgradeTarget, verifyPinnedTarget } from "@archie/runtime";
const authorization = "Archie authorization: NOT ASSESSED — locally reviewed private release selected.";
function usage() {
    throw new Error("Usage: archie bootstrap --release <local-directory> [--target <directory>] | archie upgrade --release <local-directory> [--target <directory>] | archie verify [--target <directory>]\nBootstrap and upgrade require an explicitly selected local bundle. Verify only uses the existing target pin. Signing, public-release trust, controller distribution, and key operations are deferred.");
}
function options(operation, args) {
    const values = new Map();
    for (let index = 0; index < args.length; index += 2) {
        const name = args[index], value = args[index + 1];
        if ((name !== "--release" && name !== "--target") || !value || values.has(name))
            usage();
        values.set(name, value);
    }
    const release = values.get("--release");
    if ((operation === "verify" && release) || (operation !== "verify" && !release))
        usage();
    return { release, target: values.get("--target") ?? process.cwd() };
}
export function runReleaseInstallCommand(args) {
    const operation = args[0];
    if (operation !== "bootstrap" && operation !== "upgrade" && operation !== "verify")
        usage();
    const input = options(operation, args.slice(1));
    if (operation === "verify") {
        const result = verifyPinnedTarget(input.target);
        console.log(`Verified pinned Archie ${result.record.version}`);
    }
    else {
        const selected = selectLocalRelease(input.release);
        const result = operation === "bootstrap" ? bootstrapTarget(input.target, selected) : upgradeTarget(input.target, selected);
        console.log(`${operation === "bootstrap" ? "Bootstrapped" : "Upgraded"} Archie ${result.record.version}`);
        console.log(`Selection receipt: ${result.selectionReceiptPath}`);
    }
    console.log(authorization);
}
//# sourceMappingURL=release-install.js.map