export interface EvidenceFingerprintInput {
    ruleId: string;
    sourceArchitectureId: string;
    targetArchitectureId: string;
    sourceModule: string;
    targetModule: string;
    edgeKind: "runtime" | "type";
    specifier: string;
}
export declare function evidenceFingerprint(value: EvidenceFingerprintInput): string;
