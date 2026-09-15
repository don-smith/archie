import { readFile } from "node:fs/promises";
import { marked } from "marked";
import { ArchitectureDocsBuildError } from "./errors.mjs";

const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const ARCHIE_MARKER_COMMENT = /^<!--\s*archie-(?:guide:[a-z0-9][a-z0-9._-]*|topic:[a-z0-9][a-z0-9-]*|capability:[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*)\s*-->$/;

function invalid(filename, message) {
  return new ArchitectureDocsBuildError("Markdown source is invalid.", { code: "MARKDOWN_INVALID", issues: [{ path: filename, message, expected: "Use safe CommonMark Markdown and HTTP(S), mailto, or repository-relative links." }] });
}
function safeUrl(href, filename, image = false) {
  if (typeof href !== "string" || href.trim() === "" || /[\u0000-\u001f]/.test(href)) throw invalid(filename, "contains a malformed Markdown URL");
  let url;
  try { url = new URL(href, "https://architecture-docs.invalid/"); } catch { throw invalid(filename, "contains a malformed Markdown URL"); }
  if (!["http:", "https:", "mailto:", "https:"].includes(url.protocol)) throw invalid(filename, "contains an unsafe Markdown URL scheme");
  if (url.protocol === "mailto:" && !href.includes("@")) throw invalid(filename, "contains an unsafe Markdown mailto URL");
  if (image && ["http:", "https:"].includes(url.protocol)) throw invalid(filename, "contains a remotely loaded Markdown image");
  if (href.startsWith("//")) throw invalid(filename, "contains a protocol-relative Markdown URL");
  return href;
}

export function markdownToHtml(source, { filename = "page.md" } = {}) {
  const renderer = new marked.Renderer();
  renderer.heading = ({ text, depth }) => {
    const level = Math.min(6, depth + 1);
    return `<h${level}>${text}</h${level}>\n`;
  };
  renderer.link = ({ href, title, text }) => `<a href="${escapeHtml(safeUrl(href, filename))}"${title ? ` title="${escapeHtml(title)}"` : ""}>${text}</a>`;
  renderer.image = ({ href, title, text }) => `<img src="${escapeHtml(safeUrl(href, filename, true))}" alt="${escapeHtml(text ?? "")}"${title ? ` title="${escapeHtml(title)}"` : ""}>`;
  renderer.html = ({ text }) => ARCHIE_MARKER_COMMENT.test(text.trim()) ? `${text.trim()}\n` : escapeHtml(text);
  try {
    return marked.parse(source.replaceAll("\r\n", "\n"), {
      renderer,
      gfm: true,
      breaks: false,
      headerIds: false,
      mangle: false,
    });
  } catch (error) {
    if (error instanceof ArchitectureDocsBuildError) throw error;
    throw invalid(filename, error.message || "contains unsupported Markdown");
  }
}

export async function loadMarkdownPage(filename) {
  let source;
  try { source = await readFile(filename, "utf8"); } catch (cause) { throw new ArchitectureDocsBuildError("Markdown source could not be read.", { code: "MARKDOWN_READ_FAILED", cause, issues: [{ path: filename, message: "file could not be read", expected: "Provide a readable Markdown page." }] }); }
  return markdownToHtml(source, { filename });
}
