function descriptionText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.md ?? value.txt ?? "";
}

function groupFor(view) {
  const type = String(view.$view._type).toLowerCase();
  if (type === "dynamic") return "Dynamics";
  if (type === "deployment") return "Deployment";

  if (view.isScopedElementView()) {
    const kinds = new Set(view.$view.nodes.map((node) => String(node.kind).toLowerCase()));
    if (kinds.has("code")) return "Code";
    if (kinds.has("component")) return "Components";
    if (kinds.has("container")) return "Containers";
  }
  return "Orientation";
}

export function buildViewMetadata(model, semanticViews = new Map()) {
  const modelViews = [...model.views()].filter((view) => view.id !== "index");
  const parentByView = new Map();

  for (const child of modelViews) {
    const scope = child.$view.viewOf;
    if (!scope) continue;
    const candidates = modelViews.filter(
      (parent) => parent.id !== child.id && parent.$view.nodes.some((node) => node.modelRef === scope),
    );
    const parent = candidates.find((candidate) =>
      candidate.$view.nodes.some((node) => node.modelRef === scope && node.navigateTo === child.id),
    ) ?? candidates[0];
    if (parent) parentByView.set(child.id, parent.id);
  }

  return modelViews.map((view) => ({
    id: view.id,
    title: view.title || view.id,
    description: descriptionText(view.description),
    type: view.$view._type,
    group: groupFor(view),
    ...(parentByView.has(view.id) ? { parentId: parentByView.get(view.id) } : {}),
    ...(semanticViews.get(view.id) ? { semanticDigest: semanticViews.get(view.id) } : {}),
  }));
}
