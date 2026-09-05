# Archie context

Private APM context for Archie. Its `.apm/skills/` directory is a generated, checked projection of Archie’s canonical routing skill and independently selectable capability skills.

## Deploy to a project

The release target owns this committed context at its project root. After the target has its verified Archie release pin, run:

```bash
cd /path/to/project
apm install --frozen
```

APM deploys the context skills to `/path/to/project/.agents/skills/`. It has no extension, plugin, or prompt-template alias. Pi discovers the project-local `archie` skill there, so invoke it explicitly with:

```text
/skill:archie
```

For runtime-heavy work, the deployed Archie skill runs `scripts/dispatch-runtime.mjs` against the project. The dispatcher refuses to use a global command and starts only `.archie/runtime/node_modules/<pinned-package>/dist/skill-runtime.js`.

Keep `apm.yml`, `apm.lock.yaml`, and `.apm/skills/` together in the project. `apm install --frozen` is the replay path; it does not resolve a different context.
