import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

function assertCleanSourceState() {
  const status = spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { encoding: "utf8" });
  if (status.status !== 0) throw new Error(`cannot inspect RC source state: ${status.stderr.trim()}`);
  if (status.stdout.trim()) {
    throw new Error(`RC evaluation requires a clean Git working tree before packing; commit or remove tracked and non-ignored content:\n${status.stdout.trim()}`);
  }
}

assertCleanSourceState();
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const runtime = await import("../dist/packages/archie-runtime/src/index.js");
const releaseInstall = await import("../dist/packages/archie-runtime/src/release-install/verify.js");
const capabilities = await import("../dist/packages/capabilities/src/index.js");

const fixture = resolve("test/fixtures/private-bundles/valid");
const output = process.argv[2] === "--output" && process.argv[3] && process.argv.length === 4
  ? resolve(process.argv[3])
  : process.argv.length === 2 ? resolve("evaluation/private-trials/latest.json") : undefined;
if (!output) throw new Error("Usage: node scripts/run-private-trial-evaluation.mjs [--output <evidence.json>]");

const sha256 = value => createHash("sha256").update(value).digest("hex");
const sha512 = value => `sha512-${createHash("sha512").update(value).digest("base64")}`;
const temporary = prefix => mkdtempSync(join(tmpdir(), prefix));

