import { createHash } from "node:crypto";
import type { ReleaseRecordV1 } from "../release-record/release-record-v1.js";

export interface NpmProjection {
  manifest: string;
  lock: string;
}

const runtimeDependencies = {
  "@typescript/typescript-darwin-arm64": "7.0.2",
  likec4: "1.59.2",
  marked: "15.0.7",
  playwright: "1.62.1",
  typescript: "7.0.2"
};
const runtimeBin = { "architecture-docs": "dist/architecture-docs/bin/architecture-docs.mjs" };

export function npmProjection(record: ReleaseRecordV1): NpmProjection {
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

export function validateNpmProjection(projection: NpmProjection, record: ReleaseRecordV1): void {
  const parse = (bytes: string, label: string): Record<string, unknown> => {
    try {
      const value = JSON.parse(bytes);
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
      return value as Record<string, unknown>;
    } catch { throw new Error(`${label} is not valid generated JSON`); }
  };
  const manifest = parse(projection.manifest, "runtime manifest");
  const lock = parse(projection.lock, "runtime lock");
  const dependency = (manifest.dependencies as Record<string, unknown> | undefined)?.[record.npm.package];
  const lockPackages = (lock.packages as Record<string, Record<string, unknown>> | undefined) ?? {};
  const lockRoot = lockPackages[""];
  const packageLock = lockPackages[`node_modules/${record.npm.package}`];
  const expectedRootDependencies = { [record.npm.package]: record.npm.locator };
  if (
    manifest.name !== "archie-private-runtime" || manifest.private !== true || manifest.version !== record.version || dependency !== record.npm.locator ||
    lock.lockfileVersion !== 3 || !lockRoot || lockRoot.name !== "archie-private-runtime" || lockRoot.version !== record.version || JSON.stringify(lockRoot.dependencies) !== JSON.stringify(expectedRootDependencies) ||
    !packageLock || packageLock.version !== record.npm.version || packageLock.resolved !== record.npm.locator || packageLock.integrity !== record.npm.lockIntegrity ||
    JSON.stringify(packageLock.dependencies) !== JSON.stringify(runtimeDependencies) || JSON.stringify(packageLock.bin) !== JSON.stringify(runtimeBin)
  ) throw new Error("generated npm projection differs from the pinned release record");
}

export function tarballSha256(tarball: Buffer): string {
  return createHash("sha256").update(tarball).digest("hex");
}
