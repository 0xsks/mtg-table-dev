
## 2024-05-24 - V8 Sorting vs. localeCompare
**Learning:** In V8, `Array.prototype.sort()` using `localeCompare` on large string arrays (36k+ elements) introduces massive overhead. Direct string boolean comparison (`<` and `>`) is significantly faster.
**Action:** For internal in-memory sorts not requiring exact localization correctness, use `(a < b ? -1 : (a > b ? 1 : 0))` instead of `a.localeCompare(b)`.

## 2024-05-24 - Functional loops vs. Iterators
**Learning:** `Array.prototype.some` and `.every` have a noticeable closure allocation cost when called inside an outer 36k item loop. Standard `for` loops with a `break` are measurably faster in JavaScript hot loops.
**Action:** When a loop iterates thousands of times per request, avoid internal closure-based array iteration and favor standard `for` loops.
