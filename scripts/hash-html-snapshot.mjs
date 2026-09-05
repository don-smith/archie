import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
const root = new URL("../packages/archie-runtime/vendor/html-design/", import.meta.url).pathname;
const list = (directory = root) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? list(join(directory, entry.name)) : [relative(root, join(directory, entry.name)).replaceAll("\\", "/")]).sort();
const files = list(); const hash = createHash("sha256");
for (const file of files) { const path = join(root, file); if (!statSync(path).isFile()) throw new Error(`Not a regular snapshot file: ${file}`); hash.update(`${file}\0`); hash.update(readFileSync(path)); hash.update("\0"); }
const provenance = {
  format: "archie-html-design-snapshot-v1", upstream: "https://github.com/don/html-design-skill", commit: "f8bc6fbf750f59caabd94ab98cb5c34fdad9cc58", sourcePath: "dist/skill/html-design", gitTree: "6ddea5582b8238392c7e6dff4adbd6f79c183edd",
  digest: { algorithm: "sha256", value: hash.digest("hex"), fileCount: files.length },
  license: { path: "LICENSE", sha256: createHash("sha256").update(readFileSync(join(root, "LICENSE"))).digest("hex") },
  requiredNotices: ["node_modules/entities/LICENSE", "node_modules/parse5/LICENSE"], importToolVersion: "archie-import-owned-sources-v1", verificationCommand: "npm run hash:html-snapshot"
};
writeFileSync(new URL("../packages/archie-runtime/vendor/html-design.provenance.json", import.meta.url), `${JSON.stringify(provenance, null, 2)}\n`);
console.log(`${provenance.digest.value} ${provenance.digest.fileCount}`);
