## 2024-05-18 - Search Loop O(N) String Allocation Bottleneck
**Learning:** Re-computing regular expression replacements (`.replace(/[\x27\x60\u2019]/g, "")`) and `.toLowerCase()` on both the user query and every card's name/type inside a tight filter loop causes severe O(N) string allocation overhead per search request, especially for large datasets.
**Action:** Pre-calculate normalized and lowercased string variations on application startup and store them on the data objects. Lift static computations (like processing the query string) outside of loops to prevent unnecessary recreation.
