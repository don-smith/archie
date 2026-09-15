import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const [targetArgument, ...runtimeArgs] = process.argv.slice(2);
const target = resolve(targetArgument ?? process.cwd());
const recordPaths = [join(target, ".archie", "release", "release-record-v2.json"), join(target, ".archie", "release", "release-record-v1.json")];
const runtimePath = join(target, ".archie", "runtime");
const recordPath = recordPaths.find(existsSync);

if (!recordPath || !existsSync(join(runtimePath, "package-lock.json"))) {
  throw new Error("Archie runtime is not pinned and verified in this project; run archie bootstrap or archie verify before dispatching it");
}

let packageName;
try {
  const record = JSON.parse(readFileSync(recordPath, "utf8"));
  packageName = record?.schemaVersion === 2 ? "@archie/runtime" : record?.npm?.package;
} catch {
  throw new Error("Pinned Archie release record is unreadable");
}
if (typeof packageName !== "string" || !/^@[a-z0-9-]+\/[a-z0-9-]+$/.test(packageName)) {
  throw new Error("Pinned Archie release record has no supported runtime package name");
}

const entry = join(runtimePath, "node_modules", ...packageName.split("/"), "dist", "skill-runtime.js");
if (!existsSync(entry)) {
  throw new Error(`Pinned Archie runtime command is unavailable: ${entry}`);
}
const result = spawnSync(process.execPath, [entry, ...runtimeArgs], { cwd: target, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
