# TypeScript support

`typescript-program-v1` uses the TypeScript 7.0.2 compiler API. It accepts only root `tsconfig` paths provided on the command line or realization map. It follows reachable project references.

The adapter reads TypeScript source files with `.ts`, `.tsx`, `.mts`, and `.cts` extensions. It reports static ESM imports, re-exports, and string-literal dynamic imports. `import type`, `export type`, and explicit type-only named specifiers become `type` edges. Other supported imports become `runtime` edges.

A node's internal module ID is its repository-relative POSIX path without the TypeScript extension. Package and Node built-in imports are external modules when the compiler resolves them.

For static bare workspace package imports, re-exports, and string-literal dynamic imports, the compiler project checker resolves configured paths, package roots, and supported subpaths. A qualifying resolution to selected repository source is represented as the existing source-module target. When the compiler resolves a workspace export to an emitted declaration, the adapter maps it to source only when one selected source module has the exact declaration path derived from its declared `rootDir` and `outDir` or `declarationDir`. A repository-source resolution outside selected scope is reported as `workspace-source-outside-scope`; dependency resolutions remain external modules and failed resolutions remain unresolved gaps.

Nonliteral dynamic imports and `require` calls become gaps. So do unresolved imports, relevant compiler diagnostics, source files outside the repository, and scoped source files absent from a program. Strict checks fail when coverage has those gaps.
