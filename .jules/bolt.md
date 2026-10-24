
## 2024-10-24 - Pre-parsing Query Constraints
**Learning:** In the `searchCards` function, `cmcParam` string splitting and parsing, as well as `colors` string sorting, were happening inside the search loop iterating over 36k+ cards. This resulted in significant CPU overhead.
**Action:** Always hoist parsing logic (like string manipulation and `Number` conversion) out of hot loops when iterating over large datasets. Replace functional array methods (`some`, `every`) with explicit loops and early returns in hot paths to avoid closure allocations.
