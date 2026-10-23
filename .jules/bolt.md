
## 2023-10-24 - Pre-parsing string constraints for in-memory array
**Learning:** For a codebase relying heavily on large in-memory array filtering (~36k items), any string manipulation or dynamic regex building inside the loop creates massive cumulative overhead. Caching simple lowercased representations on initialization gave extreme performance boosts without much memory overhead.
**Action:** Always pre-calculate and cache commonly queried string derivatives (like `typeLine.toLowerCase()` or a cleaned `name` with punctuation removed) onto objects during the initial data load, and compute search constraints (like numeric parsing or sorting a target value array) once outside the hot-path loop.
