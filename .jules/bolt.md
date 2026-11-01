
## 2026-11-01 - Avoid Re-processing Query Arrays
**Learning:** Spread syntax and array methods applied to invariant query parameters directly inside the main `searchCards` loop (iterating over ~36,000 items) incur significant CPU and GC overhead. Specifically, `[...colors].sort().join("")` generated repeated string sorting and allocations across the entire pool.
**Action:** Always extract static transformations—such as sorting string parameters or mapping arrays of filter values—before entering hot loops to reuse the pre-calculated result.
