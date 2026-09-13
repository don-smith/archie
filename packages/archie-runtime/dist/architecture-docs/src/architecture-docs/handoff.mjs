import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { digest } from "./evidence-ledger.mjs";
import { buildCompositionGuide } from "./composition-guide.mjs";
import { buildHandoffDelta, deltaToMarkdown } from "./handoff-delta.mjs";

export const HANDOFF_VERSION = 1;

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}
async function writeJson(filename, value) {
  const bytes = jsonBytes(value);
  await writeFile(filename, bytes);
  return sha256(bytes);
}
function pageRecord(page, markdown) {
  return {
    id: page.id,
    title: page.title,
    summary: page.summary,
    markdown,
    viewIds: page.viewIds,
    claimIds: page.claimIds,
    initialViewId: page.initialViewId ?? page.viewIds[0] ?? null,
    ...(page.slug ? { slug: page.slug } : {}),
  };
}
async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

export async function readHandoffSnapshot(directory) {
  try {
    const manifest = await readJson(path.join(directory, "manifest.json"));
    const [claims, pageMap, views] = await Promise.all([
      readJson(path.join(directory, "claims.json")),
      readJson(path.join(directory, "page-map.json")),
      readJson(path.join(directory, "assets/views.json")),
    ]);
    return { manifest, claims, pageMap, views };
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export function calculateHandoffDigest(manifest) {
  const stableManifest = {
    ...manifest,
    digests: Object.fromEntries(Object.entries(manifest.digests).filter(([key]) => !["handoff", "delta"].includes(key))),
  };
  return digest(stableManifest);
}

export async function writeHandoffBundle({ destination, config, compiled, pages, statuses, pagePaths, previous = null }) {
  await mkdir(path.join(destination, "pages"), { recursive: true });
  await mkdir(path.join(destination, "assets"), { recursive: true });

  const pageMap = {
    version: HANDOFF_VERSION,
    home: pageRecord(pages[0], `pages/${pages[0].id}.md`),
    areas: pages.slice(1).map((page) => pageRecord(page, `pages/${page.id}.md`)),
  };
  const claims = {
    version: config.ledger.version,
    inventory: config.ledger.inventory,
    claims: config.ledger.claims,
    pageMapReview: config.ledger.pageMapReview,
  };
  const views = { views: compiled.views };
  const pageDigests = {};
  const supplementalInputs = [];

  for (const page of pages) {
    const bytes = await readFile(pagePaths[page.id]);
    const filename = path.join(destination, "pages", `${page.id}.md`);
    await writeFile(filename, bytes);
    pageDigests[page.id] = sha256(bytes);
  }

  for (const [index, input] of (config.supplementalInputs ?? []).entries()) {
    const source = config.paths.supplementalInputs[index];
    const bytes = await readFile(source.sourcePath);
    const filename = path.join(destination, input.destination);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, bytes);
    supplementalInputs.push({ id: input.id, source: input.source, destination: input.destination, sha256: sha256(bytes) });
  }

  const guide = buildCompositionGuide();
  const guideBytes = Buffer.from(guide);
  await writeFile(path.join(destination, "composition-guide.md"), guideBytes);
  const claimsDigest = await writeJson(path.join(destination, "claims.json"), claims);
  const pageMapDigest = await writeJson(path.join(destination, "page-map.json"), pageMap);
  const viewsDigest = await writeJson(path.join(destination, "assets", "views.json"), views);
  const likec4Destination = path.join(destination, "assets", "likec4-views.js");
  await copyFile(compiled.bundlePath, likec4Destination);

  const manifest = {
    ownership: { product: "architecture-docs", artifact: "handoff", generated: true, markerVersion: 1 },
    version: HANDOFF_VERSION,
    guideVersion: 1,
    repository: config.publicConfig.repository,
    document: config.publicConfig.document,
    root: config.publicConfig.root,
    source: {
      model: config.publicConfig.model,
      evidence: config.publicConfig.evidence,
      sourceLinks: config.publicConfig.sourceLinks,
    },
    presentation: { palette: config.publicConfig.palette },
    initialView: config.model.initialView,
    counts: {
      pageCount: pages.length,
      compiledViewCount: compiled.views.length,
      provisionalClaimCount: statuses.filter((claim) => !claim.approved).length,
    },
    compiler: { likec4: compiled.likec4Version },
    semantics: {
      modelDigest: compiled.semanticData.modelDigest,
      workspaceDigest: compiled.semanticData.workspaceDigest,
      views: Object.fromEntries(compiled.semanticData.views.map(({ id, semanticDigest }) => [id, semanticDigest])),
    },
    files: {
      guide: "composition-guide.md",
      claims: "claims.json",
      pageMap: "page-map.json",
      pages: "pages",
      views: "assets/views.json",
      likec4: "assets/likec4-views.js",
      delta: "delta.json",
      deltaMarkdown: "delta.md",
    },
    ...(supplementalInputs.length ? { supplementalInputs } : {}),
    digests: {
      guide: sha256(guideBytes),
      claims: claimsDigest,
      pageMap: pageMapDigest,
      views: viewsDigest,
      model: compiled.semanticData.modelDigest,
      workspace: compiled.semanticData.workspaceDigest,
      pages: pageDigests,
    },
  };
  manifest.digests.handoff = calculateHandoffDigest(manifest);

  const delta = buildHandoffDelta({ previous, current: { manifest, claims, pageMap, views } });
  await writeJson(path.join(destination, "delta.json"), delta);
  const deltaMarkdown = deltaToMarkdown(delta);
  await writeFile(path.join(destination, "delta.md"), deltaMarkdown);
  manifest.digests.delta = sha256(jsonBytes(delta));
  await writeJson(path.join(destination, "manifest.json"), manifest);

  return {
    manifest,
    files: [
      "manifest.json",
      "composition-guide.md",
      "claims.json",
      "page-map.json",
      ...pages.map((page) => `pages/${page.id}.md`),
      ...supplementalInputs.map((input) => input.destination),
      "assets/views.json",
      "assets/likec4-views.js",
      "delta.json",
      "delta.md",
    ],
  };
}
