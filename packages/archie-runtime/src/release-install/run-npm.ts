import { existsSync, readFileSync, lstatSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import type { PinnedTarget } from "./target-state.js";
import { canonicalize } from "../analysis/canonical-json.js";
import type { ReleaseArtifactV2 } from "../release-record/release-record-v2.js";

export interface NativeCommand { command: "npm" | "apm"; args: string[]; cwd: string; }
export interface NativeCommandResult { exitCode: number; stdout: string; stderr: string; }
export type NativeCommandRunner = (command: NativeCommand) => NativeCommandResult;

export const nativeRun: NativeCommandRunner = ({ command, args, cwd }) => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  return { exitCode: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};
export function requireNative(run: NativeCommandRunner, command: NativeCommand, label: string): NativeCommandResult {
  const result = run(command);
  if (result.exitCode !== 0) throw new Error(`${label} failed (${result.exitCode}): ${result.stderr || result.stdout || "no output"}`);
  return result;
}
/** npm owns lock and integrity validation; Archie checks the installed package identity afterward. */
export function assertInstalledNpm(pin: PinnedTarget): void {
  const runtime = join(pin.targetDirectory, ".archie", "runtime");
  const artifacts = pin.record.schemaVersion === 2 ? pin.record.artifacts : [{ package: pin.record.npm.package, version: pin.record.npm.version, binaries: { "architecture-docs": "" } }];
  for (const artifact of artifacts) {
    const packagePath = join(runtime, "node_modules", artifact.package, "package.json");
    if (!existsSync(packagePath)) throw new Error(`installed npm package is missing: ${artifact.package}`);
    let manifest: { name?: unknown; version?: unknown };
    try { manifest = JSON.parse(readFileSync(packagePath, "utf8")); } catch { throw new Error(`installed npm package manifest is invalid JSON: ${artifact.package}`); }
    if (manifest.name !== artifact.package || manifest.version !== artifact.version) throw new Error(`installed npm package differs from the pinned record: ${artifact.package}`);
    if (pin.record.schemaVersion === 2) {
      const fullManifest = JSON.parse(readFileSync(packagePath, "utf8")) as Record<string, unknown>;
      const v2Artifact = artifact as ReleaseArtifactV2;
      if (canonicalize(fullManifest.dependencies ?? {}) !== canonicalize(v2Artifact.dependencies) || canonicalize(fullManifest.engines ?? {}) !== canonicalize(v2Artifact.engines) || canonicalize(fullManifest.bin ?? {}) !== canonicalize(v2Artifact.binaries)) throw new Error(`installed npm package metadata differs from the pinned record: ${artifact.package}`);
      for (const binary of Object.keys(v2Artifact.binaries)) {
      const link = join(runtime, "node_modules", ".bin", binary);
        if (!existsSync(link) || !lstatSync(link).isSymbolicLink()) throw new Error(`installed npm binary link is missing: ${binary}`);
        const packageRoot = realpathSync(join(runtime, "node_modules", artifact.package));
        if (!realpathSync(link).startsWith(`${packageRoot}/`)) throw new Error(`installed npm binary link targets an unexpected package: ${binary}`);
      }
    }
  }
}

export function runNpmCi(pin: PinnedTarget, run: NativeCommandRunner): void {
  const runtime = join(pin.targetDirectory, ".archie", "runtime");
  const args = pin.record.schemaVersion === 2 ? ["ci", "--ignore-scripts", "--offline"] : ["ci", "--ignore-scripts"];
  requireNative(run, { command: "npm", args, cwd: runtime }, args.join(" "));
  assertInstalledNpm(pin);
}
