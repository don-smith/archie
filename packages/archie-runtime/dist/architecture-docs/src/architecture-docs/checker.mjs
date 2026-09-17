import { access, readFile, stat } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadArchitectureDocsConfig } from "./config.mjs";
import { ArchitectureDocsBuildError } from "./errors.mjs";
import { assertPageMapApproval, claimDigest, claimStatus, pageMapDigest } from "./evidence-ledger.mjs";
import { assertOutputOwned } from "./publisher.mjs";
import { buildCompositionGuide } from "./composition-guide.mjs";
import { compileLikeC4 } from "./likec4-compiler.mjs";
import { compilePalette } from "./palette.mjs";
import { calculateHandoffDigest, sha256 } from "./handoff.mjs";
import { evaluateArchieDocumentation, isActiveArchieDocumentationPage, isArchieDocumentationActive } from "./archie-documentation.mjs";
import { loadArchitectureStatus } from "./architecture-status.mjs";

const HOME_TOPICS = ["purpose", "actors", "boundary", "runtime-unit", "flow", "domain-language", "pattern", "navigation"];
const allPages = (config) => [config.pages.home, ...config.pages.areas];
const diagnostic = (path_, message, expected, code = undefined) => ({ path: path_, message, expected, ...(code ? { code } : {}) });
function requiredClaimDiagnostics(page, claims, topics, path_) {
  const attached = claims.filter((claim) => page.claimIds.includes(claim.id) && claim.approved && claim.review.state === "approved");
  return topics.filter((topic) => !attached.some((claim) => claim.topics.includes(topic))).map((topic) => diagnostic(path_, `has no approved claim for topic ${JSON.stringify(topic)}`, "Add an evidence-backed claim, explicitly review it, and attach it to this page."));
}
function jsonBytes(value) { return Buffer.from(`${JSON.stringify(value, null, 2)}\n`); }
function handoffPageMap(config, architectureStatus = { configured: false }) {
  const pages = allPages(config);
  const record = (page) => ({ id: page.id, title: page.title, summary: page.summary, markdown: `pages/${page.id}.md`, viewIds: page.viewIds, claimIds: page.claimIds, initialViewId: page.initialViewId ?? page.viewIds[0] ?? null, ...(page.slug ? { slug: page.slug } : {}) });
  return {
    version: architectureStatus.configured ? 2 : 1,
    home: record(pages[0]),
    areas: pages.slice(1).map(record),
    ...(architectureStatus.configured ? { status: { id: "architecture-status", title: "Architecture status", route: "architecture-status/index.html", kind: "generated", availability: architectureStatus.snapshot ? "present" : "missing" } } : {}),
  };
}
function handoffClaims(config) {
  return { version: config.ledger.version, inventory: config.ledger.inventory, claims: config.ledger.claims, pageMapReview: config.ledger.pageMapReview };
}
async function readJson(filename) { return JSON.parse(await readFile(filename, "utf8")); }
async function exists(filename) { try { await stat(filename); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; } }
async function archiePreviewWarnings(config) {
  const archieAreas = config.pages.areas.filter((area) => area.id === "archie");
  let pageText;
  if (archieAreas.length === 1) {
    try { pageText = await readFile(path.join(config.paths.outputDirectory, archieAreas[0].slug, "index.html"), "utf8"); } catch {}
  }
  return evaluateArchieDocumentation({
    configDirectory: path.dirname(config.configPath),
    areas: config.pages.areas,
    pageText,
  });
}

