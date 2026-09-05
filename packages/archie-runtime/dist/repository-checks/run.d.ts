import type { RepositoryCheck, RepositoryCheckResult } from "./contracts.js";
/** Runs the target-owned command without converting its exit or meaning into an Archie verdict. */
export declare function runRepositoryCheck(check: RepositoryCheck, cwd: string): RepositoryCheckResult;
