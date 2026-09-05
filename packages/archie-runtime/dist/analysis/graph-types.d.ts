export type EdgeKind = "runtime" | "type";
export interface Span {
    file: string;
    start: {
        line: number;
        column: number;
    };
    end: {
        line: number;
        column: number;
    };
}
export interface SourceScope {
    rootConfigs: string[];
    include: string[];
    exclusions: Array<{
        path: string;
        reason: string;
    }>;
}
export interface Gap {
    kind: string;
    message: string;
    file?: string;
    span?: Span;
}
export interface GraphNode {
    id: string;
    kind: "source-module" | "external-module";
    module: string;
    file?: string;
}
export interface GraphEdge {
    id: string;
    source: string;
    target?: string;
    kind: EdgeKind;
    specifier: string;
    status: "resolved" | "unresolved";
    span: Span;
}
export interface NormalizedGraphV1 {
    version: "normalized-graph/v1";
    scope?: SourceScope;
    nodes: GraphNode[];
    edges: GraphEdge[];
    exclusions: Array<{
        path: string;
        reason: string;
    }>;
    gaps: Gap[];
    provenance: {
        adapter: "typescript-program-v1";
        compilerVersion: string;
        rootConfigs: string[];
        sourceFiles: string[];
        resolutionInputs: string[];
        compilerOptions: Record<string, string | boolean | number>;
    };
}
