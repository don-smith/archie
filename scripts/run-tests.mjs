import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
const walk = (path) => readdirSync(path, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(path, entry.name)) : entry.name.endsWith(".test.mjs") ? [join(path, entry.name)] : []);
const requested = process.argv.slice(2);
const files = (requested.length ? requested : ["test"]).flatMap((path) => walk(path)).sort();
if (!files.length) throw new Error(`No tests found for: ${(requested.length ? requested : ["test"]).join(", ")}`);
const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);