async function freshnessDiagnostics(config, handoffDirectory, architectureStatus) {
  const diagnostics = [];
  let manifest;
  try { manifest = await readJson(path.join(handoffDirectory, "manifest.json")); }
  catch { return [diagnostic("$.handoff.manifest", "handoff manifest could not be read", "Run the architecture docs build before checking publication.", "HANDOFF_STALE")]; }
  const stale = (field, message) => diagnostics.push(diagnostic(`$.handoff.${field}`, message, "Rebuild the handoff from the current authored architecture inputs.", "HANDOFF_STALE"));
  if (architectureStatus.snapshot) {
    const currentStatusDigest = sha256(jsonBytes(architectureStatus.snapshot));
    if (manifest.digests?.architectureStatus !== currentStatusDigest) stale("digests.architectureStatus", "status digest does not match the current configured snapshot");
  } else if (manifest.digests?.architectureStatus) {
    stale("digests.architectureStatus", "handoff contains a status digest but the configured snapshot is unavailable");
  }
  const expectedClaims = handoffClaims(config);
  const expectedPageMap = handoffPageMap(config, architectureStatus);
  if (manifest.digests?.claims !== sha256(jsonBytes(expectedClaims))) stale("digests.claims", "claims digest does not match the current evidence ledger");
  if (manifest.digests?.pageMap !== sha256(jsonBytes(expectedPageMap))) stale("digests.pageMap", "page-map digest does not match the current configuration");
  const archieDocumentationActive = await isArchieDocumentationActive(path.dirname(config.configPath));
  const guideBytes = Buffer.from(buildCompositionGuide({
    archiePage: expectedPageMap.areas.find((page) => isActiveArchieDocumentationPage(archieDocumentationActive, page)),
  }));
  if (manifest.digests?.guide !== sha256(guideBytes)) stale("digests.guide", "composition guide digest does not match the generated guide");
  for (const page of allPages(config)) {
    try {
      const bytes = await readFile(config.paths.pagePaths[page.id]);
      if (manifest.digests?.pages?.[page.id] !== sha256(bytes)) stale(`digests.pages.${page.id}`, `Markdown digest for ${page.id} does not match the authored page`);
    } catch { stale(`pages.${page.id}`, `Markdown source for ${page.id} could not be read`); }
  }
  const configuredSupplementalInputs = config.supplementalInputs ?? [];
  const recordedSupplementalInputs = manifest.supplementalInputs ?? [];
  if (configuredSupplementalInputs.length !== recordedSupplementalInputs.length) stale("supplementalInputs", "supplemental input declarations do not match the handoff manifest");
  for (const [index, input] of configuredSupplementalInputs.entries()) {
    const recorded = recordedSupplementalInputs[index];
    const field = `supplementalInputs[${index}]`;
    if (!recorded || recorded.id !== input.id || recorded.source !== input.source || recorded.destination !== input.destination) {
      stale(field, "supplemental input declaration does not match the handoff manifest"); continue;
    }
    try {
      const sourceBytes = await readFile(config.paths.supplementalInputs[index].sourcePath);
      const sourceDigest = sha256(sourceBytes);
      if (recorded.sha256 !== sourceDigest) stale(field, "supplemental input digest does not match the authored source");
      const copiedBytes = await readFile(path.join(handoffDirectory, recorded.destination));
      if (sha256(copiedBytes) !== recorded.sha256) stale(field, "copied supplemental input digest does not match the handoff manifest");
    } catch { stale(field, "supplemental input source or copied handoff file could not be read"); }
  }
  const handoffDigest = calculateHandoffDigest(manifest);
  if (manifest.digests?.handoff !== handoffDigest) stale("digests.handoff", "handoff manifest digest is internally inconsistent");

  const temporary = await mkdtemp(path.join(tmpdir(), "architecture-docs-check-"));
  try {
    let compiled;
    try {
      const palette = compilePalette(config.palette);
      compiled = await compileLikeC4({ sourceWorkspace: config.paths.modelWorkspace, temporaryDirectory: temporary, browserRoot: config.sourceLinks.browserRoot, title: config.document.title, likec4Theme: palette.likec4Theme });
    } catch (error) {
      diagnostics.push(diagnostic("$.handoff.semantics", error.message, "Fix the current LikeC4 model and rebuild the handoff.", "HANDOFF_RECOMPUTE_FAILED"));
      return diagnostics;
    }
    if (manifest.digests?.model !== compiled.semanticData.modelDigest) stale("digests.model", "model semantic digest does not match the compiled model");
    if (manifest.digests?.workspace !== compiled.semanticData.workspaceDigest) stale("digests.workspace", "workspace semantic digest does not match the compiled views");
    for (const view of compiled.views) {
      if (manifest.semantics?.views?.[view.id] !== view.semanticDigest) stale(`semantics.views.${view.id}`, `view ${view.id} semantic digest does not match the current model`);
    }
    for (const viewId of Object.keys(manifest.semantics?.views ?? {})) {
      if (!compiled.views.some((view) => view.id === viewId)) stale(`semantics.views.${viewId}`, `view ${viewId} no longer exists in the current model`);
    }
  } finally { await rm(temporary, { recursive: true, force: true }); }
  return diagnostics;
}

