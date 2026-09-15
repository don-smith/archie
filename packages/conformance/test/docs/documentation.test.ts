import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("documents the supported compiler pin, CLI, and exit codes", async () => {
  const readme = await readFile("README.md", "utf8");
  const support = await readFile("docs/typescript-support.md", "utf8");
  const policy = await readFile("docs/compiler-upgrade-policy.md", "utf8");
  assert.match(readme, /How the commands fit together/); assert.match(readme, /`check` does not consume a graph file/); assert.match(readme, /--format text/); assert.match(readme, /typescript-program-v1/); assert.match(readme, /\| 0 \|/); assert.match(readme, /\| 3 \|/);
  assert.match(readme, /npx --no-install architecture-conformance/); assert.match(readme, /onboarding-state\/v1/); assert.match(readme, /onboarding-summary/); assert.match(readme, /exact devDependency/); assert.match(readme, /--exclude/); assert.match(readme, /string-literal dynamic imports/);
  assert.match(readme, /Replay evidence/); assert.match(readme, /--state/); assert.match(readme, /--map/); assert.match(readme, /Reconcile local drift records/); assert.match(readme, /architecture-active-result-set\/v1/); assert.match(readme, /resolvedCandidates/);
  assert.match(support, /workspace package imports/); assert.match(support, /declared `rootDir`/); assert.match(support, /string-literal dynamic imports/); assert.match(support, /7\.0\.2/); assert.match(policy, /Do not update it as routine dependency maintenance/);
});
