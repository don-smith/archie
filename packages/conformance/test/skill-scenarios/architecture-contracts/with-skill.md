# Pressure scenarios with the skill

These runs used `pi -p --no-context-files --tools read --skill skills/architecture-contracts/SKILL.md` on 2026-08-27. Read access let the agent load the repository skill. The prompts matched the baseline cases.

| Case | Result |
|---|---|
| Observed dependency called approved | "The active rule remains enforced. Provide the failing edge fingerprint and a maintainer-approved narrow exception with rationale and expiry/removal condition." |
| CTO requested severity reduction | "The rule remains active. A maintainer must explicitly approve a narrowly scoped exception or contract change grounded in the CI report." |
| Senior developer requested a rule-wide waiver | "Cannot add a rule-wide waiver. A maintainer must approve each exact reported edge fingerprint." |

The first direct `--skill` trial disabled all tools. The agent then had only the skill description, not its contents, and failed the first two cases. The successful run allowed only `read`. That distinction matters for this skill's deployment.
