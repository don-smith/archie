/** Developer work product Archie creates but does not own; an uninstall must leave it in place. */
export declare const PRESERVED_DIRECTORIES: readonly ["assessments"];
export interface UninstallResult {
    targetDirectory: string;
    /** Directories left behind on purpose, relative to the target. */
    preserved: string[];
}
/**
 * Removes Archie from a target by replaying its install journal, which restores every path Archie
 * touched to the bytes that preceded it. Nothing is derived from guesswork about layout, so a skills
 * directory holding skills Archie does not own keeps them, and preserved work product is never removed.
 */
export declare function uninstallTarget(targetDirectory: string): UninstallResult;
