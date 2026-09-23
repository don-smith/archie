#!/usr/bin/env node
// Structural validator for the Archie intent layer (VRS tree).
// Dependency-free: Node built-ins only. Validates structure, never semantic truth.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT_FILES = [
  "vision.md",
  "requirements.md",
  "spec.md",
  "ontology.md",
  "roadmap.md",
  "open-questions.md"
];
export const NODE_DIRS = ["01-product", "02-system", "03-delivery", "04-docs"];
export const COMPANION_DIRS = [".decisions", ".delta"];
export const SPEC_STATUSES = ["Draft", "Active", "Stable"];
export const MATURITY_MARKER = "**Maturity: experimental**";

const DECLARED_PATTERN = /\*\*([A-Z][A-Z0-9.]*-(?:A|T|R|DQ)\d+)(?:\*\*|\s)/g;
const REFINES_PATTERN = /refines:\s*([A-Za-z][A-Za-z0-9.]*-(?:A|T|R|DQ)\d+)/g;
const LINK_PATTERN = /!?\[[^\]]*\]\(([^)]+)\)/g;
const MATURITY_PATTERN = /(\*\*)?Maturity:\s*([A-Za-z]+)(\*\*)?/g;
const DECISION_PATTERN = /^\d{4}-[a-z0-9-]+\.md$/;
const DELTA_PATTERN = /^DELTA-\d{3}-[a-z0-9-]+\.md$/;

function toPosix(path) {
  return path.split(sep).join("/");
}

function stripFences(text) {
  return text
    .split("\n")
    .filter((line, index, lines) => {
      if (line.trimStart().startsWith("```")) {
        let depth = 1;
        for (let next = index + 1; next < lines.length; next += 1) {
          if (lines[next].trimStart().startsWith("```")) {
            depth = 0;
            break;
          }
        }
        return depth === 0;
      }
      return true;
    })
    .join("\n");
}

function markdownFiles(root) {
  const files = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = join(dir, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push(child);
    }
  };
  visit(root);
  return files;
}

function dirFiles(root) {
  const files = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) visit(join(dir, entry.name));
      else if (entry.isFile()) files.push(join(dir, entry.name));
    }
  };
  visit(root);
  return files;
}

/** Parses the "| `PREFIX-*` | `dir/` |" rows of the root spec's ID scheme table. */
export function parseNamespaceTable(specText) {
  const table = new Map();
  for (const line of specText.split("\n")) {
    const match = line.match(/^\|\s*`([^`|]+)`\s*\|\s*`?([^`|]+)`?\s*\|/);
    if (!match) continue;
    const prefix = match[1];
    const dir = match[2].trim();
    if (prefix.endsWith("-*") && dir) table.set(prefix.slice(0, -1), dir);
  }
  return table;
}

function headingSections(text) {
  const sections = new Map();
  let current = null;
  for (const line of text.split("\n")) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) current = match[1].trim();
    else if (current) sections.set(current, (sections.get(current) ?? 0) + 1);
  }
  return sections;
}

