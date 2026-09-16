import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { ReleaseRecordV1 } from "../release-record/release-record-v1.js";
import type { ReleaseRecordV2 } from "../release-record/release-record-v2.js";

export interface NpmProjection {
  manifest: string;
  lock: string;
}
export type ReleaseRecordForNpm = ReleaseRecordV1 | ReleaseRecordV2;

const runtimeDependencies = {
  "@typescript/typescript-darwin-arm64": "7.0.2",
  likec4: "1.59.2",
  marked: "15.0.7",
  playwright: "1.62.1",
  typescript: "7.0.2"
};
const runtimeBin = { "architecture-docs": "dist/architecture-docs/bin/architecture-docs.mjs" };
const releaseDependencyPackages = (JSON.parse(readFileSync(new URL("../../vendor/release-npm-lock-v2.json", import.meta.url), "utf8")) as { packages: Record<string, unknown> }).packages;

export function npmProjection(record: ReleaseRecordForNpm): NpmProjection {
  if (record.schemaVersion === 2) return npmProjectionV2(record);
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

export function validateNpmProjection(projection: NpmProjection, record: ReleaseRecordForNpm): void {
  if (record.schemaVersion === 2) { validateNpmProjectionV2(projection, record); return; }
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

function npmProjectionV2(record: ReleaseRecordV2): NpmProjection {
  const dependencies = Object.fromEntries(record.artifacts.map(artifact => [artifact.package, artifact.locator]));
  const manifest = { name: "archie-private-runtime", private: true, version: record.version, dependencies };
  const packages: Record<string, unknown> = { "": { name: "archie-private-runtime", version: record.version, dependencies }, ...releaseDependencyPackages };
  for (const artifact of record.artifacts) {
    packages[`node_modules/${artifact.package}`] = { version: artifact.version, resolved: artifact.locator, integrity: artifact.lockIntegrity, dependencies: artifact.dependencies, bin: artifact.binaries, engines: artifact.engines };
  }
  return { manifest: `${JSON.stringify(manifest, null, 2)}\n`, lock: `${JSON.stringify({ name: "archie-private-runtime", version: record.version, lockfileVersion: 3, requires: true, packages }, null, 2)}\n` };
}
function validateNpmProjectionV2(projection: NpmProjection, record: ReleaseRecordV2): void {
  const parse = (bytes: string, label: string): Record<string, unknown> => { try { const value = JSON.parse(bytes); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value as Record<string, unknown>; } catch { throw new Error(`${label} is not valid generated JSON`); } };
  const manifest = parse(projection.manifest, "runtime manifest"), lock = parse(projection.lock, "runtime lock");
  if (manifest.name !== "archie-private-runtime" || manifest.private !== true || manifest.version !== record.version || lock.lockfileVersion !== 3) throw new Error("generated npm projection differs from the pinned release record");
  const dependencies = manifest.dependencies as Record<string, unknown> | undefined, packages = lock.packages as Record<string, Record<string, unknown>> | undefined;
  if (!dependencies || !packages || JSON.stringify(Object.keys(dependencies)) !== JSON.stringify(record.artifacts.map(artifact => artifact.package))) throw new Error("generated npm projection artifact order differs from the pinned release record");
  const lockedRoot = packages[""];
  if (!lockedRoot || lockedRoot.name !== manifest.name || lockedRoot.version !== record.version || JSON.stringify(lockedRoot.dependencies) !== JSON.stringify(dependencies)) throw new Error("generated npm projection root differs from the pinned release record");
  for (const artifact of record.artifacts) {
    if (dependencies[artifact.package] !== artifact.locator) throw new Error("generated npm projection differs from the pinned release record");
    const installed = packages[`node_modules/${artifact.package}`];
    if (!installed || installed.version !== artifact.version || installed.resolved !== artifact.locator || installed.integrity !== artifact.lockIntegrity || JSON.stringify(installed.dependencies) !== JSON.stringify(artifact.dependencies) || JSON.stringify(installed.engines) !== JSON.stringify(artifact.engines) || JSON.stringify(installed.bin) !== JSON.stringify(artifact.binaries)) throw new Error("generated npm projection differs from the pinned release record");
  }
}

export function tarballSha256(tarball: Buffer): string {
  return createHash("sha256").update(tarball).digest("hex");
}
