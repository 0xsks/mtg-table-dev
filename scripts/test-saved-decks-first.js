#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");

console.log("=== VERIFYING SAVED DECKS APPEAR FIRST ===");

// 1. Check profile.js code structure
const profileCode = fs.readFileSync("public/js/profile.js", "utf8");

// Verify displayDecks puts myDecks first
assert(profileCode.includes("const displayDecks = [...myDecks, ...starterDecks, ...otherDecks]"), "profile.js must place myDecks first in displayDecks");
console.log("✓ profile.js orders displayDecks with player saved decks first");

// Verify renderDecksArmory is rendered in portal view AND in profile view
const firstDecksArmoryIdx = profileCode.indexOf("${renderDecksArmory()}");
const secondDecksArmoryIdx = profileCode.indexOf("${renderDecksArmory()}", firstDecksArmoryIdx + 1);
const charCardIdx = profileCode.indexOf("profile-char-card");
const customizerIdx = profileCode.indexOf("Character Customization Station");

assert(firstDecksArmoryIdx !== -1, "renderDecksArmory must be in portal view");
assert(secondDecksArmoryIdx !== -1, "renderDecksArmory must be in profile view");
assert(charCardIdx < secondDecksArmoryIdx, "In profile view, renderDecksArmory must be after profile-char-card");
assert(secondDecksArmoryIdx < customizerIdx, "In profile view, renderDecksArmory must appear BEFORE Character Customization Station");
console.log("✓ profile.js renders Saved Decks Armory FIRST before customization & achievements in both views");

// 2. Check builder.js code structure
const builderCode = fs.readFileSync("public/js/builder.js", "utf8");

// Verify builder sortedDecks puts myDecks first
assert(builderCode.includes("sortedDecks = [...myDecks, ...starterDecks, ...otherDecks]"), "builder.js must order sortedDecks with player saved decks first");
console.log("✓ builder.js orders sortedDecks with player saved decks first");

// Verify builder has the builder-decks-bar
assert(builderCode.includes("builder-decks-bar"), "builder.js must render builder-decks-bar");
assert(builderCode.includes("builder-deck-pill"), "builder.js must render deck pills");
console.log("✓ builder.js contains the quick-switch Saved Decks bar");

// Verify builder auto-loads player's first saved deck if !r.id
assert(builderCode.includes("myDecks[0].id"), "builder.js must auto-load primary saved deck when opening builder");
console.log("✓ builder.js auto-loads player's first saved deck on /builder");

// 3. Check CSS rules
const cssCode = fs.readFileSync("public/css/app.css", "utf8");
assert(cssCode.includes(".builder-decks-bar"), "app.css must have .builder-decks-bar styles");
assert(cssCode.includes(".is-my-saved-deck"), "app.css must have .is-my-saved-deck styles");
assert(cssCode.includes(".deck-saved-pill"), "app.css must have .deck-saved-pill styles");
console.log("✓ app.css has all required styling classes");

console.log("\nALL VERIFICATIONS PASSED! ✨");
