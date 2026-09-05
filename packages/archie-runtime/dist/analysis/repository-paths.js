import { relative, resolve, sep } from "node:path";
export function repositoryPath(repositoryRoot, path) {
    const value = relative(resolve(repositoryRoot), resolve(path));
    if (value === "" || value.startsWith(`..${sep}`) || value === "..")
        return undefined;
    return value.split(sep).join("/");
}
export function canonicalModule(path) {
    return path.replace(/\.(?:tsx?|mts|cts)$/, "");
}
//# sourceMappingURL=repository-paths.js.map