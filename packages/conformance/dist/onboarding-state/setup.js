import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
function packageJson(path) { return JSON.parse(readFileSync(path, "utf8")); }
function record(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : undefined; }
/** Verifies the runtime expected by the locally installed package, without consulting PATH. */
export function verifyOnboardingRuntime(nodeVersion = process.versions.node, npmUserAgent = process.env.npm_config_user_agent) {
    if (!/^24\.\d+\.\d+$/.test(nodeVersion))
        throw new Error("architecture-conformance requires Node >=24 <25; switch to a supported Node 24 runtime and run npx --no-install architecture-conformance");
    if (!/^npm\/\d+\.\d+\.\d+(?:\s|$)/.test(npmUserAgent ?? ""))
        throw new Error("architecture-conformance onboarding must be run by npm from the target installation; use npm with npx --no-install architecture-conformance");
}
/** Rejects ambient executables: onboarding may run only the target's exact local devDependency. */
export function verifyLocalOnboardingSetup(repositoryRoot = process.cwd()) {
    verifyOnboardingRuntime();
    const rootManifestPath = resolve(repositoryRoot, "package.json");
    const lockfilePath = resolve(repositoryRoot, "package-lock.json");
    const executable = resolve(repositoryRoot, "node_modules/.bin/architecture-conformance");
    if (!existsSync(rootManifestPath) || !existsSync(lockfilePath) || !existsSync(executable))
        throw new Error("local architecture-conformance setup is missing; install architecture-conformance as an exact devDependency, commit the lockfile (package-lock.json), then run npx --no-install architecture-conformance");
    const root = packageJson(rootManifestPath);
    const dependencies = record(root.devDependencies);
    const packageName = ["@archie/conformance", "architecture-conformance"].find((name) => typeof dependencies?.[name] === "string");
    const installedManifestPath = packageName ? resolve(repositoryRoot, "node_modules", packageName, "package.json") : "";
    if (!packageName || !existsSync(installedManifestPath))
        throw new Error("local architecture-conformance setup is missing; install architecture-conformance as an exact devDependency, commit the lockfile (package-lock.json), then run npx --no-install architecture-conformance");
    const pinned = dependencies?.[packageName];
    const installed = packageJson(installedManifestPath);
    if (typeof pinned !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pinned) || pinned !== installed.version)
        throw new Error("architecture-conformance must be an exact installed devDependency; install/pin the package and commit the lockfile (package-lock.json)");
    const lockfile = packageJson(lockfilePath);
    const packages = record(lockfile.packages);
    const lockedRoot = record(packages?.[""]);
    const lockedDependencies = record(lockedRoot?.devDependencies);
    const lockedPackage = record(packages?.[`node_modules/${packageName}`]);
    if (lockfile.lockfileVersion !== 3 || lockedDependencies?.[packageName] !== pinned || lockedPackage?.version !== installed.version)
        throw new Error("package-lock.json must record the exact architecture-conformance devDependency; reinstall, commit the lockfile (package-lock.json), then run npx --no-install architecture-conformance");
    if (typeof installed.bin !== "object" || !installed.bin || Array.isArray(installed.bin) || !("architecture-conformance" in installed.bin))
        throw new Error("installed architecture-conformance package does not expose its local executable");
}
//# sourceMappingURL=setup.js.map