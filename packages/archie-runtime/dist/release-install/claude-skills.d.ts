import type { CheckStatus } from "./report.js";
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
export declare function claudeBridgePaths(targetDirectory: string, skills: readonly string[], previousSkills?: readonly string[]): string[];
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
export declare function linkClaudeSkills(targetDirectory: string, skills: readonly string[], previousSkills?: readonly string[]): ClaudeSkillBridge;
/**
 * Read-only counterpart, for `archie verify` and any gate that runs against a checkout.
 *
 * It judges only the links Archie owns for the skills this release deploys. A missing link is not a
 * failure: the bridge is written by the install, and a repository that installed an earlier Archie,
 * or one whose `.claude` directory is not committed, is not broken — it simply has no bridge yet.
 * A link that is present and wrong is a failure, because Claude Code surfaces it as a broken skill.
 */
export declare function verifyClaudeSkillLinks(targetDirectory: string, skills: readonly string[]): CheckStatus;
