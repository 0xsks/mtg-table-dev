
## 2025-02-13 - Loop-Invariant Computations in Array Search
**Learning:** In-memory search functions over tens of thousands of cards (like `searchCards`) are extremely sensitive to loop-invariant computations. Operations like string splitting, regex replacements, array sorting, and spreading iterators (e.g., `[...ident]`) inside the iteration loop add significant overhead.
**Action:** Always extract invariant parsing, sorting, and array instantiations outside the iteration loop for heavily accessed API endpoints that rely on in-memory array filtering.
