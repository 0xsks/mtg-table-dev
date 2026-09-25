const fs = require('fs');

const code = fs.readFileSync('public/js/rpg.js', 'utf8');

const newSprites = fs.readFileSync('pixel_gen.js', 'utf8');

const replacement = newSprites + `
    function drawBuilding(c, lm, isNear, t) {
      const bob = isNear ? Math.sin(t * 0.007) * 3 : Math.sin(t * 0.003) * 1.5;
      const { x, y, w, h } = lm;
      const hw = w / 2, hh = h / 2;
      
      const grd = c.createRadialGradient(x, y + hh + 10, 10, x, y + hh + 10, hw * 1.1);
      grd.addColorStop(0, "rgba(0,0,0,0.4)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = grd; c.beginPath(); c.ellipse(x, y + hh + 10, hw * 1.1, 28, 0, 0, Math.PI * 2); c.fill();

      let scale = 6;
      if (lm.buildingType === "portal" || lm.buildingType === "shrine") scale = 5;
      if (lm.buildingType === "castle" || lm.buildingType === "fortress") scale = 7;
      
      drawPixelSprite(c, lm.buildingType, x, y + hh + 20, scale, bob);
    }
`;

// regex to replace drawCastle to drawShrine and drawBuilding
const startIdx = code.indexOf('function drawCastle');
const endIdx = code.indexOf('/* ══════════════════════════════════════════════════════════════════════\n       ROOM INTERIOR ENVIRONMENTS');

if (startIdx > -1 && endIdx > -1) {
  const newCode = code.slice(0, startIdx) + replacement + "\n\n    " + code.slice(endIdx);
  fs.writeFileSync('public/js/rpg.js', newCode);
  console.log("Replaced successfully!");
} else {
  console.log("Could not find indices.");
}
