#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const schema = JSON.parse(await readFile(new URL("../schemas/architecture-model.schema.json", import.meta.url), "utf8"));
const collectionPrefixes = {
  sources: "src-",
  inventory: "inv-",
  elements: "el-",
  relationships: "rel-",
  interfaces: "if-",
  flows: "flow-",
  data: "data-",
  terms: "term-",
  scenarios: "scn-",
  divergences: "div-",
  claims: "claim-",
  diagrams: "diag-",
};
const factCollections = ["elements", "relationships", "interfaces", "flows", "data", "terms", "scenarios", "divergences", "claims"];

function diagnostic(jsonPath, value, expected) {
  return `${jsonPath}: invalid value ${JSON.stringify(value)}; expected ${expected}`;
}

function typeMatches(value, type) {
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}

function resolveReference(reference) {
  if (!reference.startsWith("#/")) throw new Error(`Unsupported schema reference: ${reference}`);
  return reference.slice(2).split("/").reduce((value, part) => value[part.replaceAll("~1", "/").replaceAll("~0", "~")], schema);
}

function validateSchema(value, rule, jsonPath, errors) {
  if (rule.$ref) {
    validateSchema(value, resolveReference(rule.$ref), jsonPath, errors);
    return;
  }
  for (const part of rule.allOf ?? []) validateSchema(value, part, jsonPath, errors);
  if (Object.hasOwn(rule, "const") && value !== rule.const) errors.push(diagnostic(jsonPath, value, JSON.stringify(rule.const)));
  if (rule.enum && !rule.enum.includes(value)) errors.push(diagnostic(jsonPath, value, `one of ${rule.enum.join(", ")}`));
  if (rule.type && !typeMatches(value, rule.type)) {
    errors.push(diagnostic(jsonPath, value, rule.type === "array" ? "an array" : `a ${rule.type}`));
    return;
  }
  if (typeof value === "string") {
    if (rule.minLength && value.length < rule.minLength) errors.push(diagnostic(jsonPath, value, "a non-empty string"));
    if (rule.pattern && !(new RegExp(rule.pattern).test(value))) errors.push(diagnostic(jsonPath, value, `a string matching ${rule.pattern}`));
  }
  if (Array.isArray(value)) {
    if (rule.minItems && value.length < rule.minItems) errors.push(diagnostic(jsonPath, value, `at least ${rule.minItems} item(s)`));
    if (rule.uniqueItems) {
      const first = new Map();
      value.forEach((item, index) => {
        const key = JSON.stringify(item);
        if (first.has(key)) errors.push(diagnostic(`${jsonPath}[${index}]`, item, `a unique item; first used at ${jsonPath}[${first.get(key)}]`));
        else first.set(key, index);
      });
    }
    if (rule.items) value.forEach((item, index) => validateSchema(item, rule.items, `${jsonPath}[${index}]`, errors));
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const key of rule.required ?? []) {
      if (!Object.hasOwn(value, key)) errors.push(diagnostic(`${jsonPath}.${key}`, undefined, "a required field"));
    }
    for (const [key, childRule] of Object.entries(rule.properties ?? {})) {
      if (Object.hasOwn(value, key)) validateSchema(value[key], childRule, `${jsonPath}.${key}`, errors);
    }
    if (rule.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(rule.properties ?? {}, key)) errors.push(diagnostic(`${jsonPath}.${key}`, value[key], "no additional field"));
      }
    }
  }
}

function evidenceKinds(item, sources) {
  return item.evidence.map((reference) => sources.get(reference.sourceId)?.kind).filter(Boolean);
}

function checkFact(item, jsonPath, sources, errors) {
  item.evidence.forEach((reference, index) => {
    if (!sources.has(reference.sourceId)) {
      errors.push(diagnostic(`${jsonPath}.evidence[${index}].sourceId`, reference.sourceId, "an existing source ID"));
    }
  });
  if (item.certainty === "unresolved" && !item.gap?.trim()) {
    errors.push(diagnostic(`${jsonPath}.gap`, item.gap, "a non-empty gap for unresolved certainty"));
  }
  if (item.certainty !== "confirmed") return;
  const kinds = evidenceKinds(item, sources);
  if (["current", "both"].includes(item.state) && !kinds.some((kind) => ["code", "configuration"].includes(kind))) {
    errors.push(diagnostic(`${jsonPath}.evidence`, item.evidence, "code or configuration evidence for a confirmed current fact"));
  }
  if (["intended", "both"].includes(item.state) && !kinds.some((kind) => ["intent", "decision", "developer"].includes(kind))) {
    errors.push(diagnostic(`${jsonPath}.evidence`, item.evidence, "tracked intent or developer evidence for a confirmed intended fact"));
  }
}

