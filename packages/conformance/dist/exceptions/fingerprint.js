import { digestJson } from "../artifacts/digest.js";
export function evidenceFingerprint(value) {
    return digestJson({ version: "evidence-fingerprint/v1", ...value });
}
//# sourceMappingURL=fingerprint.js.map