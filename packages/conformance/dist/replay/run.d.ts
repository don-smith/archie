export type ReplayBehavior = "regenerate" | "verify";
export type ReplaySource = {
    kind: "state";
    path: string;
} | {
    kind: "map";
    path: string;
};
export declare function replay(source: ReplaySource, behavior: ReplayBehavior, cwd?: string): void;
