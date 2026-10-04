const fs = require('fs');

const CARDS_PATH = './data/cards.json';
const cards = JSON.parse(fs.readFileSync(CARDS_PATH, "utf8"));

// Baseline compute
for (const c of cards) {
  const raw = [c.name, c.type_line, c.set].join(" ").toLowerCase();
  c._hay = raw;
}

const pool = cards;
const terms = [{ raw: "fire", clean: "fire" }];
const type = "instant";
const cmcParts = ["1", "2"];
const cmcParam = "1, 2";
const colors = "R";
const colorMode = "identity";
const hasColorless = false;
const token = false;
const rarity = null;
const format = null;
const setCode = null;
const groupSet = null;
const q = "fire";

function oldSearch() {
  const hits = [];
  for (const c of pool) {
    if (token) {
      if (!c.token) continue;
    } else if (c.token) {
      continue;
    }
    if (type && !c.type_line.toLowerCase().includes(type)) continue;
    if (rarity && c.rarity !== rarity) continue;
    if (format && c.legalities?.[format] !== "legal") continue;
    if (setCode && c.set !== setCode) continue;
    if (groupSet && !groupSet.has(c.set)) continue;

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

    if (terms.length) {
      const hay = c._hay || "";
      let matches = true;
      for (const t of terms) {
        if (!hay.includes(t.raw) && (!t.clean || !hay.includes(t.clean))) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;
    }

    const name = c.name.toLowerCase();
    let score = 10;
    if (q) {
      const qLower = q.toLowerCase();
      const qClean = qLower.replace(/[\x27\x60\u2019]/g, "");
      const nameClean = name.replace(/[\x27\x60\u2019]/g, "");
      if (name === qLower || nameClean === qClean) score = 0;
      else if (name.startsWith(qLower) || nameClean.startsWith(qClean)) score = 1;
      else if (name.includes(qLower) || nameClean.includes(qClean)) score = 2;
      else if (terms.every((t) => name.includes(t.raw) || (t.clean && nameClean.includes(t.clean)))) score = 3;
      else score = 6;
    }
    if (c.name.startsWith("_")) score += 30;
    hits.push({ score, c });
  }
  return hits.length;
}

for (const c of cards) {
  c._type_lower = (c.type_line || "").toLowerCase();
  c._name_lower = (c.name || "").toLowerCase();
  c._name_clean = c._name_lower.replace(/[\x27\x60\u2019]/g, "");
}

function newSearch() {
  const sortedColors = colors ? [...colors].sort().join("") : "";
  const parsedCmc = cmcParts ? cmcParts.map(p => {
    if (p.endsWith("+")) return { min: true, val: Number(p.slice(0, -1)) };
    return { min: false, val: Number(p) };
  }).filter(p => !Number.isNaN(p.val)) : null;

  const qLower = q ? q.toLowerCase() : "";
  const qClean = qLower ? qLower.replace(/[\x27\x60\u2019]/g, "") : "";

  const hits = [];
  for (const c of pool) {
    if (token) {
      if (!c.token) continue;
    } else if (c.token) {
      continue;
    }
    if (type && !c._type_lower.includes(type)) continue;
    if (rarity && c.rarity !== rarity) continue;
    if (format && c.legalities?.[format] !== "legal") continue;
    if (setCode && c.set !== setCode) continue;
    if (groupSet && !groupSet.has(c.set)) continue;

    if (parsedCmc && parsedCmc.length) {
      let matchCmc = false;
      for (let i = 0; i < parsedCmc.length; i++) {
        const p = parsedCmc[i];
        if (p.min) {
          if (c.cmc >= p.val) { matchCmc = true; break; }
        } else {
          if (c.cmc === p.val) { matchCmc = true; break; }
        }
      }
      if (!matchCmc) continue;
    }

    if (hasColorless && !colors) {
      if ((c.colors || []).length > 0) continue;
    } else if (colors) {
      const ident = (colorMode === "identity" ? c.color_identity : c.colors) || [];
      const isCardColorless = (c.colors || []).length === 0;

      if (hasColorless && isCardColorless) {
      } else if (colorMode === "exact") {
        let setStr = "";
        if (ident.length) {
          const identArr = [];
          for (let i = 0; i < ident.length; i++) identArr.push(ident[i]);
          setStr = identArr.sort().join("");
        }
        if (sortedColors !== setStr) continue;
        if (colors.length === 0 && ident.length) continue;
      } else if (colorMode === "identity") {
        let ok = true;
        for (let i = 0; i < ident.length; i++) {
          if (!colors.includes(ident[i])) { ok = false; break; }
        }
        if (!ok) continue;
      } else if (colorMode === "any") {
        let ok = false;
        for (let i = 0; i < colors.length; i++) {
          if (ident.includes(colors[i])) { ok = true; break; }
        }
        if (!ok) continue;
      } else {
        let ok = true;
        for (let i = 0; i < colors.length; i++) {
          if (!ident.includes(colors[i])) { ok = false; break; }
        }
        if (!ok) continue;
      }
    }

    if (terms.length) {
      const hay = c._hay || "";
      let matches = true;
      for (let i = 0; i < terms.length; i++) {
        const t = terms[i];
        if (!hay.includes(t.raw) && (!t.clean || !hay.includes(t.clean))) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;
    }

    const name = c._name_lower;
    let score = 10;
    if (q) {
      const nameClean = c._name_clean;
      if (name === qLower || nameClean === qClean) score = 0;
      else if (name.startsWith(qLower) || nameClean.startsWith(qClean)) score = 1;
      else if (name.includes(qLower) || nameClean.includes(qClean)) score = 2;
      else {
        let allTermsMatch = true;
        for (let i = 0; i < terms.length; i++) {
          const t = terms[i];
          if (!(name.includes(t.raw) || (t.clean && nameClean.includes(t.clean)))) {
            allTermsMatch = false;
            break;
          }
        }
        if (allTermsMatch) score = 3;
        else score = 6;
      }
    }
    if (c.name.startsWith("_")) score += 30;
    hits.push({ score, c });
  }
  return hits.length;
}

// Warmup
for(let i=0;i<10;i++) { oldSearch(); newSearch(); }

const start1 = process.hrtime.bigint();
for(let i=0;i<100;i++) oldSearch();
const end1 = process.hrtime.bigint();

const start2 = process.hrtime.bigint();
for(let i=0;i<100;i++) newSearch();
const end2 = process.hrtime.bigint();

console.log("Old search:", Number(end1 - start1) / 1000000, "ms");
console.log("New search:", Number(end2 - start2) / 1000000, "ms");
