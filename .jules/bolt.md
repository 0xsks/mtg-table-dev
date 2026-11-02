## 2024-05-14 - Pre-parsing colors and CMC parameters in searchCards
**Learning:** In highly iterated loops like `searchCards`, splitting and sorting string parameters `colors` inside the loop causes significant overhead. The same applies for regex replacements and repeated lowercase calls for card names.
**Action:** Always parse query strings into arrays/pre-sorted strings and pre-compute lowercased/clean card properties outside the hot loop to reduce iteration cost.
