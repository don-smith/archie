import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const packageRoot = process.cwd();
const repositoryRoot = resolve(packageRoot, "../..");

function npm(args: string[], cwd: string): string { return execFileSync("npm", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }

test("packed Archie artifacts install Conformance into the target-owned runtime and expose its binary", async () => {
  const runtimePack = JSON.parse(npm(["pack", "--json", "--workspace", "@archie/runtime"], repositoryRoot)) as Array<{ filename: string }>;
  const conformancePack = JSON.parse(npm(["pack", "--json", "--workspace", "@archie/conformance"], repositoryRoot)) as Array<{ filename: string }>;
  const tarballs = [join(repositoryRoot, runtimePack[0]!.filename), join(repositoryRoot, conformancePack[0]!.filename)];
  const target = await mkdtemp(join(tmpdir(), "archie-conformance-target-"));
  const runtime = join(target, ".archie/runtime");
  await mkdir(join(runtime, "npm"), { recursive: true });
  await writeFile(join(runtime, "package.json"), JSON.stringify({ name: "archie-private-runtime", private: true }));
  try {
    const localTarballs = [];
    for (const tarball of tarballs) {
      const local = join(runtime, "npm", tarball.split("/").pop()!);
      await copyFile(tarball, local);
      localTarballs.push(`./npm/${local.split("/").pop()!}`);
    }
    npm(["install", "--save-exact", ...localTarballs], runtime);
    const manifest = JSON.parse(await readFile(join(runtime, "package.json"), "utf8")) as { dependencies: Record<string, string> };
    assert.match(manifest.dependencies["@archie/conformance"]!, /^file:/);
    const skill = await readFile(join(runtime, "node_modules", "@archie", "conformance", "skills", "architecture-conformance-onboarding", "SKILL.md"), "utf8");
    assert.match(skill, /\.archie\/runtime\/node_modules\/\.bin\/architecture-conformance/);
    const executable = join(runtime, "node_modules/.bin/architecture-conformance");
    const output = execFileSync(executable, ["onboard", "setup"], { cwd: target, encoding: "utf8" });
    assert.match(output, /local pinned setup verified/);
  } finally {
    await Promise.all(tarballs.map((tarball) => rm(tarball, { force: true })));
  }
});
