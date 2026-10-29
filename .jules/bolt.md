
## 2024-05-18 - Caching String Normalizations

**Learning:** Placing complex regex string normalizations (e.g. `replace(/[\x27\x60\u2019]/g, "")`), repeated array allocations (like `[...colors]`), and slow standard string comparisons (like `localeCompare`) inside tight inner loops over huge datasets blocks the Node event loop and degrades performance significantly.
**Action:** Always pre-compute and cache normalized string variants natively on dictionary objects on server startup, extract invariants (parsing logic and intermediate arrays) outside loops, and prefer direct boolean string comparisons (like `a < b ? -1 : 1`) over `localeCompare`.
