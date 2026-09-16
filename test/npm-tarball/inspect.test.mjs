import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import test from "node:test";
import { inspectNpmTarball } from "../../dist/packages/archie-runtime/src/index.js";

const BLOCK = 512;

function octal(block, offset, length, value) {
  const text = value.toString(8).padStart(length - 2, "0");
  block.write(text, offset, length - 2, "ascii");
  block[offset + length - 2] = 0;
  block[offset + length - 1] = 32;
}

function header(name, size, type = "0", link = "") {
  const block = Buffer.alloc(BLOCK);
  block.write(name, 0, 100, "utf8");
  octal(block, 100, 8, 0o644);
  octal(block, 108, 8, 0);
  octal(block, 116, 8, 0);
  octal(block, 124, 12, size);
  octal(block, 136, 12, 0);
  block.fill(32, 148, 156);
  block.write(type, 156, 1, "ascii");
  block.write(link, 157, 100, "utf8");
  block.write("ustar", 257, 5, "ascii");
  block.write("00", 263, 2, "ascii");
  let checksum = 0;
  for (const byte of block) checksum += byte;
  octal(block, 148, 8, checksum);
  return block;
}

function entry(name, body = Buffer.alloc(0), type = "0", link = "") {
  const padding = Buffer.alloc(Math.ceil(body.length / BLOCK) * BLOCK - body.length);
  return Buffer.concat([header(name, body.length, type, link), body, padding]);
}

function archive(entries, terminationBlocks = 2) {
  return gzipSync(Buffer.concat([...entries, Buffer.alloc(BLOCK * terminationBlocks)]));
}

function validEntries() {
  const manifest = Buffer.from(JSON.stringify({ name: "@archie/conformance", version: "0.1.0-private.0", bin: { "architecture-conformance": "dist/cli.js" } }));
  return [entry("package/package.json", manifest), entry("package/dist/cli.js", Buffer.from("#!/usr/bin/env node\n"))];
}

test("strict npm tar inspection accepts the required regular-file subset", () => {
  const inspected = inspectNpmTarball(archive(validEntries()));
  assert.equal(inspected.manifest.name, "@archie/conformance");
  assert.ok(inspected.files.has("package/dist/cli.js"));
});

test("strict npm tar inspection rejects an invalid checksum", () => {
  const raw = Buffer.concat([...validEntries(), Buffer.alloc(BLOCK * 2)]);
  raw[20] ^= 1;
  assert.throws(() => inspectNpmTarball(gzipSync(raw)), /checksum is invalid/);
});

test("strict npm tar inspection rejects incomplete termination and truncated bodies", () => {
  assert.throws(() => inspectNpmTarball(archive(validEntries(), 1)), /incomplete or invalid termination/);
  const oversized = Buffer.concat([header("package/package.json", 4096), Buffer.alloc(BLOCK * 2)]);
  assert.throws(() => inspectNpmTarball(gzipSync(oversized)), /body or padding is truncated/);
});

test("strict npm tar inspection rejects duplicate names across link types", () => {
  for (const type of ["1", "2"]) {
    const entries = [...validEntries(), entry("package/dist/cli.js", Buffer.alloc(0), type, "package/elsewhere")];
    assert.throws(() => inspectNpmTarball(archive(entries)), /duplicate entry: package\/dist\/cli\.js/);
    assert.throws(() => inspectNpmTarball(archive([...validEntries(), entry(`package/link-${type}`, Buffer.alloc(0), type, "package/elsewhere")])), /link entries are not supported/);
  }
});
