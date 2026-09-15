import type { GraphNode } from "../formats/types.js";
export declare function globMatches(path: string, pattern: string): boolean;
export declare function matchesMapping(node: GraphNode, mapping: {
    path?: string;
    module?: string;
}): boolean;
