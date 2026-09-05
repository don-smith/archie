import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export interface HtmlSnapshotDigest { algorithm: "sha256"; digest: string; fileCount: number; files: string[] }
function list(root: string, current = root): string[] {
  return readdirSync(current, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? list(root, join(current, entry.name)) : [relative(root, join(current, entry.name)).replaceAll("\\", "/")]).sort();
}
export function digestHtmlSnapshot(root: string): HtmlSnapshotDigest {
  const files = list(root); const hash = createHash("sha256");
  for (const file of files) { const path = join(root, file); if (!statSync(path).isFile()) throw new Error(`Snapshot entry is not a file: ${file}`); hash.update(`${file}\0`); hash.update(readFileSync(path)); hash.update("\0"); }
  return { algorithm: "sha256", digest: hash.digest("hex"), fileCount: files.length, files };
}
export function verifyHtmlSnapshot(root: string, expected: Pick<HtmlSnapshotDigest, "digest" | "fileCount">): HtmlSnapshotDigest {
  const actual = digestHtmlSnapshot(root);
  if (actual.digest !== expected.digest || actual.fileCount !== expected.fileCount) throw new Error(`HTML snapshot mismatch: expected ${expected.digest}/${expected.fileCount}, got ${actual.digest}/${actual.fileCount}`);
  return actual;
}

export interface HtmlSnapshotProvenance {
  format: "archie-html-design-snapshot-v1";
  upstream: string;
  commit: string;
  sourcePath: string;
  gitTree: string;
  digest: Pick<HtmlSnapshotDigest, "algorithm" | "digest" | "fileCount"> & { value?: string };
  license: { path: string; sha256: string };
  requiredNotices: string[];
  importToolVersion: string;
  verificationCommand: string;
}
export function validateHtmlSnapshotProvenance(value: unknown): asserts value is HtmlSnapshotProvenance {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("HTML snapshot provenance must be an object");
  const record = value as Record<string, unknown>;
  for (const field of ["upstream", "commit", "sourcePath", "gitTree", "importToolVersion", "verificationCommand"]) if (typeof record[field] !== "string" || !record[field]) throw new Error(`Missing HTML snapshot provenance field: ${field}`);
  if (!record.digest || typeof record.digest !== "object" || !Number.isInteger((record.digest as Record<string, unknown>).fileCount) || typeof (record.digest as Record<string, unknown>).value !== "string") throw new Error("Missing HTML snapshot digest provenance");
  if (!record.license || typeof record.license !== "object" || typeof (record.license as Record<string, unknown>).sha256 !== "string") throw new Error("Missing HTML snapshot license provenance");
  if (!Array.isArray(record.requiredNotices) || record.requiredNotices.length === 0 || !record.requiredNotices.every((notice) => typeof notice === "string")) throw new Error("Missing HTML snapshot required notices");
}
