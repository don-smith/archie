import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface NpmTarballManifest {
  name: string;
  version: string;
  bin: Record<string, string>;
}

export async function makeNpmTarball(manifest: NpmTarballManifest, includeBinaries = true): Promise<Buffer> {
  const root = await mkdtemp(join(tmpdir(), "archie-conformance-tarball-"));
  try {
    const packageRoot = join(root, "package");
    await mkdir(packageRoot);
    await writeFile(join(packageRoot, "package.json"), JSON.stringify(manifest));
    for (const binary of includeBinaries ? Object.values(manifest.bin) : []) {
      const path = join(packageRoot, binary);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, "#!/usr/bin/env node\n");
    }
    const packed = JSON.parse(execFileSync("npm", ["pack", "--json", packageRoot, "--pack-destination", root], { cwd: root, encoding: "utf8" })) as Array<{ filename: string }>;
    return await readFile(join(root, packed[0]!.filename));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