function statusValue(text) {
  const matches = [...text.matchAll(/^##\s*Status\s*:?\s*(.*)$/gm)];
  if (matches.length === 0) return undefined;
  const inline = matches[0][1].trim();
  if (inline) return inline.replace(/[.].*$/, "");
  const lines = text.split("\n");
  const index = lines.findIndex((line) => /^##\s*Status\s*:?\s*/.test(line));
  for (const line of lines.slice(index + 1)) {
    if (line.trim()) return line.trim().replace(/[.].*$/, "");
  }
  return undefined;
}

function entryKind(path) {
  if (!existsSync(path)) return "missing";
  return statSync(path).isDirectory() ? "directory" : "file";
}

export function checkTree(root) {
  const diagnostics = [];
  const fail = (message) => diagnostics.push(message);

  const treeRoot = resolve(root);
  if (!existsSync(treeRoot) || !statSync(treeRoot).isDirectory()) {
    return { ok: false, diagnostics: [`${root} is not a directory`], table: new Map() };
  }

  const rel = (path) => toPosix(relative(treeRoot, path));
  const relDir = (path) => {
    const dir = dirname(rel(path));
    return dir === "." ? "" : dir;
  };

  // Required root files exist and are non-empty.
  for (const name of ROOT_FILES) {
    const path = join(treeRoot, name);
    if (entryKind(path) !== "file") fail(`missing required root file: ${name}`);
    else if (statSync(path).size === 0) fail(`required root file is empty: ${name}`);
  }

  // Required companion and node directories exist and are non-empty.
  for (const name of [...COMPANION_DIRS, ...NODE_DIRS]) {
    const path = join(treeRoot, name);
    if (entryKind(path) !== "directory") {
      fail(`missing required directory: ${name}`);
      continue;
    }
    if (dirFiles(path).length === 0) fail(`directory is empty: ${name}`);
  }

  // Every node has requirements.md and spec.md, both non-empty.
  for (const name of NODE_DIRS) {
    for (const file of ["requirements.md", "spec.md"]) {
      const path = join(treeRoot, name, file);
      if (entryKind(path) !== "file") fail(`missing required node file: ${name}/${file}`);
      else if (statSync(path).size === 0) fail(`required node file is empty: ${name}/${file}`);
    }
  }

  const specPath = join(treeRoot, "spec.md");
  const table = existsSync(specPath) && statSync(specPath).isFile() ? parseNamespaceTable(stripFences(readFileSync(specPath, "utf8"))) : new Map();
  const rootPrefix = "ARCHIE-";
  if (!table.has(rootPrefix)) fail(`ID scheme table must map the root namespace ${rootPrefix}* to the tree root`);
  if (table.size === 0) fail(`ID scheme table is missing from spec.md`);

  const files = markdownFiles(treeRoot);
  const specFiles = files.filter((file) => file.endsWith("/spec.md") || rel(file).endsWith("spec.md"));

  // Table-mapped directories must exist in the tree.
  for (const [, dir] of table) {
    const target = dir === "." ? treeRoot : join(treeRoot, dir);
    if (entryKind(target) !== "directory") fail(`ID scheme table maps namespace to a missing directory: ${dir}`);
  }

  // Spec Status: every spec.md has exactly one legal ## Status.
  for (const file of specFiles) {
    const text = readFileSync(file, "utf8");
    const matches = [...text.matchAll(/^##\s*Status\s*:?\s*(.*)$/gm)];
    if (matches.length === 0) fail(`${rel(file)}: spec is missing its ## Status heading`);
    else if (matches.length > 1) fail(`${rel(file)}: spec has more than one ## Status heading`);
    else {
      const value = statusValue(text);
      if (!SPEC_STATUSES.includes(value)) fail(`${rel(file)}: invalid spec maturity status "${value ?? ""}" (expected one of ${SPEC_STATUSES.join(", ")})`);
    }
  }

  // Maturity vocabulary: only the bold experimental marker is legal.
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(MATURITY_PATTERN)) {
      if (match[0] !== MATURITY_MARKER) fail(`${rel(file)}: forbidden maturity marker "${match[0]}" (only ${MATURITY_MARKER} is legal)`);
    }
  }

  // Declared IDs: bold ID tokens; globally unique; placed in their namespace directory.
  const declared = new Map(); // id -> file
  const placementFailures = [];
  for (const file of files) {
    const text = stripFences(readFileSync(file, "utf8"));
    const relFile = rel(file);
    for (const match of text.matchAll(DECLARED_PATTERN)) {
      const id = match[1];
      const prefix = `${id.slice(0, id.lastIndexOf("-"))}-`;
      const expectedDir = table.get(prefix);
      if (expectedDir === undefined) {
        fail(`${relFile}: ID ${id} has no namespace entry in the ID scheme table`);
        continue;
      }
      const expected = expectedDir === "." ? "" : expectedDir.replace(/\/$/, "");
      if (relDir(file) !== expected) placementFailures.push(`${relFile}: ID ${id} belongs to namespace ${prefix}* (directory ${expectedDir})`);
      const previous = declared.get(id);
      if (previous !== undefined) fail(`duplicate declared ID ${id}: declared in both ${previous} and ${relFile}`);
      else declared.set(id, relFile);
    }
  }
  for (const message of placementFailures) fail(message);

  // refines: every target must be a declared ID.
  for (const file of files) {
    const text = stripFences(readFileSync(file, "utf8"));
    for (const match of text.matchAll(REFINES_PATTERN)) {
      const target = match[1].split("`").pop();
      if (!/^ARCHIE(?:\.(?:PROD|SYS|DEL|DOCS))?-(?:A|T|R|DQ)\d+$/.test(target)) fail(`${rel(file)}: malformed refines target "${target}"`);
      else if (!declared.has(target)) fail(`${rel(file)}: refines target ${target} is not a declared ID`);
    }
  }

  // Relative Markdown links must resolve.
  for (const file of files) {
    const text = stripFences(readFileSync(file, "utf8"));
    for (const match of text.matchAll(LINK_PATTERN)) {
      let target = match[1].trim().replace(/\s+["'].*["']\s*$/, "");
      if (!target || target.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.includes("://")) continue;
      const anchor = target.indexOf("#");
      if (anchor >= 0) target = target.slice(0, anchor);
      if (!target) continue;
      const resolved = normalize(join(dirname(file), target));
      const kind = entryKind(resolved);
      if (kind === "missing") fail(`${rel(file)}: relative link target does not exist: ${target}`);
    }
  }

  // Decision records.
  const decisionsDir = join(treeRoot, ".decisions");
  if (entryKind(decisionsDir) === "directory") {
    for (const entry of readdirSync(decisionsDir, { withFileTypes: true })) {
      const error = checkDecision(join(decisionsDir, entry.name), entry.name, entry.isFile());
      if (error) fail(`${rel(join(decisionsDir, entry.name))}: ${error}`);
    }
  }

  // Delta records.
  const deltaDir = join(treeRoot, ".delta");
  if (entryKind(deltaDir) === "directory") {
    for (const entry of readdirSync(deltaDir, { withFileTypes: true })) {
      const error = checkDelta(join(deltaDir, entry.name), entry.name, entry.isFile());
      if (error) fail(`${rel(join(deltaDir, entry.name))}: ${error}`);
    }
  }

  return { ok: diagnostics.length === 0, diagnostics: [...new Set(diagnostics)], table };
}

function checkDecision(path, name, isFile) {
  if (!isFile || !DECISION_PATTERN.test(name)) return `unsupported decision entry (expected NNNN-slug.md): ${name}`;
  const text = readFileSync(path, "utf8");
  if (!/^Status:\s*accepted\b/mi.test(text)) return "decision status must be accepted";
  const statusLine = text.split("\n").find((line) => /^Status:\s*accepted\b/i.test(line)) ?? "";
  if (!/\d{4}-\d{2}-\d{2}/.test(statusLine)) return "decision status must carry a dated acceptance (YYYY-MM-DD)";
  const sections = headingSections(stripFences(text));
  for (const required of ["Context", "Options", "Evidence", "Consequences"]) {
    if (!sections.has(required)) return `decision is missing its ## ${required} section`;
  }
  const options = [...text.matchAll(/^###\s+Option\s/gm)];
  if (options.length < 2) return "decision Options must list at least two alternatives";
  const optionLines = text.split("\n").filter((line) => /^###\s+Option\s/.test(line));
  if (!optionLines.some((line) => /chosen/i.test(line)) || !optionLines.some((line) => /rejected/i.test(line))) {
    return "decision Options must mark one alternative chosen and the rest rejected";
  }
  if (!/^##\s+Evidence\s*$/m.test(text)) return "decision Evidence section must be present";
  const evidenceLines = text.split("\n");
  const evidenceStart = evidenceLines.findIndex((line) => /^##\s+Evidence\s*$/.test(line));
  const evidenceBody = evidenceLines.slice(evidenceStart + 1).join("\n").split("\n## ")[0];
  if (!/\d{4}/.test(evidenceBody)) return "decision Evidence must be dated";
  return undefined;
}

function checkDelta(path, name, isFile) {
  if (!isFile || !DELTA_PATTERN.test(name)) return `unsupported delta entry (expected DELTA-NNN-slug.md): ${name}`;
  const text = readFileSync(path, "utf8");
  const owner = text.split("\n").find((line) => /^Owner:\s*\S/.test(line));
  if (!owner) return "delta is missing its Owner line";
  const statusLine = text.split("\n").find((line) => /^Status:\s*\S/.test(line));
  if (!statusLine) return "delta is missing its Status line";
  if (!/^Status:\s*(open|resolved)\s*$/i.test(statusLine)) return "delta Status must be open or resolved";
  const sections = headingSections(stripFences(text));
  for (const required of ["Observed divergence", "Closure check"]) {
    if (!sections.has(required)) return `delta is missing its ## ${required} section`;
  }
  return undefined;
}

export function main(argv) {
  const args = argv.slice(2);
  if (args.length !== 1) {
    process.stderr.write("usage: node scripts/check-intent-tree.mjs <tree-path>\n");
    process.exitCode = 2;
    return;
  }
  const result = checkTree(args[0]);
  if (result.ok) {
    process.stdout.write(`Intent tree structure OK: ${args[0]}\n`);
    process.exitCode = 0;
  } else {
    process.stderr.write(`Intent tree structure check failed: ${args[0]}\n`);
    for (const diagnostic of result.diagnostics) process.stderr.write(`- ${diagnostic}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main(process.argv);
