import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { ReleaseRecord } from "../release-record/release-record-v3.js";

export interface NpmProjection {
  manifest: string;
  lock: string;
}

function loadReleaseDependencyPackages(): Record<string, unknown> {
  try { return (JSON.parse(readFileSync(new URL("../../vendor/release-npm-lock-v2.json", import.meta.url), "utf8")) as { packages: Record<string, unknown> }).packages; }
  catch (cause) { throw new Error("Runtime npm lock template is missing or invalid; run the vendor lock regeneration command and rebuild", { cause }); }
}

export function npmProjection(record: Pick<ReleaseRecord, "version" | "artifacts">): NpmProjection {
  const dependencies = Object.fromEntries(record.artifacts.map(artifact => [artifact.package, artifact.locator]));
  const manifest = { name: "archie-private-runtime", private: true, version: record.version, dependencies };
  const packages: Record<string, unknown> = { "": { name: "archie-private-runtime", version: record.version, dependencies }, ...loadReleaseDependencyPackages() };
  for (const artifact of record.artifacts) {
    packages[`node_modules/${artifact.package}`] = { version: artifact.version, resolved: artifact.locator, integrity: artifact.lockIntegrity, dependencies: artifact.dependencies, bin: artifact.binaries, engines: artifact.engines };
  }
  return { manifest: `${JSON.stringify(manifest, null, 2)}\n`, lock: `${JSON.stringify({ name: "archie-private-runtime", version: record.version, lockfileVersion: 3, requires: true, packages }, null, 2)}\n` };
}
export function validateNpmProjection(projection: NpmProjection, record: Pick<ReleaseRecord, "version" | "artifacts">): void {
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
