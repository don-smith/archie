import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inspectNpmTarball } from "../npm-tarball/inspect.js";
import { npmProjection } from "../release-install/npm-projection.js";
import { nativeRun, requireNative, type NativeCommandRunner } from "../release-install/run-npm.js";
import { PRODUCT_VERSION } from "../product-version.js";
import { ARCHIE_SKILLS, BUNDLE_INPUT_FORMAT, RELEASE_ARTIFACT_PACKAGES, type ReleaseArtifact } from "./release-record-v3.js";

/** The payload each artifact must carry for the target's command links to resolve. */
const REQUIRED_PAYLOAD: Record<string, string> = {
  "@archie/runtime": "dist/architecture-docs/bin/architecture-docs.mjs",
  "@archie/conformance": "dist/cli.js"
};
const TARBALL_NAME: Record<string, string> = {
  "@archie/runtime": "archie-runtime.tgz",
  "@archie/conformance": "conformance.tgz"
};
const LOCK_NAME: Record<string, string> = {
  "@archie/runtime": "archie-runtime.lock.json",
  "@archie/conformance": "conformance.lock.json"
};

export interface BuildBundleOptions {
  /** Directory the bundle input is written to. Created if absent; existing bundle files are replaced. */
  bundleDirectory: string;
  /** Monorepo checkout the artifacts are packed from. */
  workspaceRoot: string;
  /** GitHub SSH locator for the APM context repository. */
  locator: string;
  /** Immutable ref: a `v<version>` tag, or the full commit SHA of the checkout. */
  ref: string;
  /** Repository-relative subfolder holding the APM context, when it is not the repository root. */
  path?: string;
  run?: NativeCommandRunner;
}
export interface BuildBundleResult {
  bundleDirectory: string;
  version: string;
  artifacts: ReleaseArtifact[];
  apm: { package: string; locator: string; ref: string; path?: string; resolvedCommit: string; contentHash: string };
}

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const sha512Integrity = (bytes: Buffer) => `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
/** The packed manifest is untyped JSON, so every field the record carries is narrowed here. */
const manifestText = (manifest: Record<string, unknown>, field: string): string => {
  const value = manifest[field];
  if (typeof value !== "string" || !value) throw new Error(`packed manifest has no usable ${field}`);
  return value;
};
const manifestMap = (manifest: Record<string, unknown>, field: string): Record<string, string> => {
  const value = manifest[field];
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`packed manifest ${field} must be an object`);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
    if (typeof entry !== "string") throw new Error(`packed manifest ${field}.${key} must be a string`);
    return [key, entry];
  }));
};
const lockField = (lock: string, name: string): string => {
  const matches = [...lock.matchAll(new RegExp(`^\\s*(?:-\\s*)?${name}:\\s*(\\S+)\\s*$`, "gm"))];
  if (matches.length !== 1) throw new Error(`generated APM lock must contain exactly one ${name} field`);
  return matches[0]![1]!;
};

/** Packs one workspace and gives its tarball the bundle's stable name, since npm names it by version. */
function pack(workspace: string, destination: string, run: NativeCommandRunner, cwd: string): string {
  const before = new Set(readdirSync(destination));
  requireNative(run, { command: "npm", args: ["pack", "--workspace", workspace, "--pack-destination", destination], cwd }, `npm pack ${workspace}`);
  const packed = readdirSync(destination).filter(entry => !before.has(entry) && entry.endsWith(".tgz"));
  if (packed.length !== 1) throw new Error(`npm pack did not produce exactly one archive for ${workspace}`);
  const target = join(destination, TARBALL_NAME[workspace]!);
  renameSync(join(destination, packed[0]!), target);
  return target;
}

function artifactRecord(tarball: string, expected: string): ReleaseArtifact {
  const bytes = readFileSync(tarball);
  const manifest = inspectNpmTarball(bytes).manifest;
  if (manifest.name !== expected) throw new Error(`packed artifact identity differs: expected ${expected}, packed ${String(manifest.name)}`);
  return {
    package: expected,
    version: manifestText(manifest, "version"),
    locator: `file:npm/${TARBALL_NAME[expected]!}`,
    lockIntegrity: sha512Integrity(bytes),
    tarballSha256: sha256(bytes),
    requiredPlatformPayload: REQUIRED_PAYLOAD[expected]!,
    dependencies: manifestMap(manifest, "dependencies"),
    engines: manifestMap(manifest, "engines"),
    binaries: manifestMap(manifest, "bin")
  };
}

/** The bundle's own APM project: one pinned dependency on the Archie context, resolved by native APM. */
function apmManifest(version: string, locator: string, ref: string, path?: string): string {
  return [
    "name: archie-private-context",
    `version: ${version}`,
    "private: true",
    "targets:",
    "  - agent-skills",
    "dependencies:",
    "  apm:",
    `    - git: ${locator}`,
    `      ref: ${ref}`,
    ...(path === undefined ? [] : [`      path: ${path}`]),
    "      skills:",
    ...ARCHIE_SKILLS.map(skill => `        - ${skill}`),
    "  mcp: []",
    "includes: auto",
    "scripts: {}",
    ""
  ].join("\n");
}

/**
 * Assembles a bundle input directory from a monorepo checkout: packs both artifacts, generates their
 * shared npm lock, and has native APM resolve the context pin. Finalization is a separate step, so this
 * makes no authorization claim and reviews nothing.
 */
export function buildReleaseBundle(options: BuildBundleOptions): BuildBundleResult {
  const { bundleDirectory, workspaceRoot, locator, ref, path } = options;
  const run = options.run ?? nativeRun;
  const npmDirectory = join(bundleDirectory, "npm");
  const apmDirectory = join(bundleDirectory, "apm");
  mkdirSync(npmDirectory, { recursive: true });
  mkdirSync(apmDirectory, { recursive: true });

  const artifacts = RELEASE_ARTIFACT_PACKAGES.map(name => artifactRecord(pack(name, npmDirectory, run, workspaceRoot), name));
  const [runtime, conformance] = artifacts;
  if (runtime!.version !== conformance!.version) throw new Error("packed artifact versions differ");
  const version = runtime!.version;
  if (version !== PRODUCT_VERSION) throw new Error(`packed artifacts are ${version}, but the product version authority is ${PRODUCT_VERSION}`);

  const projection = npmProjection({ version, artifacts: [runtime!, conformance!] });
  for (const artifact of artifacts) writeFileSync(join(npmDirectory, LOCK_NAME[artifact.package]!), projection.lock);

  writeFileSync(join(apmDirectory, "apm.yml"), apmManifest(version, locator, ref, path));
  requireNative(run, { command: "apm", args: ["lock"], cwd: apmDirectory }, "apm lock");
  const lock = readFileSync(join(apmDirectory, "apm.lock.yaml"), "utf8");

  const apm = {
    package: lockField(lock, "name"),
    locator,
    ref,
    ...(path === undefined ? {} : { path }),
    resolvedCommit: lockField(lock, "resolved_commit"),
    contentHash: lockField(lock, "content_hash")
  };
  writeFileSync(join(bundleDirectory, "bundle.json"), `${JSON.stringify({
    format: BUNDLE_INPUT_FORMAT,
    artifacts: artifacts.map(artifact => ({
      package: artifact.package,
      version: artifact.version,
      locator: artifact.locator,
      lockFile: `npm/${LOCK_NAME[artifact.package]!}`,
      tarball: `npm/${TARBALL_NAME[artifact.package]!}`,
      requiredPlatformPayload: artifact.requiredPlatformPayload
    })),
    apm: { package: apm.package, skills: [...ARCHIE_SKILLS], locator, ref, ...(path === undefined ? {} : { path }), manifest: "apm/apm.yml", lockFile: "apm/apm.lock.yaml" }
  }, null, 2)}\n`);

  return { bundleDirectory, version, artifacts, apm };
}
