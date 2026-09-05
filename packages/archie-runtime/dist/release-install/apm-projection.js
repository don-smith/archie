const scalar = (value, label) => {
    if (!value || /[\r\n#]/.test(value))
        throw new Error(`${label} cannot be safely represented in the supported APM projection`);
    return value;
};
const field = (lines, name) => lines.map(line => line.match(new RegExp(`^\\s*(?:-\\s*)?${name}:\\s*(\\S+)\\s*$`))?.[1]).find(Boolean);
const includes = (lines, value) => lines.some(line => line.trim() === `- ${value}`);
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
    const next = lines.slice(header + 1, parent.end).findIndex(line => /^  \S.*:$/.test(line));
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
function appendSection(lines, name, content) {
    return [...lines, `${name}:`, ...content];
}
const dependency = (record) => [
    `    - git: ${scalar(record.apm.locator, "APM locator")}`,
    `      ref: ${scalar(record.apm.ref, "APM ref")}`,
    "      skills:", `        - ${scalar(record.apm.skill, "APM skill")}`
];
const nestedLockDependency = (record) => [
    `    - locator: ${scalar(record.apm.locator, "APM locator")}`,
    `      ref: ${scalar(record.apm.ref, "APM ref")}`,
    `      resolved_commit: ${scalar(record.apm.resolvedCommit, "APM resolved commit")}`,
    `      content_hash: ${scalar(record.apm.contentHash, "APM content hash")}`,
    `      skill: ${scalar(record.apm.skill, "APM skill")}`
];
const apm029LockDependency = (record) => [
    `- name: ${scalar(record.apm.package, "APM package")}`,
    `  repo_url: ${scalar(record.apm.locator, "APM locator")}`,
    `  resolved_commit: ${scalar(record.apm.resolvedCommit, "APM resolved commit")}`,
    `  resolved_ref: ${scalar(record.apm.ref, "APM ref")}`,
    `  content_hash: ${scalar(record.apm.contentHash, "APM content hash")}`,
    "  skill_subset:", `  - ${scalar(record.apm.skill, "APM skill")}`
];
const manifestDeployment = (record) => ["  - target: agent-skills", `    value: .agents/skills/${scalar(record.apm.skill, "APM skill")}`];
const nestedLockDeployment = (record) => ["  - target: agent-skills", `    value: .agents/skills/${scalar(record.apm.skill, "APM skill")}`];
const apm029LockDeployment = (record) => ["- kind: project-relative", "  target: agent-skills", `  value: .agents/skills/${scalar(record.apm.skill, "APM skill")}`];
const ownsDependency = (record, entry) => field(entry, "git") === record.apm.locator && includes(entry, record.apm.skill);
const ownsNestedLock = (record, entry) => field(entry, "locator") === record.apm.locator && field(entry, "skill") === record.apm.skill;
const ownsApm029Lock = (record, entry) => field(entry, "name") === record.apm.package && includes(entry, record.apm.skill);
const ownsDeployment = (record, entry) => field(entry, "target") === "agent-skills" && field(entry, "value") === `.agents/skills/${record.apm.skill}`;
function mergeManifest(current, record, previous) {
    if (!current?.trim())
        return ["dependencies:", "  apm:", ...dependency(record), "deployments:", ...manifestDeployment(record), ""].join("\n");
    let lines = current.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
    const dependencies = section(lines, "dependencies", "APM manifest");
    const apm = nestedSection(lines, dependencies, "apm", "APM manifest");
    lines = replace(lines, apm, "    ", entryLines => ownsDependency(record, entryLines) || Boolean(previous && ownsDependency(previous, entryLines)), dependency(record), "APM manifest dependencies");
    if (!lines.includes("deployments:"))
        return `${appendSection(lines, "deployments", manifestDeployment(record)).join("\n")}\n`;
    const deployments = section(lines, "deployments", "APM manifest");
    lines = replace(lines, deployments, "  ", entryLines => ownsDeployment(record, entryLines) || Boolean(previous && ownsDeployment(previous, entryLines)), manifestDeployment(record), "APM manifest deployments");
    return `${lines.join("\n")}\n`;
}
function mergeLock(current, record, previous) {
    if (!current?.trim())
        return ["dependencies:", "  apm:", ...nestedLockDependency(record), "deployments:", ...nestedLockDeployment(record), ""].join("\n");
    let lines = current.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
    const dependencies = section(lines, "dependencies", "APM lock");
    const isApm029 = lines.slice(dependencies.start, dependencies.end).some(line => line.startsWith("- "));
    if (isApm029) {
        lines = replace(lines, dependencies, "", entryLines => ownsApm029Lock(record, entryLines) || Boolean(previous && ownsApm029Lock(previous, entryLines)), apm029LockDependency(record), "APM lock dependencies");
    }
    else {
        const apm = nestedSection(lines, dependencies, "apm", "APM lock");
        lines = replace(lines, apm, "    ", entryLines => ownsNestedLock(record, entryLines) || Boolean(previous && ownsNestedLock(previous, entryLines)), nestedLockDependency(record), "APM lock dependencies");
    }
    if (!lines.includes("deployments:"))
        return `${appendSection(lines, "deployments", isApm029 ? apm029LockDeployment(record) : nestedLockDeployment(record)).join("\n")}\n`;
    const deployments = section(lines, "deployments", "APM lock");
    const indent = isApm029 ? "" : "  ";
    lines = replace(lines, deployments, indent, entryLines => ownsDeployment(record, entryLines) || Boolean(previous && ownsDeployment(previous, entryLines)), isApm029 ? apm029LockDeployment(record) : nestedLockDeployment(record), "APM lock deployments");
    return `${lines.join("\n")}\n`;
}
/** Plans only structurally unambiguous APM projections; unrelated dependency, deployment, and policy bytes are retained. */
export function planApmProjection(record, current, previous) {
    return { manifest: mergeManifest(current.manifest, record, previous), lock: mergeLock(current.lock, record, previous) };
}
function requiredEntry(lines, area, indent, owned, label) {
    const candidates = spans(lines, area, indent, label).filter(span => owned(lines.slice(span.start, span.end)));
    if (candidates.length !== 1)
        throw new Error(`${label} must contain exactly one pinned Archie entry`);
    const candidate = candidates[0];
    return lines.slice(candidate.start, candidate.end);
}
/** Rejects target-side generated APM projection drift before an upgrade can replace the existing pin. */
export function assertPinnedApmProjection(record, projection) {
    const manifest = projection.manifest.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
    const manifestDependency = requiredEntry(manifest, nestedSection(manifest, section(manifest, "dependencies", "APM manifest"), "apm", "APM manifest"), "    ", entry => ownsDependency(record, entry), "APM manifest dependencies");
    const manifestDeployment = requiredEntry(manifest, section(manifest, "deployments", "APM manifest"), "  ", entry => ownsDeployment(record, entry), "APM manifest deployments");
    if (field(manifestDependency, "ref") !== record.apm.ref || !manifestDeployment.length)
        throw new Error("pinned Archie APM manifest has drifted");
    const lock = projection.lock.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
    const dependencies = section(lock, "dependencies", "APM lock");
    const isApm029 = lock.slice(dependencies.start, dependencies.end).some(line => line.startsWith("- "));
    const dependencyEntry = isApm029 ? requiredEntry(lock, dependencies, "", entry => ownsApm029Lock(record, entry), "APM lock dependencies") : requiredEntry(lock, nestedSection(lock, dependencies, "apm", "APM lock"), "    ", entry => ownsNestedLock(record, entry), "APM lock dependencies");
    requiredEntry(lock, section(lock, "deployments", "APM lock"), isApm029 ? "" : "  ", entry => ownsDeployment(record, entry), "APM lock deployments");
    if (field(dependencyEntry, isApm029 ? "resolved_ref" : "ref") !== record.apm.ref || field(dependencyEntry, "resolved_commit") !== record.apm.resolvedCommit || field(dependencyEntry, "content_hash") !== record.apm.contentHash)
        throw new Error("pinned Archie APM lock has drifted");
}
//# sourceMappingURL=apm-projection.js.map