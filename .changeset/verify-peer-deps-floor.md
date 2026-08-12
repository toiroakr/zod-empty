---
"zod-empty": patch
---

Verify peerDependencies lower bounds against real installs in CI and normalize the `typescript` range to `>=5.0.0` (was the equivalent but unconventional `>=5.x`). The `zod` floor (`4.x`, i.e. `>=4.0.0`) was verified accurate as-is.
