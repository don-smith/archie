import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { cp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LikeC4 } from "likec4";
import { ArchitectureDocsBuildError } from "./errors.mjs";
import { rewriteSourceLinksInWorkspace } from "./source-links.mjs";
import { buildViewMetadata } from "./view-metadata.mjs";
import { buildViewSemantics } from "./view-semantics.mjs";

const projectRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const require = createRequire(import.meta.url);
const likec4PackagePath = require.resolve("likec4/package.json");
const likec4Package = require(likec4PackagePath);
const likec4Version = likec4Package.version;

export function resolveLikeC4Command() {
  const bin = typeof likec4Package.bin === "string" ? likec4Package.bin : likec4Package.bin.likec4;
  return {
    executable: process.execPath,
    arguments: [path.resolve(path.dirname(likec4PackagePath), bin)],
  };
}

function compilerFailure(result) {
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  return new ArchitectureDocsBuildError("LikeC4 compilation failed.", {
    code: "LIKEC4_COMPILATION_FAILED",
    issues: [{
      path: "$.model.workspace",
      message: output || `LikeC4 exited with status ${result.status}.`,
      expected: "Fix the LikeC4 model errors and run the build again.",
    }],
  });
}

export async function compileLikeC4({
  sourceWorkspace,
  temporaryDirectory,
  browserRoot,
  title,
  likec4Theme,
}) {
  const workspaceDirectory = path.join(temporaryDirectory, "workspace");
  const buildDirectory = path.join(temporaryDirectory, "compiled");
  await cp(sourceWorkspace, workspaceDirectory, { recursive: true });
  await rewriteSourceLinksInWorkspace(workspaceDirectory, browserRoot);
  await writeFile(
    path.join(workspaceDirectory, "likec4.config.json"),
    `${JSON.stringify({
      $schema: "https://likec4.dev/schemas/config.json",
      name: "architecture-docs",
      title,
      styles: { theme: likec4Theme },
    }, null, 2)}\n`,
  );

  const likec4Command = resolveLikeC4Command();
  const result = spawnSync(
    likec4Command.executable,
    [
      ...likec4Command.arguments,
      "build",
      workspaceDirectory,
      "--output",
      buildDirectory,
      "--base",
      "./",
      "--use-hash-history",
      "--build-webcomponent",
      "--title",
      title,
    ],
    { cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.error) {
    throw new ArchitectureDocsBuildError("LikeC4 could not be started.", {
      code: "LIKEC4_COMPILER_UNAVAILABLE",
      cause: result.error,
      issues: [{ path: "$.model.workspace", message: result.error.message, expected: "Install project dependencies and run the build again." }],
    });
  }
  if (result.status !== 0) throw compilerFailure(result);

  // Keep the generated publication artifact diff-friendly. These spaces are
  // compiler formatting, not diagram semantics.
  const bundlePath = path.join(buildDirectory, "likec4-views.js");
  const bundle = await readFile(bundlePath, "utf8");
  await writeFile(bundlePath, bundle.replace(/[ \t]+$/gm, ""));

  const workspace = await LikeC4.fromWorkspace(workspaceDirectory, { logger: false, graphviz: "wasm" });
  try {
    if (workspace.hasErrors()) {
      const issues = workspace.getErrors().map((error) => ({
        path: error.sourceFsPath ? path.relative(workspaceDirectory, error.sourceFsPath) : "$.model.workspace",
        message: error.message ?? "LikeC4 model is invalid.",
        expected: "Fix the LikeC4 model error and run the build again.",
      }));
      throw new ArchitectureDocsBuildError("LikeC4 model inspection failed.", {
        code: "LIKEC4_MODEL_INVALID",
        issues,
      });
    }
    const model = await workspace.layoutedModel();
    const semanticData = buildViewSemantics(model);
    const views = buildViewMetadata(model, new Map(semanticData.views.map((view) => [view.id, view.semanticDigest])));
    const elementIds = [...new Set(views.flatMap((view) => {
      const source = [...model.views()].find((candidate) => candidate.id === view.id);
      return source?.$view?.nodes?.map((node) => node.modelRef).filter(Boolean) ?? [];
    }))];
    return {
      bundlePath: path.join(buildDirectory, "likec4-views.js"),
      views,
      elementIds,
      semanticData,
      likec4Version,
    };
  } finally {
    await workspace.dispose();
  }
}
