#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const defaults = [
  "packages/assessment/migration-inventory.json",
  "packages/conformance/migration-inventory.json",
];
const inventories = process.argv.slice(2).length ? process.argv.slice(2) : defaults;
const dispositions = new Set(["included", "excluded", "adapted", "generated"]);
const kinds = new Set(["production", "test", "test-fixture", "skill-test", "evaluation-fixture", "evaluation-prompt", "evaluation-command", "evaluation-format", "format", "command", "skill", "package", "documentation", "repository-metadata"]);

function git(repository, args) {
  const result = spawnSync("git", ["-C", repository, ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

function pinnedTree(repository, revision) {
  const output = git(repository, ["ls-tree", "-r", revision]);
  return new Map(output.split("\n").filter(Boolean).map((line) => {
    const match = line.match(/^\d+ blob ([0-9a-f]+)\t(.+)$/);
    if (!match) throw new Error(`unexpected ls-tree row: ${line}`);
    return [match[2], match[1]];
  }));
}

async function checkInventory(inventoryPath) {
  const inventory = JSON.parse(await readFile(path.resolve(root, inventoryPath), "utf8"));
  const id = inventory.id;
  if (typeof id !== "string" || !id) throw new Error(`${inventoryPath}: inventory id is required`);
  if (inventory.format !== "archie-migration-inventory/v1") throw new Error(`${id}: unsupported inventory format`);
  const { repository, revision } = inventory.source ?? {};
  if (!path.isAbsolute(repository ?? "") || !/^[0-9a-f]{40}$/.test(revision ?? "")) throw new Error(`${id}: source must name an absolute repository and full revision`);
  const head = git(repository, ["rev-parse", "HEAD"]);
  if (head !== revision) throw new Error(`${id}: source HEAD ${head} does not equal pinned revision ${revision}`);

  const upstream = pinnedTree(repository, revision);
  const mapped = new Map();
  for (const [index, entry] of (inventory.entries ?? []).entries()) {
    const label = `${id}: entries[${index}]`;
    if (!entry.path || mapped.has(entry.path)) throw new Error(`${label}: path is missing or duplicated`);
    if (!dispositions.has(entry.disposition)) throw new Error(`${label}: invalid disposition ${entry.disposition}`);
    if (!kinds.has(entry.kind)) throw new Error(`${label}: invalid kind ${entry.kind}`);
    if (!entry.reason?.trim()) throw new Error(`${label}: reason is required`);
    if (entry.disposition === "excluded" && entry.destination) throw new Error(`${label}: excluded paths cannot have destinations`);
    if (entry.disposition !== "excluded" && !entry.destination?.trim()) throw new Error(`${label}: ${entry.disposition} paths require destinations`);
    if (upstream.get(entry.path) !== entry.blob) throw new Error(`${label}: blob does not match pinned source`);
    if (entry.fixture) {
      const fixturePath = path.join(root, entry.fixture);
      const fixtureBlob = spawnSync("git", ["hash-object", fixturePath], { encoding: "utf8" });
      if (fixtureBlob.status !== 0 || fixtureBlob.stdout.trim() !== entry.blob) throw new Error(`${label}: fixture bytes differ from pinned source`);
    }
    mapped.set(entry.path, entry);
  }

  const missing = [...upstream.keys()].filter((sourcePath) => !mapped.has(sourcePath));
  const stale = [...mapped.keys()].filter((sourcePath) => !upstream.has(sourcePath));
  if (missing.length || stale.length) {
    throw new Error(`${id}: inventory mismatch; missing [${missing.join(", ")}], stale [${stale.join(", ")}]`);
  }
  console.log(`${id}: ${mapped.size} paths mapped at ${revision}`);
}

for (const inventoryPath of inventories) await checkInventory(inventoryPath);
