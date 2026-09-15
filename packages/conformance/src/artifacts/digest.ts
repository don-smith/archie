import { createHash } from "node:crypto";

import { canonicalize } from "./canonical-json.js";

export function sha256(bytes: string | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function digestJson(value: unknown): string {
  return sha256(canonicalize(value));
}
