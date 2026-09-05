import { finalizeRelease } from "@archie/runtime";
import { dirname, join } from "node:path";
function usage() {
    throw new Error("Usage: archie-release finalize --bundle <local-directory> --source-commit <40-character-git-commit> [--html-provenance <path>]\nPrivate local bundles establish consistency only; signing, public-release trust, controller distribution, and key operations are deferred.");
}
const args = process.argv.slice(2);
if (args[0] !== "finalize")
    usage();
const value = (name) => {
    const index = args.indexOf(name);
    return index === -1 ? undefined : args[index + 1];
};
const bundleDirectory = value("--bundle");
const sourceCommit = value("--source-commit");
if (!bundleDirectory || !sourceCommit)
    usage();
const runtimeEntry = new URL(import.meta.resolve("@archie/runtime"));
const defaultProvenance = join(dirname(dirname(runtimeEntry.pathname)), "vendor", "html-design.provenance.json");
const result = finalizeRelease({ bundleDirectory, sourceCommit, htmlProvenancePath: value("--html-provenance") ?? defaultProvenance });
console.log(`Finalized ${result.record.product}@${result.record.version}`);
console.log(`Record: ${result.recordPath}`);
console.log(`Receipt: ${result.receiptPath}`);
console.log("Archie authorization: NOT ASSESSED — locally reviewed private release selected.");
//# sourceMappingURL=release-cli.js.map