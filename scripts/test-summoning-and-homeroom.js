#!/usr/bin/env node
"use strict";
// Test suite to verify:
// 1. Summoning sickness lasts strictly 1 turn:
//    - Card created on battlefield on turn N has enteredAtTurn = N.
//    - Repositioning on battlefield does NOT reset enteredAtTurn.
//    - After turn passes to next round (turn > N), enteredAtTurn < t.turn, meaning summoning sickness is gone.
// 2. Homeroom assets (rpg.js) are properly served by the server.

const { WebSocket } = require("ws");
const assert = require("assert");
const PORT = process.env.PORT || 8888;
const BASE = `http://127.0.0.1:${PORT}`;
const WS_BASE = `ws://127.0.0.1:${PORT}/ws`;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function run() {
  console.log("=== 1. VERIFYING RPG HOMEROOM ASSET SERVING ===");
  const res = await fetch(`${BASE}/js/rpg.js`);
  assert.strictEqual(res.status, 200, "rpg.js must return 200 OK");
  const rpgText = await res.text();
  assert(rpgText.includes("window.MTG_RPG"), "rpg.js must export window.MTG_RPG");
  assert(rpgText.includes("initHomeroom"), "rpg.js must define initHomeroom");
  assert(rpgText.includes("updateUser"), "rpg.js must have updateUser method");
  console.log("✓ rpg.js is correctly served by server (size: " + rpgText.length + " bytes)");

  // Check index.html includes rpg.js
  const htmlRes = await fetch(`${BASE}/`);
  const htmlText = await htmlRes.text();
  assert(htmlText.includes("/js/rpg.js"), "index.html must include script tag for /js/rpg.js");
  console.log("✓ index.html references /js/rpg.js");

  console.log("\n=== 2. VERIFYING SUMMONING SICKNESS & TURN ADVANCEMENT ===");
  const u = {
    username: `sick_test_${Math.random().toString(36).slice(2, 8)}`,
    password: "Password123!",
    displayName: "Summoning Tester",
  };
  const regRes = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(u),
  }).then((r) => r.json());
  assert(regRes.ok && regRes.token, "Register failed");
  const token = regRes.token;

  // Starter deck
  const decks = await fetch(`${BASE}/api/decks`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  const starter = (decks.decks || decks || []).find((d) => d.starter) || (decks.decks || [])[0];

  const ws = await new Promise((resolve, reject) => {
    const w = new WebSocket(WS_BASE);
    const inbox = [];
    w.on("error", reject);
    w.on("open", () => w.send(JSON.stringify({ t: "hello", token })));
    w.on("message", (data) => {
      const msg = JSON.parse(String(data));
      inbox.push(msg);
      if (msg.t === "hello") resolve({ ws: w, inbox });
    });
  });

  ws.ws.send(JSON.stringify({ t: "create", name: "Sickness Table", vsBot: true }));
  const joined = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timeout joining")), 5000);
    const iv = setInterval(() => {
      const m = ws.inbox.find((x) => x.t === "joined");
      if (m) { clearTimeout(timeout); clearInterval(iv); resolve(m); }
    }, 30);
  });
  const code = joined.code;
  console.log(`✓ Table created: ${code}`);

  const send = (a) => ws.ws.send(JSON.stringify({ t: "action", a }));
  send({ kind: "pickDeck", deckId: starter.id });

  // Wait for game start
  let state = null;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 12000) {
    const m = [...ws.inbox].reverse().find((x) => x.t === "state" && x.state && x.state.started);
    if (m) {
      state = m.state;
      if (state.activeSeat === state.you && state.turn >= 1) break;
    }
    await sleep(60);
  }
  assert(state, "Game did not start in time");
  const mySeat = state.you;
  const initialTurn = state.turn;
  console.log(`✓ Game started on turn ${initialTurn} (activeSeat = ${state.activeSeat})`);

  // Create a token creature on turn N
  send({ kind: "token", name: "Swift Gremlin", power: "3", toughness: "3", n: 1 });
  let gremlin = null;
  const tokenAt = Date.now();
  while (Date.now() - tokenAt < 8000) {
    const m = [...ws.inbox].reverse().find((x) => x.t === "state" && x.state);
    if (m && m.state.seats) {
      const mine = m.state.seats[mySeat];
      gremlin = (mine.zones.battlefield || []).find((c) => c.name === "Swift Gremlin");
      if (gremlin) { state = m.state; break; }
    }
    await sleep(60);
  }
  assert(gremlin, "Token not found on battlefield");
  console.log(`✓ Token created on turn ${initialTurn}: enteredAtTurn = ${gremlin.enteredAtTurn}`);
  assert.strictEqual(gremlin.enteredAtTurn, initialTurn, "Token enteredAtTurn must match the turn it was created");

  // TEST 1: Repositioning via "pos" action must preserve enteredAtTurn
  send({ kind: "pos", iid: gremlin.iid, x: 250, y: 350 });
  await sleep(150);
  let latestState = [...ws.inbox].reverse().find((x) => x.t === "state" && x.state).state;
  let repoCard = (latestState.seats[mySeat].zones.battlefield || []).find((c) => c.iid === gremlin.iid);
  assert.strictEqual(repoCard.enteredAtTurn, initialTurn, "pos action must preserve enteredAtTurn");
  console.log("✓ Repositioning with 'pos' action preserved enteredAtTurn =", repoCard.enteredAtTurn);

  // TEST 2: Repositioning via "move" to battlefield must preserve enteredAtTurn
  send({ kind: "move", iid: gremlin.iid, toZone: "battlefield", x: 300, y: 400 });
  await sleep(150);
  latestState = [...ws.inbox].reverse().find((x) => x.t === "state" && x.state).state;
  repoCard = (latestState.seats[mySeat].zones.battlefield || []).find((c) => c.iid === gremlin.iid);
  assert.strictEqual(repoCard.enteredAtTurn, initialTurn, "move to battlefield for card already on battlefield must NOT reset enteredAtTurn");
  console.log("✓ Dragging on battlefield ('move' action) preserved enteredAtTurn =", repoCard.enteredAtTurn);

  // TEST 3: Pass turn so round advances
  console.log("Advancing turn to test 1-turn expiration...");
  send({ kind: "passTurn" });
  const passAt = Date.now();
  let nextRoundState = null;
  while (Date.now() - passAt < 12000) {
    const m = [...ws.inbox].reverse().find((x) => x.t === "state" && x.state);
    if (m && m.state.turn > initialTurn && m.state.activeSeat === mySeat) {
      nextRoundState = m.state;
      break;
    }
    await sleep(80);
  }
  assert(nextRoundState, "Turn did not advance back to player");
  console.log(`✓ Now on turn ${nextRoundState.turn} (was turn ${initialTurn})`);

  const cardNextTurn = (nextRoundState.seats[mySeat].zones.battlefield || []).find((c) => c.iid === gremlin.iid);
  assert(cardNextTurn, "Card missing on next turn");
  console.log(`✓ Card enteredAtTurn = ${cardNextTurn.enteredAtTurn}, current turn = ${nextRoundState.turn}`);
  assert(cardNextTurn.enteredAtTurn < nextRoundState.turn, "Card enteredAtTurn MUST be less than current turn");

  // Client-side rule verification: is sick?
  // Sick if enteredAtTurn == currentTurn
  const isSickNow = cardNextTurn.enteredAtTurn != null && cardNextTurn.enteredAtTurn >= nextRoundState.turn;
  assert.strictEqual(isSickNow, false, "Card must NO LONGER have summoning sickness!");
  console.log("✓ Verified summoning sickness correctly lasted only 1 turn!");

  // TEST 4: Attack with creature now that sickness has expired
  const botIdx = 1 - mySeat;
  const botLifeBefore = nextRoundState.seats[botIdx].life;
  send({ kind: "attack", iid: gremlin.iid });
  await sleep(300);
  const afterAtk = [...ws.inbox].reverse().find((x) => x.t === "state" && x.state).state;
  const botLifeAfter = afterAtk.seats[botIdx].life;
  console.log(`✓ Bot life before attack: ${botLifeBefore}, after attack: ${botLifeAfter}`);
  assert.strictEqual(botLifeAfter, botLifeBefore - 3, "Bot life should drop by creature power (3)");
  console.log("✓ Creature attacked successfully after summoning sickness expired!");

  ws.ws.close();
  console.log("\nALL TESTS PASSED SUCCESSFULLY! ✨");
}

run().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
