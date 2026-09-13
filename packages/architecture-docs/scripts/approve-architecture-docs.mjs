#!/usr/bin/env node
import path from "node:path";
import { approveArchitectureDocsLedger } from "../src/architecture-docs/approval.mjs";
import { loadArchitectureDocsConfig } from "../src/architecture-docs/config.mjs";

const args = process.argv.slice(2);
function value(flag) { const index = args.indexOf(flag); return index < 0 ? undefined : args[index + 1]; }
if (!value("--config") || !value("--reviewer") || !value("--claims")) {
  process.stderr.write("Usage: node scripts/approve-architecture-docs.mjs --config <path> --reviewer <name> --claims <id,id,...>\n"); process.exit(1);
}
try {
  const config = await loadArchitectureDocsConfig(value("--config"));
  const ledgerPath = config.paths.ledgerPath;
  const pages = [config.pages.home, ...config.pages.areas];
  await approveArchitectureDocsLedger(ledgerPath, { claimIds: value("--claims").split(",").map((id) => id.trim()).filter(Boolean), pages, reviewer: value("--reviewer"), timestamp: value("--timestamp") });
  console.log(`Approved selected claims and the current page map in ${path.relative(process.cwd(), ledgerPath) || ledgerPath}`);
} catch (error) {
  process.stderr.write(`${error.code ?? "APPROVAL_FAILED"}: ${error.message}\n`);
  for (const issue of error.issues ?? []) process.stderr.write(`${issue.path}: ${issue.message} Expected: ${issue.expected}\n`);
  process.exitCode = 1;
}
