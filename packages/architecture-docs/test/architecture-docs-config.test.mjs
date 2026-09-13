import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadArchitectureDocsConfig } from "../src/architecture-docs/config.mjs";
import { ArchitectureDocsConfigurationError } from "../src/architecture-docs/errors.mjs";

const fixture = fileURLToPath(new URL("fixtures/architecture-docs/", import.meta.url));
const sourceConfig = path.join(fixture, "architecture-docs.config.json");
async function copyFixture() { const directory = await mkdtemp(path.join(process.cwd(), ".tmp-config-")); await cp(fixture, directory, { recursive: true }); return { directory, path: path.join(directory, "architecture-docs.config.json") }; }

test("normalizes the authored root, pages, and public metadata without absolute paths", async () => {
  const config = await loadArchitectureDocsConfig(sourceConfig);
  assert.equal(config.root, ".");
  assert.equal(config.pages.home.id, "home");
  assert.equal(config.pages.areas[0].slug, "runtime");
  assert.equal(config.pages.home.initialViewId, "systemContext");
  assert.equal(config.pages.areas[0].initialViewId, "containers");
  assert.equal(config.paths.outputDirectory, path.join(fixture, "preview"));
  assert.equal(JSON.stringify(config.publicConfig).includes(fixture), false);
});

test("rejects unknown fields, duplicate routes, and unsafe paths", async () => {
  const temporary = await copyFixture();
  try {
    const config = JSON.parse(await readFile(temporary.path, "utf8"));
    config.extra = true; config.root = "../escape"; config.pages.areas[0].slug = "runtime"; config.pages.areas.push({ ...config.pages.areas[0], id: "runtime-two", slug: "runtime" });
    await writeFile(temporary.path, JSON.stringify(config));
    await assert.rejects(loadArchitectureDocsConfig(temporary.path), (error) => {
      assert.ok(error instanceof ArchitectureDocsConfigurationError);
      const paths = error.issues.map((entry) => entry.path);
      return paths.includes("$.extra") && paths.includes("$.root") && paths.includes("$.pages");
    });
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("rejects an initial view that is not listed for the page", async () => {
  const temporary = await copyFixture();
  try {
    const config = JSON.parse(await readFile(temporary.path, "utf8"));
    config.pages.areas[0].initialViewId = "checkoutFlow";
    await writeFile(temporary.path, JSON.stringify(config));
    await assert.rejects(loadArchitectureDocsConfig(temporary.path), (error) => error instanceof ArchitectureDocsConfigurationError && error.issues.some((issue) => issue.path === "$.pages.areas[0].initialViewId"));
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("a failing configuration does not touch an existing generated sentinel", async () => {
  const temporary = await copyFixture(); const output = path.join(temporary.directory, "site");
  await mkdir(output, { recursive: true }); await writeFile(path.join(output, "sentinel.txt"), "keep\n");
  try {
    const config = JSON.parse(await readFile(temporary.path, "utf8")); config.sourceLinks.browserRoot = "file:///unsafe"; await writeFile(temporary.path, JSON.stringify(config));
    await assert.rejects(loadArchitectureDocsConfig(temporary.path));
    assert.equal(await readFile(path.join(output, "sentinel.txt"), "utf8"), "keep\n");
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("normalizes supplemental input declarations and a reviewed skill command without leaking absolute paths", async () => {
  const temporary = await copyFixture();
  try {
    await writeFile(path.join(temporary.directory, "checks.bin"), Buffer.from([0, 255, 10, 13]));
    const config = JSON.parse(await readFile(temporary.path, "utf8"));
    config.supplementalInputs = [{ id: "checks", source: "checks.bin", destination: "supplemental/checks.bin" }];
    config.skillCommand = ["node", "tools/architecture-docs.mjs"];
    await writeFile(temporary.path, JSON.stringify(config));

    const loaded = await loadArchitectureDocsConfig(temporary.path);
    assert.deepEqual(loaded.supplementalInputs, [{ id: "checks", source: "checks.bin", destination: "supplemental/checks.bin" }]);
    assert.deepEqual(loaded.skillCommand, ["node", "tools/architecture-docs.mjs"]);
    assert.equal(JSON.stringify(loaded.publicConfig).includes(temporary.directory), false);
    assert.equal(loaded.paths.supplementalInputs[0].sourcePath, path.join(temporary.directory, "checks.bin"));
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});

test("rejects unsafe or colliding supplemental declarations and invalid skill command argv", async () => {
  const temporary = await copyFixture();
  try {
    await writeFile(path.join(temporary.directory, "checks.bin"), "checks\n");
    const config = JSON.parse(await readFile(temporary.path, "utf8"));
    config.supplementalInputs = [
      { id: "checks", source: "checks.bin", destination: "pages" },
      { id: "checks", source: "checks.bin", destination: "supplemental/checks.bin" },
      { id: "escape", source: "../checks.bin", destination: "supplemental\\escape.bin" },
    ];
    config.skillCommand = ["node", ""];
    await writeFile(temporary.path, JSON.stringify(config));

    await assert.rejects(loadArchitectureDocsConfig(temporary.path), (error) => {
      assert.ok(error instanceof ArchitectureDocsConfigurationError);
      const paths = error.issues.map((issue) => issue.path);
      return paths.includes("$.supplementalInputs[0].destination")
        && paths.includes("$.supplementalInputs[1].id")
        && paths.includes("$.supplementalInputs[2].source")
        && paths.includes("$.supplementalInputs[2].destination")
        && paths.includes("$.skillCommand[1]");
    });
  } finally { await rm(temporary.directory, { recursive: true, force: true }); }
});
