import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ArchitectureDocsLedgerError } from "./errors.mjs";

export const EVIDENCE_CLASSES = [
  "existing-documentation",
  "manifests",
  "runtime-entry-points",
  "deployment-definitions",
  "persistence-definitions",
  "integration-clients",
  "representative-tests",
  "source-relationships",
  "glossary-or-domain-language",
  "adr-or-decision-sources",
];

export const CLAIM_BASES = new Set([
  "confirmed-evidence",
  "maintainer-provided-intent",
  "inference-awaiting-confirmation",
  "unresolved",
]);
export const REVIEW_STATES = new Set(["pending", "approved", "rejected"]);
const DIGEST = /^[a-f0-9]{64}$/i;
const SAFE_ID = /^[A-Za-z][A-Za-z0-9_-]*$/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function issue(issues, path_, message, expected) {
  issues.push({ path: path_, message, expected });
}
function requiredString(value, path_, issues) {
  if (typeof value !== "string" || value.trim() === "") {
    issue(issues, path_, "must be a non-empty string", "Provide a non-empty string.");
    return null;
  }
  return value.trim();
}
function arrayOfStrings(value, path_, issues) {
  if (!Array.isArray(value)) {
    issue(issues, path_, "must be an array", "Provide an array of strings.");
    return [];
  }
  return value.map((entry, index) => requiredString(entry, `${path_}[${index}]`, issues)).filter(Boolean);
}
function rejectUnknown(value, allowed, path_, issues) {
  if (!isObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) issue(issues, `${path_}.${key}`, "is not a supported field", "Remove this field or use a documented field.");
  }
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function digest(value) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function claimForDigest(claim) {
  return {
    id: claim.id,
    statement: claim.statement,
    basis: claim.basis,
    topics: claim.topics,
    evidence: claim.evidence,
    targets: claim.targets,
  };
}
export function claimDigest(claim) {
  return digest(claimForDigest(claim));
}
export function pageMapDigest(pages) {
  return digest(pages);
}

function validateEvidence(value, path_, issues) {
  if (!Array.isArray(value) || value.length === 0) {
    issue(issues, path_, "must contain at least one evidence entry", "Provide a repository path or approved HTTP(S) URL with a note.");
    return [];
  }
  return value.map((entry, index) => {
    const entryPath = `${path_}[${index}]`;
    if (!isObject(entry)) {
      issue(issues, entryPath, "must be an object", "Provide path or url and note.");
      return null;
    }
    rejectUnknown(entry, new Set(["path", "url", "note"]), entryPath, issues);
    const hasPath = typeof entry.path === "string" && entry.path.trim() !== "";
    const hasUrl = typeof entry.url === "string" && entry.url.trim() !== "";
    if (hasPath === hasUrl) issue(issues, entryPath, "must contain exactly one path or url", "Use one local path or one HTTP(S) URL.");
    if (hasUrl) {
      try {
        const url = new URL(entry.url);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        issue(issues, `${entryPath}.url`, "must be an HTTP or HTTPS URL", "Use an approved HTTP(S) evidence URL.");
      }
    }
    const note = requiredString(entry.note, entryPath, issues);
    return hasPath ? { path: entry.path.trim(), note } : { url: entry.url?.trim(), note };
  }).filter(Boolean);
}

function validateReview(value, path_, claim, issues) {
  if (value === undefined) return { state: "pending" };
  if (!isObject(value)) {
    issue(issues, path_, "must be an object", "Provide review state, or omit review for pending work.");
    return { state: "pending" };
  }
  rejectUnknown(value, new Set(["state", "reviewer", "timestamp", "digest"]), path_, issues);
  const state = requiredString(value.state, `${path_}.state`, issues);
  if (state && !REVIEW_STATES.has(state)) issue(issues, `${path_}.state`, "is not a supported review state", "Use pending, approved, or rejected.");
  if (state === "pending") return { state };
  const reviewer = requiredString(value.reviewer, `${path_}.reviewer`, issues);
  const timestamp = requiredString(value.timestamp, `${path_}.timestamp`, issues);
  const reviewDigest = requiredString(value.digest, `${path_}.digest`, issues);
  if (reviewDigest && !DIGEST.test(reviewDigest)) issue(issues, `${path_}.digest`, "must be a SHA-256 digest", "Use 64 hexadecimal characters.");
  if (timestamp && Number.isNaN(Date.parse(timestamp))) issue(issues, `${path_}.timestamp`, "must be an ISO timestamp", "Use an ISO-8601 timestamp.");
  return { state, reviewer, timestamp, digest: reviewDigest };
}

