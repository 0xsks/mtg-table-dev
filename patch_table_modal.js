const fs = require('fs');

// 1. Update table.js
let tableCode = fs.readFileSync('public/js/table.js', 'utf8');

tableCode = tableCode.replace(/window\.MTG_VIEWS\.table = async function tableView\(r\) \{/, 'window.MTG.openTableModal = async function openTableModal(r) {');

tableCode = tableCode.replace(
  /const app = document\.getElementById\("app"\);\s*app\.innerHTML = `\$\{nav\("lobby"\)\}<div class="table-screen" id="table-root">[\s\S]*?<div id="atk-fx" class="atk-fx" hidden><\/div>`;\s*bindNav\(\);/,
  `// Create fullscreen overlay
    let overlay = document.getElementById("table-full-overlay");
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.id = "table-full-overlay";
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;background:var(--bg);";
    overlay.innerHTML = \`<div class="table-screen" id="table-root" style="height:100%;"><div class="playmat"><div class="pregame"><h2>Connecting…</h2><p class="muted">Talking to the table on this computer.</p></div></div><aside class="sidebar"></aside></div>
      <div class="preview" id="preview" hidden></div>
      <div class="menu" id="cmenu" hidden></div>
      <div id="atk-fx" class="atk-fx" hidden></div>
      <button style="position:fixed;top:10px;left:10px;z-index:10000;background:rgba(0,0,0,0.6);" class="btn ghost small" onclick="document.getElementById('table-full-overlay').remove(); window.MTG_TABLE_CONN && window.MTG_TABLE_CONN.close();">⬅️ Leave Table</button>\`;
    document.body.appendChild(overlay);`
);

// We need to capture the connection so the leave button can close it
tableCode = tableCode.replace(/conn = connectWS\(\{/g, 'conn = connectWS({'); // Ensure conn is assigned
tableCode = tableCode.replace(/let conn = null;/g, 'let conn = null; window.MTG_TABLE_CONN = null;');
tableCode = tableCode.replace(/conn = connectWS/g, 'window.MTG_TABLE_CONN = conn = connectWS');

fs.writeFileSync('public/js/table.js', tableCode);

// 2. Update app.js go()
let appCode = fs.readFileSync('public/js/app.js', 'utf8');
appCode = appCode.replace(
  /if \(path\.startsWith\("\/dao"\)\) \{[\s\S]*?return;\n    \}/,
  `if (path.startsWith("/dao")) {
      if (window.MTG.openDaoModal) window.MTG.openDaoModal();
      return;
    }
    if (path.startsWith("/table")) {
      const parts = path.split("/").filter(Boolean);
      if (window.MTG.openTableModal) window.MTG.openTableModal({ code: (parts[1] || "").toUpperCase() });
      return;
    }`
);

// Remove the route mapping for table
appCode = appCode.replace(/if \(parts\[0\] === "table"\) return \{ name: "table", code: \(parts\[1\] \|\| ""\)\.toUpperCase\(\) \};\n\s*/g, '');

// Update boot to check for table modal instead of table view
appCode = appCode.replace(/window\.MTG_VIEWS\.table \&\&/g, 'window.MTG.openTableModal &&');

fs.writeFileSync('public/js/app.js', appCode);

