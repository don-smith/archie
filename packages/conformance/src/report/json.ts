import { canonicalize } from "../artifacts/canonical-json.js";

export function renderJson(value: unknown): string { return `${canonicalize(value)}\n`; }