export function validateEvidenceLedger(parsed, { baseDirectory = process.cwd(), checkPaths = true, allowStaleReviews = false } = {}) {
  const issues = [];
  if (!isObject(parsed)) {
    issue(issues, "$", "must be an object", "Provide a claims ledger object.");
    return { issues, ledger: null };
  }
  rejectUnknown(parsed, new Set(["version", "inventory", "claims", "pageMapReview"]), "$", issues);
  if (parsed.version !== 1) issue(issues, "$.version", "must be the supported ledger version 1", "Set version to 1.");
  const inventory = parsed.inventory;
  const normalizedInventory = {};
  if (!isObject(inventory)) {
    issue(issues, "$.inventory", "must be an object", "Record every evidence class as examined or not-applicable.");
  } else {
    for (const key of Object.keys(inventory)) if (!EVIDENCE_CLASSES.includes(key)) issue(issues, `$.inventory.${key}`, "is not a supported evidence class", "Use one of the documented evidence classes.");
    for (const evidenceClass of EVIDENCE_CLASSES) {
      const entry = inventory[evidenceClass];
      const entryPath = `$.inventory.${evidenceClass}`;
      if (!isObject(entry)) {
        issue(issues, entryPath, "must be an object", "Provide status, paths, and a not-applicable reason when needed.");
        continue;
      }
      rejectUnknown(entry, new Set(["status", "paths", "reason", "notes"]), entryPath, issues);
      const status = requiredString(entry.status, `${entryPath}.status`, issues);
      if (status && !["examined", "not-applicable"].includes(status)) issue(issues, `${entryPath}.status`, "is not supported", "Use examined or not-applicable.");
      const paths = arrayOfStrings(entry.paths ?? [], `${entryPath}.paths`, issues);
      const reason = entry.reason === undefined ? undefined : requiredString(entry.reason, `${entryPath}.reason`, issues);
      if (status === "not-applicable" && !reason) issue(issues, `${entryPath}.reason`, "is required for not-applicable evidence", "Explain why this evidence class does not apply.");
      if (status === "examined" && paths.length === 0) issue(issues, `${entryPath}.paths`, "must name examined sources", "List at least one path or explain that the class is not applicable.");
      normalizedInventory[evidenceClass] = { status, paths, ...(reason ? { reason } : {}), ...(entry.notes ? { notes: String(entry.notes) } : {}) };
    }
  }
  if (!Array.isArray(parsed.claims)) {
    issue(issues, "$.claims", "must be an array", "Provide an array of material claims.");
  }
  const ids = new Set();
  const claims = (Array.isArray(parsed.claims) ? parsed.claims : []).map((value, index) => {
    const claimPath = `$.claims[${index}]`;
    if (!isObject(value)) {
      issue(issues, claimPath, "must be an object", "Provide a claim record.");
      return null;
    }
    rejectUnknown(value, new Set(["id", "statement", "basis", "topics", "evidence", "targets", "review"]), claimPath, issues);
    const id = requiredString(value.id, `${claimPath}.id`, issues);
    if (id && !SAFE_ID.test(id)) issue(issues, `${claimPath}.id`, "contains unsafe characters", "Use letters, numbers, hyphens, or underscores.");
    if (id && ids.has(id)) issue(issues, `${claimPath}.id`, "duplicates another claim ID", "Use a unique stable claim ID.");
    if (id) ids.add(id);
    const statement = requiredString(value.statement, `${claimPath}.statement`, issues);
    const basis = requiredString(value.basis, `${claimPath}.basis`, issues);
    if (basis && !CLAIM_BASES.has(basis)) issue(issues, `${claimPath}.basis`, "is not a supported claim basis", "Use confirmed-evidence, maintainer-provided-intent, inference-awaiting-confirmation, or unresolved.");
    const topics = arrayOfStrings(value.topics, `${claimPath}.topics`, issues);
    if (topics.length === 0) issue(issues, `${claimPath}.topics`, "must contain at least one topic", "Tag the claim for publication coverage.");
    const evidence = validateEvidence(value.evidence, `${claimPath}.evidence`, issues);
    const targets = isObject(value.targets) ? value.targets : (issue(issues, `${claimPath}.targets`, "must be an object", "Provide page IDs and optional LikeC4 element IDs."), {});
    rejectUnknown(targets, new Set(["pages", "elements"]), `${claimPath}.targets`, issues);
    const pages = arrayOfStrings(targets.pages ?? [], `${claimPath}.targets.pages`, issues);
    const elements = arrayOfStrings(targets.elements ?? [], `${claimPath}.targets.elements`, issues);
    if (pages.length === 0) issue(issues, `${claimPath}.targets.pages`, "must reference at least one page", "Attach each material claim to a curated page.");
    const review = validateReview(value.review, `${claimPath}.review`, { id, statement, basis, topics, evidence, targets: { pages, elements } }, issues);
    const claim = { id, statement, basis, topics, evidence, targets: { pages, elements }, review };
    if (review.digest && review.digest !== claimDigest(claim) && !allowStaleReviews) issue(issues, `${claimPath}.review.digest`, "does not match the current claim", "Re-review this claim after changing its statement, basis, evidence, topics, or targets.");
    if (checkPaths) for (const [evidenceIndex, entry] of evidence.entries()) if (entry.path && (entry.path.startsWith("/") || entry.path.split(/[\\/]/).includes(".."))) issue(issues, `${claimPath}.evidence[${evidenceIndex}].path`, "must be a safe repository-relative path", "Use a path without absolute or parent traversal segments.");
    return claim;
  }).filter(Boolean);

  let pageMapReview;
  if (parsed.pageMapReview !== undefined) {
    pageMapReview = validateReview(parsed.pageMapReview, "$.pageMapReview", null, issues);
  } else pageMapReview = { state: "pending" };
  return { issues, ledger: { version: 1, inventory: normalizedInventory, claims, pageMapReview } };
}

