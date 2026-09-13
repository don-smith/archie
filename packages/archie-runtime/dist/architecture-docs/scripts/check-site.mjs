#!/usr/bin/env node
import { checkFinalSite, formatFinalSiteReport } from "../src/architecture-docs/site-checker.mjs";

const args = process.argv.slice(2);
const index = args.indexOf("--config");
const configPath = index >= 0 ? args[index + 1] : undefined;
if (!configPath) {
  process.stderr.write("Usage: node scripts/check-site.mjs --config <path>\n");
  process.exit(1);
}

try {
  const report = await checkFinalSite(configPath);
  console.log(formatFinalSiteReport(report));
  if (!report.ok) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`${error.code ?? "CHECK_FAILED"}: ${error.message}\n`);
  for (const issue of error.issues ?? []) process.stderr.write(`${issue.path}: ${issue.message} Expected: ${issue.expected}\n`);
  process.exitCode = 1;
}
