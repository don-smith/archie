# Pi explicit-mode trial

## Purpose and boundary

The first adapter trial uses an **explicit /archie entry**. It starts focused Archie behavior on demand and leaves ordinary Pi sessions unchanged. The first implementation should begin with the smallest prompt-template or command wiring that can expose the portable instructions and curated capabilities.

Do not add extension code unless trial evidence shows a measured need for confirmation UI, configured write interception, or status display. This document does not create a package manifest, extension, prompt template, command, installer, or configuration file.

## Adapter responsibilities

The Pi adapter owns these concerns:

- installation instructions and local discovery of the portable Archie skill;
- the explicit entry and prompt or session wiring;
- adapter configuration, including any configured write boundary;
- any Pi-native confirmation, tool interception, or status UI; and
- installation, discovery, invocation, and boundary smoke evidence.

The portable core owns mode selection, evidence labels, capability selection, and the proposal-before-apply rule. A Pi confirmation or interception control is a host feature. It must not be described as a cross-host permission guarantee.

## Trial sequence

1. Implement the smallest explicit entry that loads the portable Archie instructions.
2. Run the onboarding and operational fixtures from the evaluation contract.
3. Run the Pi smoke template for installation, discovery, explicit invocation, and only the boundary behavior actually implemented.
4. Ask the developer to review advice usefulness, evidence calibration, and observed proposal behavior.
5. Compare the evidence against the stop/go decision below.

## Success conditions

Continue only when the trial has all of the following:

- recorded results for onboarding and operational fixtures;
- Pi smoke evidence for the implemented adapter path;
- a developer review that finds the advice useful and calibrated; and
- observed proposal behavior that shows intent, evidence, affected artifacts, verification, and a developer decision before a configured durable write.

## Stop/go decision

**Go.** Start core hardening when all success conditions are recorded, the explicit entry leaves normal Pi sessions unchanged, and any confirmation behavior is accurately described as adapter-specific.

**Stop or return to design.** Do not add extension code, package distribution, or another host when fixture routing is unreliable, evidence labels mislead reviewers, proposal behavior is unclear, the entry disrupts ordinary sessions, or the needed approval behavior cannot be bounded and observed. Record the failed evidence and revise the operating contract or adapter design first.

## Limits of evidence

A passing Pi smoke result is **not evidence for another host**. It establishes only this adapter's observed behavior. A later second-host packaging spike must separately prove that host's installation, discovery, invocation, and approval behavior.
