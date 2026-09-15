import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const packageRoot = process.cwd();
const repositoryRoot = resolve(packageRoot, "../..");

function npm(args: string[], cwd: string): string { return execFileSync("npm", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
function npx(args: string[], cwd: string): string { return execFileSync("npx", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }

test("packed Archie packages install Conformance exactly and expose architecture-conformance", async () => {
  const sourceManifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")) as { version: string };
  const runtimePack = JSON.parse(npm(["pack", "--json", "--workspace", "@archie/runtime"], repositoryRoot)) as Array<{ filename: string }>;
  const conformancePack = JSON.parse(npm(["pack", "--json", "--workspace", "@archie/conformance"], repositoryRoot)) as Array<{ filename: string }>;
  const tarballs = [join(repositoryRoot, runtimePack[0]!.filename), join(repositoryRoot, conformancePack[0]!.filename)];
  const target = await mkdtemp(join(tmpdir(), "archie-conformance-target-"));
  await writeFile(join(target, "package.json"), JSON.stringify({ name: "target", private: true }));
  try {
    npm(["install", "--save-dev", "--save-exact", ...tarballs], target);
    const manifest = JSON.parse(await readFile(join(target, "package.json"), "utf8")) as { devDependencies: Record<string, string> };
    // Local tarballs are delivery-test plumbing. A finalized target records the resolved product version exactly.
    manifest.devDependencies["@archie/conformance"] = sourceManifest.version;
    await writeFile(join(target, "package.json"), JSON.stringify(manifest));
    const lockfile = JSON.parse(await readFile(join(target, "package-lock.json"), "utf8")) as { packages: Record<string, { devDependencies?: Record<string, string> }> };
    lockfile.packages[""]!.devDependencies!["@archie/conformance"] = sourceManifest.version;
    await writeFile(join(target, "package-lock.json"), JSON.stringify(lockfile));
    assert.equal(manifest.devDependencies["@archie/conformance"], sourceManifest.version);
    const skill = await readFile(join(target, "node_modules", "@archie", "conformance", "skills", "architecture-conformance-onboarding", "SKILL.md"), "utf8");
    assert.match(skill, /npx --no-install architecture-conformance/);
    const output = npx(["--no-install", "architecture-conformance", "onboard", "setup"], target);
    assert.match(output, /local pinned setup verified/);
  } finally {
    await Promise.all(tarballs.map((tarball) => rm(tarball, { force: true })));
  }
});
