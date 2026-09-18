import type { ArchieSkill, ReleaseRecord } from "../release-record/release-record-v3.js";

export interface ApmProjection { manifest: string; lock?: string; }
type Span = { start: number; end: number };

const scalar = (value: string, label: string): string => {
  if (!value || /[\r\n#]/.test(value)) throw new Error(`${label} cannot be safely represented in the supported APM projection`);
  return value;
};
const field = (lines: string[], name: string): string | undefined => lines.map(line => line.match(new RegExp(`^\\s*(?:-\\s*)?${name}:\\s*(\\S+)\\s*$`))?.[1]).find(Boolean);
const skillSubset = (lines: string[], header: string): string[] => {
  const index = lines.findIndex(line => line.trim() === `${header}:`);
  if (index < 0) return [];
  const values: string[] = [];
  for (const line of lines.slice(index + 1)) {
    if (/^\s*-\s+\S+\s*$/.test(line)) { values.push(line.trim().slice(2)); continue; }
    if (line.trim()) break;
  }
  return values;
};
const sameSkills = (lines: string[], skills: readonly ArchieSkill[], header: string) => JSON.stringify(skillSubset(lines, header)) === JSON.stringify(skills);
const repoUrl = (locator: string): string => {
  const match = locator.match(/^git@github\.com:([^/]+\/[^/]+)\.git$/);
  if (!match) throw new Error("APM locator must be a GitHub SSH repository URL");
  return match[1]!;
};

function section(lines: string[], name: string, label: string): Span {
  const headers = lines.map((line, index) => line === `${name}:` ? index : -1).filter(index => index >= 0);
  if (headers.length !== 1) throw new Error(`${label} must contain exactly one top-level ${name} section`);
  const start = headers[0]!;
  const next = lines.slice(start + 1).findIndex(line => /^\S.*:$/.test(line));
  return { start: start + 1, end: next === -1 ? lines.length : start + 1 + next };
}
function nestedSection(lines: string[], parent: Span, name: string, label: string): Span {
  const headers = lines.slice(parent.start, parent.end).map((line, index) => line === `  ${name}:` ? parent.start + index : -1).filter(index => index >= 0);
  if (headers.length !== 1) throw new Error(`${label} must contain exactly one dependencies.${name} section`);
  const header = headers[0]!;
  const next = lines.slice(header + 1, parent.end).findIndex(line => /^  \S/.test(line));
  return { start: header + 1, end: next === -1 ? parent.end : header + 1 + next };
}
function spans(lines: string[], area: Span, indent: string, label: string): Span[] {
  const starts = lines.slice(area.start, area.end).map((line, index) => line.startsWith(`${indent}- `) ? area.start + index : -1).filter(index => index >= 0);
  if (!starts.length && lines.slice(area.start, area.end).some(line => line.trim())) throw new Error(`${label} has an unsupported shared-entry structure`);
  return starts.map((start, index) => ({ start, end: starts[index + 1] ?? area.end }));
}
function replace(lines: string[], area: Span, indent: string, owned: (entry: string[]) => boolean, next: string[], label: string): string[] {
  const candidates = spans(lines, area, indent, label).filter(span => owned(lines.slice(span.start, span.end)));
  if (candidates.length > 1) throw new Error(`${label} has ambiguous Archie-owned entries`);
  if (!candidates.length) return [...lines.slice(0, area.end), ...next, ...lines.slice(area.end)];
  const current = candidates[0]!;
  return [...lines.slice(0, current.start), ...next, ...lines.slice(current.end)];
}

const dependency = (record: ReleaseRecord): string[] => [
  `    - git: ${scalar(record.apm.locator, "APM locator")}`,
  `      ref: ${scalar(record.apm.ref, "APM ref")}`,
  ...(record.apm.path === undefined ? [] : [`      path: ${scalar(record.apm.path, "APM path")}`]),
  "      skills:",
  ...record.apm.skills.map(skill => `        - ${scalar(skill, "APM skill")}`)
];
const ownsDependency = (record: ReleaseRecord, entry: string[]) => field(entry, "git") === record.apm.locator && sameSkills(entry, record.apm.skills, "skills");

function blankManifest(record: ReleaseRecord): string {
  return [
    "name: archie-private-runtime", `version: ${scalar(record.version, "Archie version")}`, "private: true", "targets:", "  - agent-skills",
    "dependencies:", "  apm:", ...dependency(record), "  mcp: []", "includes: auto", "scripts: {}", ""
  ].join("\n");
}
function mergeManifest(current: string | undefined, record: ReleaseRecord, previous?: ReleaseRecord): string {
  if (!current?.trim()) return blankManifest(record);
  let lines = current.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  const dependencies = section(lines, "dependencies", "APM manifest");
  const apm = nestedSection(lines, dependencies, "apm", "APM manifest");
  lines = replace(lines, apm, "    ", entry => ownsDependency(record, entry) || Boolean(previous && ownsDependency(previous, entry)), dependency(record), "APM manifest dependencies");
  return `${lines.join("\n")}\n`;
}

/** Plans only an APM-valid manifest. Native APM owns the companion lock's metadata and serialization. */
export function planApmProjection(record: ReleaseRecord, current: { manifest?: string; lock?: string }, previous?: ReleaseRecord): ApmProjection {
  return { manifest: mergeManifest(current.manifest, record, previous), lock: current.lock };
}

function requiredEntry(lines: string[], area: Span, indent: string, owned: (entry: string[]) => boolean, label: string): string[] {
  const candidates = spans(lines, area, indent, label).filter(span => owned(lines.slice(span.start, span.end)));
  if (candidates.length !== 1) throw new Error(`${label} must contain exactly one pinned Archie entry`);
  return lines.slice(candidates[0]!.start, candidates[0]!.end);
}
/** Rejects manifest or native APM 0.29 lock drift before Archie treats the target as pinned. */
export function assertPinnedApmProjection(record: ReleaseRecord, projection: Required<ApmProjection>): void {
  const manifest = projection.manifest.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  const manifestDependency = requiredEntry(manifest, nestedSection(manifest, section(manifest, "dependencies", "APM manifest"), "apm", "APM manifest"), "    ", entry => ownsDependency(record, entry), "APM manifest dependencies");
  if (field(manifestDependency, "ref") !== record.apm.ref || field(manifestDependency, "path") !== record.apm.path || !sameSkills(manifestDependency, record.apm.skills, "skills")) throw new Error("pinned Archie APM manifest has drifted");
  const lock = projection.lock.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  const dependencies = section(lock, "dependencies", "APM lock");
  const entry = requiredEntry(lock, dependencies, "", lines => field(lines, "name") === record.apm.package && field(lines, "repo_url") === repoUrl(record.apm.locator), "APM lock dependencies");
  if (field(entry, "resolved_ref") !== record.apm.ref || field(entry, "resolved_commit") !== record.apm.resolvedCommit || field(entry, "content_hash") !== record.apm.contentHash || field(entry, "virtual_path") !== record.apm.path || !sameSkills(entry, record.apm.skills, "skill_subset")) throw new Error("pinned Archie APM lock has drifted");
}
