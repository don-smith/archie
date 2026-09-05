import { createHash } from "node:crypto";
export function npmProjection(record) {
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
            [`node_modules/${record.npm.package}`]: { version: record.npm.version, resolved: record.npm.locator, integrity: record.npm.lockIntegrity }
        }
    };
    return { manifest: `${JSON.stringify(manifest, null, 2)}\n`, lock: `${JSON.stringify(lock, null, 2)}\n` };
}
export function validateNpmProjection(projection, record) {
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
    const packageLock = (lock.packages ?? {})[`node_modules/${record.npm.package}`];
    if (manifest.name !== "archie-private-runtime" || manifest.private !== true || manifest.version !== record.version || dependency !== record.npm.locator || !packageLock || packageLock.version !== record.npm.version || packageLock.resolved !== record.npm.locator || packageLock.integrity !== record.npm.lockIntegrity)
        throw new Error("generated npm projection differs from the pinned release record");
}
export function tarballSha256(tarball) {
    return createHash("sha256").update(tarball).digest("hex");
}
//# sourceMappingURL=npm-projection.js.map