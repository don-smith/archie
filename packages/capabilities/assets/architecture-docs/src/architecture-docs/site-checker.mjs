import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { loadArchitectureDocsConfig } from "./config.mjs";
import { loadArchitectureStatus } from "./architecture-status.mjs";
import { calculateHandoffDigest, sha256 } from "./handoff.mjs";
const requireDigest = (bytes) => sha256(bytes);

function diagnostic(path_, message, expected, code = undefined) {
  return { path: path_, message, expected, ...(code ? { code } : {}) };
}

async function exists(filename) {
  try {
    await stat(filename);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function attribute(source, name) {
  const match = new RegExp(`\\b${name}=["']([^"']*)["']`, "i").exec(source);
  return match?.[1] ?? null;
}

function firstTag(source, tag) {
  return source.match(new RegExp(`<${tag}\\b[^>]*>`, "i"))?.[0] ?? "";
}

function pageRoute(config, page) {
  return page.id === config.pages.home.id ? "index.html" : path.join(page.slug, "index.html");
}

function generatedStatusPageRecord(availability) {
  return { id: "architecture-status", title: "Architecture status", route: "architecture-status/index.html", kind: "generated", availability };
}

export async function checkFinalSite(configPath) {
  const config = await loadArchitectureDocsConfig(configPath);
  const architectureStatus = await loadArchitectureStatus(config);
  const siteDirectory = path.join(config.paths.rootDirectory, "site");
  const handoffDirectory = path.join(config.paths.rootDirectory, "handoff");
  const diagnostics = [];
  const add = (path_, message, expected, code) => diagnostics.push(diagnostic(path_, message, expected, code));

  if (!await exists(siteDirectory)) {
    add("$.site", "final site does not exist", "Compose site/ with html-design before running the final-site check.", "SITE_MISSING");
    return { ok: false, diagnostics, pageCount: 0 };
  }

  let manifest;
  try {
    manifest = JSON.parse(await readFile(path.join(handoffDirectory, "manifest.json"), "utf8"));
  } catch {
    add("$.handoff.manifest", "handoff manifest could not be read", "Build the architecture handoff before checking the final site.", "HANDOFF_MISSING");
  }

  let receipt;
  try {
    receipt = JSON.parse(await readFile(path.join(siteDirectory, "assets", "architecture-handoff.json"), "utf8"));
  } catch {
    add("$.site.receipt", "final site has no valid architecture handoff receipt", "Write site/assets/architecture-handoff.json from the current handoff manifest.", "SITE_RECEIPT_MISSING");
  }
  if (receipt && manifest) {
    if (receipt.ownership?.product !== "html-design" || receipt.ownership?.generated !== true) add("$.site.receipt.ownership", "receipt is missing the html-design ownership marker", "Set ownership.product to html-design and ownership.generated to true.");
    if (receipt.architectureHandoffDigest !== manifest.digests?.handoff) add("$.site.receipt.architectureHandoffDigest", "final site was composed from a stale handoff", "Recompose the final site and record manifest.digests.handoff.", "SITE_STALE");
    if (receipt.architectureHandoffSchema !== manifest.version) add("$.site.receipt.architectureHandoffSchema", "receipt uses an incompatible handoff schema", "Record manifest.version in the receipt.");
  }

  let views;
  try {
    views = JSON.parse(await readFile(path.join(siteDirectory, "assets/views.json"), "utf8")).views;
  } catch {
    add("$.site.assets.views", "final site is missing assets/views.json", "Copy the handoff view manifest into the final site's local assets.", "SITE_ASSET_MISSING");
    views = [];
  }
  const viewIds = new Set(views.map((view) => view.id));
  const pages = [config.pages.home, ...config.pages.areas];
  if (config.architectureStatus) {
    const statusRoute = path.join(siteDirectory, "architecture-status", "index.html");
    if (!await exists(statusRoute)) add("$.site.architectureStatus", "final site architecture status route is missing", "Compose architecture-status/index.html from the handoff status record.", "SITE_STATUS_ROUTE_MISSING");
    const snapshotAvailable = Boolean(architectureStatus.snapshot);
    if (manifest?.version !== 2) add("$.handoff.version", "configured architecture status requires handoff version 2", "Build handoff v2 with architecture status configured.", "SITE_STATUS_HANDOFF_VERSION_MISMATCH");
    if (snapshotAvailable) {
      const currentStatusDigest = requireDigest(Buffer.from(`${JSON.stringify(architectureStatus.snapshot, null, 2)}\n`));
      if (manifest?.digests?.architectureStatus !== currentStatusDigest) add("$.handoff.digests.architectureStatus", "handoff status digest does not match the current configured snapshot", "Rebuild the handoff from the current architecture status snapshot.", "SITE_STALE");
    } else if (manifest?.digests?.architectureStatus) {
      add("$.handoff.digests.architectureStatus", "handoff contains a status digest but the configured snapshot is unavailable", "Rebuild the handoff without a status snapshot.", "SITE_STALE");
    }
    let pageMap;
    try {
      pageMap = JSON.parse(await readFile(path.join(handoffDirectory, "page-map.json"), "utf8"));
    } catch {
      add("$.handoff.pageMap", "handoff page map could not be read", "Build handoff v2 with the generated architecture status page record.", "SITE_STATUS_PAGE_MAP_MISSING");
    }
    const expectedStatus = generatedStatusPageRecord(snapshotAvailable ? "present" : "missing");
    if (pageMap && (pageMap.version !== 2 || JSON.stringify(pageMap.status) !== JSON.stringify(expectedStatus))) {
      add("$.handoff.pageMap.status", "handoff page map is missing the matching generated architecture status record", "Build handoff v2 with the generated architecture-status page record and current availability.", "SITE_STATUS_PAGE_MAP_MISMATCH");
    }
    if (snapshotAvailable) {
      try {
        const statusBytes = await readFile(path.join(handoffDirectory, "architecture-status.json"));
        if (manifest?.digests?.architectureStatus !== requireDigest(statusBytes)) add("$.handoff.digests.architectureStatus", "handoff status digest is inconsistent", "Rebuild the status handoff before composing the final site.");
      } catch { add("$.handoff.architectureStatus", "handoff status snapshot is missing", "Build handoff v2 with architecture status configured.", "SITE_STATUS_HANDOFF_MISSING"); }
    } else if (manifest?.files?.architectureStatus || manifest?.digests?.architectureStatus) {
      add("$.handoff.architectureStatus", "missing status snapshots must not be copied into the handoff", "Rebuild the architecture docs handoff without architecture-status.json.", "SITE_STATUS_HANDOFF_UNEXPECTED");
    }
  }

  for (const page of pages) {
    const route = pageRoute(config, page).split(path.sep).join("/");
    const filename = path.join(siteDirectory, route);
    const pathPrefix = `$.site.pages.${page.id}`;
    if (!await exists(filename)) {
      add(pathPrefix, `final site route ${route} is missing`, "Compose one HTML route for every page-map record.", "SITE_ROUTE_MISSING");
      continue;
    }
    const html = await readFile(filename, "utf8");
    const body = firstTag(html, "body");
    const viewer = firstTag(html, "likec4-view");
    const declaredViews = (attribute(body, "data-view-ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean);
    const initialView = attribute(body, "data-initial-view");
    const hasViews = page.viewIds.length > 0;
    const expectedInitial = hasViews ? page.initialViewId ?? page.viewIds[0] ?? config.model.initialView : null;
    const unknownViews = [...new Set([...page.viewIds, ...declaredViews].filter((id) => !viewIds.has(id)))];
    if (unknownViews.length) add(`${pathPrefix}.viewIds`, `references views not present in assets/views.json: ${unknownViews.join(", ")}`, "Use compiled view IDs from the handoff.");
    if (JSON.stringify(declaredViews) !== JSON.stringify(page.viewIds)) add(`${pathPrefix}.viewIds`, "page-declared view IDs do not match the page map", "Render the page map's ordered viewIds on this route.", "SITE_VIEW_MAP_MISMATCH");
    if (!html.match(/<main\b/gi)?.length || (html.match(/<main\b/gi) ?? []).length !== 1 || (html.match(/<h1\b/gi) ?? []).length !== 1) add(`${pathPrefix}.structure`, "route must contain exactly one main landmark and one h1", "Keep one main and one page-level h1 in each composed route.");
    if (hasViews) {
      if (initialView !== expectedInitial) add(`${pathPrefix}.initialViewId`, `declares ${JSON.stringify(initialView)} instead of ${JSON.stringify(expectedInitial)}`, "Show the page map's initialViewId first.", "SITE_INITIAL_VIEW_MISMATCH");
      if (attribute(viewer, "view-id") !== expectedInitial) add(`${pathPrefix}.viewer`, "the mounted LikeC4 view is not the page's initial view", "Mount the declared initialViewId on first render.", "SITE_INITIAL_VIEW_MISMATCH");
      if (!html.includes("likec4-view") || !html.includes("ds-scroll-x") || !html.includes('tabindex="0"')) add(`${pathPrefix}.diagram`, "route is missing the accessible diagram frame contract", "Mount the page's views in a labelled, keyboard-focusable scroll region.");
      if (!html.includes('id="view-select"')) add(`${pathPrefix}.selector`, "route has no architecture view selector", "Provide a page-local selector for its declared view IDs.");
    } else if (initialView !== null || attribute(viewer, "view-id") !== null || html.includes('id="view-select"') || html.includes('id="views"')) {
      add(`${pathPrefix}.views`, "a viewless page renders an interactive architecture view", "Omit the view section, selector, initial-view metadata, and LikeC4 mount for a page with no viewIds.", "SITE_VIEWLESS_PAGE_MISMATCH");
    }
  }

  if (manifest && receipt?.architectureHandoffDigest === manifest.digests?.handoff && calculateHandoffDigest(manifest) !== manifest.digests.handoff) add("$.handoff.manifest.digests.handoff", "handoff manifest digest is internally inconsistent", "Rebuild the handoff before composing the final site.");
  return { ok: diagnostics.length === 0, diagnostics, pageCount: pages.length + (config.architectureStatus ? 1 : 0) };
}

export function formatFinalSiteReport(report) {
  if (report.ok) return `Final site contract passed for ${report.pageCount} pages.`;
  return report.diagnostics.map((entry) => `${entry.path}: ${entry.message} Expected: ${entry.expected}`).join("\n");
}
