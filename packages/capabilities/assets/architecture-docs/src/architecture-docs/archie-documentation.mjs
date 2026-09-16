import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const DEPLOYED_GUIDE_PATH = ".agents/skills/archie/references/managed-site-guide.md";
const GUIDE_MARKER = /^<!--\s*archie-guide:([a-z0-9][a-z0-9._-]*)\s*-->$/;
const TOPIC_MARKER = /^<!--\s*archie-topic:([a-z0-9][a-z0-9-]*)\s*-->$/;
const CAPABILITY_MARKER = /^<!--\s*archie-capability:([a-z0-9][a-z0-9-]*):([a-z0-9][a-z0-9-]*)\s*-->$/;
const ARCHIE_COMMENT = /<!--[\s\S]*?-->/g;

function warning(code, path_, message, expected) {
  return { severity: "warning", code, path: path_, message, expected };
}

export async function isArchieDocumentationActive(configDirectory) {
  try {
    await stat(path.join(configDirectory, ".archie", "version"));
    return true;
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;
    throw error;
  }
}

function markerComments(text) {
  return text.match(ARCHIE_COMMENT)?.filter((comment) => /\barchie-(?:guide|topic|capability)\b/.test(comment)) ?? [];
}

function markerIdentity(comment) {
  let match = GUIDE_MARKER.exec(comment);
  if (match) return { kind: "guide", version: match[1], marker: `<!-- archie-guide:${match[1]} -->` };
  match = TOPIC_MARKER.exec(comment);
  if (match) return { kind: "required", marker: `<!-- archie-topic:${match[1]} -->` };
  match = CAPABILITY_MARKER.exec(comment);
  if (match) return { kind: "required", marker: `<!-- archie-capability:${match[1]}:${match[2]} -->`, capability: true };
  return null;
}

function parseGuide(text) {
  if (typeof text !== "string") return null;
  const comments = markerComments(text);
  const markers = comments.map(markerIdentity);
  if (markers.some((marker) => marker === null)) return null;
  const versions = markers.filter((marker) => marker.kind === "guide");
  const required = markers.filter((marker) => marker.kind === "required");
  if (versions.length !== 1 || !required.some((marker) => !marker.capability) || !required.some((marker) => marker.capability)) return null;
  if (new Set(required.map((marker) => marker.marker)).size !== required.length) return null;
  return { version: versions[0].version, requiredMarkers: required.map((marker) => marker.marker) };
}

function countPageMarkers(pageText) {
  const counts = new Map();
  for (const comment of markerComments(typeof pageText === "string" ? pageText : "")) {
    const marker = markerIdentity(comment);
    if (!marker) continue;
    const key = marker.kind === "guide" ? `guide:${marker.version}` : marker.marker;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

async function resolveGuideText(configDirectory, guideText, guideReadError) {
  if (guideReadError !== undefined) return null;
  if (guideText !== undefined) return guideText;
  try {
    return await readFile(path.join(configDirectory, DEPLOYED_GUIDE_PATH), "utf8");
  } catch {
    return null;
  }
}

export async function evaluateArchieDocumentation({ configDirectory, areas, guideText, guideReadError, pageText }) {
  if (!await isArchieDocumentationActive(configDirectory)) return [];

  const warnings = [];
  const guide = parseGuide(await resolveGuideText(configDirectory, guideText, guideReadError));
  if (!guide) {
    warnings.push(warning(
      "ARCHIE_GUIDE_UNREADABLE",
      DEPLOYED_GUIDE_PATH,
      "deployed Archie guide could not be read or its marker contract is invalid",
      "Deploy a readable guide with one version marker and unique required topic and capability markers.",
    ));
  }

  const pageAreas = Array.isArray(areas) ? areas : [];
  const archieAreas = pageAreas.map((area, index) => ({ area, index })).filter(({ area }) => area?.id === "archie");
  if (archieAreas.length === 0) {
    warnings.push(warning(
      "ARCHIE_AREA_MISSING",
      "$.pages.areas",
      "Archie-managed target has no Archie area",
      "Add exactly one pages.areas record with id, title, and slug set to Archie values.",
    ));
    return warnings;
  }
  if (archieAreas.length > 1) {
    warnings.push(warning(
      "ARCHIE_AREA_DUPLICATE",
      "$.pages.areas",
      `Archie-managed target has ${archieAreas.length} Archie areas`,
      "Keep exactly one pages.areas record whose id is \"archie\".",
    ));
    return warnings;
  }

  const [{ area, index }] = archieAreas;
  const pagePath = `$.pages.areas[${index}].markdown`;
  if (area.title !== "Archie" || area.slug !== "archie") {
    warnings.push(warning(
      "ARCHIE_AREA_METADATA_INVALID",
      `$.pages.areas[${index}]`,
      "Archie area title or slug does not match the managed-site contract",
      "Set title to \"Archie\" and slug to \"archie\".",
    ));
  }
  if (!guide) return warnings;

  const counts = countPageMarkers(pageText);
  const versionEntries = [...counts.entries()].filter(([key]) => key.startsWith("guide:"));
  const versionCount = versionEntries.reduce((total, [, count]) => total + count, 0);
  const expectedVersionMarker = `<!-- archie-guide:${guide.version} -->`;
  if (versionCount === 0) {
    warnings.push(warning(
      "ARCHIE_GUIDE_VERSION_MISSING",
      pagePath,
      "Archie page has no guide version marker",
      `Include ${expectedVersionMarker} exactly once.`,
    ));
  } else if (versionCount > 1) {
    warnings.push(warning(
      "ARCHIE_MARKER_DUPLICATE",
      pagePath,
      `Archie page contains guide version markers ${versionCount} times`,
      `Include ${expectedVersionMarker} exactly once.`,
    ));
  } else {
    const version = versionEntries[0][0].slice("guide:".length);
    if (version !== guide.version) {
      warnings.push(warning(
        "ARCHIE_GUIDE_VERSION_MISMATCH",
        pagePath,
        `Archie page uses guide version ${JSON.stringify(version)} instead of ${JSON.stringify(guide.version)}`,
        `Adapt the deployed guide and include ${expectedVersionMarker} exactly once.`,
      ));
    }
  }

  for (const marker of guide.requiredMarkers) {
    const count = counts.get(marker) ?? 0;
    if (count === 0) {
      warnings.push(warning(
        "ARCHIE_MARKER_MISSING",
        pagePath,
        `Archie page is missing required marker ${marker}`,
        `Include ${marker} exactly once.`,
      ));
    } else if (count > 1) {
      warnings.push(warning(
        "ARCHIE_MARKER_DUPLICATE",
        pagePath,
        `Archie page contains required marker ${marker} ${count} times`,
        `Include ${marker} exactly once.`,
      ));
    }
  }
  return warnings;
}
