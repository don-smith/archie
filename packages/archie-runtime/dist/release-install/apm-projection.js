import { ARCHIE_SKILLS } from "../release-record/release-record-v1.js";
const scalar = (value, label) => {
    if (!value || /[\r\n#]/.test(value))
        throw new Error(`${label} cannot be safely represented in the supported APM projection`);
    return value;
};
const field = (lines, name) => lines.map(line => line.match(new RegExp(`^\\s*(?:-\\s*)?${name}:\\s*(\\S+)\\s*$`))?.[1]).find(Boolean);
const skillSubset = (lines) => lines.filter(line => /^\s*-\s+\S+\s*$/.test(line)).map(line => line.trim().slice(2)).filter(value => ARCHIE_SKILLS.includes(value)).sort();
const sameSkills = (lines, skills) => JSON.stringify(skillSubset(lines)) === JSON.stringify(skills);
const repoUrl = (locator) => {
    const match = locator.match(/^git@github\.com:([^/]+\/[^/]+)\.git$/);
    if (!match)
        throw new Error("APM locator must be a GitHub SSH repository URL");
    return match[1];
};
function section(lines, name, label) {
    const headers = lines.map((line, index) => line === `${name}:` ? index : -1).filter(index => index >= 0);
    if (headers.length !== 1)
        throw new Error(`${label} must contain exactly one top-level ${name} section`);
    const start = headers[0];
    const next = lines.slice(start + 1).findIndex(line => /^\S.*:$/.test(line));
    return { start: start + 1, end: next === -1 ? lines.length : start + 1 + next };
}
function nestedSection(lines, parent, name, label) {
    const headers = lines.slice(parent.start, parent.end).map((line, index) => line === `  ${name}:` ? parent.start + index : -1).filter(index => index >= 0);
    if (headers.length !== 1)
        throw new Error(`${label} must contain exactly one dependencies.${name} section`);
    const header = headers[0];
    const next = lines.slice(header + 1, parent.end).findIndex(line => /^  \S/.test(line));
    return { start: header + 1, end: next === -1 ? parent.end : header + 1 + next };
}
function spans(lines, area, indent, label) {
    const starts = lines.slice(area.start, area.end).map((line, index) => line.startsWith(`${indent}- `) ? area.start + index : -1).filter(index => index >= 0);
    if (!starts.length && lines.slice(area.start, area.end).some(line => line.trim()))
        throw new Error(`${label} has an unsupported shared-entry structure`);
    return starts.map((start, index) => ({ start, end: starts[index + 1] ?? area.end }));
}
function replace(lines, area, indent, owned, next, label) {
    const candidates = spans(lines, area, indent, label).filter(span => owned(lines.slice(span.start, span.end)));
    if (candidates.length > 1)
        throw new Error(`${label} has ambiguous Archie-owned entries`);
    if (!candidates.length)
        return [...lines.slice(0, area.end), ...next, ...lines.slice(area.end)];
    const current = candidates[0];
    return [...lines.slice(0, current.start), ...next, ...lines.slice(current.end)];
}
const dependency = (record) => [
    `    - git: ${scalar(record.apm.locator, "APM locator")}`,
    `      ref: ${scalar(record.apm.ref, "APM ref")}`,
    "      skills:",
    ...record.apm.skills.map(skill => `        - ${scalar(skill, "APM skill")}`)
];
const ownsDependency = (record, entry) => field(entry, "git") === record.apm.locator && sameSkills(entry, record.apm.skills);
function blankManifest(record) {
    return [
        "name: archie-private-runtime", `version: ${scalar(record.version, "Archie version")}`, "private: true", "targets:", "  - agent-skills",
        "dependencies:", "  apm:", ...dependency(record), "  mcp: []", "includes: auto", "scripts: {}", ""
    ].join("\n");
}
function mergeManifest(current, record, previous) {
    if (!current?.trim())
        return blankManifest(record);
    let lines = current.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
    const dependencies = section(lines, "dependencies", "APM manifest");
    const apm = nestedSection(lines, dependencies, "apm", "APM manifest");
    lines = replace(lines, apm, "    ", entry => ownsDependency(record, entry) || Boolean(previous && ownsDependency(previous, entry)), dependency(record), "APM manifest dependencies");
    return `${lines.join("\n")}\n`;
}
/** Plans only an APM-valid manifest. Native APM owns the companion lock's metadata and serialization. */
export function planApmProjection(record, current, previous) {
    return { manifest: mergeManifest(current.manifest, record, previous), lock: current.lock };
}
function requiredEntry(lines, area, indent, owned, label) {
    const candidates = spans(lines, area, indent, label).filter(span => owned(lines.slice(span.start, span.end)));
    if (candidates.length !== 1)
        throw new Error(`${label} must contain exactly one pinned Archie entry`);
    return lines.slice(candidates[0].start, candidates[0].end);
}
/** Rejects manifest or native APM 0.29 lock drift before Archie treats the target as pinned. */
export function assertPinnedApmProjection(record, projection) {
    const manifest = projection.manifest.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
    const manifestDependency = requiredEntry(manifest, nestedSection(manifest, section(manifest, "dependencies", "APM manifest"), "apm", "APM manifest"), "    ", entry => ownsDependency(record, entry), "APM manifest dependencies");
    if (field(manifestDependency, "ref") !== record.apm.ref || !sameSkills(manifestDependency, record.apm.skills))
        throw new Error("pinned Archie APM manifest has drifted");
    const lock = projection.lock.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
    const dependencies = section(lock, "dependencies", "APM lock");
    const entry = requiredEntry(lock, dependencies, "", lines => field(lines, "name") === record.apm.package && field(lines, "repo_url") === repoUrl(record.apm.locator), "APM lock dependencies");
    if (field(entry, "resolved_ref") !== record.apm.ref || field(entry, "resolved_commit") !== record.apm.resolvedCommit || field(entry, "content_hash") !== record.apm.contentHash || !sameSkills(entry, record.apm.skills))
        throw new Error("pinned Archie APM lock has drifted");
}
//# sourceMappingURL=apm-projection.js.map