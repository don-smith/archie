import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const manifest = JSON.parse(readFileSync(new URL("../source-import-manifest.json", import.meta.url)));
const workspace = new URL("..", import.meta.url).pathname;
for (const item of manifest.imports) {
  const actual = execFileSync("git", ["-C", item.repository, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (actual !== item.revision) throw new Error(`${item.id} is not at recorded revision ${item.revision}; found ${actual}`);
  const temporary = mkdtempSync(join(tmpdir(), "archie-import-"));
  const archive = join(temporary, "source.tar");
  try {
    writeFileSync(archive, execFileSync("git", ["-C", item.repository, "archive", "--format=tar", item.revision, ...item.paths]));
    execFileSync("tar", ["-xf", archive, "-C", temporary]);
    for (const source of item.paths) {
      const from = join(temporary, source);
      const to = item.id === "html-design-snapshot" ? join(workspace, item.destination) : join(workspace, item.destination, source);
      cpSync(from, to, { recursive: true, force: true });
    }
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
const assessmentSkill = join(workspace, "packages/capabilities/assets/assessment/skills/architecture-assessment/SKILL.md");
const neutralizedAssessment = readFileSync(assessmentSkill, "utf8")
  .replace("without a MyFlow workstream", "without a product workstream")
  .replace(/1\. Resolve the loaded `myflow` skill directory from the available-skills metadata\. Run:\n\n   ```text\n   node <myflow-skill-dir>\/scripts\/resolve-repository-map\.mjs discover --cwd <git-root>\n   ```\n\n2\. Read the selected repository map when found, then/, "1. Inspect repository-local instructions, the supplied artifact, and its linked intent, design, research, glossary, decision, and architecture sources.\n2. Then")
  .replace("3. Read `git status --short`. Record the selected repository map and current Git state.", "3. Read `git status --short`. Record applicable repository instructions and current Git state.");
writeFileSync(assessmentSkill, neutralizedAssessment);
writeFileSync(join(workspace, "packages/capabilities/assets/IMPORTS.json"), `${JSON.stringify({ format: manifest.format, productVersion: manifest.productVersion, imports: manifest.imports.filter((item) => item.id !== "html-design-snapshot"), excluded: manifest.excluded }, null, 2)}\n`);
console.log(`Imported ${manifest.imports.length} reviewed source inputs from immutable revisions.`);
