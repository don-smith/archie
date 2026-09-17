import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  evaluateArchieDocumentation,
  isActiveArchieDocumentationPage,
  isArchieDocumentationActive,
} from "../src/architecture-docs/archie-documentation.mjs";

const guideText = [
  "<!-- archie-guide:v3 -->",
  "<!-- archie-topic:overview -->",
  "<!-- archie-topic:stewardship -->",
  "<!-- archie-capability:assessment:problem -->",
  "<!-- archie-capability:assessment:start -->",
].join("\n");
const completePage = `${guideText}\n`;
const validArea = { id: "archie", title: "Archie", slug: "archie" };

async function managedTarget() {
  const configDirectory = await mkdtemp(path.join(process.cwd(), ".tmp-archie-documentation-"));
  await mkdir(path.join(configDirectory, ".archie"));
  await writeFile(path.join(configDirectory, ".archie/version"), "1.0.0\n");
  return configDirectory;
}

async function evaluate(configDirectory, overrides = {}) {
  return evaluateArchieDocumentation({
    configDirectory,
    areas: [validArea],
    guideText,
    pageText: completePage,
    ...overrides,
  });
}

function warning(code, path_, message, expected) {
  return { severity: "warning", code, path: path_, message, expected };
}

test("Archie documentation activation follows the target version marker", async () => {
  const configDirectory = await mkdtemp(path.join(process.cwd(), ".tmp-archie-documentation-"));
  try {
    assert.equal(await isArchieDocumentationActive(configDirectory), false);
    await mkdir(path.join(configDirectory, ".archie"));
    await writeFile(path.join(configDirectory, ".archie/version"), "1.0.0\n");
    assert.equal(await isArchieDocumentationActive(configDirectory), true);
  } finally {
    await rm(configDirectory, { recursive: true, force: true });
  }
});

test("the active Archie-page predicate requires installation and the Archie page ID", () => {
  assert.equal(isActiveArchieDocumentationPage(true, validArea), true);
  assert.equal(isActiveArchieDocumentationPage(false, validArea), false);
  assert.equal(isActiveArchieDocumentationPage(true, { ...validArea, id: "architecture" }), false);
  assert.equal(isActiveArchieDocumentationPage(true, undefined), false);
});

test("an uninstalled target has no Archie warnings even when it has an Archie area", async () => {
  const configDirectory = await mkdtemp(path.join(process.cwd(), ".tmp-archie-documentation-"));
  try {
    assert.deepEqual(await evaluate(configDirectory, {
      guideText: undefined,
      guideReadError: new Error("guide unavailable"),
      pageText: "",
    }), []);
  } finally {
    await rm(configDirectory, { recursive: true, force: true });
  }
});

test("an unreadable or malformed deployed guide produces only the guide warning", async () => {
  const configDirectory = await managedTarget();
  try {
    const expected = [warning(
      "ARCHIE_GUIDE_UNREADABLE",
      ".agents/skills/archie/references/managed-site-guide.md",
      "deployed Archie guide could not be read or its marker contract is invalid",
      "Deploy a readable guide with one version marker and unique required topic and capability markers.",
    )];
    assert.deepEqual(await evaluate(configDirectory, {
      guideText: undefined,
      guideReadError: new Error("permission denied"),
    }), expected);
    assert.deepEqual(await evaluate(configDirectory, {
      guideText: "<!-- archie-guide:v3 -->\n<!-- archie-topic:overview -->\n<!-- archie-topic:overview -->\n",
    }), expected);
  } finally {
    await rm(configDirectory, { recursive: true, force: true });
  }
});

test("the evaluator reads the target-relative deployed guide when no guide result is supplied", async () => {
  const configDirectory = await managedTarget();
  try {
    const deployedGuide = path.join(configDirectory, ".agents/skills/archie/references/managed-site-guide.md");
    await mkdir(path.dirname(deployedGuide), { recursive: true });
    await writeFile(deployedGuide, guideText);
    assert.deepEqual(await evaluateArchieDocumentation({
      configDirectory,
      areas: [validArea],
      pageText: completePage,
    }), []);
  } finally {
    await rm(configDirectory, { recursive: true, force: true });
  }
});

test("a managed target requires exactly one Archie area", async () => {
  const configDirectory = await managedTarget();
  try {
    assert.deepEqual(await evaluate(configDirectory, { areas: [] }), [warning(
      "ARCHIE_AREA_MISSING",
      "$.pages.areas",
      "Archie-managed target has no Archie area",
      "Add exactly one pages.areas record with id, title, and slug set to Archie values.",
    )]);
    assert.deepEqual(await evaluate(configDirectory, { areas: [validArea, { ...validArea }] }), [warning(
      "ARCHIE_AREA_DUPLICATE",
      "$.pages.areas",
      "Archie-managed target has 2 Archie areas",
      "Keep exactly one pages.areas record whose id is \"archie\".",
    )]);
  } finally {
    await rm(configDirectory, { recursive: true, force: true });
  }
});

