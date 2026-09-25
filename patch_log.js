const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(
  /const t = tables\.get\(ws\.tableCode\);\s*if \(!t\) throw new Error\("not at a table"\);/,
  'const t = tables.get(ws.tableCode);\n  if (!t) throw new Error("not at a table (type: " + type + ")");'
);

fs.writeFileSync('server.js', code);