function files(root, current = root) {
  if (!existsSync(current)) return [];
  return readdirSync(current, { withFileTypes: true }).flatMap(entry => {
    const path = join(current, entry.name);
    if (entry.isDirectory()) return files(root, path);
    if (!entry.isFile() && !entry.isSymbolicLink()) throw new Error(`unsupported evidence entry: ${path}`);
    return [relative(root, path).replaceAll("\\", "/")];
  }).sort();
}
function fullManifest(root, exclusions = new Set()) {
  const entries = Object.fromEntries(files(root).filter(file => !exclusions.has(file)).map(file => [file, sha256(readFileSync(join(root, file)))]));
  return { files: entries, count: Object.keys(entries).length, digest: sha256(JSON.stringify(entries)) };
}
function summary(manifest) { return { count: manifest.count, digest: manifest.digest }; }
function copyOnWrite(source, destination) {
  mkdirSync(dirname(destination), { recursive: true });
  const result = spawnSync("cp", ["-cR", source, destination], { encoding: "utf8" });
  if (result.status !== 0) cpSync(source, destination, { recursive: true });
}
function version(command) {
  const result = spawnSync(command, ["--version"], { encoding: "utf8" });
  return result.status === 0 ? (result.stdout || result.stderr).trim() : "unavailable";
}
function isolatedOfflineEnvironment(base) {
  const sourceCache = execFileSync("npm", ["config", "get", "cache"], { encoding: "utf8" }).trim();
  const cache = join(base, "npm-cache");
  mkdirSync(cache);
  const content = join(sourceCache, "_cacache");
  if (!existsSync(content)) throw new Error(`npm cache is unavailable for offline RC evaluation: ${content}`);
  copyOnWrite(content, join(cache, "_cacache"));
  return {
    ...process.env,
    npm_config_cache: cache,
    npm_config_offline: "true",
    npm_config_registry: "http://127.0.0.1:9/",
    npm_config_fetch_retries: "0",
    npm_config_audit: "false",
    npm_config_fund: "false"
  };
}
function pack(workspace, destination, filename, env) {
  const output = JSON.parse(execFileSync("npm", ["pack", "--json", "--workspace", workspace, "--pack-destination", destination], { encoding: "utf8", env }));
  const packed = join(destination, output[0].filename);
  const target = join(destination, filename);
  renameSync(packed, target);
  return target;
}
function artifact(tarball, expectedName, locator) {
  const bytes = readFileSync(tarball);
  const packageManifest = runtime.inspectNpmTarball(bytes).manifest;
  if (packageManifest.name !== expectedName) throw new Error(`packed artifact identity differs: ${expectedName}`);
  return {
    packageManifest,
    record: {
      package: expectedName,
      version: packageManifest.version,
      locator,
      lockIntegrity: sha512(bytes),
      tarballSha256: sha256(bytes),
      requiredPlatformPayload: expectedName === "@archie/runtime" ? "dist/architecture-docs/bin/architecture-docs.mjs" : "dist/cli.js",
      dependencies: packageManifest.dependencies ?? {},
      engines: packageManifest.engines ?? {},
      binaries: packageManifest.bin ?? {}
    }
  };
}
function createBundle(base, name, env) {
  const bundle = join(base, name);
  mkdirSync(join(bundle, "npm"), { recursive: true });
  cpSync(join(fixture, "apm"), join(bundle, "apm"), { recursive: true });
  const runtimeTarball = pack("@archie/runtime", join(bundle, "npm"), "archie-runtime.tgz", env);
  const conformanceTarball = pack("@archie/conformance", join(bundle, "npm"), "conformance.tgz", env);
  const runtimeArtifact = artifact(runtimeTarball, "@archie/runtime", "file:npm/archie-runtime.tgz");
  const conformanceArtifact = artifact(conformanceTarball, "@archie/conformance", "file:npm/conformance.tgz");
  if (runtimeArtifact.packageManifest.version !== conformanceArtifact.packageManifest.version) throw new Error("packed artifact versions differ");
  const recordLike = { version: runtimeArtifact.packageManifest.version, artifacts: [runtimeArtifact.record, conformanceArtifact.record] };
  const projection = runtime.npmProjection(recordLike);
  writeFileSync(join(bundle, "npm/archie-runtime.lock.json"), projection.lock);
  writeFileSync(join(bundle, "npm/conformance.lock.json"), projection.lock);
  const apm = JSON.parse(readFileSync(join(fixture, "bundle.json"), "utf8")).apm;
  writeFileSync(join(bundle, "bundle.json"), `${JSON.stringify({
    format: "archie-private-bundle-input-v3",
    artifacts: [
      { package: "@archie/runtime", version: runtimeArtifact.packageManifest.version, locator: runtimeArtifact.record.locator, lockFile: "npm/archie-runtime.lock.json", tarball: "npm/archie-runtime.tgz", requiredPlatformPayload: runtimeArtifact.record.requiredPlatformPayload },
      { package: "@archie/conformance", version: conformanceArtifact.packageManifest.version, locator: conformanceArtifact.record.locator, lockFile: "npm/conformance.lock.json", tarball: "npm/conformance.tgz", requiredPlatformPayload: conformanceArtifact.record.requiredPlatformPayload }
    ],
    apm
  }, null, 2)}\n`);
  const finalized = runtime.finalizeRelease({ bundleDirectory: bundle, sourceCommit });
  return { bundle, finalized, selected: runtime.selectLocalRelease(bundle) };
}
function selectedApmSkill(skillName) {
  const skill = resolve("packages/archie-context/.apm/skills", skillName);
  if (!existsSync(skill)) throw new Error(`private APM context is missing its skill: ${skill}`);
  return skill;
}
function installSkillProjection(cwd, skills) {
  const deployedFiles = [];
  for (const skill of skills) {
    const deployed = join(cwd, ".agents", "skills", skill);
    rmSync(deployed, { recursive: true, force: true });
    cpSync(selectedApmSkill(skill), deployed, { recursive: true });
    deployedFiles.push(...files(deployed).map(file => `.agents/skills/${skill}/${file}`));
  }
  const hashes = deployedFiles.map(file => `    ${file}: sha256:${sha256(readFileSync(join(cwd, file)))}`);
  const lockPath = join(cwd, "apm.lock.yaml");
  const lock = readFileSync(lockPath, "utf8").replace(/^  deployed_file_hashes:\n(?:    .*\n)*  content_hash:/m, "  content_hash:");
  writeFileSync(lockPath, lock.replace("  content_hash:", `  deployed_file_hashes:\n${hashes.join("\n")}\n  content_hash:`));
}
function runner(bundle, env, { policy = "passed", failApmInstall = false } = {}) {
  return ({ command, args, cwd }) => {
    if (command === "npm") {
      const result = spawnSync(command, args, { cwd, encoding: "utf8", env, timeout: 180000 });
      return { exitCode: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
    }
    if (args[0] === "lock") {
      cpSync(join(bundle, "apm", "apm.lock.yaml"), join(cwd, "apm.lock.yaml"));
      return { exitCode: 0, stdout: "local RC lock evidence staged", stderr: "" };
    }
    if (args[0] === "install") {
      if (failApmInstall) return { exitCode: 9, stdout: "", stderr: "injected APM installation failure" };
      const recordPath = join(cwd, ".archie/release", runtime.RELEASE_RECORD_FILE);
      installSkillProjection(cwd, JSON.parse(readFileSync(recordPath, "utf8")).apm.skills);
      return { exitCode: 0, stdout: "local RC skill projection installed", stderr: "" };
    }
    if (args.join(" ") === "audit --ci --no-policy") return { exitCode: 0, stdout: "baseline passed", stderr: "" };
    if (args.join(" ") === "policy status") return policy === "not-applied"
      ? { exitCode: 0, stdout: "No policy configured", stderr: "" }
      : { exitCode: 0, stdout: "policy applied", stderr: "" };
    if (args.join(" ") === "audit --ci") return policy === "blocked"
      ? { exitCode: 2, stdout: "policy audit", stderr: "blocked" }
      : { exitCode: 0, stdout: "policy audit passed", stderr: "" };
    return { exitCode: 0, stdout: "ok", stderr: "" };
  };
}
function targetSummary(target) {
  return summary(fullManifest(target, new Set([".archie/release/install-journal.json"])));
}
function pinnedStateSummary(target) {
  return targetSummary(target);
}
function comparePackageProjection(target, bundle, selected) {
  const details = {};
  for (const artifact of selected.artifacts) {
    const extraction = temporary("archie-rc-package-");
    try {
      execFileSync("tar", ["-xzf", join(bundle, artifact.record.locator.replace(/^file:npm\//, "npm/")), "-C", extraction]);
      const packed = fullManifest(join(extraction, "package"));
      const installed = fullManifest(join(target, ".archie/runtime/node_modules", artifact.record.package));
      details[artifact.record.package] = { exact: packed.digest === installed.digest, packed: summary(packed), installed: summary(installed) };
    } finally { rmSync(extraction, { recursive: true, force: true }); }
  }
  return details;
}
function compareSkillProjection(target, skills) {
  return Object.fromEntries(skills.map(skill => {
    const canonical = fullManifest(selectedApmSkill(skill));
    const deployed = fullManifest(join(target, ".agents/skills", skill));
    return [skill, { exact: canonical.digest === deployed.digest, canonical: summary(canonical), deployed: summary(deployed) }];
  }));
}
function smokeBinaries(target, env) {
  const docs = join(target, ".archie/runtime/node_modules/.bin/architecture-docs");
  const conformance = join(target, ".archie/runtime/node_modules/.bin/architecture-conformance");
  const docsTarget = temporary("archie-rc-docs-");
  try {
    cpSync("packages/architecture-docs/test/fixtures/architecture-docs", docsTarget, { recursive: true });
    const docsResult = spawnSync(docs, ["build", "--config", join(docsTarget, "architecture-docs.config.json")], { cwd: docsTarget, encoding: "utf8", env, timeout: 120000 });
    const conformanceResult = spawnSync(conformance, ["onboard", "setup"], { cwd: target, encoding: "utf8", env, timeout: 120000 });
    if (docsResult.status !== 0) throw new Error(`architecture-docs failed: ${docsResult.stderr || docsResult.stdout}`);
    if (conformanceResult.status !== 0) throw new Error(`architecture-conformance failed: ${conformanceResult.stderr || conformanceResult.stdout}`);
    return { architectureDocs: "passed", architectureConformance: "passed" };
  } finally { rmSync(docsTarget, { recursive: true, force: true }); }
}
function mutationResult(baseTarget, name, mutate) {
  const root = temporary(`archie-rc-mutation-${name}-`);
  const target = join(root, "target");
  try {
    copyOnWrite(baseTarget, target);
    mutate(target);
    try {
      releaseInstall.verifyCurrentInstalledTarget(target);
      return { rejected: false, error: "verification unexpectedly passed" };
    } catch (error) {
      return { rejected: true, error: error instanceof Error ? error.message : String(error) };
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
}
function preparePolicyTarget(base, selected, bundle, env, policy) {
  const target = join(base, `target-${policy}`);
  mkdirSync(target, { recursive: true });
  const installed = runtime.bootstrapAndVerifyTarget(target, selected, { run: runner(bundle, env, { policy }) });
  return installed.report;
}

const root = temporary("archie-private-rc-");
try {
  const env = isolatedOfflineEnvironment(root);
  const first = createBundle(root, "first-bundle", env);
  const second = createBundle(root, "second-bundle", env);
  const firstManifest = fullManifest(first.bundle);
  const secondManifest = fullManifest(second.bundle);
  const deterministic = readFileSync(first.finalized.recordPath, "utf8") === readFileSync(second.finalized.recordPath, "utf8")
    && firstManifest.digest === secondManifest.digest;
  if (!deterministic) throw new Error("two clean finalizations produced different records or artifact manifests");

  const target = join(root, "target");
  mkdirSync(target);
  const native = runner(first.bundle, env);
  const bootstrap = runtime.bootstrapAndVerifyTarget(target, first.selected, { run: native });
  const afterBootstrap = targetSummary(target);
  const firstVerify = runtime.verifyInstalledTarget(target, { run: native });
  const afterFirstVerify = targetSummary(target);
  const secondVerify = runtime.verifyInstalledTarget(target, { run: native });
  const afterSecondVerify = targetSummary(target);
  const sameVersion = runtime.upgradeAndVerifyTarget(target, first.selected, { run: native });
  const afterSameVersion = targetSummary(target);
  const replay = runtime.verifyInstalledTarget(target, { run: native });
  const afterReplay = targetSummary(target);
  const packageProjection = comparePackageProjection(target, first.bundle, first.selected);
  const skillProjection = compareSkillProjection(target, first.selected.record.apm.skills);
  if (!Object.values(packageProjection).every(entry => entry.exact) || !Object.values(skillProjection).every(entry => entry.exact)) throw new Error("installed RC bytes differ from selected artifacts");
  const binaries = smokeBinaries(target, env);

  const legacyTarget = join(root, "legacy-target");
  mkdirSync(join(legacyTarget, ".archie/release"), { recursive: true });
  writeFileSync(join(legacyTarget, ".archie/release/release-record-v2.json"), "{}\n");
  let legacyPin;
  try {
    runtime.bootstrapAndVerifyTarget(legacyTarget, first.selected, { run: native });
    legacyPin = { rejected: false, error: "bootstrap unexpectedly accepted a pre-v3 pin" };
  } catch (error) {
    legacyPin = { rejected: /pre-v3 Archie release pin/.test(error?.cause?.message ?? error?.message ?? ""), error: error?.cause?.message ?? error?.message };
  }
  if (!legacyPin.rejected) throw new Error("a pre-v3 target pin was not refused");

  const recoveryTarget = join(root, "recovery-target");
  mkdirSync(recoveryTarget);
  runtime.bootstrapAndVerifyTarget(recoveryTarget, first.selected, { run: native });
  const beforeRecovery = pinnedStateSummary(recoveryTarget);
  let recovery;
  try {
    runtime.upgradeAndVerifyTarget(recoveryTarget, first.selected, { run: runner(first.bundle, env, { failApmInstall: true }) });
    recovery = { rejected: false, compensation: "not-run", restored: false };
  } catch (error) {
    const afterRecovery = pinnedStateSummary(recoveryTarget);
    recovery = { rejected: true, compensation: error?.report?.compensation ?? "blocked", restored: beforeRecovery.digest === afterRecovery.digest, before: beforeRecovery, after: afterRecovery };
  }
  if (recovery.compensation !== "passed" || !recovery.restored) throw new Error("a failed upgrade did not restore its verified installed state");

  const mutations = {
    "runtime-tarball": mutationResult(target, "runtime-tarball", mutated => writeFileSync(join(mutated, ".archie/runtime/npm/archie-runtime.tgz"), "changed")),
    "conformance-tarball": mutationResult(target, "conformance-tarball", mutated => writeFileSync(join(mutated, ".archie/runtime/npm/conformance.tgz"), "changed")),
    "npm-lock": mutationResult(target, "npm-lock", mutated => writeFileSync(join(mutated, ".archie/runtime/package-lock.json"), "{}\n")),
    "installed-runtime": mutationResult(target, "installed-runtime", mutated => writeFileSync(join(mutated, ".archie/runtime/node_modules/@archie/runtime/package.json"), "{}\n")),
    "installed-conformance": mutationResult(target, "installed-conformance", mutated => writeFileSync(join(mutated, ".archie/runtime/node_modules/@archie/conformance/package.json"), "{}\n")),
    "deployed-html-design": mutationResult(target, "deployed-html-design", mutated => writeFileSync(join(mutated, ".agents/skills/html-design/scripts/check-artifact.mjs"), "changed\n")),
    "deployed-architecture-review": mutationResult(target, "deployed-architecture-review", mutated => writeFileSync(join(mutated, ".agents/skills/architecture-review/SKILL.md"), "changed\n")),
    "apm-lock": mutationResult(target, "apm-lock", mutated => writeFileSync(join(mutated, "apm.lock.yaml"), readFileSync(join(mutated, "apm.lock.yaml"), "utf8").replace(first.selected.record.apm.contentHash, "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"))),
    "deployed-skill": mutationResult(target, "deployed-skill", mutated => writeFileSync(join(mutated, ".agents/skills/archie/SKILL.md"), "changed\n"))
  };
  if (!Object.values(mutations).every(result => result.rejected)) throw new Error("an RC mutation unexpectedly passed verification");

  const policyRoot = join(root, "policy");
  mkdirSync(policyRoot);
  const policy = {
    passed: preparePolicyTarget(policyRoot, first.selected, first.bundle, env, "passed").apm.policy,
    noPolicy: preparePolicyTarget(policyRoot, first.selected, first.bundle, env, "not-applied").apm.policy,
    blocked: preparePolicyTarget(policyRoot, first.selected, first.bundle, env, "blocked").apm.policy
  };

  const record = first.selected.record;
  const targetLock = readFileSync(join(target, ".archie/runtime/package-lock.json"), "utf8");
  const exactLock = targetLock === first.selected.npmLockBytes;
  const stagedArtifacts = Object.fromEntries(record.artifacts.map(item => [item.package, {
    locator: item.locator,
    sha256: sha256(readFileSync(join(target, ".archie/runtime", item.locator.replace(/^file:/, "")))),
    recordedSha256: item.tarballSha256
  }]));
  if (!exactLock || !Object.values(stagedArtifacts).every(item => item.sha256 === item.recordedSha256)) throw new Error("staged npm evidence differs from the finalized RC");

  const evidence = {
    format: "archie-private-trial-evidence-v3",
    candidate: { status: "local-only", version: record.version, sourceCommit: record.sourceCommit, schemaVersion: record.schemaVersion, authorization: "not-assessed" },
    environment: { node: process.version, platform: process.platform, architecture: process.arch, npm: version("npm"), apm: version("apm"), git: version("git") },
    finalization: { deterministic, recordSha256: first.finalized.recordSha256, artifactManifest: summary(firstManifest), repeatedArtifactManifest: summary(secondManifest), orderedArtifacts: record.artifacts.map(item => item.package) },
    installation: { bootstrap: bootstrap.report, firstVerify, secondVerify, sameVersionReplay: sameVersion.report, replay, byteStable: [afterFirstVerify, afterSecondVerify, afterSameVersion, afterReplay].every(item => item.digest === afterBootstrap.digest), manifests: { bootstrap: afterBootstrap, firstVerify: afterFirstVerify, secondVerify: afterSecondVerify, sameVersion: afterSameVersion, replay: afterReplay } },
    legacyPin,
    recovery,
    integrity: { exactNpmLock: exactLock, stagedArtifacts, packages: packageProjection, skills: skillProjection, skillCount: Object.keys(skillProjection).length, binaries, architectureDocsEmbedded: packageProjection["@archie/runtime"].exact },
    mutations,
    policy,
    capabilities: { count: capabilities.capabilityContracts.length, authorityStopsPreserved: capabilities.capabilityContracts.every(capability => typeof capability.authorityStop === "string" && capability.authorityStop.length > 0) },
    externalGates: { githubSshPreflight: "not-run-without-developer-approval", immutableContextRef: "not-created", push: "not-authorized", tag: "not-authorized", note: "The local RC uses retained deterministic APM fixture identity while deploying and byte-checking the current eight-skill context. A real immutable private ref and native APM lock remain manual gates." },
    textReport: runtime.formatInstallReport(replay)
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`Private-trial evidence written to ${output}\n`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
