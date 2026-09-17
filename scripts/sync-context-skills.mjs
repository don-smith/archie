import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const mappings = [
  ["skills/archie", "packages/archie-context/.apm/skills/archie"],
  ["packages/assessment/skills/architecture-assessment", "packages/archie-context/.apm/skills/architecture-assessment"],
  ["packages/architecture-docs/skills/architecture-docs", "packages/archie-context/.apm/skills/architecture-docs"],
  ["packages/architecture-docs/skills/likec4-authoring", "packages/archie-context/.apm/skills/likec4-authoring"],
  ["packages/architecture-review/skills/architecture-review", "packages/archie-context/.apm/skills/architecture-review"],
  ["packages/html-design/skills/html-design", "packages/archie-context/.apm/skills/html-design"],
  ["packages/conformance/skills/architecture-conformance-onboarding", "packages/archie-context/.apm/skills/architecture-conformance-onboarding"],
  ["packages/conformance/skills/architecture-contracts", "packages/archie-context/.apm/skills/architecture-contracts"]
];
const fileMappings = [
  ["docs/archie/managed-site-guide.md", "skills/archie/references/managed-site-guide.md"],
  ["docs/archie/deep-module-vocabulary.md", "packages/assessment/skills/architecture-assessment/references/deep-module-vocabulary.md"],
  ["docs/archie/deep-module-vocabulary.md", "packages/architecture-review/skills/architecture-review/references/deep-module-vocabulary.md"],
  ["packages/archie-context/scripts/dispatch-runtime.mjs", "skills/archie/scripts/dispatch-runtime.mjs"]
];

function digestTree(root) {
  if (!existsSync(root)) return undefined;
  const files = [];
  const visit = (path) => {
    for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile()) files.push(child);
      else throw new Error(`canonical skill source contains an unsupported entry: ${child}`);
    }
  };
  if (statSync(root).isDirectory()) visit(root); else files.push(root);
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(`${relative(root, file)}\0`);
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return { fileCount: files.length, sha256: hash.digest("hex") };
}

const checking = process.argv.includes("--check");
if (!checking) {
  for (const [source, destination] of fileMappings) {
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination, { force: true, recursive: false });
  }
  for (const [source, destination] of mappings) {
    rmSync(destination, { recursive: true, force: true });
    cpSync(source, destination, { recursive: true });
  }
}

for (const [source, destination] of [...mappings, ...fileMappings]) {
  const expected = digestTree(source);
  const actual = digestTree(destination);
  if (!expected || !actual || expected.fileCount !== actual.fileCount || expected.sha256 !== actual.sha256) {
    throw new Error(`APM context skill projection differs from canonical source: ${source} -> ${destination}`);
  }
}
console.log(`Canonical APM skill projection ${checking ? "verified" : "synchronized"}.`);
