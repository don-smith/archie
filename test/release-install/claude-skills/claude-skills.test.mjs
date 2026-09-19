import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { claudeBridgePaths, linkClaudeSkills, verifyClaudeSkillLinks } from "../../../dist/packages/archie-runtime/src/release-install/claude-skills.js";
import { beginInstallJournal, compensateInstall } from "../../../dist/packages/archie-runtime/src/release-install/journal.js";

const SKILLS = ["archie", "architecture-docs"];

/** A target as APM leaves it: skills deployed under `.agents/skills`, and a repository that uses Claude Code. */
function target({ claude = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "archie-claude-skills-"));
  for (const skill of SKILLS) deploy(root, skill);
  if (claude) mkdirSync(join(root, ".claude"), { recursive: true });
  return root;
}
function deploy(root, skill) {
  mkdirSync(join(root, ".agents", "skills", skill), { recursive: true });
  writeFileSync(join(root, ".agents", "skills", skill, "SKILL.md"), `${skill}\n`);
}
const bridged = (root, skill) => join(root, ".claude", "skills", skill);
const isLink = (path) => { try { return lstatSync(path).isSymbolicLink(); } catch { return false; } };

test("links every deployed skill into the directory Claude Code reads", () => {
  const root = target();
  try {
    const result = linkClaudeSkills(root, SKILLS);
    assert.equal(result.status, "passed");
    assert.deepEqual(result.linked, SKILLS);
    // The link resolving to the deployed bytes is the whole point: a link Claude Code cannot follow
    // is indistinguishable, to the developer, from the skills never having been installed.
    assert.equal(readFileSync(join(bridged(root, "archie"), "SKILL.md"), "utf8"), "archie\n");
    assert.equal(readlinkSync(bridged(root, "archie")), "../../.agents/skills/archie");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("does nothing in a repository that does not use Claude Code", () => {
  const root = target({ claude: false });
  try {
    assert.equal(linkClaudeSkills(root, SKILLS).status, "not-applied");
    assert.ok(!existsSync(join(root, ".claude")), "no agent directory is seeded");
    assert.deepEqual(claudeBridgePaths(root, SKILLS), []);
    assert.equal(verifyClaudeSkillLinks(root, SKILLS), "not-applied");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("leaves a name the repository owns alone and reports it", () => {
  const root = target();
  try {
    mkdirSync(join(root, ".claude", "skills"), { recursive: true });
    mkdirSync(bridged(root, "archie"), { recursive: true });
    writeFileSync(join(bridged(root, "archie"), "SKILL.md"), "the repository's own\n");

    const result = linkClaudeSkills(root, SKILLS);
    assert.equal(result.status, "blocked");
    assert.deepEqual(result.occupied, ["archie"]);
    assert.deepEqual(result.linked, ["architecture-docs"]);
    assert.equal(readFileSync(join(bridged(root, "archie"), "SKILL.md"), "utf8"), "the repository's own\n");
    // Never journaled either, because compensation would remove it.
    assert.deepEqual(claudeBridgePaths(root, SKILLS), [bridged(root, "architecture-docs")]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("leaves a link the repository made to something else alone", () => {
  const root = target();
  try {
    mkdirSync(join(root, ".claude", "skills"), { recursive: true });
    mkdirSync(join(root, "tools", "archie"), { recursive: true });
    symlinkSync("../../tools/archie", bridged(root, "archie"));

    assert.deepEqual(linkClaudeSkills(root, SKILLS).occupied, ["archie"]);
    assert.equal(readlinkSync(bridged(root, "archie")), "../../tools/archie");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("removes links for skills the previous release deployed and this one does not", () => {
  const root = target();
  try {
    deploy(root, "retired");
    linkClaudeSkills(root, [...SKILLS, "retired"]);
    rmSync(join(root, ".agents", "skills", "retired"), { recursive: true, force: true });

    const result = linkClaudeSkills(root, SKILLS, [...SKILLS, "retired"]);
    assert.deepEqual(result.removed, ["retired"]);
    assert.ok(!isLink(bridged(root, "retired")), "the dangling link is gone, not left for Claude Code to report as broken");
    assert.ok(isLink(bridged(root, "archie")), "the skills this release still deploys keep their links");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("keeps a link the repository made to a skill of its own under .agents/skills", () => {
  const root = target();
  try {
    deploy(root, "code-review");
    mkdirSync(join(root, ".claude", "skills"), { recursive: true });
    symlinkSync("../../.agents/skills/code-review", bridged(root, "code-review"));

    linkClaudeSkills(root, SKILLS, SKILLS);
    assert.equal(readlinkSync(bridged(root, "code-review")), "../../.agents/skills/code-review");
    assert.equal(verifyClaudeSkillLinks(root, SKILLS), "passed", "a skill Archie does not deploy is not Archie's to judge");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("repoints a link of its own that names the wrong skill", () => {
  const root = target();
  try {
    mkdirSync(join(root, ".claude", "skills"), { recursive: true });
    symlinkSync("../../.agents/skills/architecture-docs", bridged(root, "archie"));
    assert.throws(() => verifyClaudeSkillLinks(root, SKILLS), /points at \.\.\/\.\.\/\.agents\/skills\/architecture-docs/);

    linkClaudeSkills(root, SKILLS);
    assert.equal(readlinkSync(bridged(root, "archie")), "../../.agents/skills/archie");
    assert.equal(verifyClaudeSkillLinks(root, SKILLS), "passed");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("verification fails a dangling link and tolerates a missing one", () => {
  const root = target();
  try {
    linkClaudeSkills(root, SKILLS);
    assert.equal(verifyClaudeSkillLinks(root, SKILLS), "passed");

    rmSync(bridged(root, "architecture-docs"), { force: true });
    assert.equal(verifyClaudeSkillLinks(root, SKILLS), "passed", "an install that predates the bridge is not broken, just unbridged");

    rmSync(join(root, ".agents", "skills", "archie"), { recursive: true, force: true });
    assert.throws(() => verifyClaudeSkillLinks(root, SKILLS), /dangling/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the install journal reverses a bridge the install created", () => {
  const root = target();
  try {
    const journal = beginInstallJournal(root, SKILLS);
    linkClaudeSkills(root, SKILLS);
    assert.ok(isLink(bridged(root, "archie")));

    compensateInstall(root, journal);
    for (const skill of SKILLS) assert.ok(!isLink(bridged(root, skill)) && !existsSync(bridged(root, skill)), `${skill} is removed by compensation`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the install journal restores a link that was there before", () => {
  const root = target();
  try {
    mkdirSync(join(root, ".claude", "skills"), { recursive: true });
    symlinkSync("../../.agents/skills/architecture-docs", bridged(root, "archie"));

    const journal = beginInstallJournal(root, SKILLS);
    linkClaudeSkills(root, SKILLS);
    assert.equal(readlinkSync(bridged(root, "archie")), "../../.agents/skills/archie");

    compensateInstall(root, journal);
    assert.equal(readlinkSync(bridged(root, "archie")), "../../.agents/skills/architecture-docs", "the preimage is a link, and is restored as one");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
