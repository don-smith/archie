import { createHash } from "node:crypto";
import type { ReleaseRecordV1 } from "../release-record/release-record-v1.js";

export interface NpmProjection {
  manifest: string;
  lock: string;
}

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
      [`node_modules/${record.npm.package}`]: { version: record.npm.version, resolved: record.npm.locator, integrity: record.npm.lockIntegrity }
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
  const packageLock = ((lock.packages as Record<string, Record<string, unknown>> | undefined) ?? {})[`node_modules/${record.npm.package}`];
  if (manifest.name !== "archie-private-runtime" || manifest.private !== true || manifest.version !== record.version || dependency !== record.npm.locator || !packageLock || packageLock.version !== record.npm.version || packageLock.resolved !== record.npm.locator || packageLock.integrity !== record.npm.lockIntegrity) throw new Error("generated npm projection differs from the pinned release record");
}

export function tarballSha256(tarball: Buffer): string {
  return createHash("sha256").update(tarball).digest("hex");
}
