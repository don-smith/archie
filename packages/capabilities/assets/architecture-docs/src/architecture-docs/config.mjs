import { lstat, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { ArchitectureDocsConfigurationError } from "./errors.mjs";
import { loadEvidenceLedger } from "./evidence-ledger.mjs";

const ROOT_FIELDS = new Set(["version", "repository", "root", "model", "document", "pages", "evidence", "palette", "sourceLinks", "supplementalInputs", "skillCommand", "architectureStatus"]);
const ARCHITECTURE_STATUS_FIELDS = new Set(["snapshot"]);
const REPOSITORY_FIELDS = new Set(["name", "shortLabel"]);
const MODEL_FIELDS = new Set(["workspace", "initialView"]);
const DOCUMENT_FIELDS = new Set(["title"]);
const PAGES_FIELDS = new Set(["home", "areas"]);
const PAGE_FIELDS = new Set(["id", "title", "summary", "markdown", "viewIds", "claimIds", "initialViewId"]);
const AREA_FIELDS = new Set([...PAGE_FIELDS, "slug"]);
const EVIDENCE_FIELDS = new Set(["ledger"]);
const PALETTE_FIELDS = new Set(["document", "diagram"]);
const DOCUMENT_SCHEME_FIELDS = new Set(["canvas", "surface", "raisedSurface", "text", "mutedText", "border", "action", "warning", "focus"]);
const DIAGRAM_FIELDS = new Set(["primaryFill", "primaryStroke", "primaryText", "neutralFill", "neutralStroke", "neutralText", "relationshipLine", "relationshipLabelBackground"]);
const SOURCE_FIELDS = new Set(["browserRoot"]);
const SUPPLEMENTAL_INPUT_FIELDS = new Set(["id", "source", "destination"]);
const MANAGED_HANDOFF_PATHS = ["manifest.json", "composition-guide.md", "claims.json", "page-map.json", "pages", "assets", "delta.json", "delta.md"];
const COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const SAFE_PATH = /^(?!\/)(?![A-Za-z]:[\\/])[^\\0]+$/;
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_ID = /^[A-Za-z][A-Za-z0-9_-]*$/;

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
function addIssue(issues, fieldPath, message, expected) { issues.push({ path: fieldPath, message, expected }); }
function objectAt(value, fieldPath, issues) {
  if (!isObject(value)) { addIssue(issues, fieldPath, "must be an object", "Provide an object with the documented fields."); return null; }
  return value;
}
function rejectUnknown(value, allowed, fieldPath, issues) {
  if (!isObject(value)) return;
  for (const key of Object.keys(value)) if (!allowed.has(key)) addIssue(issues, `${fieldPath}.${key}`, "is not a supported field", "Remove this field or use a documented field.");
}
function requiredString(value, fieldPath, issues) {
  if (typeof value !== "string" || value.trim() === "") { addIssue(issues, fieldPath, "must be a non-empty string", "Provide a non-empty string."); return null; }
  return value.trim();
}
function stringArray(value, fieldPath, issues) {
  if (!Array.isArray(value)) { addIssue(issues, fieldPath, "must be an array", "Provide an ordered array of strings."); return []; }
  return value.map((entry, index) => requiredString(entry, `${fieldPath}[${index}]`, issues)).filter(Boolean);
}
function colorObject(value, fields, fieldPath, issues) {
  const object = objectAt(value, fieldPath, issues); if (!object) return null;
  rejectUnknown(object, fields, fieldPath, issues);
  const result = {};
  for (const key of fields) {
    const color = requiredString(object[key], `${fieldPath}.${key}`, issues);
    if (color && !COLOR.test(color)) addIssue(issues, `${fieldPath}.${key}`, "must be a hexadecimal CSS color", "Use #RGB, #RGBA, #RRGGBB, or #RRGGBBAA syntax.");
    else if (color) result[key] = color.toLowerCase();
  }
  return result;
}
function normalizePathForPublic(configDirectory, value) { return (path.relative(configDirectory, value) || ".").split(path.sep).join("/"); }
function safePath(value, fieldPath, issues) {
  if (!SAFE_PATH.test(value) || path.isAbsolute(value) || value.split(/[\\/]/).includes("..")) {
    addIssue(issues, fieldPath, "must be a safe relative path", "Use a repository-relative path without absolute or parent traversal segments."); return false;
  }
  return true;
}
function normalizedRelativePath(value, fieldPath, issues) {
  const text = requiredString(value, fieldPath, issues);
  if (!text) return null;
  if (!SAFE_PATH.test(text) || path.isAbsolute(text) || text.includes("\\") || text.split("/").some((segment) => segment === "" || segment === "." || segment === "..") || path.posix.normalize(text) !== text) {
    addIssue(issues, fieldPath, "must be a normalized safe relative path", "Use a non-empty slash-separated path below its declared root without absolute, traversal, dot, empty, or backslash segments."); return null;
  }
  return text;
}
function handoffPathsOverlap(left, right) { return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`); }
function isManagedHandoffPath(destination) { return MANAGED_HANDOFF_PATHS.some((managed) => handoffPathsOverlap(destination, managed)); }
function resolveUnderRoot(configDirectory, rootPath, value) {
  const rootPrefix = `${rootPath.replaceAll("\\", "/").replace(/\/$/, "")}/`;
  const normalized = value.replaceAll("\\", "/");
  const relativeToRoot = normalized === rootPath || normalized.startsWith(rootPrefix) ? normalized.slice(rootPrefix.length) : normalized;
  return path.resolve(configDirectory, rootPath, relativeToRoot);
}
async function canonicalPath(filename) {
  const absolute = path.resolve(filename);
  try { return await realpath(absolute); } catch { const parent = path.dirname(absolute); return parent === absolute ? absolute : path.join(await canonicalPath(parent), path.basename(absolute)); }
}
async function hasSymlinkComponent(filename, baseDirectory) {
  const relative = path.relative(baseDirectory, filename);
  let current = baseDirectory;
  for (const component of relative.split(path.sep)) {
    if (!component || component === ".") continue;
    current = path.join(current, component);
    try {
      if ((await lstat(current)).isSymbolicLink()) return true;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  }
  return false;
}
function overlaps(left, right) {
  const relative = path.relative(left, right);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}
async function existingFile(filename, fieldPath, issues) {
  try { if (!(await stat(filename)).isFile()) throw new Error(); } catch { addIssue(issues, fieldPath, "does not exist", "Point to an existing authored file."); }
}
function validateBrowserRoot(value, issues) {
  const text = requiredString(value, "$.sourceLinks.browserRoot", issues);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    return url.href.endsWith("/") ? url.href : `${url.href}/`;
  } catch { addIssue(issues, "$.sourceLinks.browserRoot", "must be an HTTP or HTTPS base URL without credentials, query, or fragment", "Provide an explicit repository browser root."); return null; }
}
function validateSupplementalInput(value, index, issues) {
  const fieldPath = `$.supplementalInputs[${index}]`;
  const input = objectAt(value, fieldPath, issues); if (!input) return null;
  rejectUnknown(input, SUPPLEMENTAL_INPUT_FIELDS, fieldPath, issues);
  const id = requiredString(input.id, `${fieldPath}.id`, issues);
  if (id && !SAFE_ID.test(id)) addIssue(issues, `${fieldPath}.id`, "contains unsafe characters", "Use letters, numbers, hyphens, or underscores.");
  return {
    id,
    source: normalizedRelativePath(input.source, `${fieldPath}.source`, issues),
    destination: normalizedRelativePath(input.destination, `${fieldPath}.destination`, issues),
  };
}
function validateArchitectureStatus(value, issues) {
  const fieldPath = "$.architectureStatus";
  const object = objectAt(value, fieldPath, issues); if (!object) return null;
  rejectUnknown(object, ARCHITECTURE_STATUS_FIELDS, fieldPath, issues);
  const snapshot = normalizedRelativePath(object.snapshot, `${fieldPath}.snapshot`, issues);
  return { snapshot };
}
function validateSkillCommand(value, issues) {
  if (!Array.isArray(value) || value.length === 0) {
    addIssue(issues, "$.skillCommand", "must be a non-empty array of strings", "Provide an executable followed by zero or more literal arguments."); return [];
  }
  return value.map((entry, index) => requiredString(entry, `$.skillCommand[${index}]`, issues));
}
function validatePage(value, fieldPath, issues, area) {
  const page = objectAt(value, fieldPath, issues); if (!page) return null;
  rejectUnknown(page, area ? AREA_FIELDS : PAGE_FIELDS, fieldPath, issues);
  const result = {
    id: requiredString(page.id, `${fieldPath}.id`, issues),
    title: requiredString(page.title, `${fieldPath}.title`, issues),
    summary: requiredString(page.summary, `${fieldPath}.summary`, issues),
    markdown: requiredString(page.markdown, `${fieldPath}.markdown`, issues),
    viewIds: stringArray(page.viewIds, `${fieldPath}.viewIds`, issues),
    claimIds: stringArray(page.claimIds, `${fieldPath}.claimIds`, issues),
    ...(page.initialViewId === undefined ? {} : { initialViewId: requiredString(page.initialViewId, `${fieldPath}.initialViewId`, issues) }),
  };
  if (result.id && !SAFE_ID.test(result.id)) addIssue(issues, `${fieldPath}.id`, "contains unsafe characters", "Use letters, numbers, hyphens, or underscores.");
  if (result.initialViewId && !result.viewIds.includes(result.initialViewId)) addIssue(issues, `${fieldPath}.initialViewId`, "must name one of the page's viewIds", "Choose the first view to show from this page's ordered viewIds.");
  if (area) {
    result.slug = requiredString(page.slug, `${fieldPath}.slug`, issues);
    if (result.slug && !SAFE_SLUG.test(result.slug)) addIssue(issues, `${fieldPath}.slug`, "must be a lowercase URL slug", "Use lowercase letters, numbers, and single hyphens.");
  }
  return result;
}

function validateStructure(parsed, issues) {
  const root = objectAt(parsed, "$", issues); if (!root) return null;
  rejectUnknown(root, ROOT_FIELDS, "$", issues);
  if (root.version !== 1) addIssue(issues, "$.version", "must be the supported contract version 1", "Set version to 1.");
  const repository = objectAt(root.repository, "$.repository", issues);
  const normalizedRepository = repository ? (rejectUnknown(repository, REPOSITORY_FIELDS, "$.repository", issues), {
    name: requiredString(repository.name, "$.repository.name", issues),
    ...(repository.shortLabel === undefined ? {} : { shortLabel: requiredString(repository.shortLabel, "$.repository.shortLabel", issues) }),
  }) : null;
  const rootValue = requiredString(root.root, "$.root", issues);
  if (rootValue) safePath(rootValue, "$.root", issues);
  const model = objectAt(root.model, "$.model", issues);
  const normalizedModel = model ? (rejectUnknown(model, MODEL_FIELDS, "$.model", issues), {
    workspace: requiredString(model.workspace, "$.model.workspace", issues),
    initialView: requiredString(model.initialView, "$.model.initialView", issues),
  }) : null;
  const document = objectAt(root.document, "$.document", issues);
  const normalizedDocument = document ? (rejectUnknown(document, DOCUMENT_FIELDS, "$.document", issues), { title: requiredString(document.title, "$.document.title", issues) }) : null;
  const pages = objectAt(root.pages, "$.pages", issues);
  let normalizedPages = null;
  if (pages) {
    rejectUnknown(pages, PAGES_FIELDS, "$.pages", issues);
    const home = validatePage(pages.home, "$.pages.home", issues, false);
    const areas = Array.isArray(pages.areas) ? pages.areas.map((area, index) => validatePage(area, `$.pages.areas[${index}]`, issues, true)).filter(Boolean) : (addIssue(issues, "$.pages.areas", "must be an array", "Provide an ordered array of area pages."), []);
    normalizedPages = { home, areas };
  }
  const evidence = objectAt(root.evidence, "$.evidence", issues);
  let normalizedEvidence = null;
  if (evidence) { rejectUnknown(evidence, EVIDENCE_FIELDS, "$.evidence", issues); normalizedEvidence = { ledger: requiredString(evidence.ledger, "$.evidence.ledger", issues) }; }
  const sourceLinks = objectAt(root.sourceLinks, "$.sourceLinks", issues);
  let normalizedSourceLinks = null;
  if (sourceLinks) { rejectUnknown(sourceLinks, SOURCE_FIELDS, "$.sourceLinks", issues); normalizedSourceLinks = { browserRoot: validateBrowserRoot(sourceLinks.browserRoot, issues) }; }
  const supplementalInputs = root.supplementalInputs === undefined ? undefined : (Array.isArray(root.supplementalInputs) ? root.supplementalInputs.map((input, index) => validateSupplementalInput(input, index, issues)).filter(Boolean) : (addIssue(issues, "$.supplementalInputs", "must be an array", "Provide an ordered array of supplemental input declarations."), []));
  const skillCommand = root.skillCommand === undefined ? undefined : validateSkillCommand(root.skillCommand, issues);
  const architectureStatus = root.architectureStatus === undefined ? undefined : validateArchitectureStatus(root.architectureStatus, issues);
  const palette = objectAt(root.palette, "$.palette", issues);
  let normalizedPalette = null;
  if (palette) {
    rejectUnknown(palette, PALETTE_FIELDS, "$.palette", issues);
    const documentPalette = objectAt(palette.document, "$.palette.document", issues);
    const normalizedDocumentPalette = documentPalette ? (rejectUnknown(documentPalette, new Set(["light", "dark"]), "$.palette.document", issues), {
      light: colorObject(documentPalette.light, DOCUMENT_SCHEME_FIELDS, "$.palette.document.light", issues),
      dark: colorObject(documentPalette.dark, DOCUMENT_SCHEME_FIELDS, "$.palette.document.dark", issues),
    }) : null;
    normalizedPalette = { document: normalizedDocumentPalette, diagram: colorObject(palette.diagram, DIAGRAM_FIELDS, "$.palette.diagram", issues) };
  }
  return { version: 1, repository: normalizedRepository, root: rootValue, model: normalizedModel, document: normalizedDocument, pages: normalizedPages, evidence: normalizedEvidence, palette: normalizedPalette, sourceLinks: normalizedSourceLinks, ...(supplementalInputs === undefined ? {} : { supplementalInputs }), ...(skillCommand === undefined ? {} : { skillCommand }), ...(architectureStatus === undefined ? {} : { architectureStatus }) };
}

export async function loadArchitectureDocsConfig(configPath) {
  const absoluteConfigPath = path.resolve(configPath);
  let parsed;
  try { parsed = JSON.parse(await readFile(absoluteConfigPath, "utf8")); }
  catch (cause) {
    const message = cause.code === "ENOENT" ? "configuration file could not be read" : "contains malformed JSON";
    const expected = cause.code === "ENOENT" ? "Provide the path to a readable architecture-docs JSON configuration file." : "Fix the JSON syntax and try again.";
    throw new ArchitectureDocsConfigurationError(absoluteConfigPath, [{ path: "$", message, expected }], { cause });
  }
  const issues = [];
  const normalized = validateStructure(parsed, issues);
  if (!normalized) throw new ArchitectureDocsConfigurationError(absoluteConfigPath, issues);
  const configDirectory = path.dirname(absoluteConfigPath);
  const rootDirectory = normalized.root && path.resolve(configDirectory, normalized.root);
  const modelWorkspace = rootDirectory && normalized.model?.workspace ? resolveUnderRoot(configDirectory, normalized.root, normalized.model.workspace) : null;
  const outputDirectory = rootDirectory ? path.join(rootDirectory, "preview") : null;
  const handoffDirectory = rootDirectory ? path.join(rootDirectory, "handoff") : null;
  const siteDirectory = rootDirectory ? path.join(rootDirectory, "site") : null;
  const ledgerPath = rootDirectory && normalized.evidence?.ledger ? resolveUnderRoot(configDirectory, normalized.root, normalized.evidence.ledger) : null;
  const architectureStatusSnapshot = normalized.architectureStatus?.snapshot ? path.resolve(configDirectory, normalized.architectureStatus.snapshot) : null;
  const pages = normalized.pages;
  const pagePaths = [];
  if (pages) {
    for (const [index, page] of [["home", pages.home], ...pages.areas.map((page, i) => [`areas[${i}]`, page])]) {
      if (!page) continue;
      if (page.markdown && safePath(page.markdown, `$.pages.${index}.markdown`, issues)) {
        const markdownPath = resolveUnderRoot(configDirectory, normalized.root, page.markdown);
        pagePaths.push({ page, markdownPath });
        await existingFile(markdownPath, `$.pages.${index}.markdown`, issues);
      }
    }
  }
  if (modelWorkspace && safePath(normalized.model.workspace, "$.model.workspace", issues)) {
    try { if (!(await stat(modelWorkspace)).isDirectory()) throw new Error(); } catch { addIssue(issues, "$.model.workspace", "does not exist", "Point to an existing LikeC4 workspace directory."); }
  }
  if (ledgerPath && safePath(normalized.evidence.ledger, "$.evidence.ledger", issues)) {
    try { await stat(ledgerPath); } catch { addIssue(issues, "$.evidence.ledger", "does not exist", "Point to evidence/claims.json or another existing ledger."); }
  }
  const supplementalInputPaths = [];
  if (normalized.supplementalInputs) {
    const canonicalConfigDirectory = await canonicalPath(configDirectory);
    const ids = new Set(); const destinations = new Set();
    for (const [index, input] of normalized.supplementalInputs.entries()) {
      const fieldPath = `$.supplementalInputs[${index}]`;
      if (input.id && ids.has(input.id)) addIssue(issues, `${fieldPath}.id`, "duplicates another supplemental input ID", "Use a unique stable ID.");
      if (input.id) ids.add(input.id);
      if (input.destination && destinations.has(input.destination)) addIssue(issues, `${fieldPath}.destination`, "duplicates another supplemental input destination", "Use a unique handoff destination.");
      if (input.destination) destinations.add(input.destination);
      if (input.destination && isManagedHandoffPath(input.destination)) addIssue(issues, `${fieldPath}.destination`, "collides with a package-managed handoff path", "Choose a destination below an unowned supplemental directory.");
      if (!input.source) continue;
      const sourcePath = path.resolve(configDirectory, input.source);
      const canonicalSource = await canonicalPath(sourcePath);
      if (!overlaps(canonicalConfigDirectory, canonicalSource)) addIssue(issues, `${fieldPath}.source`, "must resolve below the configuration directory", "Use a repository-relative source path that does not escape through a symlink.");
      try { if (!(await stat(sourcePath)).isFile()) throw new Error(); } catch { addIssue(issues, `${fieldPath}.source`, "must name an existing regular file", "Point to an existing authored file."); }
      supplementalInputPaths[index] = { id: input.id, sourcePath, destination: input.destination };
    }
  }
  if (rootDirectory) {
    const canonicalConfig = await canonicalPath(absoluteConfigPath);
    const canonicalConfigDirectory = await canonicalPath(configDirectory);
    const canonicalRoot = await canonicalPath(rootDirectory);
    if (architectureStatusSnapshot) {
      const canonicalSnapshot = await canonicalPath(architectureStatusSnapshot);
      if (await hasSymlinkComponent(architectureStatusSnapshot, configDirectory)) addIssue(issues, "$.architectureStatus.snapshot", "must not contain symlink components", "Use a regular path below the configuration directory.");
      if (!overlaps(canonicalConfigDirectory, canonicalSnapshot)) addIssue(issues, "$.architectureStatus.snapshot", "must resolve below the configuration directory", "Use a repository-relative snapshot path that does not escape through a symlink.");
      const generatedDirectories = await Promise.all([outputDirectory, handoffDirectory, siteDirectory].map(canonicalPath));
      if (generatedDirectories.some((directory) => overlaps(directory, canonicalSnapshot) || overlaps(canonicalSnapshot, directory))) addIssue(issues, "$.architectureStatus.snapshot", "must not overlap preview/, handoff/, or site/", "Choose an authored snapshot path outside generated directories.");
    }
    // The configuration may live beside the authored root or inside it (root: ".").
    if (modelWorkspace) {
      const canonicalModel = await canonicalPath(modelWorkspace);
      if (!overlaps(canonicalRoot, canonicalModel)) addIssue(issues, "$.model.workspace", "must be inside the architecture-docs root", "Put the LikeC4 workspace below the configured root.");
      const canonicalOutput = await canonicalPath(outputDirectory);
      if (overlaps(canonicalModel, canonicalOutput) || overlaps(canonicalOutput, canonicalModel)) addIssue(issues, "$.model.workspace", "must not overlap the generated preview", "Keep the LikeC4 workspace separate from root/preview.");
    }
    if (normalized.supplementalInputs) {
      const generatedDirectories = await Promise.all([outputDirectory, handoffDirectory, siteDirectory].map(canonicalPath));
      for (const [index, input] of normalized.supplementalInputs.entries()) {
        const source = supplementalInputPaths[index];
        if (!source?.sourcePath) continue;
        const canonicalSource = await canonicalPath(source.sourcePath);
        if (generatedDirectories.some((directory) => overlaps(directory, canonicalSource) || overlaps(canonicalSource, directory))) addIssue(issues, `$.supplementalInputs[${index}].source`, "must not read from a generated or html-design-owned directory", "Choose an authored source outside preview/, handoff/, and site/.");
      }
    }
  }
  if (pages?.home === null) addIssue(issues, "$.pages.home", "is required", "Provide one orientation home page.");
  if (pages) {
    const ids = new Set(); const slugs = new Set();
    for (const page of [pages.home, ...pages.areas].filter(Boolean)) {
      if (normalized.architectureStatus && page.id === "architecture-status") addIssue(issues, "$.pages", "page ID collides with generated architecture-status route", "Choose a different authored page ID.");
      if (normalized.architectureStatus && page.slug === "architecture-status") addIssue(issues, "$.pages", "page slug collides with generated architecture-status route", "Choose a different authored page slug.");
      if (page.id && ids.has(page.id)) addIssue(issues, "$.pages", "contains duplicate page IDs", "Use unique stable page IDs.");
      if (page.id) ids.add(page.id);
      if (page.slug && slugs.has(page.slug)) addIssue(issues, "$.pages", "contains duplicate page slugs", "Use unique area URL slugs.");
      if (page.slug) slugs.add(page.slug);
    }
  }
  let ledger = null;
  if (ledgerPath && issues.every((entry) => entry.path !== "$.evidence.ledger" && entry.path !== "$.root")) {
    try { ledger = await loadEvidenceLedger(ledgerPath, { baseDirectory: configDirectory, checkEvidenceFiles: true }); } catch (error) { issues.push(...(error.issues ?? [{ path: "$.evidence.ledger", message: error.message, expected: "Fix the evidence ledger." }])); }
  }
  if (ledger && pages) {
    const claimIds = new Set(ledger.claims.map((claim) => claim.id));
    for (const [pageIndex, page] of [["home", pages.home], ...pages.areas.map((page, i) => [`areas[${i}]`, page])]) {
      if (!page) continue;
      for (const claimId of page.claimIds) if (!claimIds.has(claimId)) addIssue(issues, `$.pages.${pageIndex}.claimIds`, `claim ${JSON.stringify(claimId)} does not exist`, "Reference an ID from the claims ledger.");
    }
    for (const claim of ledger.claims) for (const pageId of claim.targets.pages) if (!pages.home || ![pages.home, ...pages.areas].some((page) => page?.id === pageId)) addIssue(issues, "$.evidence.ledger", `claim ${claim.id} targets missing page ${pageId}`, "Update the claim target or page map.");
  }
  if (issues.length) throw new ArchitectureDocsConfigurationError(absoluteConfigPath, issues);
  const publicConfig = {
    ...normalized,
    root: normalizePathForPublic(configDirectory, rootDirectory),
    model: { ...normalized.model, workspace: normalizePathForPublic(configDirectory, modelWorkspace) },
    pages: {
      home: { ...pages.home, markdown: normalizePathForPublic(configDirectory, pagePaths.find(({ page }) => page === pages.home).markdownPath) },
      areas: pages.areas.map((page) => ({ ...page, markdown: normalizePathForPublic(configDirectory, pagePaths.find(({ page: candidate }) => candidate === page).markdownPath) })),
    },
    evidence: { ledger: normalizePathForPublic(configDirectory, ledgerPath) },
    site: { output: normalizePathForPublic(configDirectory, outputDirectory), title: normalized.document.title },
    ...(normalized.architectureStatus === undefined ? {} : { architectureStatus: { snapshot: normalizePathForPublic(configDirectory, architectureStatusSnapshot) } }),
    ...(normalized.supplementalInputs === undefined ? {} : { supplementalInputs: normalized.supplementalInputs }),
    ...(normalized.skillCommand === undefined ? {} : { skillCommand: normalized.skillCommand }),
  };
  return { ...publicConfig, configPath: absoluteConfigPath, ledger, paths: { rootDirectory, modelWorkspace, outputDirectory, handoffDirectory, siteDirectory, ledgerPath, architectureStatusSnapshot, pagePaths: Object.fromEntries(pagePaths.map(({ page, markdownPath }) => [page.id, markdownPath])), supplementalInputs: supplementalInputPaths }, publicConfig };
}
