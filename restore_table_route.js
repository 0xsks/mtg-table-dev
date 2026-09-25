const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

// Restore the route parsing
code = code.replace(
  /if \(parts\[0\] === "cards"\) return \{ name: "cards" \};/,
  'if (parts[0] === "table") return { name: "table", code: (parts[1] || "").toUpperCase() };\n    if (parts[0] === "cards") return { name: "cards" };'
);

// In render(), handle table
code = code.replace(
  /if \(r\.name === "admin"\) \{[\s\S]*?return;\n    \}/,
  `if (r.name === "admin") {
      if (window.MTG_VIEWS.admin) await window.MTG_VIEWS.admin(r);
      return;
    }
    if (r.name === "table") {
      if (window.MTG.openTableModal) await window.MTG.openTableModal(r);
      return;
    }`
);

fs.writeFileSync('public/js/app.js', code);
