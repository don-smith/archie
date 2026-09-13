import assert from "node:assert/strict";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { claimDigest, loadEvidenceLedger, pageMapDigest, validateEvidenceLedger } from "../src/architecture-docs/evidence-ledger.mjs";
import { ArchitectureDocsLedgerError } from "../src/architecture-docs/errors.mjs";

const fixture = fileURLToPath(new URL("fixtures/architecture-docs/evidence/claims.json", import.meta.url));
test("loads the ten-class ledger and computes stable claim/page-map digests", async () => {
  const ledger = await loadEvidenceLedger(fixture);
  assert.equal(Object.keys(ledger.inventory).length, 10);
  assert.match(claimDigest(ledger.claims[0]), /^[a-f0-9]{64}$/);
  assert.equal(claimDigest(ledger.claims[0]), claimDigest({ ...ledger.claims[0] }));
  assert.notEqual(pageMapDigest([{ id: "home" }]), pageMapDigest([{ id: "other" }]));
});

test("rejects malformed evidence, review state, and stale approval digests", () => {
  const result = validateEvidenceLedger({
    version: 1,
    inventory: {},
    claims: [{ id: "x", statement: "X", basis: "guess", topics: [], evidence: [], targets: { pages: [] }, review: { state: "approved", reviewer: "A", timestamp: "bad", digest: "00" } }],
    pageMapReview: { state: "approved", reviewer: "A", timestamp: "bad", digest: "00" },
  });
  const paths = result.issues.map((entry) => entry.path);
  assert.ok(paths.includes("$.inventory.manifests"));
  assert.ok(paths.includes("$.claims[0].basis"));
  assert.ok(paths.includes("$.claims[0].review.digest"));
  assert.ok(paths.includes("$.pageMapReview.timestamp"));
});

test("missing ledger is a typed failure", async () => {
  const directory = await mkdtemp(path.join(process.cwd(), ".tmp-ledger-"));
  try {
    await assert.rejects(loadEvidenceLedger(path.join(directory, "missing.json")), (error) => error instanceof ArchitectureDocsLedgerError && error.code === "LEDGER_INVALID");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
