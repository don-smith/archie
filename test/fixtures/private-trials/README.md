# Private-trial fixture inputs

`test/fixtures/private-bundles/valid` holds the APM side of a release bundle: the Archie context manifest and lock, and `bundle.json` with the eight-skill APM input. The npm artifacts are always built at test time. Unit tests pack small stand-in packages through `test/support/release-bundle.mjs`; the private-trial evaluator and native end-to-end tests pack the real `@archie/runtime` and `@archie/conformance` workspaces. `bundle.json` lists no artifacts until a builder fills them in.

Cases mutate only copied bundles or targets. The source fixture remains unchanged.
