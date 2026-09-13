import { canonicalStyles, themeScript, viewerScript, viewerStyles } from "./site-shell.mjs";

const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const scriptData = (value) => JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("&", "\\u0026");
function navigation(config, page, prefix) {
  const home = config.pages.home;
  const links = [{ href: `${prefix}index.html`, label: home.title, current: page.id === home.id }];
  for (const area of config.pages.areas) links.push({ href: `${prefix}${area.slug}/index.html`, label: area.title, current: page.id === area.id });
  return links.map((link) => `<li><a href="${escapeHtml(link.href)}"${link.current ? ' aria-current="page"' : ""}>${escapeHtml(link.label)}</a></li>`).join("\n");
}
const previewStyles = `
  .ds-statement-hero { min-height: auto; align-items: start; padding-block: var(--ds-space-7); }
  .ds-statement-hero__inner { gap: var(--ds-space-5); }
  .ds-display { font-size: clamp(2.5rem, 4.5vw, 4rem); line-height: 1; }
  .ds-section-title { font-size: clamp(1.875rem, 3.2vw, 2.75rem); line-height: 1.1; }
  .ds-rail-document__section { padding-block: var(--ds-space-7); }
`;

function claimMarkup(claims, browserRoot) {
  if (!claims.length) return '<p class="ds-muted">No claims are attached to this page.</p>';
  return `<div class="ds-card-grid">${claims.map((claim) => {
    const status = claim.approved ? "Approved" : claim.review.state === "rejected" ? "Rejected" : "Provisional";
    const evidence = claim.evidence.map((entry) => entry.url
      ? `<a href="${escapeHtml(entry.url)}" data-ds-check-ignore="external-request" data-ds-check-reason="External evidence link; it is navigated by the reader and is not a remotely loaded artifact resource.">Evidence</a>`
      : `<a href="${escapeHtml(new URL(entry.path.replace(/^\.\//, ""), browserRoot).href)}" data-ds-check-ignore="external-request" data-ds-check-reason="External evidence link; it is navigated by the reader and is not a remotely loaded artifact resource.">${escapeHtml(entry.path)}</a>`).join(" · ");
    return `<article class="ds-content-card"><p class="ds-content-card__tag">${status} · ${escapeHtml(claim.id)}</p><p>${escapeHtml(claim.statement)}</p><p class="ds-muted">${evidence}</p></article>`;
  }).join("")}</div>`;
}
export function renderSite({ config, page, pageHtml, views, paletteCss, claimStatuses = [], assetPrefix = "" }) {
  const hasViews = page.viewIds.length > 0;
  const initialId = hasViews ? page.initialViewId ?? page.viewIds[0] ?? config.model.initialView : null;
  const initial = hasViews ? views.find((view) => view.id === initialId) ?? views[0] : null;
  const repositoryLabel = config.repository.shortLabel ?? config.repository.name;
  const claims = claimStatuses.filter((claim) => page.claimIds.includes(claim.id));
  const browserRoot = config.sourceLinks.browserRoot;
  const provisional = claims.filter((claim) => !claim.approved).length;
  const siteData = hasViews ? { initialView: initial.id, pageId: page.id } : null;
  const viewButtons = page.viewIds.map((viewId) => {
    const view = views.find((candidate) => candidate.id === viewId);
    return view ? `<button type="button" data-open-view="${escapeHtml(view.id)}">Open ${escapeHtml(view.title)}</button>` : "";
  }).join("\n");
  const relevantViews = `<div class="architecture-guide-actions ds-no-print">${viewButtons}</div>`;
  const exploreSection = hasViews ? `<section class="ds-rail-document__section" id="explore" aria-labelledby="explore-title"><header class="ds-section-lead"><div><p class="ds-kicker">Interactive model</p><h2 class="ds-section-title" id="explore-title">Explore the relevant views</h2></div><p class="ds-section-lead__summary">The curated page map starts with the views selected for this area; the selector retains access to every compiled LikeC4 view.</p></header>${relevantViews}<figure class="ds-diagram-frame ds-diagram-frame--grid"><figcaption class="ds-diagram-frame__header"><div><p class="ds-label">Interactive LikeC4 view</p><h3 id="architecture-view-title">${escapeHtml(initial.title)}</h3></div><p>Scroll to zoom; drag to pan.</p></figcaption><div class="architecture-viewer-toolbar ds-no-print"><div class="architecture-viewer-field"><label for="architecture-view-select">Architecture view</label><select id="architecture-view-select"><option>Loading authored views…</option></select></div><button id="architecture-parent-view" type="button" hidden>Up one level</button></div><div class="ds-diagram-canvas ds-scroll-x architecture-viewer-canvas" tabindex="0" aria-label="Scrollable interactive architecture diagram"><div class="architecture-viewer-stage"><likec4-view view-id="${escapeHtml(initial.id)}" browser="true" color-scheme="light"></likec4-view></div></div><div class="architecture-viewer-caption" aria-live="polite"><p id="architecture-view-description">${escapeHtml(initial.description || "This authored view has no description.")}</p><p class="architecture-viewer-status" id="architecture-view-status">Loading the static view manifest.</p></div></figure></section>` : "";
  const viewerScripts = hasViews ? `<script id="architecture-docs-data" type="application/json">${scriptData(siteData)}</script>\n    <script type="module" src="${assetPrefix}assets/likec4-views.js"></script>\n    <script type="module">${viewerScript.replace('fetch("assets/views.json")', `fetch("${assetPrefix}assets/views.json")`)}</script>` : "";
  return `<!doctype html>
<html data-ds-profile="rail-document" lang="en" data-theme="system">
  <head>
    <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="color-scheme" content="light dark" />
    <title>${escapeHtml(config.document.title)} · ${escapeHtml(page.title)}</title>
    <script data-ds-theme>${themeScript}</script>
    <style data-ds-palette="architecture-docs">${paletteCss}</style>
    <style data-ds-canonical>${canonicalStyles}</style>
    <style>${viewerStyles}${previewStyles}@media print {.architecture-viewer-canvas,.architecture-viewer-toolbar{display:none!important}.architecture-viewer-caption::before{display:block;margin-bottom:var(--ds-space-2);color:var(--ds-text);content:"Interactive diagram omitted from print. Serve the site over HTTP to explore it.";font-weight:700}}</style>
  </head>
  <body class="ds-rail-document ds-ambient-field">
    <a class="ds-skip-link" href="#main">Skip to main content</a>
    <header class="ds-top-chrome"><strong>Architecture docs · ${escapeHtml(repositoryLabel)}</strong><div class="ds-theme-controls ds-no-print" aria-label="Theme"><button type="button" data-theme-choice="system" aria-pressed="true">System</button><button type="button" data-theme-choice="light" aria-pressed="false">Light</button><button type="button" data-theme-choice="dark" aria-pressed="false">Dark</button></div></header>
    <div class="ds-rail-document__layout">
      <nav class="ds-rail-document__rail" aria-label="Architecture documentation pages"><p class="ds-label">Architecture map</p><ul>${navigation(config, page, assetPrefix)}</ul></nav>
      <main class="ds-rail-document__main" id="main">
        <section class="ds-statement-hero" id="orientation" aria-labelledby="orientation-title"><div class="ds-statement-hero__inner ds-shell"><p class="ds-kicker">Architecture docs · ${page.id === config.pages.home.id ? "Orientation" : "Major area"}</p><h1 class="ds-display" id="orientation-title">${escapeHtml(page.title)}</h1><p class="ds-statement-hero__deck">${escapeHtml(page.summary)}</p>${provisional ? `<p class="ds-status-banner ds-status-banner--warning" role="status"><strong>Provisional documentation:</strong> ${provisional} claim${provisional === 1 ? " is" : "s are"} awaiting maintainer approval.</p>` : ""}</div></section>
        <section class="ds-rail-document__section" id="prose" aria-label="Reading guide"><div class="ds-reading-width ds-block-flow">${pageHtml}</div></section>
        ${exploreSection}
        <section class="ds-rail-document__section" id="evidence" aria-labelledby="evidence-title"><header class="ds-section-lead"><div><p class="ds-kicker">Provenance</p><h2 class="ds-section-title" id="evidence-title">Claims and evidence</h2></div><p class="ds-section-lead__summary">Every material statement carries a basis and remains visible when it is provisional or rejected.</p></header>${claimMarkup(claims, browserRoot)}</section>
      </main>
    </div>
    ${viewerScripts}
  </body>
</html>`;
}
