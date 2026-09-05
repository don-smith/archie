import { relative, resolve, sep } from "node:path";

export function repositoryPath(repositoryRoot: string, path: string): string | undefined {
  const value = relative(resolve(repositoryRoot), resolve(path));
  if (value === "" || value.startsWith(`..${sep}`) || value === "..") return undefined;
  return value.split(sep).join("/");
}

export function canonicalModule(path: string): string {
  return path.replace(/\.(?:tsx?|mts|cts)$/, "");
}
