#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");

const BASE = "http://127.0.0.1:8877";

async function run() {
  console.log("=== 1. VERIFYING SEARCH WITH PUNCTUATION & DIACRITICS ===");

  // 1. Urza's Saga without apostrophe
  const resUrza = await fetch(`${BASE}/api/cards?q=urzas+saga`).then((r) => r.json());
  assert(resUrza.cards && resUrza.cards.length > 0, "urzas saga must return cards");
  assert.strictEqual(resUrza.cards[0].name, "Urza's Saga", "Top match for 'urzas saga' must be Urza's Saga");
  console.log(`✓ 'urzas saga' returned ${resUrza.total} cards, top match: "${resUrza.cards[0].name}"`);

  // 2. Dandân with plain ASCII dandan
  const resDandan = await fetch(`${BASE}/api/cards?q=dandan`).then((r) => r.json());
  assert(resDandan.cards && resDandan.cards.length > 0, "dandan must return cards");
  assert(resDandan.cards.some((c) => c.name === "Dandân"), "Must find Dandân");
  console.log(`✓ 'dandan' successfully matched "${resDandan.cards[0].name}"`);

  // 3. Crusade (card formerly only in oldPrintings)
  const resCrusade = await fetch(`${BASE}/api/cards?q=Crusade`).then((r) => r.json());
  assert(resCrusade.cards && resCrusade.cards.length > 0, "Crusade must return cards");
  assert.strictEqual(resCrusade.cards[0].name, "Crusade", "Top match for Crusade must be the card Crusade");
  console.log(`✓ 'Crusade' successfully found merged card "${resCrusade.cards[0].name}"`);

  // 4. Double-faced card search by back-face name/text (Tibalt on Valki)
  const resTibalt = await fetch(`${BASE}/api/cards?q=tibalt`).then((r) => r.json());
  assert(resTibalt.cards.some((c) => c.name.includes("Tibalt")), "Must find Tibalt cards");
  console.log(`✓ 'tibalt' matched ${resTibalt.total} cards including MDFCs/transform cards`);

  // 5. Adventure search (Stomp on Bonecrusher Giant)
  const resStomp = await fetch(`${BASE}/api/cards?q=stomp`).then((r) => r.json());
  assert(resStomp.cards.some((c) => c.name.includes("Bonecrusher Giant")), "Must find Bonecrusher Giant for stomp");
  console.log(`✓ 'stomp' matched adventure card Bonecrusher Giant // Stomp`);

  console.log("\n=== 2. VERIFYING PAGINATION & TOTAL CARD COUNTS ===");

  // Query Dragon
  const resDragonsP1 = await fetch(`${BASE}/api/cards?q=Dragon&limit=60&offset=0`).then((r) => r.json());
  assert(resDragonsP1.total > 1000, `Dragon total should be > 1000, got ${resDragonsP1.total}`);
  assert.strictEqual(resDragonsP1.cards.length, 60, "Page 1 must have 60 cards");
  assert.strictEqual(resDragonsP1.hasMore, true, "Page 1 must have hasMore = true");

  const resDragonsP2 = await fetch(`${BASE}/api/cards?q=Dragon&limit=60&offset=60`).then((r) => r.json());
  assert.strictEqual(resDragonsP2.cards.length, 60, "Page 2 must have 60 cards");
  assert.strictEqual(resDragonsP2.hasMore, true, "Page 2 must have hasMore = true");
  assert.notStrictEqual(resDragonsP1.cards[0].id, resDragonsP2.cards[0].id, "Page 2 must have different cards than Page 1");
  console.log(`✓ 'Dragon' returned total ${resDragonsP1.total} cards with seamless offset pagination`);

  console.log("\n=== 3. VERIFYING SET EXPANSIONS & OLD PRINTINGS ===");

  // Modern Horizons 2
  const resMH2 = await fetch(`${BASE}/api/cards?set=mh2&limit=5`).then((r) => r.json());
  assert.strictEqual(resMH2.total, 493, "MH2 must have 493 cards");
  console.log(`✓ 'set=mh2' returned ${resMH2.total} cards from Modern Horizons 2`);

  // Alpha (Old School)
  const resLEA = await fetch(`${BASE}/api/cards?set=lea&limit=5`).then((r) => r.json());
  assert.strictEqual(resLEA.total, 295, "LEA must have 295 cards");
  console.log(`✓ 'set=lea' returned ${resLEA.total} cards from Alpha`);

  // API Sets Endpoint
  const sets = await fetch(`${BASE}/api/sets`).then((r) => r.json());
  const hasModern = sets.some((g) => g.id === "modern_expansions");
  assert(hasModern, "api/sets must include modern_expansions group");
  console.log(`✓ '/api/sets' provides ${sets.length} categorized set groups including modern expansions`);

  console.log("\n=== 4. VERIFYING COLORLESS & MULTI-CMC SEARCH ===");

  // Colorless cards with CMC 0 or 5+
  const resColorless = await fetch(`${BASE}/api/cards?colors=C&cmc=0,5+&limit=10`).then((r) => r.json());
  assert(resColorless.total > 1500, `Colorless CMC 0 or 5+ should be > 1500, got ${resColorless.total}`);
  for (const c of resColorless.cards) {
    assert.strictEqual((c.colors || []).length, 0, `Card ${c.name} must be colorless`);
    assert(c.cmc === 0 || c.cmc >= 5, `Card ${c.name} must have CMC 0 or >= 5 (got ${c.cmc})`);
  }
  console.log(`✓ Colorless with CMC 0,5+ returned ${resColorless.total} cards matching both constraints`);

  console.log("\n=== 5. VERIFYING CLIENT CODE & CSS FOR BUILDER ===");
  const builderCode = fs.readFileSync("public/js/builder.js", "utf8");
  assert(builderCode.includes("search-meta"), "builder.js must render search-meta");
  assert(builderCode.includes("search-pagination"), "builder.js must render search-pagination");
  assert(builderCode.includes("btn-load-more"), "builder.js must have load more button");
  assert(builderCode.includes("color-mode"), "builder.js must have color-mode selector");
  assert(builderCode.includes('"C"'), "builder.js must have Colorless in colors array");
  assert(builderCode.includes('"5+"'), "builder.js must have 5+ in cmc array");
  assert(builderCode.includes("search(true)"), "builder.js must trigger search on initial load");

  const appCss = fs.readFileSync("public/css/app.css", "utf8");
  assert(appCss.includes(".search-meta-bar"), "app.css must have .search-meta-bar");
  assert(appCss.includes(".search-pagination"), "app.css must have .search-pagination");
  assert(appCss.includes(".color-mode-select"), "app.css must have .color-mode-select");
  console.log("✓ builder.js and app.css have all required UI structures");

  console.log("\n🎉 ALL SEARCH ENHANCEMENT TESTS PASSED! ✨");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
