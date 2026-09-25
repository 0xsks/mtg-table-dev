#!/usr/bin/env node
"use strict";

const { WebSocket } = require("ws");

const BASE_URL = process.env.URL || "http://127.0.0.1:8877";
const WS_URL = process.env.WS_URL || "ws://127.0.0.1:8877/ws";

function createClient(name, playerId, token) {
  const ws = new WebSocket(WS_URL);
  const inbox = [];
  let send;
  const ready = new Promise((resolve, reject) => {
    ws.on("error", reject);
    ws.on("open", () => {
      send = (obj) => ws.send(JSON.stringify(obj));
      send({ t: "hello", playerId, name, token });
    });
    ws.on("message", (buf) => {
      const msg = JSON.parse(String(buf));
      inbox.push(msg);
      if (msg.t === "hello") resolve({ ws, send, inbox, name, playerId });
    });
  });
  return { ready, inbox, get send() { return send; }, ws, name, playerId };
}

function waitFor(inbox, pred, ms = 5000, desc = "condition") {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const hit = inbox.find(pred);
      if (hit) return resolve(hit);
      if (Date.now() - t0 > ms) return reject(new Error("Timeout waiting for " + desc));
      setTimeout(tick, 25);
    };
    tick();
  });
}

async function main() {
  console.log("=== Running Comprehensive Player 2 Table & Card Movement Test ===");

  // Fetch starter decks
  const decks = await fetch(`${BASE_URL}/api/decks`).then((r) => r.json());
  const starters = decks.filter((d) => d.starter && d.counts && d.counts.main >= 20);
  if (starters.length < 2) throw new Error("At least 2 starter decks required");
  console.log(`✓ Found ${starters.length} starter decks (${starters[0].name}, ${starters[1].name})`);

  // Register Alice (Player 1)
  const auth1 = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "p1_" + Date.now(),
      password: "password123",
      displayName: "Alice",
    }),
  }).then((r) => r.json());
  console.log("✓ Registered Player 1:", auth1.user.username);

  // Connect Player 1
  const p1 = createClient("Alice", "p1_pid_" + Date.now(), auth1.token);
  await p1.ready;
  p1.send({ t: "create", name: "P2 Comprehensive Match", format: "duel", wager: 0 });
  const joined1 = await waitFor(p1.inbox, (m) => m.t === "joined", 4000, "p1 joined");
  const code = joined1.code;
  console.log("✓ Player 1 created table:", code);

  // Connect Player 2 as Guest (emulating ?second=1 window)
  const p2 = createClient("Player 2", "p2_pid_" + Date.now(), null);
  await p2.ready;
  p2.send({ t: "join", code, takeOver: true });
  await waitFor(p2.inbox, (m) => m.t === "joined", 4000, "p2 joined");

  const s1Init = await waitFor(p1.inbox, (m) => m.t === "state" && m.state.seats[1].playerId, 4000, "p1 sees p2");
  const s2Init = await waitFor(p2.inbox, (m) => m.t === "state" && m.state.seats[1].playerId, 4000, "p2 sees self");

  if (s1Init.state.you !== 0) throw new Error(`Expected P1 you=0, got ${s1Init.state.you}`);
  if (s2Init.state.you !== 1) throw new Error(`Expected P2 you=1, got ${s2Init.state.you}`);
  console.log("✓ Player 1 is Seat 0, Player 2 is Seat 1");

  // Both pick decks
  p1.send({ t: "action", a: { kind: "pickDeck", deckId: starters[0].id } });
  p2.send({ t: "action", a: { kind: "pickDeck", deckId: starters[1].id } });

  await waitFor(p1.inbox, (m) => m.t === "state" && m.state.seats[0].deckId && m.state.seats[1].deckId, 4000, "decks picked p1");
  await waitFor(p2.inbox, (m) => m.t === "state" && m.state.seats[0].deckId && m.state.seats[1].deckId, 4000, "decks picked p2");
  console.log("✓ Both players chose their decks");

  // Start game
  p1.send({ t: "action", a: { kind: "start" } });
  const startState1 = await waitFor(p1.inbox, (m) => m.t === "state" && m.state.started, 4000, "game start p1");
  const startState2 = await waitFor(p2.inbox, (m) => m.t === "state" && m.state.started, 4000, "game start p2");
  console.log("✓ Game successfully started!");

  const p2Seat = startState2.state.seats[1];
  const p2Hand = p2Seat.zones.hand;
  if (!Array.isArray(p2Hand) || p2Hand.length < 7) {
    throw new Error(`P2 hand invalid: length ${p2Hand?.length}`);
  }
  console.log(`✓ Player 2 has full 7-card hand (${p2Hand.map((c) => c.name).join(", ")})`);

  // Find a land in P2's hand
  const land = p2Hand.find((c) => /\bLand\b/i.test(c.type_line)) || p2Hand[0];
  console.log(`✓ Player 2 playing land from hand: ${land.name} (${land.iid})`);

  p2.send({
    t: "action",
    a: {
      kind: "move",
      iid: land.iid,
      toZone: "battlefield",
      toSeat: 1,
      x: 0.25,
      y: 0.35,
    },
  });

  const p2LandPlayed = await waitFor(
    p2.inbox,
    (m) => m.t === "state" && m.state.seats[1].zones.battlefield.some((c) => c.iid === land.iid),
    4000,
    "p2 land on battlefield"
  );
  const bfLand = p2LandPlayed.state.seats[1].zones.battlefield.find((c) => c.iid === land.iid);
  console.log(`✓ Land successfully moved to P2 battlefield: x=${bfLand.x}, y=${bfLand.y}`);

  // Test repositioning card around battlefield with pos
  console.log("✓ Testing P2 card repositioning via 'pos' action...");
  p2.send({
    t: "action",
    a: {
      kind: "pos",
      iid: land.iid,
      x: 0.72,
      y: 0.88,
    },
  });

  const p2Pos1 = await waitFor(
    p2.inbox,
    (m) => {
      if (m.t !== "state") return false;
      const c = m.state.seats[1].zones.battlefield.find((x) => x.iid === land.iid);
      return c && Math.abs(c.x - 0.72) < 0.01 && Math.abs(c.y - 0.88) < 0.01;
    },
    4000,
    "p2 pos update"
  );
  const repoLand = p2Pos1.state.seats[1].zones.battlefield.find((x) => x.iid === land.iid);
  console.log(`✓ Land repositioned to x=${repoLand.x}, y=${repoLand.y}`);

  // Test tap/untap for P2
  p2.send({ t: "action", a: { kind: "tap", iid: land.iid } });
  const p2Tapped = await waitFor(
    p2.inbox,
    (m) => {
      if (m.t !== "state") return false;
      const c = m.state.seats[1].zones.battlefield.find((x) => x.iid === land.iid);
      return c && c.tapped === true;
    },
    4000,
    "p2 land tap"
  );
  console.log("✓ Land tapped by Player 2");

  // Test casting non-land spell to stack, then resolving
  const p2UpdatedHand = p2Tapped.state.seats[1].zones.hand;
  const spell = p2UpdatedHand.find((c) => !/\bLand\b/i.test(c.type_line)) || p2UpdatedHand[0];
  console.log(`✓ Player 2 casting spell: ${spell.name} (${spell.iid})`);

  p2.send({
    t: "action",
    a: {
      kind: "move",
      iid: spell.iid,
      toZone: "battlefield", // client sends battlefield, backend moves spell to stack
      toSeat: 1,
    },
  });

  const p2SpellOnStack = await waitFor(
    p2.inbox,
    (m) => m.t === "state" && (m.state.stack || []).some((c) => c.iid === spell.iid),
    4000,
    "spell on stack"
  );
  console.log(`✓ Spell ${spell.name} successfully entered the stack!`);

  // Resolve spell to battlefield
  p2.send({ t: "action", a: { kind: "resolve" } });
  const p2Resolved = await waitFor(
    p2.inbox,
    (m) =>
      m.t === "state" &&
      (m.state.seats[1].zones.battlefield.some((c) => c.iid === spell.iid) ||
        m.state.seats[1].zones.graveyard.some((c) => c.iid === spell.iid)),
    4000,
    "spell resolved"
  );
  console.log("✓ Spell resolved!");

  // If permanent, test moving it on battlefield
  const permOnBf = p2Resolved.state.seats[1].zones.battlefield.find((c) => c.iid === spell.iid);
  if (permOnBf) {
    p2.send({ t: "action", a: { kind: "pos", iid: spell.iid, x: 0.15, y: 0.65 } });
    const p2SpellPos = await waitFor(
      p2.inbox,
      (m) => {
        if (m.t !== "state") return false;
        const c = m.state.seats[1].zones.battlefield.find((x) => x.iid === spell.iid);
        return c && Math.abs(c.x - 0.15) < 0.01;
      },
      4000,
      "spell pos updated"
    );
    console.log("✓ Creature/Permanent repositioned on battlefield: x=0.15, y=0.65");

    // Add counters
    p2.send({ t: "action", a: { kind: "counters", iid: spell.iid, counter: "p1p1", delta: 2 } });
    const p2Counters = await waitFor(
      p2.inbox,
      (m) => {
        if (m.t !== "state") return false;
        const c = m.state.seats[1].zones.battlefield.find((x) => x.iid === spell.iid);
        return c && c.counters && c.counters.p1p1 === 2;
      },
      4000,
      "counters added"
    );
    console.log("✓ +1/+1 counters added to card on battlefield:", p2Counters.state.seats[1].zones.battlefield.find(x => x.iid === spell.iid).counters);
  }

  // Verify Player 1 cannot tamper with Player 2's card
  p1.send({ t: "action", a: { kind: "pos", iid: land.iid, x: 0.01, y: 0.01 } });
  // Wait brief delay
  await new Promise((r) => setTimeout(r, 200));
  const latestState = p2.inbox.slice().reverse().find((m) => m.t === "state");
  const landCheck = latestState.state.seats[1].zones.battlefield.find((x) => x.iid === land.iid);
  if (!landCheck || Math.abs(landCheck.x - 0.72) > 0.05) {
    throw new Error("P1 was able to move P2's card! Security failure.");
  }
  console.log("✓ Verified: Player 1 cannot move Player 2's cards (security check passed)");

  p1.ws.close();
  p2.ws.close();
  console.log("\n*** ALL PLAYER 2 TESTS PASSED PERFECTLY! ***\n");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
