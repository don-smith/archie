import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { approveArchitectureDocsLedger } from "../src/architecture-docs/approval.mjs";
import { buildArchitectureDocs } from "../src/architecture-docs/index.mjs";
import { checkArchitectureDocs } from "../src/architecture-docs/checker.mjs";
import { pageMapDigest } from "../src/architecture-docs/evidence-ledger.mjs";

const fixture = path.resolve("test/fixtures/architecture-docs");
async function setup() { const directory = await mkdtemp(path.join(process.cwd(), ".tmp-publication-")); await cp(fixture, directory, { recursive: true }); return { directory, config: path.join(directory, "architecture-docs.config.json"), ledger: path.join(directory, "evidence/claims.json") }; }

test("preview accepts provisional claims and reports the current page-map digest", async () => {
  const temporary = await setup();
  try {
    await buildArchitectureDocs(temporary.config);
    const report = await checkArchitectureDocs(temporary.config, { mode: "preview" });
    assert.equal(report.ok, true); assert.equal(report.provisionalClaimCount, 2); assert.equal(report.pageMapDigest, pageMapDigest([{ id: "home", title: "Orientation", summary: "A safe orientation.", markdown: "pages/home.md", viewIds: ["systemContext"], claimIds: ["purpose"], initialViewId: "systemContext" }, { id: "runtime", title: "Runtime", summary: "The worker area.", markdown: "pages/runtime.md", viewIds: ["containers", "components"], claimIds: ["runtime"], initialViewId: "containers", slug: "runtime" }]));
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("approval CLI keeps a rooted configuration's page-map review current", async () => {
  const directory = await mkdtemp(path.join(process.cwd(), ".tmp-rooted-approval-"));
  try {
    const authoredRoot = path.join(directory, "architecture");
    await cp(fixture, directory, { recursive: true });
    await cp(fixture, authoredRoot, { recursive: true });
    const configPath = path.join(directory, "architecture-docs.config.json");
    const config = JSON.parse(await readFile(path.join(authoredRoot, "architecture-docs.config.json"), "utf8"));
    config.root = "architecture";
    await writeFile(configPath, JSON.stringify(config));
    await buildArchitectureDocs(configPath);

    const approval = spawnSync(process.execPath, ["scripts/approve-architecture-docs.mjs", "--config", configPath, "--reviewer", "maintainer@example.test", "--claims", "purpose,runtime"], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(approval.status, 0, approval.stderr);
    const report = await checkArchitectureDocs(configPath, { mode: "publication" });
    assert.equal(report.diagnostics.some((entry) => entry.path === "$.pageMapReview"), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("publication allows a prose-only area page", async () => {
  const temporary = await setup();
  try {
    const config = JSON.parse(await readFile(temporary.config, "utf8"));
    config.pages.areas[0].viewIds = [];
    delete config.pages.areas[0].initialViewId;
    await writeFile(temporary.config, JSON.stringify(config));
    await buildArchitectureDocs(temporary.config);
    const pages = [config.pages.home, ...config.pages.areas];
    await approveArchitectureDocsLedger(temporary.ledger, { claimIds: ["purpose", "runtime"], pages, reviewer: "maintainer@example.test" });
    const report = await checkArchitectureDocs(temporary.config, { mode: "publication" });
    assert.equal(report.diagnostics.some((entry) => entry.path === "$.pages.areas[0].viewIds"), false);
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("publication rejects a stale handoff after authored Markdown changes", async () => {
  const temporary = await setup();
  try {
    await buildArchitectureDocs(temporary.config);
    await writeFile(path.join(temporary.directory, "pages/home.md"), "# Changed narrative\\n");
    const report = await checkArchitectureDocs(temporary.config, { mode: "publication" });
    assert.ok(report.diagnostics.some((entry) => entry.code === "HANDOFF_STALE" && entry.path.includes("pages.home")));
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("publication rejects changed supplemental bytes until a rebuild copies the current bytes", async () => {
  const temporary = await setup();
  try {
    await writeFile(path.join(temporary.directory, "checks.bin"), Buffer.from([0, 255, 10, 13]));
    const config = JSON.parse(await readFile(temporary.config, "utf8"));
    config.supplementalInputs = [{ id: "checks", source: "checks.bin", destination: "supplemental/checks.bin" }];
    await writeFile(temporary.config, JSON.stringify(config));
    await buildArchitectureDocs(temporary.config);

    await writeFile(path.join(temporary.directory, "checks.bin"), Buffer.from([1, 2, 3]));
    const stale = await checkArchitectureDocs(temporary.config, { mode: "publication" });
    assert.ok(stale.diagnostics.some((entry) => entry.code === "HANDOFF_STALE" && entry.path === "$.handoff.supplementalInputs[0]"));

    await buildArchitectureDocs(temporary.config);
    const rebuilt = await checkArchitectureDocs(temporary.config, { mode: "publication" });
    assert.equal(rebuilt.diagnostics.some((entry) => entry.code === "HANDOFF_STALE" && entry.path === "$.handoff.supplementalInputs[0]"), false);
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("publication rejects a stale or incomplete approval rather than hiding provisional claims", async () => {
  const temporary = await setup();
  try {
    await buildArchitectureDocs(temporary.config);
    const report = await checkArchitectureDocs(temporary.config, { mode: "publication" });
    assert.equal(report.ok, false);
    assert.ok(report.diagnostics.some((entry) => entry.path === "$.pageMapReview"));
    assert.ok(report.diagnostics.some((entry) => entry.message.includes("purpose") || entry.message.includes("actors")));
    const config = JSON.parse(await readFile(temporary.config, "utf8"));
    const pages = [config.pages.home, ...config.pages.areas];
    await approveArchitectureDocsLedger(temporary.ledger, { claimIds: ["purpose", "runtime"], pages, reviewer: "maintainer@example.test" });
    const stale = JSON.parse(await readFile(temporary.ledger, "utf8")); stale.claims[0].statement = "Changed after approval"; await writeFile(temporary.ledger, JSON.stringify(stale));
    await assert.rejects(checkArchitectureDocs(temporary.config, { mode: "publication" }));
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});
