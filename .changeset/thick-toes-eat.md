---
"zod-empty": minor
---

Raise the minimum supported Node.js version to 22.13.

Node 20 reached end of life on 2026-04-30, and the release toolchain now requires 22.13 or newer. The published output is unchanged: the build target moved from `node20.10.0` to `node22.13.0`, but tsdown emits byte-identical files.
