import { buildReleaseBundle, finalizeRelease } from "@archie/runtime/release";

function usage(): never {
  throw new Error([
    "Usage:",
    "  archie-release build --bundle <output-directory> --ref <version-tag-or-40-character-commit> [--workspace <checkout>] [--locator <git-ssh-url>] [--path <subfolder>]",
    "  archie-release finalize --bundle <local-directory> --source-commit <40-character-git-commit>",
    "Private local bundles establish consistency only; signing, public-release trust, controller distribution, and key operations are deferred."
  ].join("\n"));
}

const DEFAULT_LOCATOR = "git@github.com:don-smith/archie.git";
const DEFAULT_CONTEXT_PATH = "packages/archie-context";

const args = process.argv.slice(2);
if (args[0] !== "finalize" && args[0] !== "build") usage();
const value = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

if (args[0] === "build") {
  const output = value("--bundle");
  const ref = value("--ref");
  if (!output || !ref) usage();
  const built = buildReleaseBundle({
    bundleDirectory: output,
    workspaceRoot: value("--workspace") ?? process.cwd(),
    locator: value("--locator") ?? DEFAULT_LOCATOR,
    ref,
    path: value("--path") ?? DEFAULT_CONTEXT_PATH
  });
  console.log(`Built bundle input for archie@${built.version}`);
  console.log(`Bundle: ${built.bundleDirectory}`);
  console.log(`Artifacts: ${built.artifacts.map(artifact => artifact.package).join(", ")}`);
  console.log(`APM context: ${built.apm.package}@${built.apm.resolvedCommit} (${built.apm.contentHash})`);
  console.log("Not finalized: run archie-release finalize to produce the release record.");
  process.exit(0);
}

const bundleDirectory = value("--bundle");
const sourceCommit = value("--source-commit");
if (!bundleDirectory || !sourceCommit) usage();
const result = finalizeRelease({ bundleDirectory, sourceCommit });
console.log(`Finalized ${result.record.product}@${result.record.version}`);
console.log(`Record: ${result.recordPath}`);
console.log(`Receipt: ${result.receiptPath}`);
console.log("Archie authorization: NOT ASSESSED — locally reviewed private release selected.");
