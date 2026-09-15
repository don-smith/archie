export function globMatches(path, pattern) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\//g, "\u0000").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*").replace(/\u0000/g, "(?:.*/)?");
    return new RegExp(`^${escaped}$`).test(path);
}
export function matchesMapping(node, mapping) {
    return mapping.path !== undefined ? node.file !== undefined && globMatches(node.file, mapping.path) : mapping.module !== undefined && globMatches(node.module, mapping.module);
}
//# sourceMappingURL=selectors.js.map