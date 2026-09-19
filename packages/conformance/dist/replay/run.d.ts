export type ReplayBehavior = "regenerate" | "verify";
export type ReplaySource = {
    kind: "state";
    path: string;
} | {
    kind: "map";
    path: string;
};
interface ReplayTargets {
    graph: string;
    summary: string;
    report?: string;
}
type ReplayEvidence = {
    graph: string;
    summary: string;
    report?: string;
};
export declare function fromState(path: string, cwd: string): {
    targets: ReplayTargets;
    evidence: ReplayEvidence;
};
export declare function replay(source: ReplaySource, behavior: ReplayBehavior, cwd?: string): void;
export {};
