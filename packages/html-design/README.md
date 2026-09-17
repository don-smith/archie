# HTML Design

HTML Design is Archie's design system and artifact toolkit for self-contained HTML: long-form rail documents, review packets, and application shells. Architecture Docs uses it to compose the final `site/`, and Assessment uses it for `packet.html`.

The skill lives in `skills/html-design/` and is deployed with the other Archie skills. Its scripts scaffold artifacts, apply palettes, refresh marked design-system assets, and check artifacts:

```bash
node skills/html-design/scripts/check-artifact.mjs <artifact.html> --profile rail-document
```

The skill needs nothing installed beside it. `scripts/lib/check-artifact.mjs` is generated from `src/check-artifact.mjs` by `scripts/bundle-html-design-checker.mjs` at the Archie repository root, which inlines `parse5`. Edit the source and run `npm run build`; never edit the generated file. Notices for bundled packages are in `skills/html-design/THIRD_PARTY_NOTICES.md`.

This workspace was migrated from the standalone `html-design-skill` repository's portable bundle at commit `f8bc6fbf750f59caabd94ab98cb5c34fdad9cc58`. That repository continues separately; its design-system records, generators, site, and evaluations were not migrated.

From the Archie repository root:

```bash
npm test --workspace @archie/html-design
```
