#!/usr/bin/env node
"use strict";
// End-to-end test for the new combat "attack" action:
//  - create a vsBot table, pick a starter deck, game starts
//  - on the player's first turn, create a 4/4 token creature
//  - attack with it -> verify bot life drops by 4, token taps, phase -> combat
const { WebSocket } = require("ws");
const BASE = "http://127.0.0.1:8877";

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function run() {
  console.log("=== TESTING COMBAT ATTACK ACTION ===");

  const u = {
    username: `combat_wiz_${Math.random().toString(36).slice(2, 8)}`,
    password: "Password123!",
    displayName: "Combat Wizard",
  };
  const regRes = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(u),
  }).then((r) => r.json());
  if (!regRes.ok || !regRes.token) throw new Error("Reg failed: " + JSON.stringify(regRes));
  const token = regRes.token;
  console.log(`✓ Registered ${u.username}`);

  // Grab a starter deck id
  const decks = await fetch(`${BASE}/api/decks`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  const starter = (decks.decks || decks || []).find((d) => d.starter) || (decks.decks || [])[0];
  if (!starter) throw new Error("no starter deck available");
  console.log(`✓ Starter deck: ${starter.name} (${starter.id})`);

  const ws = await new Promise((resolve, reject) => {
    const w = new WebSocket("ws://127.0.0.1:8877/ws");
    const inbox = [];
    w.on("error", reject);
    w.on("open", () => w.send(JSON.stringify({ t: "hello", token })));
    w.on("message", (data) => {
      const msg = JSON.parse(String(data));
      inbox.push(msg);
      if (msg.t === "hello") resolve({ ws: w, inbox });
    });
  });

  ws.ws.send(JSON.stringify({ t: "create", name: "Combat Lab", vsBot: true }));
  const joined = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timeout joining")), 5000);
    const iv = setInterval(() => {
      const m = ws.inbox.find((x) => x.t === "joined");
      if (m) { clearTimeout(timeout); clearInterval(iv); resolve(m); }
    }, 30);
  });
  const code = joined.code;
  console.log(`✓ Table created (${code}, vsBot)`);

  const send = (a) => ws.ws.send(JSON.stringify({ t: "action", a }));
  send({ kind: "pickDeck", deckId: starter.id });
  console.log("✓ Picked starter deck");

  // Wait for game start + my first turn
  let state = null;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    const m = [...ws.inbox].reverse().find((x) => x.t === "state" && x.state && x.state.started);
    if (m) {
      state = m.state;
      if (state.activeSeat === state.you && state.turn >= 1) break;
    }
    await sleep(60);
  }
  if (!state) throw new Error("game never started");
  const myIdx = state.you;
  const botIdx = 1 - myIdx;
  const botLife0 = state.seats[botIdx].life;
  console.log(`✓ Game started — me seat ${myIdx}, turn ${state.turn}, bot life ${botLife0}`);

  // Create a 4/4 token creature
  send({ kind: "token", name: "Test Goblin", power: "4", toughness: "4", n: 1 });
  const tokAt = Date.now();
  let tokIid = null;
  while (Date.now() - tokAt < 8000) {
    const m = [...ws.inbox].reverse().find((x) => x.t === "state" && x.state);
    if (m && m.state.seats) {
      const mine = m.state.seats[myIdx];
      const found = (mine.zones.battlefield || []).find((c) => c.name === "Test Goblin");
      if (found) { tokIid = found.iid; state = m.state; break; }
    }
    await sleep(60);
  }
  if (!tokIid) throw new Error("token never landed on battlefield");
  console.log(`✓ Token on battlefield (${tokIid})`);

  // Attack!
  send({ kind: "attack", iid: tokIid });
  const atkAt = Date.now();
  let ok = false;
  while (Date.now() - atkAt < 8000) {
    const m = [...ws.inbox].reverse().find((x) => x.t === "state" && x.state && x.state.seats);
    if (m && m.state.seats) {
      const s = m.state;
      if (s.phase === "combat" && s.seats[botIdx].life === botLife0 - 4) {
        const tok = (s.seats[myIdx].zones.battlefield || []).find((c) => c.iid === tokIid);
        if (tok && tok.tapped) {
          ok = true;
          console.log(`✓ ATTACK RESOLVED: bot life ${botLife0} → ${s.seats[botIdx].life}, phase ${s.phase}, token tapped ✓`);
          break;
        }
      }
      state = s;
    }
    await sleep(60);
  }
  if (!ok) {
    console.log("✗ Attack did not resolve correctly. Last state:", JSON.stringify({
      phase: state && state.phase,
      botLife: state && state.seats[botIdx] && state.seats[botIdx].life,
      token: state && state.seats[myIdx] && state.seats[myIdx].zones.battlefield.find((c) => c.iid === tokIid),
    }).slice(0, 300));
    throw new Error("attack failed");
  }

  // Bonus 1: a TAPPED creature must NOT be able to attack again
  send({ kind: "attack", iid: tokIid });
  await sleep(400);
  const tappedState = [...ws.inbox].reverse().find((x) => x.t === "state" && x.state);
  const lifeAfterTapAtk = tappedState && tappedState.state.seats[botIdx].life;
  if (lifeAfterTapAtk === botLife0 - 4) {
    console.log("✓ Tapped creature correctly refused to attack again ✓");
  } else {
    throw new Error("tapped creature was allowed to attack again!");
  }

  // Bonus 2: lethal damage should end the game
  send({ kind: "token", name: "Lethal", power: "20", toughness: "20", n: 1 });
  await sleep(400);
  const lastState = [...ws.inbox].reverse().find((x) => x.t === "state" && x.state);
  const lethalTok = lastState.state.seats[myIdx].zones.battlefield.find((c) => c.name === "Lethal");
  send({ kind: "attack", iid: lethalTok.iid });
  const endAt = Date.now();
  let ended = false;
  while (Date.now() - endAt < 8000) {
    const m = [...ws.inbox].reverse().find((x) => x.t === "state" && x.state);
    if (m && m.state.ended && m.state.winnerSeat === myIdx) { ended = true; break; }
    await sleep(60);
  }
  if (!ended) throw new Error("lethal attack did not end the game");
  console.log("✓ Lethal attack ended the game — victory by combat damage ✓");

  ws.ws.close();
  console.log("\n🎉 COMBAT ATTACK TEST COMPLETE");
  process.exit(0);
}

run().catch((err) => {
  console.error("✗ FAIL:", err.message);
  process.exit(1);
});