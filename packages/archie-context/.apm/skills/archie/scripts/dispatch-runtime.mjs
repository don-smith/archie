import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const [targetArgument, ...runtimeArgs] = process.argv.slice(2);
const target = resolve(targetArgument ?? process.cwd());
const recordPath = join(target, ".archie", "release", "release-record-v3.json");
const runtimePath = join(target, ".archie", "runtime");

if (!existsSync(recordPath) || !existsSync(join(runtimePath, "package-lock.json"))) {
  throw new Error("Archie runtime is not pinned and verified in this project; run archie bootstrap or archie verify before dispatching it");
}

let packageName;
try {
  const record = JSON.parse(readFileSync(recordPath, "utf8"));
  packageName = record?.schemaVersion === 3 ? record.artifacts?.[0]?.package : undefined;
} catch {
  throw new Error("Pinned Archie release record is unreadable");
}
if (typeof packageName !== "string" || !/^@[a-z0-9-]+\/[a-z0-9-]+$/.test(packageName)) {
  throw new Error("Pinned Archie release record has no supported runtime package name");
}

const entry = join(runtimePath, "node_modules", ...packageName.split("/"), "dist", "skill-runtime.js");

/**
 * A pinned project whose node_modules is missing is hydrated, not uninstalled: a fresh branch or
 * worktree carries the pin and the tarballs but never the installed tree. Hydration is attempted
 * offline first, which succeeds in seconds when this machine's npm cache is already warm and fails
 * immediately when it is not. That keeps a multi-minute cold download out of an agent's turn, where
 * it looks like a hang, and hands it to the developer as one command instead.
 */
if (!existsSync(entry)) {
  if (!existsSync(join(runtimePath, "npm"))) {
    throw new Error(`Pinned Archie runtime command is unavailable: ${entry}`);
  }
  process.stderr.write("Archie is pinned here but its runtime is not installed in this working tree; hydrating from the local npm cache.\n");
  const hydrate = spawnSync("npm", ["ci", "--ignore-scripts", "--offline", "--no-audit", "--fund=false"], { cwd: runtimePath, stdio: "inherit" });
  if (hydrate.status !== 0 || !existsSync(entry)) {
    throw new Error([
      "Archie is pinned in this project but its runtime is not installed here, and this machine's npm cache cannot supply it offline.",
      "Run this once, then try again:",
      `  (cd ${runtimePath} && npm ci --ignore-scripts && npx playwright install chromium)`,
      "It downloads the runtime's dependencies and, on a cold machine, the Playwright browser (~150MB, stored once per machine)."
    ].join("\n"));
  }
}
const result = spawnSync(process.execPath, [entry, ...runtimeArgs], { cwd: target, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
