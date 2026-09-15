# Compiler upgrade policy

TypeScript 7.0.2 is a compatibility boundary. Do not update it as routine dependency maintenance.

Before changing the pin, a maintainer must decide whether the existing adapter remains valid or a new adapter version is needed. Run the full adapter fixture suite against the candidate compiler. Review normalized graph and provenance changes, then update the exact package and lockfile together.

A compiler upgrade is complete only after the fixture decision and support documentation name the new compiler version.