async function receiptDiagnostics(config, handoffDirectory) {
  const siteDirectory = path.join(config.paths.rootDirectory, "site");
  if (!await exists(siteDirectory)) return [];
  const receiptPath = path.join(siteDirectory, "assets", "architecture-handoff.json");
  try {
    const receipt = await readJson(receiptPath);
    const manifest = await readJson(path.join(handoffDirectory, "manifest.json"));
    const diagnostics = [];
    if (receipt?.ownership?.product !== "html-design" || receipt.ownership.generated !== true) diagnostics.push(diagnostic("$.site.receipt.ownership", "final site receipt is missing the html-design ownership marker", "Write site/assets/architecture-handoff.json with the documented final-site ownership metadata."));
    if (receipt.architectureHandoffDigest !== manifest.digests?.handoff) diagnostics.push(diagnostic("$.site.receipt.architectureHandoffDigest", "final site was composed from a stale handoff", "Recompose the final site and record the current handoff digest in its receipt."));
    if (receipt.architectureHandoffSchema !== manifest.version) diagnostics.push(diagnostic("$.site.receipt.architectureHandoffSchema", "final site receipt uses an incompatible handoff schema", "Record the current manifest.version in the receipt."));
    return diagnostics;
  } catch { return [diagnostic("$.site.receipt", "final site exists but has no valid architecture handoff receipt", "Compose the final site from the handoff and write site/assets/architecture-handoff.json.")]; }
}

