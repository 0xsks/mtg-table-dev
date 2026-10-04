## 2024-05-24 - Array method overhead in large in-memory searches
**Learning:** In hot search loops over ~36k+ cards (`searchCards` in `server.js`), functional array methods like `.some()`, `.every()`, and creating closures add significant overhead.
**Action:** Replace functional array methods and closures inside hot loops with traditional `for` loops and cache pre-computed values (like parsed query terms and case-normalized fields) outside the loop to drastically improve performance.
