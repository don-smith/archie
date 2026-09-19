import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, rmSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CheckStatus } from "./report.js";

/**
 * Bridges APM's skill deployment into the one directory Claude Code reads.
 *
 * APM deploys every Archie skill to `.agents/skills/<skill>/`, which is where this product's
 * own checks, the native lock's per-file hashes, and `verifyDeployedSkills` all look. Claude Code
 * discovers skills in exactly three places — `~/.claude/skills`, `<project>/.claude/skills`, and
 * plugins — and `.agents/skills` is none of them. The Jaspyr trial found this the expensive way:
 * every gate passed, all eight skills were deployed and byte-verified, and the developer's agent
 * offered none of them. Adding `claude` to the project's APM targets does not help either; APM's
 * agent-specific targets govern other primitives and skills still deploy only to `.agents/skills`.
 *
 * The bridge is a relative symbolic link per skill, never a copy. A copy would be a second set of
 * bytes that nothing hashes, free to drift from the deployed tree the lock pins, and it would turn
 * every upgrade into a two-place update. A link keeps `.agents/skills` the single source.
 *
 * Ownership is deliberately narrow: Archie touches `.claude/skills/<skill>` only for the skills the
 * release deploys, and only when that path is absent or already holds a link of its own making.
 * A repository's own skill, or a link it made to something else, keeps the name and is reported
 * rather than replaced.
 */
const LINK_PREFIX = "../../.agents/skills/";

const claudeDirectory = (targetDirectory: string): string => join(resolve(targetDirectory), ".claude");
const skillsDirectory = (targetDirectory: string): string => join(claudeDirectory(targetDirectory), "skills");
const linkPath = (targetDirectory: string, skill: string): string => join(skillsDirectory(targetDirectory), skill);
const linkTo = (skill: string): string => `${LINK_PREFIX}${skill}`;

/** The link's own text, or undefined when the path is not a symbolic link. Never follows the link. */
function readLink(path: string): string | undefined {
  try { return lstatSync(path).isSymbolicLink() ? readlinkSync(path) : undefined; } catch { return undefined; }
}

/**
 * What Archie may write at a skill's name, decided from the path as it stands:
 * `absent` and `ours` are writable, `occupied` is the repository's and is left alone.
 */
function occupancy(targetDirectory: string, skill: string): "absent" | "ours" | "occupied" {
  const path = linkPath(targetDirectory, skill);
  const link = readLink(path);
  if (link !== undefined) return link.startsWith(LINK_PREFIX) ? "ours" : "occupied";
  return existsSync(path) ? "occupied" : "absent";
}

export interface ClaudeSkillBridge {
  /** `not-applied` when the repository has no `.claude` directory; `blocked` when a name was already taken. */
  status: CheckStatus;
  linked: string[];
  /** Links to skills a previous release deployed and this one does not. */
  removed: string[];
  /** Skills whose name in `.claude/skills` belongs to the repository, so Claude Code will not see them. */
  occupied: string[];
}

/**
 * The paths a bridge may write, for the install journal to record a preimage of.
 *
 * Only absent paths and Archie's own links are listed: `backup` reads a regular file's bytes and
 * would fail on a directory, and compensation removes an entry with `rmSync` without `recursive`,
 * which a directory would refuse. Both are correct, because a directory at one of these names is
 * the repository's and is never written to in the first place.
 */
export function claudeBridgePaths(targetDirectory: string, skills: readonly string[], previousSkills: readonly string[] = []): string[] {
  const target = resolve(targetDirectory);
  if (!existsSync(claudeDirectory(target))) return [];
  const names = [...new Set([...skills, ...previousSkills])].sort();
  return names.filter(skill => occupancy(target, skill) !== "occupied").map(skill => linkPath(target, skill));
}

/**
 * Reconciles `.claude/skills` with the skills this release deploys: writes a link for each one,
 * repoints a link of Archie's that names the wrong skill, and removes links for skills the previous
 * release deployed and this one does not. Doing this on every install is what keeps a rename or a
 * dropped skill from leaving a dangling link behind, which Claude Code would report as a broken skill.
 *
 * A repository with no `.claude` directory is not using Claude Code, so nothing is created: this
 * mirrors how APM itself decides a target is active, and keeps Archie from seeding agent
 * directories in repositories that do not want them.
 */
export function linkClaudeSkills(targetDirectory: string, skills: readonly string[], previousSkills: readonly string[] = []): ClaudeSkillBridge {
  const target = resolve(targetDirectory);
  if (!existsSync(claudeDirectory(target))) return { status: "not-applied", linked: [], removed: [], occupied: [] };
  mkdirSync(skillsDirectory(target), { recursive: true });

  const linked: string[] = [], occupied: string[] = [];
  for (const skill of skills) {
    if (occupancy(target, skill) === "occupied") { occupied.push(skill); continue; }
    const path = linkPath(target, skill);
    if (readLink(path) !== linkTo(skill)) { rmSync(path, { force: true }); symlinkSync(linkTo(skill), path); }
    linked.push(skill);
  }

  const removed: string[] = [];
  for (const skill of previousSkills) {
    if (skills.includes(skill) || occupancy(target, skill) !== "ours") continue;
    rmSync(linkPath(target, skill), { force: true });
    removed.push(skill);
  }

  return { status: occupied.length ? "blocked" : "passed", linked, removed: removed.sort(), occupied };
}

/**
 * Read-only counterpart, for `archie verify` and any gate that runs against a checkout.
 *
 * It judges only the links Archie owns for the skills this release deploys. A missing link is not a
 * failure: the bridge is written by the install, and a repository that installed an earlier Archie,
 * or one whose `.claude` directory is not committed, is not broken — it simply has no bridge yet.
 * A link that is present and wrong is a failure, because Claude Code surfaces it as a broken skill.
 */
export function verifyClaudeSkillLinks(targetDirectory: string, skills: readonly string[]): CheckStatus {
  const target = resolve(targetDirectory);
  if (!existsSync(claudeDirectory(target))) return "not-applied";
  if (!existsSync(skillsDirectory(target))) return "passed";
  const present = new Set(readdirSync(skillsDirectory(target)));
  for (const skill of skills) {
    if (!present.has(skill)) continue;
    const link = readLink(linkPath(target, skill));
    if (link === undefined || !link.startsWith(LINK_PREFIX)) continue;
    if (link !== linkTo(skill)) throw new Error(`Claude Code skill link .claude/skills/${skill} points at ${link} rather than the skill of the same name; re-run the Archie install to reconcile it`);
    if (!existsSync(linkPath(target, skill))) throw new Error(`Claude Code skill link .claude/skills/${skill} is dangling: ${link} does not exist; re-run the Archie install to reconcile it`);
  }
  return "passed";
}
