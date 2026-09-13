#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadArchitectureDocsConfig } from "../src/architecture-docs/config.mjs";

const args = process.argv.slice(2); const index = args.indexOf("--config"); const configPath = index >= 0 ? args[index + 1] : undefined;
if (!configPath) { process.stderr.write("Usage: node scripts/check-html.mjs --config <path>\n"); process.exit(1); }
function count(html, tag) { return (html.match(new RegExp(`<${tag}\\b`, "gi")) ?? []).length; }
function checkLinks(html, filename, diagnostics) {
  for (const match of html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) {
    const href = match[1].trim();
    if (/^(?:javascript|data|vbscript|file):/i.test(href) || href.startsWith("//")) diagnostics.push(`${filename}: unsafe link URL ${href}`);
  }
}
try {
  const config = await loadArchitectureDocsConfig(configPath);
  const routes = [{ page: config.pages.home, filename: path.join(config.paths.outputDirectory, "index.html") }, ...config.pages.areas.map((page) => ({ page, filename: path.join(config.paths.outputDirectory, page.slug, "index.html") }))];
  const diagnostics = [];
  for (const { page, filename } of routes) {
    const html = await readFile(filename, "utf8");
    if (!html.includes('data-ds-profile="rail-document"')) diagnostics.push(`${filename}: missing rail-document profile`);
    if (!html.includes("data-ds-palette=\"architecture-docs\"")) diagnostics.push(`${filename}: missing architecture-docs palette marker`);
    if (!html.includes("Skip to main content")) diagnostics.push(`${filename}: missing skip link`);
    if (page.viewIds.length > 0 && !html.includes('id="architecture-docs-data"')) diagnostics.push(`${filename}: missing generated page metadata`);
    if (!html.includes(page.title.replaceAll("&", "&amp;"))) diagnostics.push(`${filename}: missing page title`);
    if (count(html, "main") !== 1 || count(html, "h1") !== 1) diagnostics.push(`${filename}: expected exactly one main and one h1`);
    if (!count(html, "h2")) diagnostics.push(`${filename}: authored narrative has no section heading`);
    if (page.viewIds.length > 0) {
      if (!html.includes("likec4-view") || !html.includes("ds-scroll-x") || !html.includes('tabindex="0"')) diagnostics.push(`${filename}: missing accessible LikeC4 diagram frame`);
      if (!html.includes("zoomOnScroll") || !html.includes("panOnScroll")) diagnostics.push(`${filename}: missing wheel-to-zoom adapter settings`);
    } else if (/<likec4-view\b/i.test(html) || html.includes('id="explore"') || html.includes("architecture-docs-data")) {
      diagnostics.push(`${filename}: a viewless page must not render an interactive LikeC4 section`);
    }
    checkLinks(html, filename, diagnostics);
  }
  if (diagnostics.length) { for (const diagnostic of diagnostics) process.stderr.write(`${diagnostic}\n`); process.exitCode = 1; }
  else console.log(`Preview HTML checks passed for ${routes.length} architecture docs pages.`);
} catch (error) {
  process.stderr.write(`${error.code ?? "CHECK_FAILED"}: ${error.message}\n`);
  for (const issue of error.issues ?? []) process.stderr.write(`${issue.path}: ${issue.message} Expected: ${issue.expected}\n`);
  process.exitCode = 1;
}
