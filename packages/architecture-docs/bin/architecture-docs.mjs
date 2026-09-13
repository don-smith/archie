#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadArchitectureDocsConfig } from "../src/architecture-docs/config.mjs";
import { formatArgv, runSkillCommand } from "../src/architecture-docs/skill-command.mjs";

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const commandScripts = {
  build: "build-architecture-docs.mjs",
  check: "check-architecture-docs.mjs",
  approve: "approve-architecture-docs.mjs",
  "check:html": "check-html.mjs",
  "check:browser": "check-site-browser.mjs",
  "check:site": "check-site.mjs",
  "check:site:browser": "check-final-site-browser.mjs",
};

const [command, ...args] = process.argv.slice(2);
if (!command || command === "--help" || command === "-h") {
  console.log(`Usage: architecture-docs <command> [options]

Commands:
  build          Build the disposable preview and html-design handoff bundle
                   Use --handoff-only to update only the handoff; site/ is never owned
  check          Run preview or publication checks
  approve        Record explicit maintainer approval
  check:html     Check generated HTML
  check:browser  Run browser checks against the generated preview
  check:site     Check the independently composed final-site contract
  check:site:browser
                 Run browser checks against every final-site route
  skill:run      Run a reviewed config skillCommand override`);
  process.exit(command ? 0 : 1);
}

function configArgument(commandArgs) {
  const indexes = commandArgs.map((arg, index) => arg === "--config" ? index : -1).filter((index) => index >= 0);
  if (indexes.length !== 1 || !commandArgs[indexes[0] + 1]) return null;
  return commandArgs[indexes[0] + 1];
}

async function runConfiguredSkill(commandArgs) {
  const [subcommand, ...normalArgs] = commandArgs;
  const configPath = configArgument(normalArgs);
  if (!subcommand || subcommand.startsWith("-") || !commandScripts[subcommand] || !configPath) {
    console.error("Usage: architecture-docs skill:run <build|check|approve|check:html|check:browser|check:site|check:site:browser> --config <path> [normal command options]");
    return 1;
  }
  let config;
  try {
    config = await loadArchitectureDocsConfig(configPath);
  } catch (error) {
    console.error(`${error.code ?? "CONFIGURATION_INVALID"}: ${error.message}`);
    for (const issue of error.issues ?? []) console.error(`${issue.path}: ${issue.message} Expected: ${issue.expected}`);
    return 1;
  }
  if (!config.skillCommand) {
    console.error(`No skillCommand override is configured for target root ${process.cwd()}. Use the command from the target's pinned .archie/runtime/node_modules/.bin/architecture-docs: ${subcommand}.`);
    return 1;
  }
  const [executable, ...prefixArgs] = config.skillCommand;
  const argv = [...prefixArgs, subcommand, ...normalArgs];
  console.log(`architecture-docs skill runner selected override command for ${process.cwd()}: ${formatArgv([executable, ...argv])}`);
  const result = await runSkillCommand({ command: executable, args: argv, cwd: process.cwd() });
  if (result.error) {
    console.error(`Could not run the configured architecture-docs command from target root ${process.cwd()}: ${result.error.message}`);
    return 1;
  }
  if (result.signal) {
    console.error(`Configured architecture-docs command stopped by ${result.signal} in target root ${process.cwd()}.`);
    return 1;
  }
  if (result.code !== 0) console.error(`Configured architecture-docs command exited with status ${result.code} in target root ${process.cwd()}.`);
  return result.code ?? 1;
}

if (command === "skill:run") {
  process.exitCode = await runConfiguredSkill(args);
} else {
  const script = commandScripts[command];
  if (!script) {
    console.error(`Unknown architecture-docs command: ${command}`);
    console.error("Run `architecture-docs --help` for available commands.");
    process.exit(1);
  }

  const child = spawn(process.execPath, [path.join(packageDirectory, "scripts", script), ...args], {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  child.on("error", (error) => {
    console.error(`Could not run architecture-docs ${command}: ${error.message}`);
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      console.error(`architecture-docs ${command} stopped by ${signal}`);
      process.exitCode = 1;
    } else {
      process.exitCode = code ?? 1;
    }
  });
}
