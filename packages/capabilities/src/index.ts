export type CapabilityId =
  | "assessment" | "architecture-docs" | "likec4-authoring"
  | "conformance-onboarding" | "architecture-contracts" | "architecture-review" | "html-design";

export interface CapabilityContract {
  id: CapabilityId;
  request: string;
  output: string;
  authorityStop: string;
  resultMeaning: string;
}

export const capabilityContracts: readonly CapabilityContract[] = [
  { id: "assessment", request: "repository architecture assessment", output: "fact model and assessment", authorityStop: "developer approves findings and recommendations", resultMeaning: "model contract completeness" },
  { id: "architecture-docs", request: "evidence-backed architecture documentation", output: "claims, pages, and handoff", authorityStop: "maintainer approves claims", resultMeaning: "documentation artifact validity" },
  { id: "likec4-authoring", request: "C4 model authoring", output: "compiled model and selected views", authorityStop: "returns claims to architecture documentation", resultMeaning: "LikeC4 syntax and view validity" },
  { id: "conformance-onboarding", request: "conformance setup", output: "observed graph and setup proposal", authorityStop: "cannot approve architecture intent", resultMeaning: "observed setup evidence" },
  { id: "architecture-contracts", request: "architecture contract change", output: "precise contract or exception", authorityStop: "maintainer decision before normative change", resultMeaning: "deterministic conformance result" },
  { id: "architecture-review", request: "bounded structural review of one module", output: "triaged findings and a phased polish plan", authorityStop: "developer triages findings before follow-up", resultMeaning: "advisory findings, not an architecture pass" },
  { id: "html-design", request: "self-contained HTML presentation", output: "checked site, review packet, or document artifact", authorityStop: "presentation only; never changes architecture content", resultMeaning: "artifact profile and design-system validity" }
];

export function selectCapability(id: CapabilityId): CapabilityContract {
  const capability = capabilityContracts.find((candidate) => candidate.id === id);
  if (!capability) throw new Error(`Unknown capability: ${id}`);
  return capability;
}
