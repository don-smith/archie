import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
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
    const packagePath = join(pin.targetDirectory, ".archie", "runtime", "node_modules", pin.record.npm.package, "package.json");
    if (!existsSync(packagePath))
        throw new Error("installed npm package is missing");
    let manifest;
    try {
        manifest = JSON.parse(readFileSync(packagePath, "utf8"));
    }
    catch {
        throw new Error("installed npm package manifest is invalid JSON");
    }
    if (manifest.name !== pin.record.npm.package || manifest.version !== pin.record.npm.version)
        throw new Error("installed npm package differs from the pinned record");
}
export function runNpmCi(pin, run) {
    const runtime = join(pin.targetDirectory, ".archie", "runtime");
    requireNative(run, { command: "npm", args: ["ci", "--ignore-scripts"], cwd: runtime }, "npm ci --ignore-scripts");
    assertInstalledNpm(pin);
}
//# sourceMappingURL=run-npm.js.map