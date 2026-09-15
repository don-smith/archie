import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(process.cwd(), "../..");

test("parity harness and accepted matrix are present at the product seam", async () => {
  await assert.doesNotReject(access(resolve(repositoryRoot, "scripts/compare-conformance.mjs")));
  const manifest = JSON.parse(await readFile(resolve(repositoryRoot, "packages/conformance/test/fixtures/parity/cases.json"), "utf8")) as { cases: string[]; allowedUnstableFields: string[] };
  assert.deepEqual(manifest.cases.slice(0, 10), ["valid", "violation", "strict-gap", "dependency", "cycle", "exception", "baseline", "replay", "reconciliation", "onboarding"]);
  assert.deepEqual(manifest.allowedUnstableFields, ["stderr.absoluteFixtureRoot"]);
});
