import { bootstrapAndVerifyTarget, formatInstallReport, ReleaseInstallFailure, ReleaseVerificationFailure, selectLocalRelease, upgradeAndVerifyTarget, verifyInstalledTarget } from "@archie/runtime/release";
function usage() {
    throw new Error("Usage: archie bootstrap --release <local-directory> [--target <directory>] [--format text|json] | archie upgrade --release <local-directory> [--target <directory>] [--format text|json] | archie verify [--target <directory>] [--format text|json]\nBootstrap and upgrade require an explicitly selected local bundle. Verify only uses the existing target pin. Signing, public-release trust, controller distribution, and key operations are deferred.");
}
function options(operation, args) {
    const values = new Map();
    for (let index = 0; index < args.length; index += 2) {
        const name = args[index], value = args[index + 1];
        if ((name !== "--release" && name !== "--target" && name !== "--format") || !value || values.has(name))
            usage();
        values.set(name, value);
    }
    const release = values.get("--release"), format = values.get("--format") ?? "text";
    if ((operation === "verify" && release) || (operation !== "verify" && !release) || (format !== "text" && format !== "json"))
        usage();
    return { release, target: values.get("--target") ?? process.cwd(), format };
}
function emit(report, format) {
    console.log(format === "json" ? JSON.stringify(report) : formatInstallReport(report));
}
export function runReleaseInstallCommand(args) {
    const operation = args[0];
    if (operation !== "bootstrap" && operation !== "upgrade" && operation !== "verify")
        usage();
    const input = options(operation, args.slice(1));
    try {
        if (operation === "verify") {
            emit(verifyInstalledTarget(input.target), input.format);
        }
        else {
            const selected = selectLocalRelease(input.release);
            const result = operation === "bootstrap" ? bootstrapAndVerifyTarget(input.target, selected) : upgradeAndVerifyTarget(input.target, selected);
            emit(result.report, input.format);
        }
    }
    catch (error) {
        if (error instanceof ReleaseInstallFailure || error instanceof ReleaseVerificationFailure)
            emit(error.report, input.format);
        throw error;
    }
}
//# sourceMappingURL=release-install.js.map