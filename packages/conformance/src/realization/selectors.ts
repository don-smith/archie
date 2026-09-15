import type { GraphNode } from "../formats/types.js";

export function globMatches(path: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\//g, "\u0000").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*").replace(/\u0000/g, "(?:.*/)?");
  return new RegExp(`^${escaped}$`).test(path);
}

export function matchesMapping(node: GraphNode, mapping: { path?: string; module?: string }): boolean {
  return mapping.path !== undefined ? node.file !== undefined && globMatches(node.file, mapping.path) : mapping.module !== undefined && globMatches(node.module, mapping.module);
}
