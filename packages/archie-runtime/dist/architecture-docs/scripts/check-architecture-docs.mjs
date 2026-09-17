#!/usr/bin/env node
import { checkArchitectureDocs } from "../src/architecture-docs/checker.mjs";

const args = process.argv.slice(2);
const configIndex = args.indexOf("--config");
const modeIndex = args.indexOf("--mode");
const config = configIndex >= 0 ? args[configIndex + 1] : undefined;
const mode = modeIndex >= 0 ? args[modeIndex + 1] : "publication";
if (!config) { process.stderr.write("Usage: node scripts/check-architecture-docs.mjs --config <path> [--mode preview|publication]\n"); process.exit(1); }
try {
  const report = await checkArchitectureDocs(config, { mode });
  for (const entry of report.warnings) process.stderr.write(`warning ${entry.code}: ${entry.path}: ${entry.message} Expected: ${entry.expected}\n`);
  if (report.diagnostics.length > 0) {
    for (const entry of report.diagnostics) process.stderr.write(`${entry.path}: ${entry.message} Expected: ${entry.expected}\n`);
    process.exitCode = 1;
  } else console.log(`Architecture docs ${mode} checks passed (${report.provisionalClaimCount} provisional claims).`);
} catch (error) {
  process.stderr.write(`${error.code ?? "CHECK_FAILED"}: ${error.message}\n`);
  for (const issue of error.issues ?? []) process.stderr.write(`${issue.path}: ${issue.message} Expected: ${issue.expected}\n`);
  process.exitCode = 1;
}
