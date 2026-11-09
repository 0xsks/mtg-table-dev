const fs = require('fs');

const cards = JSON.parse(fs.readFileSync('data/cards.json', 'utf8')).slice(0, 1000);
const oldPrintings = [];
const setsInGroup = new Map();

for (const c of cards) {
    c._hay = (c.name || '').toLowerCase(); // mock
}

function runOriginal(query, limit = 500) {
  // Mock subset of searchCards logic that we are optimizing
  let q = (query.q || "").trim();
  let setCode = (query.set || "").toLowerCase();
  let type = (query.type || "").toLowerCase();

  const rawColors = (query.colors || "").toUpperCase();
  const hasColorless = query.colorless === "1" || rawColors.includes("C");
  const colors = rawColors.replace(/[^WUBRG]/g, "");
  const colorMode = query.colorMode || "identity";
  const rarity = (query.rarity || "").toLowerCase();
  const format = (query.format || "").toLowerCase();
  const token = query.token === "1" || query.token === "true";
  const cmcParam = String(query.cmc == null ? "" : query.cmc).trim();
  const group = query.group || "";
  const groupSet = group ? setsInGroup.get(group) : null;

  const pool = cards;
  const cmcParts = cmcParam ? cmcParam.split(",").map((s) => s.trim()).filter(Boolean) : null;
  const terms = [];

  const hits = [];
  for (let i = 0; i < limit; i++) {
    for (const c of pool) {
        if (type && !c.type_line.toLowerCase().includes(type)) continue;

        if (cmcParts && cmcParts.length) {
            const matchCmc = cmcParts.some((p) => {
              if (p.endsWith("+")) {
                const min = Number(p.slice(0, -1));
                return !Number.isNaN(min) && c.cmc >= min;
              }
              const val = Number(p);
              return !Number.isNaN(val) && c.cmc === val;
            });
            if (!matchCmc) continue;
        }

        if (hasColorless && !colors) {
            if ((c.colors || []).length > 0) continue;
        } else if (colors) {
            const ident = (colorMode === "identity" ? c.color_identity : c.colors) || [];
            const set = ident.join("");
            const isCardColorless = (c.colors || []).length === 0;
            if (hasColorless && isCardColorless) {
            } else if (colorMode === "exact") {
              if ([...colors].sort().join("") !== [...set].sort().join("")) continue;
              if (colors.length === 0 && ident.length) continue;
            }
        }

        const name = c.name.toLowerCase();
        let score = 10;
        if (q) {
            const qLower = q.toLowerCase();
            const qClean = qLower.replace(/[\x27\x60\u2019]/g, "");
            const nameClean = name.replace(/[\x27\x60\u2019]/g, "");
            if (name === qLower || nameClean === qClean) score = 0;
        }
        hits.push({ score, c });
    }
  }
  hits.sort((a, b) => a.score - b.score || a.c.name.localeCompare(b.c.name));
  return hits.length;
}

function runOptimized(query, limit = 500) {
  let q = (query.q || "").trim();
  let type = (query.type || "").toLowerCase();

  const rawColors = (query.colors || "").toUpperCase();
  const hasColorless = query.colorless === "1" || rawColors.includes("C");
  const colors = rawColors.replace(/[^WUBRG]/g, "");
  const colorMode = query.colorMode || "identity";
  const cmcParam = String(query.cmc == null ? "" : query.cmc).trim();
  const pool = cards;
  const cmcParts = cmcParam ? cmcParam.split(",").map((s) => s.trim()).filter(Boolean) : null;
  const parsedCmcParts = cmcParts ? cmcParts.map(p => {
      const isPlus = p.endsWith("+");
      return { isPlus, val: Number(isPlus ? p.slice(0, -1) : p) };
  }) : null;

  const sortedColors = colors ? [...colors].sort().join("") : "";
  const colorsArray = colors ? [...colors] : [];
  const qLower = q ? q.toLowerCase() : "";
  const qClean = qLower ? qLower.replace(/[\x27\x60\u2019]/g, "") : "";

  for(const c of cards) {
      if(!c._type_line_lower) {
          c._type_line_lower = (c.type_line || "").toLowerCase();
          c._name_lower = c.name.toLowerCase();
          c._name_clean = c._name_lower.replace(/[\x27\x60\u2019]/g, "");
      }
  }

  const hits = [];
  for (let i = 0; i < limit; i++) {
    for (const c of pool) {
        if (type && !c._type_line_lower.includes(type)) continue;

        if (parsedCmcParts && parsedCmcParts.length) {
            const matchCmc = parsedCmcParts.some((p) => {
              if (p.isPlus) {
                return !Number.isNaN(p.val) && c.cmc >= p.val;
              }
              return !Number.isNaN(p.val) && c.cmc === p.val;
            });
            if (!matchCmc) continue;
        }

        if (hasColorless && !colors) {
            if ((c.colors || []).length > 0) continue;
        } else if (colors) {
            const ident = (colorMode === "identity" ? c.color_identity : c.colors) || [];
            const isCardColorless = (c.colors || []).length === 0;
            if (hasColorless && isCardColorless) {
            } else if (colorMode === "exact") {
              const identStr = [...ident].sort().join("");
              if (sortedColors !== identStr) continue;
              if (colors.length === 0 && ident.length) continue;
            }
        }

        let score = 10;
        if (q) {
            const name = c._name_lower;
            const nameClean = c._name_clean;
            if (name === qLower || nameClean === qClean) score = 0;
        }
        hits.push({ score, c });
    }
  }
  hits.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      const nameA = a.c.name;
      const nameB = b.c.name;
      if (nameA === nameB) return 0;
      return nameA < nameB ? -1 : 1;
  });
  return hits.length;
}

const query = { q: "goblin's", type: "creature", cmc: "3, 4+", colors: "UR", colorMode: "exact" };

const start1 = Date.now();
runOriginal(query, 500);
const time1 = Date.now() - start1;

const start2 = Date.now();
runOptimized(query, 500);
const time2 = Date.now() - start2;

console.log(`Original: ${time1}ms`);
console.log(`Optimized: ${time2}ms`);
