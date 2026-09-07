# Drift Detection playbook

Use this playbook in Operational mode when a developer asks what architecture understanding or enforced delivery expectations changed across a declared boundary. Drift Detection coordinates repository-owned evidence and checks. It is not a capability, analyzer, check owner, or repository contract.

The operating contract and capability catalog still govern evidence, ownership, uncertainty, and escalation. A deadline, a senior request, or a promised clean baseline does not relax this playbook's evidence or write limits.

## Declare the boundary

Record the intended question and exactly one boundary form:

- For a merge, resolve the merge commit and both parents. Record the relevant `first-parent..second-parent` range. Do not substitute an arbitrary symmetric range.
- For two refs or revisions, resolve and record both object IDs as the before and after states.
- For a base plus current working tree, resolve the base object ID and declare the active working-tree state.

For every form, record active `HEAD`, Git status, working-tree diff identity, and toolchain or version facts that can affect comparison. If the declaration is ambiguous or insufficient, a revision cannot be resolved, or the target is not a Git repository, stop and report the comparison as `unavailable`. Do not choose a boundary on the developer's behalf.

## Inventory and select checks

Before selecting checks, inventory repository instructions and these repository-owned sources where present:

- architecture assets and their ownership or generation contracts;
- documented check commands, contracts, versions, and stable identity rules;
- policy, exception, baseline, and drift records;
- relevant engineering or architecture standards;
- delivery workflows and gate declarations changed by the boundary;
- already-recorded evidence for either state.

Explain why each source and check is in or out of scope. Start with existing architecture checks. Add a local delivery check only when boundary evidence shows that its declaration, enforcement, or affected source scope changed.

Select only an available, documented, non-mutating invocation that can run in the active checkout. Do not invent a check, normalization, or local substitute. Treat a remote-only, unavailable, mutating, unsafe, or incomparable check as a coverage limit. If a command may create target outputs and no safe non-mutating invocation is documented, do not run it. Do not install dependencies to make a check available.

## Use the active checkout only

Execute checks only against the active checkout. Historical source and configuration may be inspected through Git, and already-recorded historical check evidence may be read. Never create or switch a checkout, worktree, archive, branch, stash, or other temporary Git state to execute a historical check. Do not invoke remote jobs.

If a check unexpectedly writes to the target repository, stop. Do not clean up, alter, or ignore the write to make the run appear non-mutating.

Historical evidence is comparable only when it records the historical state, exact command, check contract and version where available, result identity rule, relevant toolchain facts, and output or evidence location. Missing required evidence makes the comparison `unavailable`. Materially different commands, versions, states, conflicting evidence, or other conditions that defeat attribution make it `inconclusive`. Never reconstruct missing evidence by executing at a historical state.

## Keep an evidence ledger

Create a separate command entry for every selected check and a separate finding entry for every individual result. Every entry records the check, revision or working-tree state, exact command, exit status, check contract/version and relevant toolchain facts, output or evidence location, identity rule or its documented absence, and comparability. A command entry also records whether repository documentation calls the invocation non-mutating. A finding entry records its documented stable identity and comparison classification.

Use only the check's documented stable identifier or its explicitly documented stable normalization. Retain the normalization rule and its evidence. Source line numbers, volatile timestamps, message location changes, and raw exit status are not finding identities. Without a documented stable identity, do not attribute a finding delta.

An exit of zero does not prove architecture or policy conformance. A non-zero exit does not by itself identify a finding or prove that the boundary introduced architecture drift. Keep command reliability outcomes separate from finding classifications.

## Classify results

Use all applicable classifications and tie each one to comparable ledger evidence:

- `introduced`: the stable identity is present after the boundary and comparable before-state evidence shows it absent.
- `resolved`: the stable identity is present before the boundary and absent from comparable after-state evidence.
- `unchanged`: the same stable identity is present on both comparable sides.
- `pre-existing`: the identity was already recorded before the boundary, remains present, and matters to the current decision.
- `unavailable`: a required command, prior record, stable identity, repository state, or local capability is absent.
- `inconclusive`: evidence exists but conflicting or materially different command, contract, toolchain, or state conditions cannot support attribution.

Do not convert an unavailable or inconclusive comparison into a clean, unchanged, introduced, or resolved result.

## Report and stop

Return an ephemeral report with these sections:

1. **Declared boundary and active-state facts**
2. **Discovered assets and checks, with selection rationale**
3. **Execution and evidence ledger**
4. **Result classifications**
5. **Facts**
6. **Inferences**
7. **Uncertainties and coverage limits**
8. **Architecture drift**
9. **Check-reliability gaps**
10. **Changed delivery expectations**
11. **Next safe action**

State explicitly that remote jobs and unrun checks were not assessed. Keep architecture drift separate from a changed delivery expectation and from a check failure or evidence-quality gap. Do not claim an architecture-clean result beyond the assessed, comparable evidence.

The next safe action may recommend a bounded investigation, an existing catalog capability, or a developer decision. Then stop. Do not modify source, configuration, workflows, contracts, policies, exceptions, baselines, drift records, reports, architecture assets, or any other target-repository file. Do not persist this report. A later write requires a separately proposed and approved task under the owning capability; it is not part of this Drift Detection run.
