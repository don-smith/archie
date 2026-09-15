import { digestJson } from "../artifacts/digest.js";

export interface EvidenceFingerprintInput {
  ruleId: string; sourceArchitectureId: string; targetArchitectureId: string; sourceModule: string; targetModule: string; edgeKind: "runtime" | "type"; specifier: string;
}

export function evidenceFingerprint(value: EvidenceFingerprintInput): string {
  return digestJson({ version: "evidence-fingerprint/v1", ...value });
}
