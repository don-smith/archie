import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const runtimeDependencies = {
    "@typescript/typescript-darwin-arm64": "7.0.2",
    likec4: "1.59.2",
    marked: "15.0.7",
    playwright: "1.62.1",
    typescript: "7.0.2"
};
const runtimeBin = { "architecture-docs": "dist/architecture-docs/bin/architecture-docs.mjs" };
function loadReleaseDependencyPackages() {
    try {
        return JSON.parse(readFileSync(new URL("../../vendor/release-npm-lock-v2.json", import.meta.url), "utf8")).packages;
    }
    catch (cause) {
        throw new Error("Runtime v2 npm lock template is missing or invalid; run the vendor lock regeneration command and rebuild", { cause });
    }
}
export function npmProjection(record) {
    if (record.schemaVersion === 2)
        return npmProjectionV2(record);
    const manifest = {
        name: "archie-private-runtime",
        private: true,
        version: record.version,
        dependencies: { [record.npm.package]: record.npm.locator }
    };
    const lock = {
        name: "archie-private-runtime",
        version: record.version,
        lockfileVersion: 3,
        requires: true,
        packages: {
            "": { name: "archie-private-runtime", version: record.version, dependencies: { [record.npm.package]: record.npm.locator } },
            [`node_modules/${record.npm.package}`]: {
                version: record.npm.version,
                resolved: record.npm.locator,
                integrity: record.npm.lockIntegrity,
                dependencies: runtimeDependencies,
                bin: runtimeBin,
                engines: { node: ">=24 <25" }
            }
        }
    };
    return { manifest: `${JSON.stringify(manifest, null, 2)}\n`, lock: `${JSON.stringify(lock, null, 2)}\n` };
}
export function validateNpmProjection(projection, record) {
    if (record.schemaVersion === 2) {
        validateNpmProjectionV2(projection, record);
        return;
    }
    const parse = (bytes, label) => {
        try {
            const value = JSON.parse(bytes);
            if (!value || typeof value !== "object" || Array.isArray(value))
                throw new Error();
            return value;
        }
        catch {
            throw new Error(`${label} is not valid generated JSON`);
        }
    };
    const manifest = parse(projection.manifest, "runtime manifest");
    const lock = parse(projection.lock, "runtime lock");
    const dependency = manifest.dependencies?.[record.npm.package];
    const lockPackages = lock.packages ?? {};
    const lockRoot = lockPackages[""];
    const packageLock = lockPackages[`node_modules/${record.npm.package}`];
    const expectedRootDependencies = { [record.npm.package]: record.npm.locator };
    if (manifest.name !== "archie-private-runtime" || manifest.private !== true || manifest.version !== record.version || dependency !== record.npm.locator ||
        lock.lockfileVersion !== 3 || !lockRoot || lockRoot.name !== "archie-private-runtime" || lockRoot.version !== record.version || JSON.stringify(lockRoot.dependencies) !== JSON.stringify(expectedRootDependencies) ||
        !packageLock || packageLock.version !== record.npm.version || packageLock.resolved !== record.npm.locator || packageLock.integrity !== record.npm.lockIntegrity ||
        JSON.stringify(packageLock.dependencies) !== JSON.stringify(runtimeDependencies) || JSON.stringify(packageLock.bin) !== JSON.stringify(runtimeBin))
        throw new Error("generated npm projection differs from the pinned release record");
}
function npmProjectionV2(record) {
    const dependencies = Object.fromEntries(record.artifacts.map(artifact => [artifact.package, artifact.locator]));
    const manifest = { name: "archie-private-runtime", private: true, version: record.version, dependencies };
    const packages = { "": { name: "archie-private-runtime", version: record.version, dependencies }, ...loadReleaseDependencyPackages() };
    for (const artifact of record.artifacts) {
        packages[`node_modules/${artifact.package}`] = { version: artifact.version, resolved: artifact.locator, integrity: artifact.lockIntegrity, dependencies: artifact.dependencies, bin: artifact.binaries, engines: artifact.engines };
    }
    return { manifest: `${JSON.stringify(manifest, null, 2)}\n`, lock: `${JSON.stringify({ name: "archie-private-runtime", version: record.version, lockfileVersion: 3, requires: true, packages }, null, 2)}\n` };
}
function validateNpmProjectionV2(projection, record) {
    const parse = (bytes, label) => { try {
        const value = JSON.parse(bytes);
        if (!value || typeof value !== "object" || Array.isArray(value))
            throw new Error();
        return value;
    }
    catch {
        throw new Error(`${label} is not valid generated JSON`);
    } };
    const manifest = parse(projection.manifest, "runtime manifest"), lock = parse(projection.lock, "runtime lock");
    if (manifest.name !== "archie-private-runtime" || manifest.private !== true || manifest.version !== record.version || lock.lockfileVersion !== 3)
        throw new Error("generated npm projection differs from the pinned release record");
    const dependencies = manifest.dependencies, packages = lock.packages;
    if (!dependencies || !packages || JSON.stringify(Object.keys(dependencies)) !== JSON.stringify(record.artifacts.map(artifact => artifact.package)))
        throw new Error("generated npm projection artifact order differs from the pinned release record");
    const lockedRoot = packages[""];
    if (!lockedRoot || lockedRoot.name !== manifest.name || lockedRoot.version !== record.version || JSON.stringify(lockedRoot.dependencies) !== JSON.stringify(dependencies))
        throw new Error("generated npm projection root differs from the pinned release record");
    for (const artifact of record.artifacts) {
        if (dependencies[artifact.package] !== artifact.locator)
            throw new Error("generated npm projection differs from the pinned release record");
        const installed = packages[`node_modules/${artifact.package}`];
        if (!installed || installed.version !== artifact.version || installed.resolved !== artifact.locator || installed.integrity !== artifact.lockIntegrity || JSON.stringify(installed.dependencies) !== JSON.stringify(artifact.dependencies) || JSON.stringify(installed.engines) !== JSON.stringify(artifact.engines) || JSON.stringify(installed.bin) !== JSON.stringify(artifact.binaries))
            throw new Error("generated npm projection differs from the pinned release record");
    }
}
export function tarballSha256(tarball) {
    return createHash("sha256").update(tarball).digest("hex");
}
//# sourceMappingURL=npm-projection.js.map