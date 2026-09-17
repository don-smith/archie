# Archie runtime

Private runtime for locally reviewed Archie trials. It exposes the pinned `architecture-docs` command, deterministic architecture checks, and multi-artifact release installation. Release record v3 installs the separate `@archie/conformance` artifact, verifies its project-local `architecture-conformance` binary, and pins the eight-skill APM context. HTML Design ships as the `html-design` skill, not inside the runtime.

Public publication, signing, keys, and authorization are deferred.
