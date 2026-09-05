import type { PinnedTarget } from "./target-state.js";
export interface NativeCommand {
    command: "npm" | "apm";
    args: string[];
    cwd: string;
}
export interface NativeCommandResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}
export type NativeCommandRunner = (command: NativeCommand) => NativeCommandResult;
export declare const nativeRun: NativeCommandRunner;
export declare function requireNative(run: NativeCommandRunner, command: NativeCommand, label: string): NativeCommandResult;
/** npm owns lock and integrity validation; Archie checks the installed package identity afterward. */
export declare function runNpmCi(pin: PinnedTarget, run: NativeCommandRunner): void;
