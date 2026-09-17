import { existsSync, readFileSync, lstatSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { canonicalize } from "../analysis/canonical-json.js";
export const nativeRun = ({ command, args, cwd }) => {
    const result = spawnSync(command, args, { cwd, encoding: "utf8" });
    return { exitCode: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};
export function requireNative(run, command, label) {
    const result = run(command);
    if (result.exitCode !== 0)
        throw new Error(`${label} failed (${result.exitCode}): ${result.stderr || result.stdout || "no output"}`);
    return result;
}
/** npm owns lock and integrity validation; Archie checks the installed package identity afterward. */
export function assertInstalledNpm(pin) {
    const runtime = join(pin.targetDirectory, ".archie", "runtime");
    for (const artifact of pin.record.artifacts) {
        const packagePath = join(runtime, "node_modules", artifact.package, "package.json");
        if (!existsSync(packagePath))
            throw new Error(`installed npm package is missing: ${artifact.package}`);
        let manifest;
        try {
            manifest = JSON.parse(readFileSync(packagePath, "utf8"));
        }
        catch {
            throw new Error(`installed npm package manifest is invalid JSON: ${artifact.package}`);
        }
        if (manifest.name !== artifact.package || manifest.version !== artifact.version)
            throw new Error(`installed npm package differs from the pinned record: ${artifact.package}`);
        const fullManifest = manifest;
        if (canonicalize(fullManifest.dependencies ?? {}) !== canonicalize(artifact.dependencies) || canonicalize(fullManifest.engines ?? {}) !== canonicalize(artifact.engines) || canonicalize(fullManifest.bin ?? {}) !== canonicalize(artifact.binaries))
            throw new Error(`installed npm package metadata differs from the pinned record: ${artifact.package}`);
        for (const binary of Object.keys(artifact.binaries)) {
            const link = join(runtime, "node_modules", ".bin", binary);
            if (!existsSync(link) || !lstatSync(link).isSymbolicLink())
                throw new Error(`installed npm binary link is missing: ${binary}`);
            const packageRoot = realpathSync(join(runtime, "node_modules", artifact.package));
            if (!realpathSync(link).startsWith(`${packageRoot}/`))
                throw new Error(`installed npm binary link targets an unexpected package: ${binary}`);
        }
    }
}
export function runNpmCi(pin, run) {
    const runtime = join(pin.targetDirectory, ".archie", "runtime");
    const args = ["ci", "--ignore-scripts", "--offline"];
    requireNative(run, { command: "npm", args, cwd: runtime }, args.join(" "));
    assertInstalledNpm(pin);
}
//# sourceMappingURL=run-npm.js.map