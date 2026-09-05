export type JournalPhase = "prepared" | "staging" | "native-verification" | "completed" | "failed" | "compensated" | "compensation-incomplete";
type BackupEntry = {
    path: string;
    bytes?: string;
};
export interface InstallJournal {
    format: "archie-release-install-journal-v1";
    phase: JournalPhase;
    entries: BackupEntry[];
    restoreRoots: string[];
    failure?: string;
}
/** Durable preimage for all pin/configuration inputs plus native npm/APM deployment state. */
export declare function beginInstallJournal(targetDirectory: string, skills: string[]): InstallJournal;
export declare function updateInstallJournal(targetDirectory: string, journal: InstallJournal, phase: JournalPhase, failure?: unknown): void;
/** Removes partial native outputs, restores preimages, then lets the caller validate the former pin. */
export declare function compensateInstall(targetDirectory: string, journal: InstallJournal): void;
export {};
