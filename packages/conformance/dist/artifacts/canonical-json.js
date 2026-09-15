function assertJson(value) {
    if (value === null || typeof value === "boolean" || typeof value === "string")
        return;
    if (typeof value === "number") {
        if (!Number.isFinite(value))
            throw new TypeError("canonical JSON requires finite numbers");
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value)
            assertJson(item);
        return;
    }
    if (typeof value === "object") {
        for (const [key, item] of Object.entries(value)) {
            if (item === undefined)
                throw new TypeError(`canonical JSON does not allow undefined at ${key}`);
            assertJson(item);
        }
        return;
    }
    throw new TypeError(`canonical JSON does not allow ${typeof value}`);
}
function render(value) {
    if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value))
        return `[${value.map(render).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${render(value[key])}`).join(",")}}`;
}
/** RFC 8785-compatible for values representable by JavaScript JSON. */
export function canonicalize(value) {
    assertJson(value);
    return render(value);
}
//# sourceMappingURL=canonical-json.js.map