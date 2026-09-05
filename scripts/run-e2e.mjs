import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
const requested = process.argv.slice(2);
const roots = requested.length === 0 ? ["test/e2e"] : requested.map((name) => existsSync(name) ? name : `test/e2e/${name}`);
const result = spawnSync(process.execPath, ["scripts/run-tests.mjs", ...roots], { stdio: "inherit" });
process.exit(result.status ?? 1);
