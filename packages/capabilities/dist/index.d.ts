export type CapabilityId = "assessment" | "architecture-docs" | "likec4-authoring" | "conformance-onboarding" | "architecture-contracts" | "structural-inspection";
export interface CapabilityContract {
    id: CapabilityId;
    request: string;
    output: string;
    authorityStop: string;
    resultMeaning: string;
}
export declare const capabilityContracts: readonly CapabilityContract[];
export declare function selectCapability(id: CapabilityId): CapabilityContract;
