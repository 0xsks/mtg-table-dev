#!/usr/bin/env node
"use strict";

const assert = require("assert");

const PORT = 8888;
const BASE = `http://127.0.0.1:${PORT}`;

async function run() {
  console.log("=== TESTING DEFI KINGDOMS FULL SCREEN MAP & TOP-LEFT PLAYER CARD ===");

  // 1. Verify HTTP Serving of rpg.js, app.css, and profile.js
  console.log("1. Checking asset serving...");
  const [resHtml, resCss, resRpg, resProfile] = await Promise.all([
    fetch(`${BASE}/`).then((r) => r.text()),
    fetch(`${BASE}/css/app.css`).then((r) => r.text()),
    fetch(`${BASE}/js/rpg.js`).then((r) => r.text()),
    fetch(`${BASE}/js/profile.js`).then((r) => r.text()),
  ]);

  assert(resHtml.includes("/js/rpg.js"), "index.html must reference /js/rpg.js");
  assert(resHtml.includes("/js/profile.js"), "index.html must reference /js/profile.js");
  console.log("✓ index.html references all required scripts");

  // 2. Verify CSS rules for full screen map and top-left player card
  console.log("2. Checking CSS rules for full screen viewport and player card...");
  assert(resCss.includes(".dfk-world-viewport"), "CSS must define .dfk-world-viewport");
  assert(resCss.includes(".dfk-world-container"), "CSS must define .dfk-world-container");
  assert(resCss.includes(".dfk-player-card"), "CSS must define .dfk-player-card");
  assert(resCss.includes("top: 16px"), ".dfk-player-card must be pinned to top");
  assert(resCss.includes("left: 16px"), ".dfk-player-card must be pinned to left");
  assert(resCss.includes(".dfk-portrait-wrap"), "CSS must define .dfk-portrait-wrap");
  assert(resCss.includes(".dfk-level-badge"), "CSS must define .dfk-level-badge");
  assert(resCss.includes(".dfk-bar-track"), "CSS must define .dfk-bar-track");
  assert(resCss.includes(".dfk-sheet-drawer"), "CSS must define .dfk-sheet-drawer");
  console.log("✓ CSS styling rules verified for full screen map, top-left card, and drawer");

  // 3. Verify JavaScript engine logic in rpg.js
  console.log("3. Checking RPG engine code structure in rpg.js...");
  assert(resRpg.includes("initHomeroom"), "rpg.js must export initHomeroom");
  assert(resRpg.includes("dfk-player-card"), "rpg.js must render dfk-player-card");
  assert(resRpg.includes("renderPlayerCard"), "rpg.js must have renderPlayerCard function");
  assert(resRpg.includes("updatePlayerVitals"), "rpg.js must have updatePlayerVitals function");
  assert(resRpg.includes("dfk-topright-hud"), "rpg.js must render dfk-topright-hud");
  assert(resRpg.includes("dfk-bottom-hotbar"), "rpg.js must render dfk-bottom-hotbar");

  // Check all DeFi Kingdoms landmarks
  const expectedLandmarks = [
    { id: "arena", icon: "🏰", route: "/tables" },
    { id: "builder", icon: "📖", route: "/builder" },
    { id: "guilds", icon: "⚔️", route: "/guilds" },
    { id: "dao", icon: "🏛️", route: "/dao" },
    { id: "dnd", icon: "🐉", route: "/dnd" },
    { id: "bazaar", icon: "🎴", route: "/cards" },
    { id: "mirror", icon: "🪞", action: "profile" },
  ];

  expectedLandmarks.forEach((lm) => {
    assert(resRpg.includes(`"${lm.id}"`), `rpg.js must include landmark ${lm.id}`);
    assert(resRpg.includes(lm.icon), `rpg.js must include landmark icon ${lm.icon}`);
    if (lm.route) {
      assert(resRpg.includes(lm.route), `rpg.js must route to ${lm.route}`);
    }
  });
  console.log("✓ All DeFi Kingdoms landmarks verified (Arena, Grimoire, Citadel, DAO, Astral Rift, Bazaar, Mirror)");

  // 4. Verify DOM Simulation of initHomeroom
  console.log("4. Simulating browser DOM execution of initHomeroom...");
  // Create a minimal mock DOM environment to verify initHomeroom runs without exceptions
  const mockElements = new Map();
  function createMockEl(tag = "div") {
    const el = {
      tagName: tag.toUpperCase(),
      classList: {
        add(c) { el.className += " " + c; },
        remove(c) { el.className = el.className.replace(c, "").trim(); },
      },
      className: "",
      style: {},
      children: [],
      appendChild(child) { el.children.push(child); return child; },
      getBoundingClientRect() { return { width: 1440, height: 900, top: 0, left: 0 }; },
      getContext(type) {
        if (type === "2d") {
          return {
            fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
            stroke() {}, fill() {}, arc() {}, ellipse() {}, roundRect() {}, closePath() {},
            clearRect() {}, save() {}, restore() {}, scale() {}, translate() {},
            fillText() {}, measureText() { return { width: 40 }; },
            createRadialGradient() { return { addColorStop() {} }; },
            createLinearGradient() { return { addColorStop() {} }; },
          };
        }
        return null;
      },
      querySelector(sel) {
        if (sel.startsWith("#")) {
          const id = sel.slice(1);
          return mockElements.get(id) || null;
        }
        return null;
      },
      querySelectorAll() { return []; },
      addEventListener() {},
      removeEventListener() {},
      setAttribute() {},
      getAttribute() { return null; },
    };
    Object.defineProperty(el, "innerHTML", {
      set(html) {
        el._html = html;
        // Parse any id="..." into mockElements
        const idMatches = html.matchAll(/id=["']([^"']+)["']/g);
        for (const m of idMatches) {
          const child = createMockEl("div");
          child.id = m[1];
          mockElements.set(m[1], child);
        }
      },
      get() { return el._html || ""; },
    });
    return el;
  }

  const mockContainer = createMockEl("div");
  const mockWindow = {
    innerWidth: 1440,
    innerHeight: 900,
    devicePixelRatio: 1,
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame() { return 1; },
    cancelAnimationFrame() {},
    MTG_SFX: { play() {} },
    MTG: { toast() {}, go() {} },
  };

  // Evaluate rpg.js code inside sandbox
  const vm = require("vm");
  const sandbox = {
    window: mockWindow,
    document: {
      createElement: (tag) => {
        const el = createMockEl(tag);
        return el;
      },
      fullscreenElement: null,
      exitFullscreen: () => Promise.resolve(),
      getElementById: (id) => mockElements.get(id) || null,
    },
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
    Math,
    Date,
    String,
    Object,
    Number,
    setTimeout,
    clearTimeout,
    console,
  };
  sandbox.window.document = sandbox.document;
  sandbox.window.requestAnimationFrame = sandbox.requestAnimationFrame;
  sandbox.window.cancelAnimationFrame = sandbox.cancelAnimationFrame;

  vm.createContext(sandbox);
  vm.runInContext(resRpg, sandbox);

  assert(sandbox.window.MTG_RPG, "Sandbox must define window.MTG_RPG");
  assert(typeof sandbox.window.MTG_RPG.initHomeroom === "function", "initHomeroom must be a function");

  let sheetOpened = false;
  const inst = sandbox.window.MTG_RPG.initHomeroom(mockContainer, {
    user: { username: "archmage_lily", displayName: "Lily the Archmage", avatar: "preset:fairy", balance: 5420 },
    me: { name: "Lily" },
    onOpenSheet: () => { sheetOpened = true; },
  });

  assert(inst, "initHomeroom must return instance");
  assert(typeof inst.updateUser === "function", "instance must have updateUser");
  assert(typeof inst.destroy === "function", "instance must have destroy");

  // Verify Player Card elements in mock
  const cardNameEl = mockElements.get("dfk-card-name");
  assert(cardNameEl, "dfk-card-name element must exist");

  const cardGoldEl = mockElements.get("dfk-card-gold");
  assert(cardGoldEl, "dfk-card-gold element must exist");

  const openSheetBtn = mockElements.get("btn-dfk-open-sheet");
  assert(openSheetBtn, "btn-dfk-open-sheet must exist");
  assert(typeof openSheetBtn.onclick === "function", "btn-dfk-open-sheet must have onclick");
  openSheetBtn.onclick();
  assert.strictEqual(sheetOpened, true, "Clicking sheet button must trigger onOpenSheet callback");

  // Test updateUser
  inst.updateUser({ displayName: "Lily Ascended", avatar: "preset:dragon", balance: 99999 });
  assert.strictEqual(mockElements.get("dfk-card-gold").textContent, "99,999", "updateUser must update gold display");

  inst.destroy();
  console.log("✓ DOM simulation verified: player card, vitals, updateUser, sheet drawer trigger all working smoothly");

  console.log("\nALL DEFI KINGDOMS FULL SCREEN MAP & PLAYER CARD TESTS PASSED! 🎉");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
