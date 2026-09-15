import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const excluded = "conformance-import-boundary.test.mjs";
const forbidden = /(?:@archie\/conformance\/(?:src|dist)|packages\/conformance\/(?:src|dist)\/?)/;

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && !["node_modules", ".git", "dist", ".test-dist", "conformance"].includes(entry.name)) files.push(...await sourceFiles(path));
    else if (entry.isFile() && /\.(?:mjs|ts|json)$/.test(entry.name) && entry.name !== excluded) files.push(path);
  }
  return files;
}

test("consumers use the public Conformance package boundary", async () => {
  const files = await sourceFiles(join(root, "packages"));
  const violations = [];
  for (const file of files) if (forbidden.test(await readFile(file, "utf8"))) violations.push(file);
  assert.deepEqual(violations, []);

  const publicApi = await import("@archie/conformance");
  assert.equal(publicApi.CONFORMANCE_REPORT_V1, "conformance-report/v1");
  assert.equal(publicApi.ONBOARDING_STATE_V1, "onboarding-state/v1");
  assert.throws(() => publicApi.readConformanceReport({ version: "conformance-report/v2" }), /unsupported document version/);
  assert.throws(() => publicApi.readOnboardingState({ version: "onboarding-state/v2" }), /unsupported document version/);
});
