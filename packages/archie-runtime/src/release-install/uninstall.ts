import { existsSync, readFileSync, readdirSync, rmSync, rmdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { compensateInstall, journalPath, type InstallJournal } from "./journal.js";

/** Developer work product Archie creates but does not own; an uninstall must leave it in place. */
export const PRESERVED_DIRECTORIES = ["assessments"] as const;

export interface UninstallResult {
  targetDirectory: string;
  /** Directories left behind on purpose, relative to the target. */
  preserved: string[];
}

function pruneEmpty(path: string, stopAt: string): void {
  let current = resolve(path);
  const boundary = resolve(stopAt);
  while (current.startsWith(boundary) && current !== boundary) {
    if (!existsSync(current) || readdirSync(current).length) return;
    rmdirSync(current);
    current = resolve(current, "..");
  }
}

/**
 * Removes Archie from a target by replaying its install journal, which restores every path Archie
 * touched to the bytes that preceded it. Nothing is derived from guesswork about layout, so a skills
 * directory holding skills Archie does not own keeps them, and preserved work product is never removed.
 */
export function uninstallTarget(targetDirectory: string): UninstallResult {
  const target = resolve(targetDirectory);
  const path = journalPath(target);
  if (!existsSync(path)) throw new Error(`no Archie install journal at ${path}; nothing can be removed safely without one`);
  const journal = JSON.parse(readFileSync(path, "utf8")) as InstallJournal;
  if (journal.format !== "archie-release-install-journal-v1") throw new Error("Archie install journal has an unsupported format");

  compensateInstall(target, journal);
  rmSync(path, { force: true });
  rmSync(join(target, ".archie", ".gitignore"), { force: true });

  const archie = join(target, ".archie");
  const preserved = PRESERVED_DIRECTORIES.filter(name => existsSync(join(archie, name)));
  for (const root of [...journal.restoreRoots, join(archie, "release"), join(archie, "runtime")]) pruneEmpty(root, target);
  pruneEmpty(join(target, ".agents", "skills"), target);
  // Bounded at `.claude` rather than the target: the bridge may have created `.claude/skills`, but
  // `.claude` itself predates the install — it is what told Archie to build a bridge at all.
  pruneEmpty(join(target, ".claude", "skills"), join(target, ".claude"));
  if (!preserved.length) pruneEmpty(archie, target);

  return { targetDirectory: target, preserved: preserved.map(name => `.archie/${name}`) };
}