export async function loadEvidenceLedger(ledgerPath, options = {}) {
  const absolutePath = path.resolve(ledgerPath);
  let source;
  try {
    source = await readFile(absolutePath, "utf8");
  } catch (cause) {
    throw new ArchitectureDocsLedgerError(absolutePath, [{ path: "$", message: "ledger file could not be read", expected: "Provide a readable evidence/claims.json file." }], { cause });
  }
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (cause) {
    throw new ArchitectureDocsLedgerError(absolutePath, [{ path: "$", message: "contains malformed JSON", expected: "Fix the JSON syntax and try again." }], { cause });
  }
  const result = validateEvidenceLedger(parsed, { baseDirectory: path.dirname(absolutePath), ...options });
  if (options.checkEvidenceFiles) {
    for (const [inventoryClass, entry] of Object.entries(result.ledger?.inventory ?? {})) {
      for (const [pathIndex, sourcePath] of entry.paths.entries()) {
        if (sourcePath.startsWith("/") || sourcePath.split(/[\\\\/]/).includes("..")) {
          issue(result.issues, `$.inventory.${inventoryClass}.paths[${pathIndex}]`, "must be a safe repository-relative path", "Use a path without absolute or parent traversal segments.");
          continue;
        }
        try { await stat(path.resolve(options.baseDirectory ?? path.dirname(absolutePath), sourcePath)); }
        catch { issue(result.issues, `$.inventory.${inventoryClass}.paths[${pathIndex}]`, "does not exist", "Point to an existing repository source."); }
      }
    }
    for (const [claimIndex, claim] of result.ledger?.claims?.entries() ?? []) {
      for (const [evidenceIndex, entry] of claim.evidence.entries()) {
        if (!entry.path) continue;
        try { if (!(await stat(path.resolve(options.baseDirectory ?? path.dirname(absolutePath), entry.path))).isFile()) throw new Error(); }
        catch { issue(result.issues, `$.claims[${claimIndex}].evidence[${evidenceIndex}].path`, "does not exist", "Point to an existing repository evidence file."); }
      }
    }
  }
  if (result.issues.length) throw new ArchitectureDocsLedgerError(absolutePath, result.issues);
  return { ...result.ledger, ledgerPath: absolutePath };
}

export function claimStatus(claims) {
  return claims.map((claim) => {
    const approved = claim.review.state === "approved" && claim.review.digest === claimDigest(claim);
    return { ...claim, approved, provisional: !approved };
  });
}

export function assertPageMapApproval(ledger, pages) {
  const review = ledger.pageMapReview;
  const current = pageMapDigest(pages);
  if (review.state !== "approved" || review.digest !== current) {
    return { ok: false, code: "PAGE_MAP_REVIEW_STALE", digest: current, message: "The curated page map is not currently approved." };
  }
  return { ok: true, digest: current };
}

export function approveClaimsAndPageMap(ledger, { claimIds, pages, reviewer, timestamp = new Date().toISOString() }) {
  const ids = new Set(claimIds);
  const claims = ledger.claims.map((claim) => ids.has(claim.id)
    ? { ...claim, review: { state: "approved", reviewer, timestamp, digest: claimDigest(claim) } }
    : claim);
  return {
    ...ledger,
    claims,
    pageMapReview: { state: "approved", reviewer, timestamp, digest: pageMapDigest(pages) },
  };
}
