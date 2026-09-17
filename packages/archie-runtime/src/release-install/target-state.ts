import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { canonicalize } from "../analysis/canonical-json.js";
import { parseReleaseRecord, RELEASE_RECORD_FILE, type ReleaseRecord, type SelectedRelease } from "../release-record/release-record-v3.js";
import { assertPinnedApmProjection, planApmProjection, type ApmProjection } from "./apm-projection.js";
import { npmProjection, tarballSha256, validateNpmProjection, type NpmProjection } from "./npm-projection.js";

const readOptional = (path: string): string | undefined => existsSync(path) ? readFileSync(path, "utf8") : undefined;

export interface PinnedTarget {
  targetDirectory: string;
  record: ReleaseRecord;
  recordBytes: string;
  apm: Required<ApmProjection>;
  npm: NpmProjection;
}

export interface StagedTarget extends PinnedTarget {
  selectionReceiptPath: string;
}

function paths(targetDirectory: string) {
  const target = resolve(targetDirectory);
  const archie = join(target, ".archie");
  return {
    target, archie, release: join(archie, "release"), runtime: join(archie, "runtime"), runtimeNpm: join(archie, "runtime", "npm"),
    version: join(archie, "version"), record: join(archie, "release", RELEASE_RECORD_FILE), legacyRecords: [join(archie, "release", "release-record-v1.json"), join(archie, "release", "release-record-v2.json")], receipt: join(archie, "release", "selection-receipt.json"),
    manifest: join(archie, "runtime", "package.json"), lock: join(archie, "runtime", "package-lock.json"),
    apmManifest: join(target, "apm.yml"), apmLock: join(target, "apm.lock.yaml")
  };
}

/** Release records before v3 are not upgraded in place: their skill set and runtime payload differ. */
function assertNoLegacyPin(p: ReturnType<typeof paths>): void {
  if (p.legacyRecords.some(existsSync)) throw new Error("target has a pre-v3 Archie release pin; remove .archie/release, .archie/runtime, and .archie/version, then bootstrap the v3 release");
}

function receipt(selected: SelectedRelease): string {
  return `${canonicalize({ format: "archie-local-selection-receipt-v1", recordSha256: selected.recordSha256, selectedPath: selected.bundleDirectory, version: selected.record.version })}\n`;
}

export function readPinnedTarget(targetDirectory: string): PinnedTarget {
  const p = paths(targetDirectory);
  assertNoLegacyPin(p);
  for (const required of [p.version, p.record, p.manifest, p.lock, p.apmManifest, p.apmLock]) if (!existsSync(required)) throw new Error(`pinned target state is incomplete: ${required}`);
  const recordBytes = readFileSync(p.record, "utf8");
  const record = parseReleaseRecord(recordBytes);
  if (readFileSync(p.version, "utf8") !== `${record.version}\n`) throw new Error("target release pin differs from the pinned record");
  const npm = { manifest: readFileSync(p.manifest, "utf8"), lock: readFileSync(p.lock, "utf8") };
  validateNpmProjection(npm, record);
  for (const artifact of record.artifacts) {
    const tarball = join(p.runtimeNpm, artifact.locator.replace(/^file:npm\//, ""));
    if (!existsSync(tarball) || tarballSha256(readFileSync(tarball)) !== artifact.tarballSha256) throw new Error(`target ${artifact.package} tarball differs from the pinned record`);
  }
  const apm = { manifest: readFileSync(p.apmManifest, "utf8"), lock: readFileSync(p.apmLock, "utf8") };
  assertPinnedApmProjection(record, apm);
  return { targetDirectory: p.target, record, recordBytes, npm, apm };
}

/** Stages only Archie-owned state and a safely merged APM projection. Native installation is deferred to Phase 5. */
export function stageSelectedRelease(targetDirectory: string, selected: SelectedRelease, previous?: ReleaseRecord): StagedTarget {
  const p = paths(targetDirectory);
  const existingManifest = readOptional(p.apmManifest);
  const existingLock = readOptional(p.apmLock);
  if ((existingManifest === undefined) !== (existingLock === undefined)) throw new Error("APM target projection is incomplete; cannot safely preserve shared state");
  const generatedNpm = npmProjection(selected.record);
  const npm = { manifest: generatedNpm.manifest, lock: generatedNpm.lock };
  validateNpmProjection(npm, selected.record);
  const apm = planApmProjection(selected.record, { manifest: existingManifest, lock: existingLock }, previous);
  mkdirSync(p.release, { recursive: true });
  mkdirSync(p.runtimeNpm, { recursive: true });
  writeFileSync(p.version, `${selected.record.version}\n`);
  writeFileSync(p.record, selected.recordBytes);
  writeFileSync(p.receipt, receipt(selected));
  writeFileSync(p.manifest, npm.manifest);
  writeFileSync(p.lock, npm.lock);
  for (const artifact of selected.artifacts) copyFileSync(artifact.tarballPath, join(p.runtimeNpm, artifact.tarballName));
  writeFileSync(p.apmManifest, apm.manifest);
  // APM rejects an empty lockfile; only preserve an existing preimage until native `apm lock` replaces it.
  if (apm.lock !== undefined) writeFileSync(p.apmLock, apm.lock);
  return { targetDirectory: p.target, record: selected.record, recordBytes: selected.recordBytes, npm, apm: { ...apm, lock: apm.lock ?? "" }, selectionReceiptPath: p.receipt };
}

export function bootstrapTarget(targetDirectory: string, selected: SelectedRelease): StagedTarget {
  const p = paths(targetDirectory);
  assertNoLegacyPin(p);
  if (existsSync(p.record) || existsSync(p.version)) throw new Error("target already has a release pin; use upgrade with an explicit local release");
  return stageSelectedRelease(targetDirectory, selected);
}

/** Internal staging step; the public upgrade flow verifies the installed target before calling this. */
export function stageUpgradeTarget(targetDirectory: string, selected: SelectedRelease): StagedTarget {
  const previous = readPinnedTarget(targetDirectory);
  return stageSelectedRelease(targetDirectory, selected, previous.record);
}

/** Verify deliberately has no release input: it can only inspect the target-owned pin. */
export function verifyPinnedTarget(targetDirectory: string): PinnedTarget {
  return readPinnedTarget(targetDirectory);
}
