# Pi explicit-skill trial

## Purpose and boundary

The Pi adapter uses the Agent Skills discovery path. APM deploys Archie into a project’s `.agents/skills/archie/` directory; Pi discovers that directory after the project is trusted. The developer enters Archie explicitly with `/skill:archie`, so ordinary Pi sessions remain unchanged.

This adapter has no extension, plugin, prompt-template alias, or host write interception. The portable core owns routing, evidence labels, capability selection, and proposal-before-apply. Any future Pi-native control must be described as Pi-specific, not as a cross-host permission guarantee.

## Installation and discovery

From a test-project root that contains the committed private context and already has a verified Archie runtime pin, deploy the frozen context:

```bash
cd /path/to/test-project
apm install --frozen
pi
```

Confirm that `.agents/skills/archie/SKILL.md` exists, then invoke:

```text
/skill:archie
```

Pi’s documented project discovery location is `.agents/skills/`; no `--skill` flag, extension, or prompt alias is required for this installed path.

## Runtime dispatch

For a runtime-heavy operation, Archie uses its deployed `scripts/dispatch-runtime.mjs`. The dispatcher starts only the runtime installed under the verified project-local `.archie/runtime/` pin. It must not call a global Archie executable.

## Trial evidence

Record the adapter revision, Pi and APM versions, installation command, test project, discovered skill path, fixture prompt, captured output, and developer review.

| Case | Procedure | Expected evidence |
|---|---|---|
| Installation | Run the frozen APM command above. | `.agents/skills/archie/` and capability skill directories are deployed. |
| Skill discovery | Start Pi from the test-project root. | `archie` is available through the project Agent Skills directory. |
| Explicit invocation | Enter `/skill:archie` with a fixture prompt. | Archie loads only on explicit invocation and reports its selected mode and route. |
| Proposal boundary | Use the durable-change fixture. | Archie presents intent, evidence, affected artifacts, verification, and a developer decision before a durable change. |

A passing trial is Pi-only evidence. It proves neither another host’s discovery behavior nor a host-level write-control guarantee.
