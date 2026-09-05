import { spawnSync } from "node:child_process";
import type { RepositoryCheck, RepositoryCheckResult } from "./contracts.js";

/** Runs the target-owned command without converting its exit or meaning into an Archie verdict. */
export function runRepositoryCheck(check: RepositoryCheck, cwd: string): RepositoryCheckResult {
  const execution = spawnSync(check.command, { cwd, shell: true, encoding: "utf8" });
  return { id: check.id, exitCode: execution.status ?? 1, stdout: execution.stdout ?? "", stderr: execution.stderr ?? "", resultMeaning: check.resultMeaning };
}
