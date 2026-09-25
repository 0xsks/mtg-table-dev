const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

const regex = /async function render\(\) \{[\s\S]*?return await view\(r\.name === "cards" \? \{ \.\.\.r, browse: true \} : r\);\n    \} catch \(err\) \{/;

const replacement = `async function render() {
    try {
      const r = route();
      document.body.classList.toggle("view-table", r.name === "table");
      window.MTG_SECOND = isSecondPlayer();
      applySkin(getSkin(window.MTG_SECOND));
      if (window.MTG_HOMEROOM_INST && r.name !== "profile" && r.name !== "table") {
        try { window.MTG_HOMEROOM_INST.destroy(); } catch {}
        window.MTG_HOMEROOM_INST = null;
      }
      if (r.name === "table") {
        if (window.MTG.openTableModal) {
          // If we haven't rendered the background profile yet, render it first!
          if (!document.getElementById("homeroom-mount")) {
            await window.MTG_VIEWS.profile({ name: "profile" });
          }
          await window.MTG.openTableModal(r);
        }
        return;
      }
      const view = window.MTG_VIEWS[r.name === "cards" ? "builder" : r.name] || window.MTG_VIEWS.profile;
      if (!view) throw new Error("UI scripts did not load");
      return await view(r.name === "cards" ? { ...r, browse: true } : r);
    } catch (err) {`;

code = code.replace(regex, replacement);
fs.writeFileSync('public/js/app.js', code);
