
## 2024-10-20 - [Optimize Array Operations and Sorting in searchCards]
**Learning:** V8 engine performance can suffer noticeably in a large iterations (~36k iterations loop). Functions like `localeCompare` and `string replace` with regular expressions are expensive operations inside the loop.
**Action:** Always pre-compute loop constants and pre-parse search constraints outside loops. When sorting arrays containing string values (like names), prefer traditional string comparisons (`<` and `>`) over `localeCompare` for improved performance.
