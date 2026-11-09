const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('data/cards.json', 'utf8'));
const oldPrintings = [];
const setsInGroup = new Map();

for (const c of cards) {
    c._hay = (c.name || '').toLowerCase(); // mock
}

function runOriginal(query, limit = 50) {
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
  const terms = []; // simplified

  const hits = [];
  for (let i = 0; i < limit; i++) {
    hits.length = 0;
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
            } else if (colorMode === "identity") {
              if ([...ident].some((x) => !colors.includes(x))) continue;
            } else if (colorMode === "any") {
              if (![...colors].some((x) => ident.includes(x))) continue;
            } else if (![...colors].every((x) => ident.includes(x))) {
              continue;
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

function precomputeCardProps(c) {
  c._name_lower = c.name.toLowerCase();
  c._name_clean = c._name_lower.replace(/[\x27\x60\u2019]/g, "");
  c._type_line_lower = (c.type_line || "").toLowerCase();
  c._colors_sorted = c.colors ? [...c.colors].sort().join("") : "";
  c._color_identity_sorted = c.color_identity ? [...c.color_identity].sort().join("") : "";
}

for (const c of cards) precomputeCardProps(c);

function runOptimized(query, limit = 50) {
  let q = (query.q || "").trim();
  let type = (query.type || "").toLowerCase();

  const rawColors = (query.colors || "").toUpperCase();
  const hasColorless = query.colorless === "1" || rawColors.includes("C");
  const colors = rawColors.replace(/[^WUBRG]/g, "");
  const colorMode = query.colorMode || "identity";
  const cmcParam = String(query.cmc == null ? "" : query.cmc).trim();
  const pool = cards;
  const terms = []; // simplified

  const cmcParts = cmcParam ? cmcParam.split(",").map((s) => s.trim()).filter(Boolean) : null;
  const parsedCmcParts = cmcParts && cmcParts.length ? cmcParts.map(p => {
    const isPlus = p.endsWith("+");
    return { isPlus, val: Number(isPlus ? p.slice(0, -1) : p) };
  }) : null;

  const qLower = q ? q.toLowerCase() : "";
  const qClean = qLower ? qLower.replace(/[\x27\x60\u2019]/g, "") : "";
  const sortedColorsStr = colors ? [...colors].sort().join("") : "";
  const colorsArr = colors ? [...colors] : [];

  const hits = [];
  for (let i = 0; i < limit; i++) {
    hits.length = 0;
    for (const c of pool) {
        if (type && !c._type_line_lower.includes(type)) continue;

        if (parsedCmcParts) {
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
              // Allowed if colorless is selected alongside colors
            } else if (colorMode === "exact") {
              const cSorted = colorMode === "identity" ? c._color_identity_sorted : c._colors_sorted;
              if (sortedColorsStr !== cSorted) continue;
              if (colors.length === 0 && ident.length) continue;
            } else if (colorMode === "identity") {
              if (ident.some((x) => !colors.includes(x))) continue;
            } else if (colorMode === "any") {
              if (!colorsArr.some((x) => ident.includes(x))) continue;
            } else if (!colorsArr.every((x) => ident.includes(x))) {
              continue;
            }
        }

        const name = c._name_lower;
        let score = 10;
        if (q) {
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
const query2 = { q: "goblin", type: "creature", colors: "R", colorMode: "any" };
const query3 = { q: "", type: "", colors: "", cmc: "" }; // default load

const queries = [query, query2, query3];

for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const res1 = runOriginal(q, 1);
    const res2 = runOptimized(q, 1);
    if (res1 !== res2) {
        console.error(`Mismatch on query ${i}: original=${res1}, optimized=${res2}`);
    } else {
        console.log(`Query ${i} matched: ${res1} hits`);
    }
}

const limit = 50;

console.time('Original');
for(let i = 0; i < queries.length; i++) runOriginal(queries[i], limit);
console.timeEnd('Original');

console.time('Optimized');
for(let i = 0; i < queries.length; i++) runOptimized(queries[i], limit);
console.timeEnd('Optimized');
