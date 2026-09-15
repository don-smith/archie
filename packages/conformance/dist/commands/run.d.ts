export interface CliRun {
    code: number;
    stdout: string;
    stderr: string;
}
export declare function runCli(argv: string[], cwd?: string): CliRun;
