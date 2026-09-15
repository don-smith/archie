import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { defaultOnboardingState, validateOnboardingState } from "../../src/onboarding-state/validate.js";
import { advanceOnboardingState } from "../../src/onboarding-state/update.js";

const scope = { rootConfigs: ["tsconfig.json"], include: ["src/**/*.ts"], exclusions: [] };

test("initializes operational-only onboarding state with safe defaults", () => {
  const state = defaultOnboardingState({ scope, skillLocation: ".agents/skills/architecture-conformance-onboarding" });
  assert.equal(state.version, "onboarding-state/v1");
  assert.equal(state.checkpoint, "scope-selected");
  assert.equal(state.paths.graph, ".architecture-conformance/evidence/observed-graph.json");
  assert.equal(state.paths.map, ".architecture-conformance/realization-map.json");
  assert.deepEqual(state.evidence, {});
});

test("rejects normative content, unsafe paths, unknown versions, and invalid evidence transitions", async () => {
  const state = defaultOnboardingState({ scope, skillLocation: "skills/onboarding" });
  assert.throws(() => validateOnboardingState({ ...state, version: "onboarding-state/v2" }), /unsupported document version/);
  assert.throws(() => validateOnboardingState({ ...state, paths: { ...state.paths, graph: "../graph.json" } }), /repository-relative/);
  assert.throws(() => validateOnboardingState({ ...state, approval: { approvedBy: "agent" } }), /unknown field/);
  const root = await mkdtemp(join(tmpdir(), "architecture-conformance-state-"));
  await mkdir(join(root, ".architecture-conformance", "evidence"), { recursive: true });
  await writeFile(join(root, ".architecture-conformance", "evidence", "observed-graph.json"), "{}\n");
  assert.throws(
    () => advanceOnboardingState(state, { checkpoint: "classification-drafted" }, root),
    /invalid checkpoint transition/
  );
});

test("advances only with required, digest-matched deterministic evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "architecture-conformance-state-"));
  const state = defaultOnboardingState({ scope, skillLocation: "skills/onboarding" });
  await mkdir(join(root, ".architecture-conformance", "evidence"), { recursive: true });
  await writeFile(join(root, ".architecture-conformance", "evidence", "observed-graph.json"), "{\"version\":1}\n");
  await writeFile(join(root, ".architecture-conformance", "evidence", "onboarding-summary.md"), "# Evidence\n");
  const advanced = await advanceOnboardingState(state, { checkpoint: "evidence-generated" }, root);
  assert.equal(advanced.checkpoint, "evidence-generated");
  assert.equal(Object.keys(advanced.evidence).sort().join(","), "graph,summary");
  await writeFile(join(root, ".architecture-conformance", "evidence", "observed-graph.json"), "changed\n");
  assert.throws(() => validateOnboardingState(advanced, root), /digest mismatch/);
});
