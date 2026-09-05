import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("Pi discovers and invokes Archie from the frozen project Agent Skills deployment", () => {
  const base = mkdtempSync(join(tmpdir(), "archie-pi-discovery-"));
  try {
    const project = join(base, "project");
    cpSync("packages/archie-context", project, { recursive: true });
    const install = spawnSync("apm", ["install", "--frozen"], { cwd: project, encoding: "utf8" });
    assert.equal(install.status, 0, `${install.stdout}\n${install.stderr}`);
    const skill = join(project, ".agents", "skills", "archie");
    assert.match(readFileSync(join(skill, "SKILL.md"), "utf8"), /^name: archie$/m);
    assert.match(readFileSync("adapters/pi/TRIAL.md", "utf8"), /\.agents\/skills\/archie\/SKILL\.md/);
    assert.match(readFileSync("adapters/pi/TRIAL.md", "utf8"), /\/skill:archie/);
    const provider = join(base, "pi-discovery-provider.ts");
    writeFileSync(provider, `import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export default function (pi: ExtensionAPI) {
  pi.registerProvider("pi-discovery-test", {
    name: "Pi discovery test", baseUrl: "http://127.0.0.1/unused", apiKey: "test", api: "openai-completions",
    models: [{ id: "local", name: "Local", reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 1024, maxTokens: 64 }],
    streamSimple(model: any) {
      const stream = createAssistantMessageEventStream();
      const message: any = { role: "assistant", content: [], api: model.api, provider: model.provider, model: model.id, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason: "pending", timestamp: Date.now() };
      queueMicrotask(() => {
        stream.push({ type: "start", partial: message });
        message.content.push({ type: "text", text: "Pi skill invocation completed." });
        stream.push({ type: "text_start", contentIndex: 0, partial: message });
        stream.push({ type: "text_delta", contentIndex: 0, delta: "Pi skill invocation completed.", partial: message });
        stream.push({ type: "text_end", contentIndex: 0, content: "Pi skill invocation completed.", partial: message });
        message.stopReason = "stop";
        stream.push({ type: "done", reason: "stop", message });
        stream.end();
      });
      return stream;
    }
  });
}
`);
    const invocation = spawnSync("pi", ["--approve", "--offline", "--no-session", "--no-tools", "--extension", provider, "--provider", "pi-discovery-test", "--model", "local", "--mode", "json", "-p", "/skill:archie"], { cwd: project, encoding: "utf8", timeout: 120000 });
    assert.equal(invocation.status, 0, `${invocation.stdout}\n${invocation.stderr}`);
    const events = invocation.stdout.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
    const loadedSkill = events.find((event) => event.type === "message_start" && event.message?.role === "user" && event.message.content?.[0]?.text?.includes("<skill name=\"archie\""));
    assert.ok(loadedSkill, "Pi did not load /skill:archie from the project Agent Skills directory");
    assert.ok(events.some((event) => event.type === "message_end" && event.message?.role === "assistant" && event.message.content?.[0]?.text === "Pi skill invocation completed."), "Pi did not complete the /skill:archie invocation");
  } finally { rmSync(base, { recursive: true, force: true }); }
});
