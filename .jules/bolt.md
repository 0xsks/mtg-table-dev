## 2026-09-27 - Hoist Query Normalization and Precompute Values
**Learning:** `searchCards` evaluates card searches heavily in loops for every keystroke or query. Operations like regex replacement, lowercasing on loop invariants, and processing thousands of cards per request can block the node event loop significantly.
**Action:** When working with large filtering loops (like catalog search), extract invariants (`qLower`, `qClean`) and precalculate loop parameters (`_nameLower`, `_nameClean`) on server initialization for O(1) loop-body text lookups.