export async function checkArchitectureDocs(configPath, { mode = "preview" } = {}) {
  if (!["preview", "publication"].includes(mode)) throw new TypeError(`Unknown architecture docs check mode: ${mode}`);
  const config = await loadArchitectureDocsConfig(configPath);
  const architectureStatus = await loadArchitectureStatus(config);
  const statuses = claimStatus(config.ledger.claims);
  const diagnostics = [];
  const pages = allPages(config);
  const mapApproval = assertPageMapApproval(config.ledger, pages);
  if (mode === "publication" && !mapApproval.ok) diagnostics.push(diagnostic("$.pageMapReview", mapApproval.message, "Review the ordered page map and record its current digest."));
  for (const page of pages) for (const claimId of page.claimIds) {
    const claim = statuses.find((entry) => entry.id === claimId);
    if (claim?.review.state === "rejected") diagnostics.push(diagnostic(`$.pages.${page.id}.claimIds`, `references rejected claim ${JSON.stringify(claimId)}`, "Remove the claim from the page or resolve and re-review it."));
  }
  if (mode === "publication") {
    diagnostics.push(...requiredClaimDiagnostics(config.pages.home, statuses, HOME_TOPICS, "$.pages.home.claimIds"));
    for (const [index, page] of config.pages.areas.entries()) {
      diagnostics.push(...requiredClaimDiagnostics(page, statuses, ["responsibility"], `$.pages.areas[${index}].claimIds`));
      if (page.viewIds.length > 0 && !page.claimIds.some((id) => statuses.find((claim) => claim.id === id)?.approved && statuses.find((claim) => claim.id === id)?.topics.some((topic) => ["interface", "flow"].includes(topic)))) diagnostics.push(diagnostic(`$.pages.areas[${index}].claimIds`, "has no approved interface or flow claim", "Attach an approved interface or flow claim to this area page."));
    }
  }
  const outputOptions = { markerPath: "assets/preview.json", artifactLabel: "architecture docs preview", outputPath: "$.preview.output" };
  try { await assertOutputOwned(config.paths.outputDirectory, outputOptions); } catch (error) { diagnostics.push(...(error.issues ?? [diagnostic("$.preview.output", error.message, "Move or remove the unowned preview after explicit approval.")])); }
  try { if (!(await stat(config.paths.outputDirectory)).isDirectory()) throw new Error(); } catch { diagnostics.push(diagnostic("$.preview.output", "generated preview does not exist", "Run the architecture docs build before checking publication.")); }
  const handoffDirectory = path.join(config.paths.rootDirectory, "handoff");
  const handoffOptions = { markerPath: "manifest.json", artifact: "handoff", artifactLabel: "architecture docs handoff", outputPath: "$.handoff.output" };
  try { await assertOutputOwned(handoffDirectory, handoffOptions); } catch (error) { diagnostics.push(...(error.issues ?? [diagnostic("$.handoff.output", error.message, "Move or remove the unowned handoff after explicit approval.")])); }
  for (const filename of ["manifest.json", "composition-guide.md", "claims.json", "page-map.json", "delta.json", "delta.md", "assets/views.json", "assets/likec4-views.js"]) {
    try { await access(path.join(handoffDirectory, filename)); } catch { diagnostics.push(diagnostic(`$.handoff.${filename}`, "handoff file is missing", "Run the architecture docs build before checking the handoff.")); }
  }
  for (const page of pages) {
    const filename = page.id === config.pages.home.id ? path.join(config.paths.outputDirectory, "index.html") : path.join(config.paths.outputDirectory, page.slug, "index.html");
    try { await access(filename); } catch { diagnostics.push(diagnostic(`$.pages.${page.id}`, "generated preview route is missing", "Rebuild the architecture docs preview.")); }
  }
  if (architectureStatus.configured) {
    try { await access(path.join(config.paths.outputDirectory, "architecture-status", "index.html")); } catch { diagnostics.push(diagnostic("$.architectureStatus", "generated architecture status route is missing", "Rebuild the architecture docs preview.")); }
    if (mode === "publication") {
      try {
        const manifest = await readJson(path.join(handoffDirectory, "manifest.json"));
        if (manifest.version !== 2) diagnostics.push(diagnostic("$.handoff.architectureStatus", "handoff v2 status record is missing", "Rebuild the architecture docs handoff with architectureStatus configured."));
        if (architectureStatus.snapshot) {
          if (manifest.files?.architectureStatus !== "architecture-status.json") diagnostics.push(diagnostic("$.handoff.architectureStatus", "handoff status snapshot path is missing", "Rebuild the architecture docs handoff."));
          const statusBytes = await readFile(path.join(handoffDirectory, "architecture-status.json"));
          if (manifest.digests?.architectureStatus !== sha256(statusBytes)) diagnostics.push(diagnostic("$.handoff.digests.architectureStatus", "handoff status digest is inconsistent", "Rebuild the architecture docs handoff."));
        } else if (manifest.files?.architectureStatus || manifest.digests?.architectureStatus) {
          diagnostics.push(diagnostic("$.handoff.architectureStatus", "missing status snapshots must not be copied into the handoff", "Rebuild the architecture docs handoff without architecture-status.json."));
        }
      } catch { diagnostics.push(diagnostic("$.handoff.architectureStatus", "handoff manifest could not be read", "Rebuild the architecture docs handoff.")); }
    }
  }
  if (mode === "publication") {
    diagnostics.push(...await freshnessDiagnostics(config, handoffDirectory, architectureStatus));
    diagnostics.push(...await receiptDiagnostics(config, handoffDirectory));
  }
  const warnings = await archiePreviewWarnings(config);
  return { mode, ok: diagnostics.length === 0, diagnostics, warnings, warningCount: warnings.length, provisionalClaimCount: statuses.filter((claim) => !claim.approved).length, pageMapDigest: pageMapDigest(pages), claimDigests: Object.fromEntries(statuses.map((claim) => [claim.id, claimDigest(claim)])) };
}
export function assertPublication(report) {
  if (report.diagnostics.length > 0) throw new ArchitectureDocsBuildError("Architecture docs publication checks failed.", { code: "PUBLICATION_CHECK_FAILED", issues: report.diagnostics });
  return report;
}
