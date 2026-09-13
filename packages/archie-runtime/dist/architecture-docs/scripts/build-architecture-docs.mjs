#!/usr/bin/env node
import { buildArchitectureDocs } from "../src/architecture-docs/index.mjs";

const args = process.argv.slice(2);
function value(flag) { const index = args.indexOf(flag); return index < 0 ? undefined : args[index + 1]; }
const config = value("--config");
const mode = value("--mode");
const handoffOnly = args.includes("--handoff-only");
const knownFlags = new Set(["--config", "--mode", "--handoff-only"]);
const unknownFlags = args.filter((arg) => arg.startsWith("--") && !knownFlags.has(arg));
const unknown = args.filter((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--config" && args[index - 1] !== "--mode");
if (!config || args.filter((arg) => arg === "--config").length !== 1 || unknown.length || unknownFlags.length || (args.includes("--mode") && !mode) || (mode && !["preview", "handoff-only"].includes(mode)) || (handoffOnly && mode === "preview")) {
  process.stderr.write("Usage: node scripts/build-architecture-docs.mjs --config <path> [--handoff-only | --mode preview|handoff-only]\n");
  process.exit(1);
}
try {
  const result = await buildArchitectureDocs(config, { handoffOnly: handoffOnly || mode === "handoff-only" });
  if (result.handoffOnly) console.log(`Updated architecture docs handoff only: ${result.handoffDirectory}`);
  else console.log(`Built architecture docs preview: ${result.pageCount} pages, ${result.compiledViewCount} views at ${result.outputDirectory}`);
  console.log(`Handoff bundle: ${result.handoffDirectory}`);
} catch (error) {
  process.stderr.write(`${error.code ?? "BUILD_FAILED"}: ${error.message}\n`);
  for (const issue of error.issues ?? []) process.stderr.write(`${issue.path}: ${issue.message} Expected: ${issue.expected}\n`);
  process.exitCode = 1;
}
