import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { inspectNpmTarball, normalizeNpmBinaryPath, parseReleaseRecord, RELEASE_RECORD_FILE } from "@archie/runtime";

function packageJson(path: string): Record<string, unknown> { return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>; }
function record(value: unknown): Record<string, unknown> | undefined { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }

/** Verifies the runtime supported by the Archie-provisioned package. */
export function verifyOnboardingRuntime(nodeVersion = process.versions.node): void {
  if (!/^24\.\d+\.\d+$/.test(nodeVersion)) throw new Error("architecture-conformance requires Node >=24 <25; switch to the Node 24 runtime required by the pinned Archie release");
}

/** Rejects ambient executables: onboarding may run only Archie's target-owned npm projection. */
export function verifyLocalOnboardingSetup(repositoryRoot = process.cwd()): void {
  verifyOnboardingRuntime();
  const runtimeRoot = resolve(repositoryRoot, ".archie/runtime");
  const runtimeManifestPath = resolve(runtimeRoot, "package.json");
  const lockfilePath = resolve(runtimeRoot, "package-lock.json");
  const executable = resolve(runtimeRoot, "node_modules/.bin/architecture-conformance");
  const installedManifestPath = resolve(runtimeRoot, "node_modules/@archie/conformance/package.json");
  if (![runtimeManifestPath, lockfilePath, executable, installedManifestPath].every(existsSync)) {
    throw new Error("project-local architecture-conformance setup is missing; bootstrap or repair the pinned Archie release before onboarding");
  }
  const runtime = packageJson(runtimeManifestPath);
  const dependencies = record(runtime.dependencies);
  const locator = dependencies?.["@archie/conformance"];
  if (typeof locator !== "string" || !/^file:npm\/[^/]+\.tgz$/.test(locator)) throw new Error("Archie runtime must pin @archie/conformance to a target-owned local tarball");
  const tarballPath = resolve(runtimeRoot, locator.slice("file:".length));
  if (relative(runtimeRoot, tarballPath).startsWith("..") || !existsSync(tarballPath)) {
    throw new Error("Archie runtime @archie/conformance tarball is missing or outside the target-owned runtime");
  }
  const tarballStatus = lstatSync(tarballPath);
  const realRuntimeRoot = realpathSync(runtimeRoot), realTarballPath = realpathSync(tarballPath);
  if (tarballStatus.isSymbolicLink() || !tarballStatus.isFile() || relative(realRuntimeRoot, realTarballPath).startsWith("..")) {
    throw new Error("Archie runtime @archie/conformance tarball must be a target-owned regular file");
  }
  const tarball = readFileSync(realTarballPath), inspectedTarball = inspectNpmTarball(tarball), archiveManifest = inspectedTarball.manifest;
  const archiveBin = record(archiveManifest.bin), archiveBinary = archiveBin?.["architecture-conformance"];
  const installed = packageJson(installedManifestPath), installedBin = record(installed.bin), installedBinary = installedBin?.["architecture-conformance"];
  if (installed.name !== "@archie/conformance" || typeof installed.version !== "string" || typeof installedBinary !== "string") {
    throw new Error("installed @archie/conformance package identity or binary contract is invalid");
  }
  if (archiveManifest.name !== "@archie/conformance" || archiveManifest.version !== installed.version || typeof archiveBinary !== "string" || normalizeNpmBinaryPath(archiveBinary) !== normalizeNpmBinaryPath(installedBinary)) {
    throw new Error("target-owned tarball package identity or binary contract differs from installed @archie/conformance");
  }
  if (!inspectedTarball.files.has(`package/${normalizeNpmBinaryPath(archiveBinary)}`)) throw new Error("target-owned tarball omits its declared architecture-conformance binary");
  const lockfile = packageJson(lockfilePath); const packages = record(lockfile.packages); const lockedRoot = record(packages?.[""]); const lockedDependencies = record(lockedRoot?.dependencies); const lockedPackage = record(packages?.["node_modules/@archie/conformance"]); const lockedBin = record(lockedPackage?.bin);
  const tarballIntegrity = `sha512-${createHash("sha512").update(tarball).digest("base64")}`;
  if (lockfile.lockfileVersion !== 3 || lockedDependencies?.["@archie/conformance"] !== locator || lockedPackage?.version !== installed.version || lockedPackage?.resolved !== locator || lockedPackage?.integrity !== tarballIntegrity || normalizeNpmBinaryPath(lockedBin?.["architecture-conformance"]) !== normalizeNpmBinaryPath(installedBinary)) {
    throw new Error("Archie runtime lock or tarball differs from the installed @archie/conformance package");
  }
  const releaseRecordPath = resolve(repositoryRoot, ".archie/release", RELEASE_RECORD_FILE);
  if (existsSync(releaseRecordPath)) {
    const release = parseReleaseRecord(readFileSync(releaseRecordPath, "utf8"));
    const artifact = release.artifacts.find((candidate) => candidate.package === "@archie/conformance");
    const tarballSha256 = createHash("sha256").update(tarball).digest("hex");
    if (!artifact || artifact.locator !== locator || artifact.version !== installed.version || artifact.lockIntegrity !== tarballIntegrity || artifact.tarballSha256 !== tarballSha256 || normalizeNpmBinaryPath(artifact.binaries["architecture-conformance"]) !== normalizeNpmBinaryPath(installedBinary) || normalizeNpmBinaryPath(artifact.binaries["architecture-conformance"]) !== normalizeNpmBinaryPath(archiveBinary)) {
      throw new Error("Archie runtime @archie/conformance installation differs from its release record evidence");
    }
  }
  const resolvedExecutable = realpathSync(executable);
  const installedPackageRoot = realpathSync(resolve(runtimeRoot, "node_modules/@archie/conformance"));
  if (relative(installedPackageRoot, resolvedExecutable).startsWith("..")) {
    throw new Error("project-local architecture-conformance binary does not resolve into the pinned @archie/conformance package");
  }
  if (realpathSync(resolve(dirname(installedManifestPath), installedBinary)) !== resolvedExecutable) throw new Error("project-local architecture-conformance binary differs from the installed package manifest");
}
