import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

function walk(source) {
  if (statSync(source).isFile()) return source.endsWith(".test.mjs") ? [source] : [];
  return readdirSync(source, { withFileTypes: true }).flatMap((entry) => {
    const child = `${source}/${entry.name}`;
    return entry.isDirectory() ? walk(child) : entry.name.endsWith(".test.mjs") ? [child] : [];
  });
}

const requested = process.argv.slice(2);
const roots = requested.length ? requested : ["test", "packages/assessment/test", "packages/architecture-docs/test", "packages/html-design/test", "packages/architecture-review/test"];
const files = roots.flatMap(walk).map((file) => resolve(file)).sort();
if (!files.length) throw new Error(`No tests found for: ${roots.join(", ")}`);

const assessmentRoot = resolve("packages/assessment");
const conformanceRoot = resolve("packages/conformance");
const architectureDocsRoot = resolve("packages/architecture-docs");
const htmlDesignRoot = resolve("packages/html-design");
const architectureReviewRoot = resolve("packages/architecture-review");
const assessmentTests = files.filter((file) => file.startsWith(`${assessmentRoot}/`));
const architectureDocsTests = files.filter((file) => file.startsWith(`${architectureDocsRoot}/`));
const htmlDesignTests = files.filter((file) => file.startsWith(`${htmlDesignRoot}/`));
const architectureReviewTests = files.filter((file) => file.startsWith(`${architectureReviewRoot}/`));
const productTests = files.filter((file) => ![assessmentRoot, architectureDocsRoot, htmlDesignRoot, architectureReviewRoot].some((root) => file.startsWith(`${root}/`)));

function run(group, cwd) {
  if (!group.length) return 0;
  const paths = group.map((file) => relative(cwd, file));
  return spawnSync(process.execPath, ["--test", ...paths], { cwd, stdio: "inherit" }).status ?? 1;
}

const productStatus = run(productTests, process.cwd());
const assessmentStatus = productStatus === 0 ? run(assessmentTests, assessmentRoot) : 1;
const conformanceStatus = productStatus === 0 && assessmentStatus === 0
  ? spawnSync("npm", ["run", "test:compiled"], { cwd: conformanceRoot, stdio: "inherit" }).status ?? 1
  : 1;
const architectureDocsStatus = productStatus === 0 && assessmentStatus === 0 && conformanceStatus === 0 ? run(architectureDocsTests, architectureDocsRoot) : 1;
const htmlDesignStatus = architectureDocsStatus === 0 ? run(htmlDesignTests, htmlDesignRoot) : 1;
const architectureReviewStatus = htmlDesignStatus === 0 ? run(architectureReviewTests, architectureReviewRoot) : 1;
process.exit(productStatus || assessmentStatus || conformanceStatus || architectureDocsStatus || htmlDesignStatus || architectureReviewStatus);
