import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export type JournalPhase = "prepared" | "staging" | "native-verification" | "completed" | "failed" | "compensated" | "compensation-incomplete";
type BackupEntry = { path: string; bytes?: string };
export interface InstallJournal { format: "archie-release-install-journal-v1"; phase: JournalPhase; entries: BackupEntry[]; restoreRoots: string[]; failure?: string; }

function journalPath(targetDirectory: string): string { return join(resolve(targetDirectory), ".archie", "release", "install-journal.json"); }
function files(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap(name => { const path = join(root, name); return statSync(path).isDirectory() ? files(path) : [path]; });
}
function tracked(targetDirectory: string, restoreRoots: string[]): string[] {
  const target = resolve(targetDirectory), archie = join(target, ".archie");
  return [
    join(archie, "version"), join(archie, "release", "release-record-v1.json"), join(archie, "release", "selection-receipt.json"),
    join(archie, "runtime", "package.json"), join(archie, "runtime", "package-lock.json"), join(target, "apm.yml"), join(target, "apm.lock.yaml"),
    ...restoreRoots.flatMap(files)
  ];
}
function write(path: string, journal: InstallJournal): void { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${JSON.stringify(journal, null, 2)}\n`); }
/** Durable preimage for all pin/configuration inputs plus native npm/APM deployment state. */
export function beginInstallJournal(targetDirectory: string, skills: string[]): InstallJournal {
  const target = resolve(targetDirectory), runtime = join(target, ".archie", "runtime");
  const restoreRoots = [join(runtime, "npm"), join(runtime, "node_modules"), ...skills.map(skill => join(target, ".agents", "skills", skill))];
  const entries = tracked(target, restoreRoots).map(path => ({ path, bytes: existsSync(path) ? readFileSync(path).toString("base64") : undefined }));
  const journal: InstallJournal = { format: "archie-release-install-journal-v1", phase: "prepared", entries, restoreRoots };
  write(journalPath(target), journal); return journal;
}
export function updateInstallJournal(targetDirectory: string, journal: InstallJournal, phase: JournalPhase, failure?: unknown): void {
  journal.phase = phase;
  if (failure) journal.failure = failure instanceof Error ? failure.message : String(failure);
  write(journalPath(targetDirectory), journal);
}
/** Removes partial native outputs, restores preimages, then lets the caller validate the former pin. */
export function compensateInstall(targetDirectory: string, journal: InstallJournal): void {
  for (const root of journal.restoreRoots) rmSync(root, { recursive: true, force: true });
  for (const entry of journal.entries) {
    if (entry.bytes === undefined) rmSync(entry.path, { force: true });
    else { mkdirSync(dirname(entry.path), { recursive: true }); writeFileSync(entry.path, Buffer.from(entry.bytes, "base64")); }
  }
}
