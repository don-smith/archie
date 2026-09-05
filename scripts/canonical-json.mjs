import { readFileSync } from "node:fs";

function render(value) {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    if (typeof value === "number" && !Number.isFinite(value)) throw new TypeError("canonical JSON requires finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(render).join(",")}]`;
  if (typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${render(value[key])}`).join(",")}}`;
  throw new TypeError(`canonical JSON does not allow ${typeof value}`);
}

const [input] = process.argv.slice(2);
if (!input) throw new Error("Usage: node scripts/canonical-json.mjs <json-file>");
process.stdout.write(`${render(JSON.parse(readFileSync(input, "utf8")))}\n`);