test("the Archie area uses the stable title and slug", async () => {
  const configDirectory = await managedTarget();
  try {
    assert.deepEqual(await evaluate(configDirectory, {
      areas: [{ id: "archie", title: "Architecture assistant", slug: "assistant" }],
    }), [warning(
      "ARCHIE_AREA_METADATA_INVALID",
      "$.pages.areas[0]",
      "Archie area title or slug does not match the managed-site contract",
      "Set title to \"Archie\" and slug to \"archie\".",
    )]);
  } finally {
    await rm(configDirectory, { recursive: true, force: true });
  }
});

test("the Archie page requires one current guide version", async () => {
  const configDirectory = await managedTarget();
  try {
    const withoutVersion = completePage.replace("<!-- archie-guide:v3 -->\n", "");
    assert.deepEqual(await evaluate(configDirectory, { pageText: withoutVersion }), [warning(
      "ARCHIE_GUIDE_VERSION_MISSING",
      "$.pages.areas[0].markdown",
      "Archie page has no guide version marker",
      "Include <!-- archie-guide:v3 --> exactly once.",
    )]);

    const staleVersion = completePage.replace("archie-guide:v3", "archie-guide:v2");
    assert.deepEqual(await evaluate(configDirectory, { pageText: staleVersion }), [warning(
      "ARCHIE_GUIDE_VERSION_MISMATCH",
      "$.pages.areas[0].markdown",
      "Archie page uses guide version \"v2\" instead of \"v3\"",
      "Adapt the deployed guide and include <!-- archie-guide:v3 --> exactly once.",
    )]);
  } finally {
    await rm(configDirectory, { recursive: true, force: true });
  }
});

test("the Archie page reports missing and duplicate required markers", async () => {
  const configDirectory = await managedTarget();
  try {
    const missing = completePage.replace("<!-- archie-topic:stewardship -->\n", "");
    assert.deepEqual(await evaluate(configDirectory, { pageText: missing }), [warning(
      "ARCHIE_MARKER_MISSING",
      "$.pages.areas[0].markdown",
      "Archie page is missing required marker <!-- archie-topic:stewardship -->",
      "Include <!-- archie-topic:stewardship --> exactly once.",
    )]);

    const marker = "<!-- archie-capability:assessment:problem -->";
    const duplicate = `${completePage}${marker}\n`;
    assert.deepEqual(await evaluate(configDirectory, { pageText: duplicate }), [warning(
      "ARCHIE_MARKER_DUPLICATE",
      "$.pages.areas[0].markdown",
      `Archie page contains required marker ${marker} 2 times`,
      `Include ${marker} exactly once.`,
    )]);
  } finally {
    await rm(configDirectory, { recursive: true, force: true });
  }
});

test("duplicate guide-version markers use the stable duplicate-marker warning", async () => {
  const configDirectory = await managedTarget();
  try {
    const marker = "<!-- archie-guide:v3 -->";
    assert.deepEqual(await evaluate(configDirectory, { pageText: `${completePage}${marker}\n` }), [warning(
      "ARCHIE_MARKER_DUPLICATE",
      "$.pages.areas[0].markdown",
      `Archie page contains guide version markers 2 times`,
      `Include ${marker} exactly once.`,
    )]);
  } finally {
    await rm(configDirectory, { recursive: true, force: true });
  }
});

test("rendered HTML comments use the same complete, duplicate, and stale contract", async () => {
  const configDirectory = await managedTarget();
  try {
    const rendered = `<html><body>${completePage}</body></html>`;
    assert.deepEqual(await evaluate(configDirectory, { pageText: rendered }), []);
    assert.deepEqual(
      (await evaluate(configDirectory, { pageText: rendered.replace("</body>", "<!-- archie-topic:overview --></body>") })).map(({ code }) => code),
      ["ARCHIE_MARKER_DUPLICATE"],
    );
    assert.deepEqual(
      (await evaluate(configDirectory, { pageText: rendered.replace("archie-guide:v3", "archie-guide:v2") })).map(({ code }) => code),
      ["ARCHIE_GUIDE_VERSION_MISMATCH"],
    );
  } finally {
    await rm(configDirectory, { recursive: true, force: true });
  }
});

test("a complete current Archie page produces no warnings", async () => {
  const configDirectory = await managedTarget();
  try {
    assert.deepEqual(await evaluate(configDirectory), []);
  } finally {
    await rm(configDirectory, { recursive: true, force: true });
  }
});
