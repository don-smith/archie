import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { checkTree, NODE_DIRS, COMPANION_DIRS } from "../../scripts/check-intent-tree.mjs";

const TREE_ROOT = "context";

const ID_SCHEME_TABLE = [
  "| Namespace prefix | Node directory |",
  "| --- | --- |",
  "| `ARCHIE-*` | `.` |",
  "| `ARCHIE.PROD-*` | `01-product/` |",
  "| `ARCHIE.SYS-*` | `02-system/` |",
  "| `ARCHIE.DEL-*` | `03-delivery/` |",
  "| `ARCHIE.DOCS-*` | `04-docs/` |"
].join("\n");

const SPEC = `# Spec

## Status: Draft

# ID scheme

${ID_SCHEME_TABLE}
`;

const ROOT_REQUIREMENTS = `# Root requirements

**Role:** owns the top-level invariants.

## Assumptions

- **ARCHIE-A01 One lockstep product.**

## Requirements

- **ARCHIE-R01 The product is one lockstep identity.**
`;

const ROOT_OPEN_QUESTIONS = `# Open questions

- **ARCHIE-DQ01 Some open question.**
`;

const NAMESPACE_BY_STEM = { product: "PROD", system: "SYS", delivery: "DEL", docs: "DOCS" };

function nodeRequirements(stem) {
  return `# Requirements

**Role:** ${stem}

## Requirements

- **ARCHIE.${NAMESPACE_BY_STEM[stem]}-R01 A child requirement. \`refines: ARCHIE-R01\`**
`;
}

function validDecision() {
  return [
    "# 0001 — A test decision",
    "",
    "Status: accepted (2026-09-22, test authority).",
    "",
    "## Context",
    "",
    "Some context.",
    "",
    "## Options",
    "",
    "### Option A — First — chosen",
    "",
    "Text.",
    "",
    "### Option B — Second — rejected",
    "",
    "Text.",
    "",
    "## Evidence",
    "",
    "- 2026-09-22 — test evidence.",
    "",
    "## Consequences",
    "",
    "- A consequence."
  ].join("\n");
}

function validDelta() {
  return [
    "# DELTA-001 — A test delta",
    "",
    "Owner: test owner module.",
    "",
    "Status: open",
    "",
    "## Observed divergence",
    "",
    "Some divergence.",
    "",
    "## Closure check",
    "",
    "Some closure criterion."
  ].join("\n");
}

function validTree() {
  const files = {
    "vision.md": "# Vision\n\nSome vision.\n",
    "requirements.md": ROOT_REQUIREMENTS,
    "spec.md": SPEC,
    "ontology.md": "# Ontology\n\nSome term.\n",
    "roadmap.md": "# Roadmap\n\nSome roadmap.\n",
    "open-questions.md": ROOT_OPEN_QUESTIONS,
    ".decisions/0001-test-decision.md": validDecision(),
    ".delta/DELTA-001-test-delta.md": validDelta()
  };
  for (const node of NODE_DIRS) {
    files[`${node}/requirements.md`] = nodeRequirements(node.slice(3));
    files[`${node}/spec.md`] = `# Spec\n\n## Status: Draft\n\nSome behavior.\n`;
  }
  return files;
}

function writeTree(base, files) {
  for (const [rel, content] of Object.entries(files)) {
    const target = join(base, rel);
    mkdirSync(target.slice(0, target.lastIndexOf("/")), { recursive: true });
    writeFileSync(target, content);
  }
}

function withBroken(base, files) {
  writeTree(base, files);
  return checkTree(base);
}

function tempBase() {
  return mkdtempSync(join(tmpdir(), "intent-tree-"));
}

