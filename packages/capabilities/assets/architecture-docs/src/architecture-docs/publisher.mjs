import { mkdir, mkdtemp, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { ArchitectureDocsBuildError } from "./errors.mjs";

async function exists(filename) { try { await stat(filename); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; } }
export async function assertOutputOwned(destination, options = {}) {
  if (!await exists(destination)) return;
  const markerPath = options.markerPath ?? "assets/site.json";
  const outputPath = options.outputPath ?? "$.site.output";
  const artifactLabel = options.artifactLabel ?? "generated site";
  let marker;
  try { marker = JSON.parse(await readFile(path.join(destination, markerPath), "utf8")); } catch {
    throw new ArchitectureDocsBuildError(`The existing ${artifactLabel} is not owned by architecture docs.`, { code: "OUTPUT_NOT_OWNED", issues: [{ path: outputPath, message: `existing ${artifactLabel} has no valid architecture-docs ownership marker`, expected: "Move or remove the existing directory after explicit maintainer approval; force overwrite is not supported." }] });
  }
  if (marker?.ownership?.product !== "architecture-docs" || marker.ownership.generated !== true || (options.artifact && marker.ownership.artifact !== options.artifact)) {
    throw new ArchitectureDocsBuildError(`The existing ${artifactLabel} is not owned by architecture docs.`, { code: "OUTPUT_NOT_OWNED", issues: [{ path: outputPath, message: `existing ${artifactLabel} ownership marker is not recognized`, expected: "Move or remove the existing directory after explicit maintainer approval; force overwrite is not supported." }] });
  }
}
export async function createPublicationStage(destination) { const parent = path.dirname(destination); await mkdir(parent, { recursive: true }); return mkdtemp(path.join(parent, `.${path.basename(destination)}.stage-`)); }
export async function publishDirectory(stage, destination, operations = {}) {
  await assertOutputOwned(destination, operations);
  const move = operations.rename ?? rename; const remove = operations.rm ?? rm; const outputPath = operations.outputPath ?? "$.site.output"; const hadDestination = await exists(destination); const backup = `${destination}.backup-${process.pid}-${Date.now()}`; let oldMoved = false;
  try { if (hadDestination) { await move(destination, backup); oldMoved = true; } await move(stage, destination); }
  catch (cause) {
    if (oldMoved) try { await move(backup, destination); } catch (restoreCause) { throw new ArchitectureDocsBuildError("Architecture docs publication and rollback failed.", { code: "PUBLICATION_ROLLBACK_FAILED", cause: restoreCause, issues: [{ path: outputPath, message: `The previous output remains at ${backup}.`, expected: "Restore the backup manually before running another build." }] }); }
    throw new ArchitectureDocsBuildError("Architecture docs publication failed; the previous output was preserved.", { code: "PUBLICATION_FAILED", cause, issues: [{ path: outputPath, message: cause.message, expected: "Check output permissions and run the build again." }] });
  }
  if (oldMoved) await remove(backup, { recursive: true, force: true });
}
