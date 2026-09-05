import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
function list(root, current = root) {
    return readdirSync(current, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? list(root, join(current, entry.name)) : [relative(root, join(current, entry.name)).replaceAll("\\", "/")]).sort();
}
export function digestHtmlSnapshot(root) {
    const files = list(root);
    const hash = createHash("sha256");
    for (const file of files) {
        const path = join(root, file);
        if (!statSync(path).isFile())
            throw new Error(`Snapshot entry is not a file: ${file}`);
        hash.update(`${file}\0`);
        hash.update(readFileSync(path));
        hash.update("\0");
    }
    return { algorithm: "sha256", digest: hash.digest("hex"), fileCount: files.length, files };
}
export function verifyHtmlSnapshot(root, expected) {
    const actual = digestHtmlSnapshot(root);
    if (actual.digest !== expected.digest || actual.fileCount !== expected.fileCount)
        throw new Error(`HTML snapshot mismatch: expected ${expected.digest}/${expected.fileCount}, got ${actual.digest}/${actual.fileCount}`);
    return actual;
}
export function validateHtmlSnapshotProvenance(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("HTML snapshot provenance must be an object");
    const record = value;
    for (const field of ["upstream", "commit", "sourcePath", "gitTree", "importToolVersion", "verificationCommand"])
        if (typeof record[field] !== "string" || !record[field])
            throw new Error(`Missing HTML snapshot provenance field: ${field}`);
    if (!record.digest || typeof record.digest !== "object" || !Number.isInteger(record.digest.fileCount) || typeof record.digest.value !== "string")
        throw new Error("Missing HTML snapshot digest provenance");
    if (!record.license || typeof record.license !== "object" || typeof record.license.sha256 !== "string")
        throw new Error("Missing HTML snapshot license provenance");
    if (!Array.isArray(record.requiredNotices) || record.requiredNotices.length === 0 || !record.requiredNotices.every((notice) => typeof notice === "string"))
        throw new Error("Missing HTML snapshot required notices");
}
//# sourceMappingURL=verify.js.map