import { gunzipSync } from "node:zlib";
const BLOCK_SIZE = 512;
function textField(block, start, length, label) {
    const field = block.subarray(start, start + length);
    const nul = field.indexOf(0);
    const bytes = nul < 0 ? field : field.subarray(0, nul);
    if (nul >= 0 && field.subarray(nul).some((byte) => byte !== 0))
        throw new Error(`npm tarball has invalid ${label} field encoding`);
    const text = bytes.toString("utf8");
    if (!Buffer.from(text, "utf8").equals(bytes))
        throw new Error(`npm tarball has invalid ${label} field encoding`);
    return text;
}
function octalField(block, start, length, label) {
    const field = block.subarray(start, start + length);
    if (field.some((byte) => byte !== 0 && byte !== 32 && (byte < 48 || byte > 55)))
        throw new Error(`npm tarball has invalid ${label} field encoding`);
    const nul = field.indexOf(0);
    if (nul >= 0 && field.subarray(nul).some((byte) => byte !== 0 && byte !== 32))
        throw new Error(`npm tarball has invalid ${label} field encoding`);
    const text = field.subarray(0, nul < 0 ? field.length : nul).toString("ascii").trim();
    if (text && !/^[0-7]+$/.test(text))
        throw new Error(`npm tarball has invalid ${label} field encoding`);
    const value = Number.parseInt(text || "0", 8);
    if (!Number.isSafeInteger(value) || value < 0)
        throw new Error(`npm tarball has invalid ${label}`);
    return value;
}
function validateChecksum(block) {
    const expected = octalField(block, 148, 8, "checksum");
    let actual = 0;
    for (let index = 0; index < block.length; index += 1)
        actual += index >= 148 && index < 156 ? 32 : block[index];
    if (actual !== expected)
        throw new Error("npm tarball header checksum is invalid");
}
function safeArchivePath(path) {
    const candidate = path.endsWith("/") ? path.slice(0, -1) : path;
    if (!candidate || candidate.startsWith("/") || candidate.includes("\\"))
        throw new Error("npm tarball contains an unsafe entry path");
    const segments = candidate.split("/");
    if (segments.some((segment) => !segment || segment === "." || segment === ".."))
        throw new Error("npm tarball contains an unsafe entry path");
    return candidate;
}
function jsonObject(bytes) {
    let value;
    try {
        value = JSON.parse(bytes.toString("utf8"));
    }
    catch {
        throw new Error("npm tarball package manifest is not valid JSON");
    }
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("npm tarball package manifest must be an object");
    return value;
}
function zeroBlock(block) { return block.every((byte) => byte === 0); }
/** Strictly inspects the narrow ustar subset emitted by npm pack for Archie packages. */
export function inspectNpmTarball(tarball) {
    let archive;
    try {
        archive = gunzipSync(tarball);
    }
    catch {
        throw new Error("npm tarball is not a valid gzip archive");
    }
    if (archive.length < BLOCK_SIZE * 3 || archive.length % BLOCK_SIZE !== 0)
        throw new Error("npm tarball is truncated or has invalid block alignment");
    const entries = new Set(), files = new Set();
    let manifest;
    let sawEntry = false, terminated = false;
    for (let offset = 0; offset < archive.length;) {
        const block = archive.subarray(offset, offset + BLOCK_SIZE);
        if (zeroBlock(block)) {
            const remaining = archive.subarray(offset);
            if (remaining.length < BLOCK_SIZE * 2 || !remaining.every((byte) => byte === 0))
                throw new Error("npm tarball has incomplete or invalid termination");
            terminated = true;
            break;
        }
        sawEntry = true;
        validateChecksum(block);
        const magic = textField(block, 257, 6, "magic"), version = textField(block, 263, 2, "version");
        if (magic !== "ustar" || version !== "00")
            throw new Error("npm tarball uses an unsupported tar header format");
        const rawName = textField(block, 0, 100, "name"), prefix = textField(block, 345, 155, "prefix");
        const name = safeArchivePath(prefix ? `${prefix}/${rawName}` : rawName);
        if (entries.has(name))
            throw new Error(`npm tarball contains a duplicate entry: ${name}`);
        entries.add(name);
        const size = octalField(block, 124, 12, "size");
        const dataStart = offset + BLOCK_SIZE, paddedSize = Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE, dataEnd = dataStart + size, nextOffset = dataStart + paddedSize;
        if (!Number.isSafeInteger(nextOffset) || dataEnd > archive.length || nextOffset > archive.length)
            throw new Error("npm tarball entry body or padding is truncated");
        if (archive.subarray(dataEnd, nextOffset).some((byte) => byte !== 0))
            throw new Error("npm tarball entry padding is invalid");
        const type = block[156];
        if (type === 0 || type === 48) {
            files.add(name);
            if (name === "package/package.json")
                manifest = jsonObject(archive.subarray(dataStart, dataEnd));
        }
        else if (type === 53) {
            if (size !== 0)
                throw new Error("npm tarball directory entry has a body");
        }
        else if (type === 49 || type === 50) {
            throw new Error("npm tarball link entries are not supported");
        }
        else {
            throw new Error(`npm tarball entry type is not supported: ${String.fromCharCode(type ?? 0)}`);
        }
        offset = nextOffset;
    }
    if (!sawEntry)
        throw new Error("npm tarball contains no entries");
    if (!terminated)
        throw new Error("npm tarball is missing complete termination blocks");
    if (!manifest)
        throw new Error("npm tarball omits package/package.json");
    return { manifest, files };
}
export function normalizeNpmBinaryPath(path) {
    if (typeof path !== "string")
        throw new Error("npm package binary path is invalid");
    try {
        return normalizeRequiredPlatformPayload(path.startsWith("./") ? path.slice(2) : path);
    }
    catch {
        throw new Error("npm package binary path is invalid");
    }
}
export function normalizeRequiredPlatformPayload(path) {
    if (!path || path.startsWith("/") || path.startsWith("package/") || path.includes("\\"))
        throw new Error("required platform payload path is unsafe");
    const segments = path.split("/");
    if (segments.some((segment) => !segment || segment === "." || segment === ".."))
        throw new Error("required platform payload path is unsafe");
    return segments.join("/");
}
//# sourceMappingURL=inspect.js.map