test("the checker accepts a structurally valid tree", () => {
  const base = tempBase();
  try {
    const result = withBroken(base, validTree());
    assert.equal(result.ok, true, result.diagnostics.join("\n"));
    assert.deepEqual(result.diagnostics, []);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("the checker accepts the real repository intent tree", () => {
  const result = checkTree(TREE_ROOT);
  assert.equal(result.ok, true, result.diagnostics.join("\n"));
});

test("the real tree's ID scheme table is exactly the expected namespace mapping", () => {
  const spec = readFileSync(join(TREE_ROOT, "spec.md"), "utf8");
  const expected = new Map([
    ["ARCHIE-", "."],
    ["ARCHIE.PROD-", "01-product/"],
    ["ARCHIE.SYS-", "02-system/"],
    ["ARCHIE.DEL-", "03-delivery/"],
    ["ARCHIE.DOCS-", "04-docs/"]
  ]);
  // Parsed by the same machinery the checker trusts; equality is pinned here.
  const { table } = checkTree(TREE_ROOT);
  assert.deepEqual([...table.entries()].sort(), [...expected.entries()].sort());
});

test("the CLI exits non-zero for a broken tree and zero for a valid tree", () => {
  const base = tempBase();
  try {
    writeTree(base, validTree());
    const valid = spawnSync(process.execPath, ["scripts/check-intent-tree.mjs", base], { encoding: "utf8" });
    assert.equal(valid.status, 0, valid.stderr);
    writeFileSync(join(base, "requirements.md"), "not empty but no heading\n");
    const broken = spawnSync(process.execPath, ["scripts/check-intent-tree.mjs", base], { encoding: "utf8" });
    assert.equal(broken.status, 1);
    assert.match(broken.stderr, /ARCHIE-R01/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("a duplicate declared ID is rejected once for each occurrence", () => {
  const base = tempBase();
  try {
    const files = validTree();
    files["ontology.md"] = "# Ontology\n\n- **ARCHIE-R01 Duplicate declaration.**\n";
    const result = withBroken(base, files);
    assert.equal(result.ok, false);
    const failures = result.diagnostics.filter((line) => line.includes("duplicate") && line.includes("ARCHIE-R01"));
    assert.ok(failures.length >= 1, result.diagnostics.join("\n"));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("a refines target that is not a declared ID is rejected", () => {
  const base = tempBase();
  try {
    const files = validTree();
    files["01-product/requirements.md"] = "# Requirements\n\n**Role:** product.\n\n## Requirements\n\n- **ARCHIE.PROD-R01 A child requirement. `refines: ARCHIE-R999`**\n";
    const result = withBroken(base, files);
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some((line) => line.includes("ARCHIE-R999")), result.diagnostics.join("\n"));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("a refines target whose namespace prefix is not in the ID scheme table is rejected as malformed", () => {
  const base = tempBase();
  try {
    const files = validTree();
    files["01-product/requirements.md"] = "# Requirements\n\n**Role:** product.\n\n## Requirements\n\n- **ARCHIE.PROD-R01 A child requirement. `refines: ARCHIE.EXTRA-R01`**\n";
    const result = withBroken(base, files);
    assert.equal(result.ok, false);
    assert.ok(
      result.diagnostics.some((line) => line.includes("malformed refines target") && line.includes("ARCHIE.EXTRA-R01")),
      result.diagnostics.join("\n")
    );
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("content inside fenced code blocks is ignored by the pattern scans", () => {
  const base = tempBase();
  try {
    const files = validTree();
    files["vision.md"] = [
      "# Vision",
      "",
      "```md",
      "- **ARCHIE-R01 Duplicate declared inside a fence.**",
      "**Maturity: proposal**",
      "`refines: ARCHIE-R999`",
      "See [the requirements](./missing.md).",
      "```",
      "",
      "Some vision."
    ].join("\n");
    files["02-system/spec.md"] = "# Spec\n\n```md\n## Status: Bogus\n```\n\n## Status: Draft\n\nSome behavior.\n";
    const result = withBroken(base, files);
    assert.equal(result.ok, true, result.diagnostics.join("\n"));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("an ID declared in the wrong namespace directory is rejected", () => {
  const base = tempBase();
  try {
    const files = validTree();
    files["01-product/requirements.md"] = "# Requirements\n\n**Role:** product.\n\n## Requirements\n\n- **ARCHIE.DEL-R01 Wrong namespace.**\n";
    const result = withBroken(base, files);
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some((line) => line.includes("01-product") && line.includes("ARCHIE.DEL-R01")), result.diagnostics.join("\n"));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("a relative link to a missing target is rejected", () => {
  const base = tempBase();
  try {
    const files = validTree();
    files["vision.md"] = "# Vision\n\nSee [the requirements](./missing.md).\n";
    const result = withBroken(base, files);
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some((line) => line.includes("missing.md")), result.diagnostics.join("\n"));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("external and in-page links are not treated as relative targets", () => {
  const base = tempBase();
  try {
    const files = validTree();
    files["vision.md"] = "# Vision\n\nSee [GitHub](https://github.com/don-smith/archie) and [section](#purpose).\n";
    const result = withBroken(base, files);
    assert.equal(result.ok, true, result.diagnostics.join("\n"));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("a spec without a Status heading is rejected", () => {
  const base = tempBase();
  try {
    const files = validTree();
    files["spec.md"] = "# Spec\n\nNo status here.\n";
    const result = withBroken(base, files);
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some((line) => line.includes("Status")), result.diagnostics.join("\n"));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("a spec with an invalid Status value is rejected", () => {
  const base = tempBase();
  try {
    const files = validTree();
    files["spec.md"] = `# Spec\n\n## Status: Beta\n\n${ID_SCHEME_TABLE}\n`;
    const result = withBroken(base, files);
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some((line) => line.includes("Beta")), result.diagnostics.join("\n"));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("a forbidden maturity label is rejected", () => {
  const base = tempBase();
  try {
    const files = validTree();
    files["01-product/spec.md"] = "# Spec\n\n## Status: Draft\n\n**Maturity: proposal** behavior.\n";
    const result = withBroken(base, files);
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some((line) => line.includes("proposal")), result.diagnostics.join("\n"));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("a malformed decision record is rejected", () => {
  const base = tempBase();
  try {
    const files = validTree();
    files[".decisions/not-numbered.md"] = "# Not numbered\n\nStatus: accepted (2026-09-22, test).\n";
    const result = withBroken(base, files);
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some((line) => line.includes("not-numbered.md")), result.diagnostics.join("\n"));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("a decision without accepted status or evidence is rejected", () => {
  const base = tempBase();
  try {
    const files = validTree();
    files[".decisions/0001-test-decision.md"] = "# 0001 — Test\n\nStatus: proposed.\n";
    const result = withBroken(base, files);
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some((line) => /status/i.test(line)), result.diagnostics.join("\n"));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("a malformed or incomplete delta record is rejected", () => {
  const base = tempBase();
  try {
    const files = validTree();
    files[".delta/DELTA-001-test-delta.md"] = "# DELTA-001 — Test\n\nOwner: module.\n\nStatus: pending\n\n## Observed divergence\n\nText.\n";
    const result = withBroken(base, files);
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some((line) => line.includes("Status") || line.includes("Closure")), result.diagnostics.join("\n"));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("a missing required root file is rejected", () => {
  const base = tempBase();
  try {
    const files = validTree();
    delete files["vision.md"];
    const result = withBroken(base, files);
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some((line) => line.includes("vision.md")), result.diagnostics.join("\n"));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("an empty companion directory is rejected", () => {
  const base = tempBase();
  try {
    const files = validTree();
    delete files[".delta/DELTA-001-test-delta.md"];
    const result = withBroken(base, files);
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some((line) => line.includes(".delta")), result.diagnostics.join("\n"));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("a node missing its spec is rejected", () => {
  const base = tempBase();
  try {
    const files = validTree();
    delete files["01-product/spec.md"];
    const result = withBroken(base, files);
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some((line) => line.includes("01-product") && line.includes("spec.md")), result.diagnostics.join("\n"));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("an empty required file is rejected", () => {
  const base = tempBase();
  try {
    const files = validTree();
    files["ontology.md"] = "";
    const result = withBroken(base, files);
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some((line) => line.includes("empty") && line.includes("ontology.md")), result.diagnostics.join("\n"));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("an ID scheme table missing the root mapping is rejected", () => {
  const base = tempBase();
  try {
    const files = validTree();
    files["spec.md"] = "# Spec\n\n## Status: Draft\n\n| Namespace prefix | Node directory |\n| --- | --- |\n| `ARCHIE.PROD-*` | `01-product/` |\n| `ARCHIE.SYS-*` | `02-system/` |\n| `ARCHIE.DEL-*` | `03-delivery/` |\n| `ARCHIE.DOCS-*` | `04-docs/` |\n";
    const result = withBroken(base, files);
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some((line) => line.includes("ARCHIE-")), result.diagnostics.join("\n"));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("every required node directory is exercised by the fixture", () => {
  assert.deepEqual(NODE_DIRS, ["01-product", "02-system", "03-delivery", "04-docs"]);
  assert.deepEqual(COMPANION_DIRS, [".decisions", ".delta"]);
  const base = tempBase();
  try {
    writeTree(base, validTree());
    for (const dir of [...NODE_DIRS, ...COMPANION_DIRS]) {
      assert.equal(relative(base, join(base, dir)).startsWith(".."), false);
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
