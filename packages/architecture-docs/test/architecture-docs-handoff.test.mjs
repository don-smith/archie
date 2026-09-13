import assert from "node:assert/strict";
import test from "node:test";
import { buildHandoffDelta } from "../src/architecture-docs/handoff-delta.mjs";
import { viewSemanticDigest } from "../src/architecture-docs/view-semantics.mjs";

function view(edgeId, positions) {
  return { id: "context", $view: {
    _type: "element", viewOf: "system", title: "Context", description: { txt: "A context view." },
    hash: "compiler-hash", bounds: { x: 0, y: 0, width: 100, height: 100 },
    nodes: [
      { id: "a", modelRef: "a", kind: "system", title: "A", description: { txt: "A system." }, x: positions[0], y: positions[1] },
      { id: "b", modelRef: "b", kind: "system", title: "B", description: { txt: "B system." }, x: positions[2], y: positions[3] },
    ],
    edges: [{ id: edgeId, source: "a", target: "b", label: "Uses", relations: ["generated-relation-id"], points: positions }],
  } };
}

test("view semantics ignore compiler layout and generated relationship IDs", () => {
  assert.equal(viewSemanticDigest(view("one", [0, 0, 10, 10])), viewSemanticDigest(view("two", [80, 20, 4, 90])));
});

test("handoff deltas identify content, review, page, and view changes", () => {
  const claim = { id: "claim", statement: "Old", basis: "confirmed-evidence", topics: ["purpose"], evidence: [{ path: "README.md", note: "source" }], targets: { pages: ["home"], elements: [] }, review: { state: "pending" } };
  const previous = {
    manifest: { digests: { handoff: "before", pages: { home: "page-before" } } },
    claims: { claims: [claim] },
    pageMap: { home: { id: "home", title: "Home", summary: "Old", markdown: "pages/home.md", viewIds: ["context"], claimIds: ["claim"] }, areas: [] },
    views: { views: [{ id: "context", semanticDigest: "view-before" }] },
  };
  const changedClaim = { ...claim, statement: "New", review: { state: "approved", reviewer: "maintainer", timestamp: "2026-01-01T00:00:00Z", digest: "x" } };
  const current = {
    manifest: { digests: { handoff: "after", pages: { home: "page-after" } } },
    claims: { claims: [changedClaim, { ...claim, id: "added" }] },
    pageMap: { home: { ...previous.pageMap.home, summary: "New" }, areas: [{ id: "runtime", title: "Runtime", summary: "Area", markdown: "pages/runtime.md", viewIds: [], claimIds: [] }] },
    views: { views: [{ id: "context", semanticDigest: "view-after" }, { id: "new-view", semanticDigest: "new" }] },
  };
  const delta = buildHandoffDelta({ previous, current });
  assert.deepEqual(delta.claims.added, ["added"]);
  assert.deepEqual(delta.claims.reviewChanged, ["claim"]);
  assert.equal(delta.claims.changed.find((entry) => entry.id === "claim").kind, "content");
  assert.deepEqual(delta.pages.added, ["runtime"]);
  assert.equal(delta.pages.changed[0].id, "home");
  assert.deepEqual(delta.views.added, ["new-view"]);
  assert.equal(delta.views.changed[0].id, "context");
});
