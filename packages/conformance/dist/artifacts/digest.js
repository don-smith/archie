import { createHash } from "node:crypto";
import { canonicalize } from "./canonical-json.js";
export function sha256(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
}
export function digestJson(value) {
    return sha256(canonicalize(value));
}
//# sourceMappingURL=digest.js.map