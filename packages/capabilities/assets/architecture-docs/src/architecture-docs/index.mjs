import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadArchitectureDocsConfig } from "./config.mjs";
import { ArchitectureDocsBuildError } from "./errors.mjs";
import { compileLikeC4 } from "./likec4-compiler.mjs";
import { loadMarkdownPage } from "./page-source.mjs";
import { compilePalette } from "./palette.mjs";
import { assertOutputOwned, createPublicationStage, publishDirectory } from "./publisher.mjs";
import { renderSite } from "./render-site.mjs";
import { readHandoffSnapshot, writeHandoffBundle } from "./handoff.mjs";
import { claimDigest, claimStatus } from "./evidence-ledger.mjs";

function configuredViewIssues(config, views) {
  const ids = new Set(views.map((view) => view.id));
  const issues = [];
  const check = (viewId, fieldPath) => { if (!ids.has(viewId)) issues.push({ path: fieldPath, message: `view ${JSON.stringify(viewId)} was not compiled`, expected: "Use the ID of a named view from the configured LikeC4 workspace." }); };
  check(config.model.initialView, "$.model.initialView");
  for (const [index, page] of [["home", config.pages.home], ...config.pages.areas.map((page, index) => [`areas[${index}]`, page])]) {
    for (const [viewIndex, viewId] of page.viewIds.entries()) check(viewId, `$.pages.${index}.viewIds[${viewIndex}]`);
    const initialViewId = page.initialViewId ?? page.viewIds[0];
    if (initialViewId) check(initialViewId, `$.pages.${index}.initialViewId`);
  }
  return issues;
}
function claimIssues(config, ledger, elementIds) {
  const issues = [];
  const claimsById = new Map(ledger.claims.map((claim) => [claim.id, claim]));
  for (const claim of claimsById.values()) {
    for (const elementId of claim.targets.elements) if (!elementIds.has(elementId)) issues.push({ path: `$.claims.${claim.id}.targets.elements`, message: `claim ${claim.id} targets LikeC4 element ${elementId}, which was not compiled`, expected: "Use a model element ID from the configured LikeC4 workspace." });
  }
  return issues;
}
function pageRecord(page) { return { id: page.id, title: page.title, summary: page.summary, markdown: page.markdown, viewIds: page.viewIds, claimIds: page.claimIds, initialViewId: page.initialViewId ?? page.viewIds[0] ?? null, ...(page.slug ? { slug: page.slug } : {}) }; }

export async function buildArchitectureDocs(configPath, { handoffOnly = false } = {}) {
  const config = await loadArchitectureDocsConfig(configPath);
  const handoffDirectory = path.join(config.paths.rootDirectory, "handoff");
  const outputOptions = { markerPath: "assets/preview.json", artifactLabel: "architecture docs preview", outputPath: "$.preview.output" };
  const handoffOptions = { markerPath: "manifest.json", artifact: "handoff", artifactLabel: "architecture docs handoff", outputPath: "$.handoff.output" };
  if (!handoffOnly) await assertOutputOwned(config.paths.outputDirectory, outputOptions);
  await assertOutputOwned(handoffDirectory, handoffOptions);
  const previous = await readHandoffSnapshot(handoffDirectory);
  const temporary = await mkdtemp(path.join(tmpdir(), "architecture-docs-build-"));
  let publicationStage;
  let handoffStage;
  try {
    const palette = compilePalette(config.palette);
    const compiled = await compileLikeC4({ sourceWorkspace: config.paths.modelWorkspace, temporaryDirectory: temporary, browserRoot: config.sourceLinks.browserRoot, title: config.document.title, likec4Theme: palette.likec4Theme });
    const viewIssues = configuredViewIssues(config, compiled.views);
    const targetIssues = claimIssues(config, config.ledger, new Set(compiled.elementIds));
    if (viewIssues.length || targetIssues.length) throw new ArchitectureDocsBuildError("Configured architecture docs references are missing.", { code: viewIssues.length ? "CONFIGURED_VIEW_NOT_FOUND" : "CONFIGURED_TARGET_NOT_FOUND", issues: [...viewIssues, ...targetIssues] });
    const statuses = claimStatus(config.ledger.claims);
    const pages = [config.pages.home, ...config.pages.areas];
    const stagedPages = await Promise.all(pages.map(async (page) => ({ page, html: await loadMarkdownPage(config.paths.pagePaths[page.id]) })));
    const generatedFiles = ["index.html", ...config.pages.areas.map((page) => `${page.slug}/index.html`), "assets/likec4-views.js", "assets/views.json", "assets/preview.json"];
    const previewMetadata = {
      ownership: { product: "architecture-docs", artifact: "preview", generated: true, markerVersion: 1 },
      version: 1,
      repository: config.publicConfig.repository,
      root: config.publicConfig.root,
      model: { ...config.publicConfig.model },
      pages: pages.map(pageRecord),
      build: { compiledViewCount: compiled.views.length, pageCount: pages.length, initialView: config.model.initialView, provisionalClaimCount: statuses.filter((claim) => !claim.approved).length, generatedFiles },
    };
    if (!handoffOnly) {
      publicationStage = await createPublicationStage(config.paths.outputDirectory);
      await mkdir(path.join(publicationStage, "assets"));
      await Promise.all(config.pages.areas.map((page) => mkdir(path.join(publicationStage, page.slug), { recursive: true })));
      await Promise.all([
        copyFile(compiled.bundlePath, path.join(publicationStage, "assets", "likec4-views.js")),
        writeFile(path.join(publicationStage, "assets", "views.json"), `${JSON.stringify({ views: compiled.views }, null, 2)}\n`),
        writeFile(path.join(publicationStage, "assets", "preview.json"), `${JSON.stringify(previewMetadata, null, 2)}\n`),
        ...stagedPages.map(({ page, html }) => writeFile(page.id === config.pages.home.id ? path.join(publicationStage, "index.html") : path.join(publicationStage, page.slug, "index.html"), renderSite({ config, page, pageHtml: html, views: compiled.views, paletteCss: palette.css, claimStatuses: statuses, assetPrefix: page.id === config.pages.home.id ? "" : "../" }))),
      ]);
    }
    handoffStage = await createPublicationStage(handoffDirectory);
    await writeHandoffBundle({ destination: handoffStage, config, compiled, pages, statuses, pagePaths: config.paths.pagePaths, previous });
    if (!handoffOnly) {
      await publishDirectory(publicationStage, config.paths.outputDirectory, outputOptions);
      publicationStage = undefined;
    }
    await publishDirectory(handoffStage, handoffDirectory, handoffOptions);
    handoffStage = undefined;
    return { outputDirectory: config.paths.outputDirectory, handoffDirectory, handoffOnly, pageCount: pages.length, compiledViewCount: compiled.views.length, initialView: config.model.initialView, provisionalClaimCount: statuses.filter((claim) => !claim.approved).length, generatedFiles: handoffOnly ? ["manifest.json", "composition-guide.md", "claims.json", "page-map.json", "delta.json", "delta.md"] : generatedFiles };
  } catch (error) {
    if (error instanceof ArchitectureDocsBuildError) throw error;
    throw new ArchitectureDocsBuildError("Architecture docs build failed.", { cause: error, issues: [{ path: "$", message: error.message, expected: "Fix the authored architecture docs inputs and run the build again." }] });
  } finally {
    await rm(temporary, { recursive: true, force: true });
    if (publicationStage) await rm(publicationStage, { recursive: true, force: true });
    if (handoffStage) await rm(handoffStage, { recursive: true, force: true });
  }
}

export { claimDigest };
