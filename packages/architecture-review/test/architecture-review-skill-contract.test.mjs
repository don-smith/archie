import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const skillDir = path.resolve(import.meta.dirname, "../skills/architecture-review");
const skillText = () => readFile(path.join(skillDir, "SKILL.md"), "utf8");
const templateText = () => readFile(path.join(skillDir, "templates/architecture-review.md"), "utf8");

test("declares discovery metadata for proactive, bounded review", async () => {
  const text = await skillText();
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(frontmatter, "missing YAML frontmatter");
  assert.match(frontmatter[1], /^name: architecture-review$/m);
  assert.match(frontmatter[1], /^description: Use when there is no current work item/m);
  assert.match(frontmatter[1], /Never edits source/);
  assert.match(text, /architecture-review \[target\] \[--output <file>\]/);
});

test("has no MyFlow, Pi-specific, or named-agent dependencies", async () => {
  for (const text of [await skillText(), await templateText()]) {
    assert.doesNotMatch(text, /myflow|workstream|\/skill:|ask_user_question|codebase-locator|codebase-analyzer|_shared\/|resolve-repository-map|design\/plan/i);
  }
});

test("uses host-neutral checkpoints and optional parallel analysis", async () => {
  const text = await skillText();
  assert.match(text, /structured developer checkpoint/);
  assert.match(text, /host's structured question tool when one is available/);
  assert.match(text, /Otherwise, ask in conversation with the same numbered options and wait/);
  assert.match(text, /Without subagents, do the same analysis yourself, serially/);
  assert.match(text, /git rev-parse --short HEAD/);
});

test("keeps the review method and its ordering rules", async () => {
  const text = await skillText();
  const order = ["### Step 1: Identify the target", "### Step 3: Layer-split checkpoint", "### Step 4: Create the skeleton artifact", "### Step 5: Per-layer review", "### Step 6: Capture emergent methodology principles", "### Step 7: Synthesize cross-cutting themes", "### Step 8: Consolidated polish plan", "### Step 9: Present and hand off"];
  const positions = order.map((heading) => text.indexOf(heading));
  assert.ok(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])), positions.join(","));
  for (const dimension of ["Boundary", "Public surface", "Coherence and single responsibility", "Granularity", "Programming by intention", "DRY", "Domain language", "Naming", "Error and fail-soft posture", "Module-graph hygiene"]) {
    assert.match(text, new RegExp(`\\*\\*${dimension}\\*\\*`));
  }
  assert.match(text, /Read every file fully/);
  assert.match(text, /Never auto-accept a finding/);
  assert.match(text, /Never edit source files during the review/);
  assert.match(text, /Keep "Keep as composition primitive"|always offer "Keep as composition primitive"/);
});

test("writes to an Archie artifact location and hands off work items without implementing", async () => {
  const text = await skillText();
  assert.match(text, /`--output`, then a repository instruction, then `\.archie\/reviews\/<yyyymmdd>-<topic>\.md`/);
  assert.match(text, /tracked or ignored/);
  assert.match(text, /Propose each accepted phase as a work item/);
  assert.match(text, /Create or file nothing without the developer's approval/);
  assert.match(text, /`architecture-contracts`/);
  assert.match(text, /`architecture-docs`/);
  assert.match(await templateText(), /Plan ready to become work items\./);
});

test("links every reference and template one hop from the skill", async () => {
  const text = await skillText();
  const linked = new Set([...text.matchAll(/\]\((references|templates)\/([^)]+\.md)\)/g)].map((match) => `${match[1]}/${match[2]}`));
  const files = [];
  for (const directory of ["references", "templates"]) {
    for (const file of await readdir(path.join(skillDir, directory))) files.push(`${directory}/${file}`);
  }
  assert.deepEqual([...linked].sort(), files.sort());
});
