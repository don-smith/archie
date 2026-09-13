import { createHash } from "node:crypto";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function text(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.md ?? value.txt ?? "";
}

function elementRecord(element) {
  const source = element?.$element ?? element ?? {};
  return {
    id: source.id,
    kind: source.kind,
    title: source.title ?? source.id,
    description: text(source.description),
    ...(source.technology ? { technology: source.technology } : {}),
    ...(source.tags?.length ? { tags: [...source.tags].sort() } : {}),
  };
}

function modelRelationshipRecord(relationship) {
  const source = relationship?.$relationship ?? relationship ?? {};
  return {
    source: source.source?.model ?? source.source,
    target: source.target?.model ?? source.target,
    title: source.title ?? "",
  };
}

function nodeIdentity(node) {
  return node.modelRef ?? node.id;
}

function canonicalView(view) {
  const source = view.$view ?? view;
  const nodes = source.nodes ?? [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const recordNode = (node) => ({
    id: nodeIdentity(node),
    kind: node.kind,
    title: node.title ?? nodeIdentity(node),
    description: text(node.description),
    ...(node.technology ? { technology: node.technology } : {}),
    ...(node.tags?.length ? { tags: [...node.tags].sort() } : {}),
    ...(node.parent ? { parent: nodeById.get(node.parent)?.modelRef ?? node.parent } : {}),
    ...(node.children?.length ? { children: node.children.map((id) => nodeById.get(id)?.modelRef ?? id) } : {}),
  });
  const relationships = (source.edges ?? []).map((edge) => ({
    source: nodeById.get(edge.source)?.modelRef ?? edge.source,
    target: nodeById.get(edge.target)?.modelRef ?? edge.target,
    label: edge.label ?? "",
    ...(edge.line ? { line: edge.line } : {}),
    ...(edge.head ? { head: edge.head } : {}),
  }));
  return {
    id: view.id ?? source.id,
    type: source._type ?? source.type,
    scope: source.viewOf ?? null,
    title: source.title ?? view.title ?? view.id,
    description: text(source.description ?? view.description),
    nodes: nodes.map(recordNode),
    relationships,
  };
}

export function canonicalizeView(view) {
  return canonicalView(view);
}

export function viewSemanticDigest(view) {
  return digest(canonicalView(view));
}

export function buildViewSemantics(model) {
  const views = [...model.views()]
    .filter((view) => view.id !== "index")
    .map((view) => {
      const semantics = canonicalView(view);
      return { id: view.id, semanticDigest: digest(semantics), semantics };
    });
  const modelElements = [...model.elements()].map(elementRecord).sort((left, right) => left.id.localeCompare(right.id));
  const modelRelationships = [...model.relationships()]
    .map(modelRelationshipRecord)
    .sort((left, right) => `${left.source}:${left.target}:${left.title}`.localeCompare(`${right.source}:${right.target}:${right.title}`));
  const modelInventory = { elements: modelElements, relationships: modelRelationships };
  const modelDigest = digest(modelInventory);
  const workspaceDigest = digest({ modelDigest, views: views.map(({ id, semanticDigest }) => ({ id, semanticDigest })) });
  return { views, modelDigest, workspaceDigest };
}

export function semanticManifest(semantics) {
  return {
    modelDigest: semantics.modelDigest,
    workspaceDigest: semantics.workspaceDigest,
    views: Object.fromEntries(semantics.views.map(({ id, semanticDigest }) => [id, semanticDigest])),
  };
}

export function isSemanticInventory(value) {
  return isObject(value) && typeof value.modelDigest === "string" && typeof value.workspaceDigest === "string";
}
