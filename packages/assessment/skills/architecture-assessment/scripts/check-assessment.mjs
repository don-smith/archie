#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateModel } from "./check-model.mjs";

const requiredMarkdown = [
  "assessment.md",
  "evidence/inventory.md",
  "evidence/flows.md",
  "evidence/evolution.md",
];

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

function allModelIds(model) {
  const ids = new Set();
  for (const collection of ["sources", "inventory", "elements", "relationships", "interfaces", "flows", "data", "terms", "scenarios", "divergences", "claims", "diagrams"]) {
    for (const item of model[collection]) ids.add(item.id);
  }
  return ids;
}

function referencedIds(markdown) {
  return [...markdown.matchAll(/\[model:([a-z0-9-]+)\]/g)].map((match) => match[1]);
}

async function readModel(file) {
  try {
    return { model: JSON.parse(await readFile(file, "utf8")), errors: [] };
  } catch (error) {
    return { model: undefined, errors: [`$: invalid JSON in ${file}; expected a parseable architecture model (${error.message})`] };
  }
}

// Archie deploys html-design as a sibling of this skill, so it is the default.
async function defaultHtmlSkillDir() {
  const sibling = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../html-design");
  return (await exists(path.join(sibling, "scripts", "check-artifact.mjs"))) ? sibling : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const assessmentArgument = args.find((argument, index) => !argument.startsWith("--") && args[index - 1] !== "--html-skill-dir");
  if (!assessmentArgument) throw new Error("Usage: check-assessment.mjs <assessment-dir> [--html-skill-dir <path>]");
  const htmlFlag = args.indexOf("--html-skill-dir");
  const htmlSkillDir = htmlFlag >= 0 ? path.resolve(args[htmlFlag + 1]) : await defaultHtmlSkillDir();
  const directory = path.resolve(assessmentArgument);
  const errors = [];

  const modelPath = path.join(directory, "architecture-model.json");
  if (!(await exists(modelPath))) errors.push(`${modelPath}: missing architecture-model.json`);
  for (const relative of requiredMarkdown) {
    if (!(await exists(path.join(directory, relative)))) errors.push(`${relative}: missing required Markdown evidence`);
  }
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
    return;
  }

  const loaded = await readModel(modelPath);
  errors.push(...loaded.errors);
  const modelErrors = loaded.model ? validateModel(loaded.model) : [];
  errors.push(...modelErrors);
  const model = modelErrors.length ? undefined : loaded.model;
  if (model) {
    const ids = allModelIds(model);
    for (const relative of requiredMarkdown) {
      const markdown = await readFile(path.join(directory, relative), "utf8");
      const references = referencedIds(markdown);
      if (!references.length) errors.push(`${relative}: expected at least one [model:<id>] reference`);
      references.forEach((id) => {
        if (!ids.has(id)) errors.push(`${relative}: invalid model reference ${id}; expected an ID from architecture-model.json`);
      });
      if (relative === "assessment.md") {
        const statuses = [...markdown.matchAll(/^Status:\s*`(in-progress|blocked|ready)`\s*$/gm)].map((match) => match[1]);
        if (statuses.length !== 1) errors.push("assessment.md: expected exactly one Status: `<in-progress|blocked|ready>` declaration");
        else if (statuses[0] !== model.status) errors.push(`assessment.md: status ${statuses[0]} does not agree with $.status ${model.status}`);
      }
    }

    const packet = path.join(directory, "packet.html");
    const packetExists = await exists(packet);
    if (model.status === "ready") {
      if (!packetExists) errors.push("packet.html: a ready bundle requires a self-contained packet");
      if (!htmlSkillDir) errors.push("--html-skill-dir: a ready bundle requires the html-design skill; install it beside this skill or pass --html-skill-dir");
    } else if (!packetExists && !model.blockers.some((blocker) => blocker.kind === "html-unavailable" && blocker.message.trim())) {
      errors.push("$.blockers: a non-ready bundle without packet.html requires an actionable html-unavailable blocker");
    }

    if (packetExists && htmlSkillDir) {
      const checker = path.join(htmlSkillDir, "scripts", "check-artifact.mjs");
      if (!(await exists(checker))) errors.push(`${checker}: missing html-design artifact checker`);
      else {
        const result = spawnSync(process.execPath, [checker, packet, "--profile", "review-packet"], { encoding: "utf8" });
        if (result.status !== 0) errors.push(`packet.html: html-design review-packet check failed\n${result.stderr || result.stdout}`.trim());
      }
    }
  }

  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log(`valid ${model.status} assessment bundle: ${directory}`);
}

if (process.argv[1] && realpathSync(path.resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
