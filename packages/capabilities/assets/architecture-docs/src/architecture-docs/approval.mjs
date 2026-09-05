import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { approveClaimsAndPageMap, loadEvidenceLedger } from "./evidence-ledger.mjs";

export async function approveArchitectureDocsLedger(ledgerPath, { claimIds, pages, reviewer, timestamp } = {}) {
  if (!reviewer || typeof reviewer !== "string" || !reviewer.trim()) throw new TypeError("A maintainer reviewer is required; approval never infers identity.");
  if (!Array.isArray(claimIds) || claimIds.length === 0) throw new TypeError("Select at least one claim explicitly before approving.");
  if (!Array.isArray(pages) || pages.length === 0) throw new TypeError("The ordered page map is required before approval.");
  const ledger = await loadEvidenceLedger(ledgerPath, { allowStaleReviews: true });
  const updated = approveClaimsAndPageMap(ledger, { claimIds, pages, reviewer: reviewer.trim(), timestamp });
  const target = path.resolve(ledgerPath);
  const temporary = `${target}.approval-${process.pid}-${Date.now()}`;
  const serializable = { version: 1, inventory: updated.inventory, claims: updated.claims, pageMapReview: updated.pageMapReview };
  await writeFile(temporary, `${JSON.stringify(serializable, null, 2)}\n`, "utf8");
  await rename(temporary, target);
  return updated;
}
