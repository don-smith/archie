export const capabilityContracts = [
    { id: "assessment", request: "repository architecture assessment", output: "fact model and assessment", authorityStop: "developer approves findings and recommendations", resultMeaning: "model contract completeness" },
    { id: "architecture-docs", request: "evidence-backed architecture documentation", output: "claims, pages, and handoff", authorityStop: "maintainer approves claims", resultMeaning: "documentation artifact validity" },
    { id: "likec4-authoring", request: "C4 model authoring", output: "compiled model and selected views", authorityStop: "returns claims to architecture documentation", resultMeaning: "LikeC4 syntax and view validity" },
    { id: "conformance-onboarding", request: "conformance setup", output: "observed graph and setup proposal", authorityStop: "cannot approve architecture intent", resultMeaning: "observed setup evidence" },
    { id: "architecture-contracts", request: "architecture contract change", output: "precise contract or exception", authorityStop: "maintainer decision before normative change", resultMeaning: "deterministic conformance result" },
    { id: "structural-inspection", request: "broad structural inspection", output: "layered findings and phased options", authorityStop: "developer triages findings before follow-up", resultMeaning: "advisory findings, not an architecture pass" }
];
export function selectCapability(id) {
    const capability = capabilityContracts.find((candidate) => candidate.id === id);
    if (!capability)
        throw new Error(`Unknown capability: ${id}`);
    return capability;
}
//# sourceMappingURL=index.js.map