import { digest } from "./evidence-ledger.mjs";

function byId(entries = []) {
  return new Map(entries.map((entry) => [entry.id, entry]));
}
function changeSet(previousEntries, currentEntries, compare, classify = () => "changed") {
  const before = byId(previousEntries);
  const after = byId(currentEntries);
  const added = [];
  const removed = [];
  const changed = [];
  for (const [id, entry] of after) {
    if (!before.has(id)) added.push(id);
    else if (!compare(before.get(id), entry)) changed.push({ id, kind: classify(before.get(id), entry) });
  }
  for (const id of before.keys()) if (!after.has(id)) removed.push(id);
  return { added, removed, changed };
}

function claimContent(claim) {
  if (!claim) return null;
  const { review: _review, ...content } = claim;
  return content;
}
function pageContent(page) {
  if (!page) return null;
  const { markdown: _markdown, ...content } = page;
  return content;
}
function viewContent(view) {
  return view ? { id: view.id, semanticDigest: view.semanticDigest } : null;
}

export function buildHandoffDelta({ previous = null, current }) {
  const previousClaims = previous?.claims?.claims ?? [];
  const previousPages = [previous?.pageMap?.home, ...(previous?.pageMap?.areas ?? [])].filter(Boolean);
  const previousViews = previous?.views?.views ?? [];
  const currentClaims = current.claims.claims;
  const currentPages = [current.pageMap.home, ...current.pageMap.areas];
  const currentViews = current.views.views;
  const claims = changeSet(previousClaims, currentClaims, (before, after) => (
    digest(claimContent(before)) === digest(claimContent(after)) &&
    digest(before.review ?? { state: "pending" }) === digest(after.review ?? { state: "pending" })
  ), (before, after) => digest(claimContent(before)) === digest(claimContent(after)) ? "review" : "content");
  const reviewChanged = currentClaims
    .filter((after) => {
      const before = previousClaims.find((candidate) => candidate.id === after.id);
      return before && digest(before.review ?? { state: "pending" }) !== digest(after.review ?? { state: "pending" });
    })
    .map((claim) => claim.id);
  const pages = changeSet(previousPages, currentPages, (before, after) => (
    digest(pageContent(before)) === digest(pageContent(after)) &&
    (previous?.manifest?.digests?.pages?.[before.id] ?? "") === (current.manifest?.digests?.pages?.[after.id] ?? "")
  ), (before, after) => digest(pageContent(before)) === digest(pageContent(after)) ? "markdown" : "metadata");
  const views = changeSet(previousViews, currentViews, (before, after) => digest(viewContent(before)) === digest(viewContent(after)), () => "semantic");
  const baseline = previous ? "update" : "baseline";
  const statusConfigured = current.manifest?.version === 2;
  const availabilityChanged = statusConfigured && (!previous || previous.manifest?.architectureStatus?.available !== current.manifest.architectureStatus?.available);
  const digestChanged = statusConfigured && (!previous || previous.manifest?.digests?.architectureStatus !== current.manifest.digests?.architectureStatus);
  const statusChanged = availabilityChanged || digestChanged;
  const status = statusConfigured ? { available: current.manifest.architectureStatus?.available === true, changed: statusChanged, digestChanged } : undefined;
  const affectedPageIds = [...new Set([...claims.added, ...claims.removed, ...claims.changed.map((entry) => entry.id), ...pages.added, ...pages.removed, ...pages.changed.map((entry) => entry.id), ...(statusChanged ? ["architecture-status"] : [])])];
  const affectedViewIds = [...new Set([...views.added, ...views.removed, ...views.changed.map((entry) => entry.id)])];
  return {
    version: statusConfigured ? 2 : 1,
    kind: baseline,
    baseline: previous?.manifest?.digests?.handoff ?? null,
    current: current.manifest?.digests?.handoff ?? null,
    summary: {
      claims: { added: claims.added.length, removed: claims.removed.length, changed: claims.changed.length },
      pages: { added: pages.added.length, removed: pages.removed.length, changed: pages.changed.length },
      views: { added: views.added.length, removed: views.removed.length, changed: views.changed.length },
      affectedPageIds,
      affectedViewIds,
      ...(status ? { architectureStatus: status } : {}),
    },
    ...(status ? { architectureStatus: status } : {}),
    claims: { ...claims, reviewChanged },
    pages,
    views,
  };
}

function list(label, values) {
  return values.length ? `- ${label}: ${values.join(", ")}` : `- ${label}: none`;
}
export function deltaToMarkdown(delta) {
  const title = delta.kind === "baseline" ? "Baseline handoff" : "Handoff update";
  const changed = (entries) => entries.length ? entries.map((entry) => typeof entry === "string" ? entry : `${entry.id} (${entry.kind})`).join(", ") : "none";
  return `# ${title}

This report compares stable architecture inputs. It does not compare LikeC4 JavaScript bundle bytes.${delta.architectureStatus ? `\n\nArchitecture status: ${delta.architectureStatus.changed ? "availability or digest changed" : "unchanged"}; available: ${delta.architectureStatus.available}.` : ""}

## Summary

- Claims: ${delta.summary.claims.added} added, ${delta.summary.claims.removed} removed, ${delta.summary.claims.changed} changed.
- Pages: ${delta.summary.pages.added} added, ${delta.summary.pages.removed} removed, ${delta.summary.pages.changed} changed.
- Views: ${delta.summary.views.added} added, ${delta.summary.views.removed} removed, ${delta.summary.views.changed} changed.
${list("Affected pages", delta.summary.affectedPageIds)}
${list("Affected views", delta.summary.affectedViewIds)}

## Claims

${list("Added", delta.claims.added)}
${list("Removed", delta.claims.removed)}
- Changed: ${changed(delta.claims.changed)}
${list("Review/status changes", delta.claims.reviewChanged ?? [])}

## Pages

${list("Added", delta.pages.added)}
${list("Removed", delta.pages.removed)}
- Changed: ${changed(delta.pages.changed)}

## Views

${list("Added", delta.views.added)}
${list("Removed", delta.views.removed)}
- Changed: ${changed(delta.views.changed)}

Review the affected IDs against \`claims.json\`, \`page-map.json\`, and \`assets/views.json\` before recomposing the final site.
`;
}
