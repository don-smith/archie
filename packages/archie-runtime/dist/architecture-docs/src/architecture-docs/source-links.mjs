import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ArchitectureDocsBuildError } from "./errors.mjs";

function lineNumber(source, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source[cursor] === "\n") line += 1;
  }
  return line;
}

function rewrittenUrl(value, browserRoot) {
  if (value.startsWith("./")) {
    const pathPart = value.slice(2).split(/[?#]/, 1)[0];
    if (!pathPart || pathPart.startsWith("/") || pathPart.includes("\\")) {
      throw new Error("repository-relative link must name a relative file path");
    }
    for (const segment of pathPart.split("/")) {
      let decoded;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        throw new Error("repository-relative link contains malformed URL encoding");
      }
      if (decoded === "..") throw new Error("repository-relative link must not traverse to a parent directory");
    }
    return new URL(value.slice(2), browserRoot).href;
  }

  let absolute;
  try {
    absolute = new URL(value);
  } catch {
    throw new Error("link must begin with ./ or be an absolute HTTP or HTTPS URL");
  }
  if (absolute.protocol !== "http:" && absolute.protocol !== "https:") {
    throw new Error("link scheme must be HTTP or HTTPS");
  }
  return value;
}

function quotedEnd(source, start, quote) {
  for (let cursor = start + 1; cursor < source.length; cursor += 1) {
    if (source[cursor] === "\\") {
      cursor += 1;
      continue;
    }
    if (source[cursor] === quote) return cursor;
  }
  return -1;
}

export function rewriteSourceLinks(source, browserRoot, { filename = "model.c4" } = {}) {
  let output = "";
  let cursor = 0;
  let copiedUntil = 0;
  const issues = [];

  while (cursor < source.length) {
    if (source.startsWith("//", cursor)) {
      const end = source.indexOf("\n", cursor + 2);
      cursor = end < 0 ? source.length : end + 1;
      continue;
    }
    if (source.startsWith("/*", cursor)) {
      const end = source.indexOf("*/", cursor + 2);
      cursor = end < 0 ? source.length : end + 2;
      continue;
    }
    if (source[cursor] === "'" || source[cursor] === '"' || source[cursor] === "`") {
      const end = quotedEnd(source, cursor, source[cursor]);
      cursor = end < 0 ? source.length : end + 1;
      continue;
    }

    const isLink = source.startsWith("link", cursor)
      && !/[A-Za-z0-9_]/.test(source[cursor - 1] ?? "")
      && !/[A-Za-z0-9_]/.test(source[cursor + 4] ?? "");
    if (!isLink) {
      cursor += 1;
      continue;
    }

    let valueStart = cursor + 4;
    while (source[valueStart] === " " || source[valueStart] === "\t") valueStart += 1;
    if (valueStart === cursor + 4) {
      cursor += 4;
      continue;
    }

    let valueEnd = valueStart;
    let value;
    let quote = "";
    if (source[valueStart] === "'" || source[valueStart] === '"') {
      quote = source[valueStart];
      valueEnd = quotedEnd(source, valueStart, quote);
      if (valueEnd < 0) {
        issues.push({
          path: `${filename}:${lineNumber(source, cursor)}`,
          message: "contains an unterminated source link",
          expected: "Close the quoted link value.",
        });
        break;
      }
      value = source.slice(valueStart + 1, valueEnd);
    } else {
      while (valueEnd < source.length && !/[\s{}]/.test(source[valueEnd])) valueEnd += 1;
      value = source.slice(valueStart, valueEnd);
    }

    try {
      const replacement = rewrittenUrl(value, browserRoot);
      output += source.slice(copiedUntil, valueStart);
      output += quote ? `${quote}${replacement}${quote}` : replacement;
      copiedUntil = quote ? valueEnd + 1 : valueEnd;
    } catch (error) {
      issues.push({
        path: `${filename}:${lineNumber(source, cursor)}`,
        message: error.message,
        expected: "Use ./path within the repository or an absolute HTTP or HTTPS URL.",
      });
    }
    cursor = quote ? valueEnd + 1 : valueEnd;
  }

  if (issues.length > 0) {
    throw new ArchitectureDocsBuildError("LikeC4 source links are invalid.", {
      code: "SOURCE_LINK_INVALID",
      issues,
    });
  }
  return `${output}${source.slice(copiedUntil)}`;
}

async function modelFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await modelFiles(filename));
    else if (entry.isFile() && [".c4", ".likec4"].includes(path.extname(entry.name))) files.push(filename);
  }
  return files;
}

export async function rewriteSourceLinksInWorkspace(workspace, browserRoot) {
  const issues = [];
  for (const filename of await modelFiles(workspace)) {
    const source = await readFile(filename, "utf8");
    try {
      const rewritten = rewriteSourceLinks(source, browserRoot, { filename: path.relative(workspace, filename) });
      if (rewritten !== source) await writeFile(filename, rewritten);
    } catch (error) {
      if (error instanceof ArchitectureDocsBuildError && error.code === "SOURCE_LINK_INVALID") {
        issues.push(...error.issues);
      } else {
        throw error;
      }
    }
  }
  if (issues.length > 0) {
    throw new ArchitectureDocsBuildError("LikeC4 source links are invalid.", {
      code: "SOURCE_LINK_INVALID",
      issues,
    });
  }
}
