import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

const runtime = await import("../dist/packages/archie-runtime/src/index.js");
const capabilities = await import("../dist/packages/capabilities/src/index.js");

const fixture = "test/fixtures/private-bundles/valid";
const provenance = "packages/archie-runtime/vendor/html-design.provenance.json";
const sourceCommit = "abcdef0123456789abcdef0123456789abcdef01";
const output = process.argv[2] === "--output" && process.argv[3] && process.argv.length === 4
  ? process.argv[3]
  : process.argv.length === 2 ? "evaluation/private-trials/latest.json" : undefined;

if (!output) throw new Error("Usage: node scripts/run-private-trial-evaluation.mjs [--output <evidence.json>]");

function temporary(prefix) { return mkdtempSync(join(tmpdir(), prefix)); }
function copyBundle(base, name) {
  const bundle = join(base, name);
  cpSync(fixture, bundle, { recursive: true });
  return bundle;
}
function finalize(bundle) {
  return runtime.finalizeRelease({ bundleDirectory: bundle, sourceCommit, htmlProvenancePath: provenance });
}
function unpackTarball(tarball, destination) {
  const extracted = join(destination, "extracted");
  mkdirSync(extracted, { recursive: true });
  const result = spawnSync("tar", ["-xzf", tarball, "-C", extracted], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`selected npm artifact could not be unpacked: ${result.stderr || result.stdout}`);
  return join(extracted, "package");
}
function selectedApmSkill(skillName) {
  const skill = join("packages", "archie-context", ".apm", "skills", skillName);
  if (!existsSync(skill)) throw new Error(`private APM context is missing its skill: ${skill}`);
  return skill;
}
function nativeRunner(bundle, { install = true, policy = "passed" } = {}) {
  return ({ command, args, cwd }) => {
    if (command === "npm" && install) {
      const record = JSON.parse(readFileSync(join(cwd, "..", "release", "release-record-v1.json"), "utf8"));
      const installed = join(cwd, "node_modules", record.npm.package);
      const extraction = join(cwd, ".selected-artifact-extract");
      rmSync(installed, { recursive: true, force: true });
      rmSync(extraction, { recursive: true, force: true });
      mkdirSync(extraction, { recursive: true });
      mkdirSync(dirname(installed), { recursive: true });
      cpSync(unpackTarball(join(cwd, "npm", record.npm.locator.replace(/^file:npm\//, "")), extraction), installed, { recursive: true });
      rmSync(extraction, { recursive: true, force: true });
    }
    if (command === "apm" && args[0] === "lock") {
      if (!bundle) throw new Error("a selected APM release bundle is required for locking");
      cpSync(join(bundle, "apm", "apm.lock.yaml"), join(cwd, "apm.lock.yaml"));
    }
    if (command === "apm" && args[0] === "install" && install) {
      const record = JSON.parse(readFileSync(join(cwd, ".archie", "release", "release-record-v1.json"), "utf8"));
      for (const skill of record.apm.skills) {
        const deployed = join(cwd, ".agents", "skills", skill);
        rmSync(deployed, { recursive: true, force: true });
        cpSync(selectedApmSkill(skill), deployed, { recursive: true });
      }
    }
    if (command === "apm" && args[0] === "policy") {
      return policy === "not-applied"
        ? { exitCode: 0, stdout: "No policy configured", stderr: "" }
        : { exitCode: 0, stdout: "policy applied", stderr: "" };
    }
    if (command === "apm" && args.join(" ") === "audit --ci" && policy === "blocked") {
      return { exitCode: 2, stdout: "policy audit", stderr: "blocked" };
    }
    return { exitCode: 0, stdout: "ok", stderr: "" };
  };
}
function prepareTarget(base, policy = "passed") {
  const bundle = copyBundle(base, "bundle");
  finalize(bundle);
  const selected = runtime.selectLocalRelease(bundle);
  const target = join(base, "target");
  mkdirSync(target, { recursive: true });
  const result = runtime.bootstrapAndVerifyTarget(target, selected, { run: nativeRunner(bundle, { policy }) });
  return { bundle, selected, target, result };
}
function files(root, current = root) {
  return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const path = join(current, entry.name);
    return entry.isDirectory() ? files(root, path) : [relative(root, path).replaceAll("\\", "/")];
  }).sort();
}
function manifest(root) {
  const trackedFiles = files(root);
  const entries = Object.fromEntries(trackedFiles.map((file) => [file, createHash("sha256").update(readFileSync(join(root, file))).digest("hex")]));
  return { files: entries, digest: createHash("sha256").update(JSON.stringify(entries)).digest("hex") };
}
function artifactProjection(bundle, target, record) {
  const extraction = temporary("archie-selected-npm-artifact-");
  try {
    const artifactPackage = unpackTarball(join(target, ".archie", "runtime", "npm", record.npm.locator.replace(/^file:npm\//, "")), extraction);
    return {
      npm: manifest(join(artifactPackage, "vendor", "html-design")).digest === manifest(join(target, ".archie", "runtime", "node_modules", record.npm.package, "vendor", "html-design")).digest,
      apm: record.apm.skills.every((skill) => manifest(selectedApmSkill(skill)).digest === manifest(join(target, ".agents", "skills", skill)).digest)
    };
  } finally {
    rmSync(extraction, { recursive: true, force: true });
  }
}
function rejectedMutation(name, mutate) {
  const base = temporary(`archie-private-trial-${name}-`);
  try {
    const { selected, target } = prepareTarget(base);
    mutate({ selected, target });
    try {
      runtime.verifyInstalledTarget(target, { run: nativeRunner(undefined, { install: false }) });
      return { rejected: false, error: "verification unexpectedly passed" };
    } catch (error) {
      return { rejected: true, error: error instanceof Error ? error.message : String(error) };
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}
function version(command) {
  const result = spawnSync(command, ["--version"], { encoding: "utf8" });
  return result.status === 0 ? (result.stdout || result.stderr).trim() : "unavailable";
}

const root = temporary("archie-private-trial-");
try {
  const firstBundle = copyBundle(root, "first-bundle");
  const secondBundle = copyBundle(root, "second-bundle");
  const first = finalize(firstBundle);
  const second = finalize(secondBundle);
  const selected = runtime.selectLocalRelease(firstBundle);
  const target = join(root, "target");
  mkdirSync(target);
  const bootstrap = runtime.bootstrapAndVerifyTarget(target, selected, { run: nativeRunner(firstBundle) });
  const selectedArtifacts = artifactProjection(firstBundle, target, selected.record);
  const afterBootstrap = manifest(target);
  const firstVerify = runtime.verifyInstalledTarget(target, { run: nativeRunner(undefined, { install: false }) });
  const afterFirstVerify = manifest(target);
  const secondVerify = runtime.verifyInstalledTarget(target, { run: nativeRunner(undefined, { install: false }) });
  const afterSecondVerify = manifest(target);
  const upgrade = runtime.upgradeAndVerifyTarget(target, selected, { run: nativeRunner(firstBundle) });
  const afterUpgrade = manifest(target);
  const replay = runtime.verifyInstalledTarget(target, { run: nativeRunner(undefined, { install: false }) });
  const afterReplay = manifest(target);

  const mutations = {
    "npm-lock": rejectedMutation("npm-lock", ({ target: mutated }) => writeFileSync(join(mutated, ".archie", "runtime", "package-lock.json"), "{}\n")),
    "npm-integrity": rejectedMutation("npm-integrity", ({ target: mutated }) => {
      const path = join(mutated, ".archie", "runtime", "package-lock.json");
      writeFileSync(path, readFileSync(path, "utf8").replace("sha512-", "sha512-corrupted-"));
    }),
    "npm-locator": rejectedMutation("npm-locator", ({ selected: pin, target: mutated }) => {
      const path = join(mutated, ".archie", "runtime", "package.json");
      writeFileSync(path, readFileSync(path, "utf8").replace(pin.record.npm.locator, "file:npm/replaced-runtime.tgz"));
    }),
    "npm-tarball": rejectedMutation("npm-tarball", ({ selected: pin, target: mutated }) => writeFileSync(join(mutated, ".archie", "runtime", "npm", pin.record.npm.locator.replace(/^file:npm\//, "")), "changed tarball bytes")),
    "apm-locator": rejectedMutation("apm-locator", ({ selected: pin, target: mutated }) => {
      const path = join(mutated, "apm.yml");
      writeFileSync(path, readFileSync(path, "utf8").replace(pin.record.apm.locator, "file:apm/replaced-context"));
    }),
    "apm-ref": rejectedMutation("apm-ref", ({ selected: pin, target: mutated }) => {
      const path = join(mutated, "apm.yml");
      writeFileSync(path, readFileSync(path, "utf8").replace(pin.record.apm.ref, "v-replaced"));
    }),
    "apm-commit": rejectedMutation("apm-commit", ({ selected: pin, target: mutated }) => {
      const path = join(mutated, "apm.lock.yaml");
      writeFileSync(path, readFileSync(path, "utf8").replace(pin.record.apm.resolvedCommit, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"));
    }),
    "apm-content-hash": rejectedMutation("apm-content-hash", ({ selected: pin, target: mutated }) => {
      const path = join(mutated, "apm.lock.yaml");
      writeFileSync(path, readFileSync(path, "utf8").replace(pin.record.apm.contentHash, "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"));
    }),
    "installed-projection": rejectedMutation("installed-projection", ({ selected: pin, target: mutated }) => writeFileSync(join(mutated, ".archie", "runtime", "node_modules", pin.record.npm.package, "package.json"), `${JSON.stringify({ name: pin.record.npm.package, version: "0.0.0" })}\n`)),
    "html-byte": rejectedMutation("html-byte", ({ selected: pin, target: mutated }) => writeFileSync(join(mutated, ".archie", "runtime", "node_modules", pin.record.npm.package, "vendor", "html-design", "SKILL.md"), "changed\n")),
    "shared-manifest": rejectedMutation("shared-manifest", ({ selected: pin, target: mutated }) => {
      const path = join(mutated, "apm.yml");
      writeFileSync(path, readFileSync(path, "utf8").replace(pin.record.apm.ref, "v-replaced"));
    })
  };

  const noPolicyBase = temporary("archie-private-trial-no-policy-");
  const blockedBase = temporary("archie-private-trial-blocked-");
  let noPolicy, blocked;
  try {
    noPolicy = prepareTarget(noPolicyBase, "not-applied").result.report;
    blocked = prepareTarget(blockedBase, "blocked").result.report;
  } finally {
    rmSync(noPolicyBase, { recursive: true, force: true });
    rmSync(blockedBase, { recursive: true, force: true });
  }

  const recoveryBase = temporary("archie-private-trial-recovery-");
  let recovery;
  try {
    const seeded = prepareTarget(recoveryBase);
    try {
      runtime.upgradeAndVerifyTarget(seeded.target, seeded.selected, { run: () => ({ exitCode: 2, stdout: "", stderr: "offline" }) });
      recovery = { compensation: "not-run", rejected: false };
    } catch (error) {
      recovery = { compensation: error?.report?.compensation ?? "blocked", rejected: true };
    }
  } finally {
    rmSync(recoveryBase, { recursive: true, force: true });
  }

  const coordinatedBundle = copyBundle(root, "coordinated-bundle");
  const coordinatedLock = join(coordinatedBundle, "apm", "apm.lock.yaml");
  writeFileSync(coordinatedLock, readFileSync(coordinatedLock, "utf8").replace(/content_hash: .*/, "content_hash: sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"));
  const coordinatedRecord = finalize(coordinatedBundle);
  const coordinatedTarget = join(root, "coordinated-target");
  mkdirSync(coordinatedTarget);
  const coordinated = runtime.bootstrapAndVerifyTarget(coordinatedTarget, runtime.selectLocalRelease(coordinatedBundle), { run: nativeRunner(coordinatedBundle) });

  const textReport = runtime.formatInstallReport(bootstrap.report);
  const evidence = {
    format: "archie-private-trial-evidence-v1",
    authorization: "not-assessed",
    commands: ["archie-release finalize", "archie bootstrap --release <local-directory>", "archie verify", "archie upgrade --release <local-directory>", "apm install --frozen", "npm ci --ignore-scripts"],
    execution: { nativeCommands: "hermetic deterministic evaluator", selectedArtifacts: "npm tarball staged under target-owned runtime state and APM skill from the selected bundle" },
    environment: { node: process.version, platform: process.platform, architecture: process.arch, npm: version("npm"), apm: version("apm"), git: version("git") },
    finalization: { deterministic: readFileSync(first.recordPath, "utf8") === readFileSync(second.recordPath, "utf8"), recordSha256: first.recordSha256 },
    replay: { byteStable: afterBootstrap.digest === afterFirstVerify.digest && afterFirstVerify.digest === afterSecondVerify.digest && afterUpgrade.digest === afterReplay.digest, bootstrap: afterBootstrap, firstVerify: afterFirstVerify, secondVerify: afterSecondVerify, afterUpgrade, afterReplay, report: replay },
    selectedArtifacts,
    mutations,
    policy: { baseline: firstVerify.apm.baseline, noPolicy: noPolicy.apm.policy, blocked: blocked.apm.policy },
    recovery,
    capabilities: { count: capabilities.capabilityContracts.length, authorityStopsPreserved: capabilities.capabilityContracts.every((capability) => typeof capability.authorityStop === "string" && capability.authorityStop.length > 0) },
    coordinatedReplacement: { consistency: coordinated.report.recordConsistency, authorization: coordinated.report.authorization, recordChanged: coordinatedRecord.recordSha256 !== first.recordSha256 },
    textReport
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`Private-trial evidence written to ${output}\n`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
