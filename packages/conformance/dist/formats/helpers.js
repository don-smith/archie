export function fail(message) { throw new TypeError(message); }
export function record(value, label) { if (!value || typeof value !== "object" || Array.isArray(value))
    fail(`${label} must be an object`); return value; }
export function string(value, label) { if (typeof value !== "string" || value.length === 0)
    fail(`${label} must be a non-empty string`); return value; }
export function array(value, label) { if (!Array.isArray(value))
    fail(`${label} must be an array`); return value; }
export function strings(value, label) { return array(value, label).map((item, index) => string(item, `${label}[${index}]`)); }
export function oneOf(value, choices, label) { const result = string(value, label); if (!choices.includes(result))
    fail(`${label} must be one of ${choices.join(", ")}`); return result; }
export function version(value, expected) { if (value.version !== expected)
    fail(`unsupported document version: ${String(value.version)}`); }
export function exactKeys(raw, allowed, label) { for (const key of Object.keys(raw))
    if (!allowed.includes(key))
        fail(`${label} has unknown field ${key}`); }
//# sourceMappingURL=helpers.js.map