/** Validate the closed schema first, then cross-references and readiness rules. */
export function validateModel(model) {
  const schemaErrors = [];
  validateSchema(model, schema, "$", schemaErrors);
  if (schemaErrors.length) return schemaErrors;

  const errors = [];
  const allIds = new Map();
  for (const [collection, prefix] of Object.entries(collectionPrefixes)) {
    model[collection].forEach((item, index) => {
      const idPath = `$.${collection}[${index}].id`;
      if (!item.id.startsWith(prefix)) errors.push(diagnostic(idPath, item.id, `a stable ID beginning with ${prefix}`));
      if (allIds.has(item.id)) errors.push(diagnostic(idPath, item.id, `a unique ID; first used at ${allIds.get(item.id)}`));
      else allIds.set(item.id, idPath);
    });
  }
  const recommendationIds = new Map();
  model.recommendations.forEach((item, index) => {
    const jsonPath = `$.recommendations[${index}].id`;
    if (recommendationIds.has(item.id)) errors.push(diagnostic(jsonPath, item.id, `a unique recommendation ID; first used at ${recommendationIds.get(item.id)}`));
    else recommendationIds.set(item.id, jsonPath);
  });

  const sources = new Map(model.sources.map((source) => [source.id, source]));
  for (const collection of factCollections) {
    model[collection].forEach((item, index) => checkFact(item, `$.${collection}[${index}]`, sources, errors));
  }

  const elements = new Set(model.elements.map((item) => item.id));
  const relationships = new Set(model.relationships.map((item) => item.id));
  const interfaces = new Set(model.interfaces.map((item) => item.id));
  const scenarios = new Set(model.scenarios.map((item) => item.id));

  model.relationships.forEach((relationship, index) => {
    for (const endpoint of ["from", "to"]) {
      if (!elements.has(relationship[endpoint])) errors.push(diagnostic(`$.relationships[${index}].${endpoint}`, relationship[endpoint], "an existing element ID"));
    }
  });
  model.interfaces.forEach((item, index) => {
    if (!elements.has(item.owner)) errors.push(diagnostic(`$.interfaces[${index}].owner`, item.owner, "an existing element ID"));
    item.consumers.forEach((id, consumerIndex) => {
      if (!elements.has(id)) errors.push(diagnostic(`$.interfaces[${index}].consumers[${consumerIndex}]`, id, "an existing element ID"));
    });
  });
  model.flows.forEach((flow, index) => {
    flow.steps.forEach((step, stepIndex) => {
      for (const endpoint of ["actor", "target"]) {
        if (!elements.has(step[endpoint])) errors.push(diagnostic(`$.flows[${index}].steps[${stepIndex}].${endpoint}`, step[endpoint], "an existing element ID"));
      }
      if (step.relationshipId && !relationships.has(step.relationshipId)) {
        errors.push(diagnostic(`$.flows[${index}].steps[${stepIndex}].relationshipId`, step.relationshipId, "an existing relationship ID"));
      }
    });
  });
  model.data.forEach((datum, index) => {
    if (!elements.has(datum.authority)) errors.push(diagnostic(`$.data[${index}].authority`, datum.authority, "an existing element ID"));
    datum.owners.forEach((owner, ownerIndex) => {
      if (!elements.has(owner)) errors.push(diagnostic(`$.data[${index}].owners[${ownerIndex}]`, owner, "an existing element ID"));
    });
  });
  model.scope.scenarioIds.forEach((id, index) => {
    if (!scenarios.has(id)) errors.push(diagnostic(`$.scope.scenarioIds[${index}]`, id, "an existing scenario ID"));
  });
  model.scenarios.forEach((scenario, index) => {
    scenario.changeSurface.contracts.forEach((id, contractIndex) => {
      if (!interfaces.has(id)) errors.push(diagnostic(`$.scenarios[${index}].changeSurface.contracts[${contractIndex}]`, id, "an existing interface ID"));
    });
  });

  const inventoryPaths = new Map();
  model.inventory.forEach((item, index) => {
    const jsonPath = `$.inventory[${index}]`;
    if (inventoryPaths.has(item.path)) errors.push(diagnostic(`${jsonPath}.path`, item.path, `a unique inventory path; first used at ${inventoryPaths.get(item.path)}`));
    else inventoryPaths.set(item.path, jsonPath);
    if (item.classification === "included" && item.coverage !== "read") {
      errors.push(diagnostic(`${jsonPath}.coverage`, item.coverage, "read; included production files must be read"));
    }
  });
  model.scope.expectedFiles.forEach((file, index) => {
    if (!inventoryPaths.has(file)) errors.push(diagnostic(`$.scope.expectedFiles[${index}]`, file, "a path represented exactly once in inventory"));
  });

  model.diagrams.forEach((diagram, index) => {
    diagram.modelRefs.forEach((id, referenceIndex) => {
      if (!allIds.has(id)) errors.push(diagnostic(`$.diagrams[${index}].modelRefs[${referenceIndex}]`, id, "an existing model ID"));
    });
  });

  if (model.status === "ready") {
    if (model.blockers.length) errors.push(diagnostic("$.blockers", model.blockers, "no blockers; ready models cannot retain blockers"));
    if (model.factualCorrection.status !== "completed") {
      errors.push(diagnostic("$.factualCorrection.status", model.factualCorrection.status, "completed before ready"));
    }
    if (!model.factualCorrection.summary.trim()) {
      errors.push(diagnostic("$.factualCorrection.summary", model.factualCorrection.summary, "a non-empty correction summary before ready"));
    }
    model.recommendations.forEach((recommendation, index) => {
      if (!["accepted", "rejected", "deferred"].includes(recommendation.outcome)) {
        errors.push(diagnostic(`$.recommendations[${index}].outcome`, recommendation.outcome, "accepted, rejected, or deferred by the developer before ready"));
      }
      if (!recommendation.reason.trim()) {
        errors.push(diagnostic(`$.recommendations[${index}].reason`, recommendation.reason, "a non-empty triage reason before ready"));
      }
    });
  }
  if (model.status === "blocked" && !model.blockers.length) {
    errors.push(diagnostic("$.blockers", model.blockers, "one or more actionable blockers for blocked status"));
  }
  return errors;
}

async function readAndValidateModel(file) {
  let model;
  try {
    model = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    return { model: undefined, errors: [`$: invalid JSON in ${file}; expected a parseable architecture model (${error.message})`] };
  }
  return { model, errors: validateModel(model) };
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: check-model.mjs <architecture-model.json>");
  const { errors } = await readAndValidateModel(path.resolve(file));
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log(`valid architecture model: ${file}`);
}

if (process.argv[1] && realpathSync(path.resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
