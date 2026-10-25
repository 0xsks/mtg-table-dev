
## 2024-10-25 - Caching Arrays Safely in Node.js
**Learning:** When moving array allocations (like `[...colors]`) out of a hot loop, failure to account for falsy/undefined values (`null`) when spreading will cause `TypeError: ... is not iterable` crashes.
**Action:** Always include a ternary fallback (e.g., `colors ? [...colors] : []`) when hoisting array spreads.
