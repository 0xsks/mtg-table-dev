#!/usr/bin/env node
"use strict";

const { WebSocket } = require("ws");
const { signIn } = require("./lib/wallet");
const { BASE, WS_URL } = require("./lib/target");

function client(playerId, name, token) {
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
      if (msg.t === "hello") resolve({ ws, send, inbox, hello: msg });
    });
  });
  return { ready, inbox, get send() { return send; }, ws };
}

function waitFor(inbox, pred, ms = 5000) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const hit = inbox.find(pred);
      if (hit) return resolve(hit);
      if (Date.now() - t0 > ms) return reject(new Error("timeout " + pred));
      setTimeout(tick, 30);
    };
    tick();
  });
}

(async () => {
  console.log("1. Testing Auth Endpoints...");

  // Sign in Alice and Bob with throwaway wallets. Password auth is gone —
  // wallet sign-in is the only way in.
  const alice = await signIn({ displayName: "Alice Mage" });
  if (alice.balance !== 1000) throw new Error("Alice sign-in balance wrong: " + JSON.stringify(alice));
  const bob = await signIn({ displayName: "Bob Knight" });
  if (bob.balance !== 1000) throw new Error("Bob sign-in balance wrong: " + JSON.stringify(bob));
  const regA = alice;
  const regB = bob;

  // Verify /api/auth/me
  const meA = await fetch(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${regA.token}` },
  }).then((r) => r.json());
  if (!meA.ok || meA.user.username !== regA.username) throw new Error("Alice me check failed");

  // Verify Faucet
  const faucetA = await fetch(`${BASE}/api/auth/faucet`, {
    method: "POST",
    headers: { Authorization: `Bearer ${regA.token}` },
  }).then((r) => r.json());
  if (!faucetA.ok || faucetA.balance !== 1500) throw new Error("Faucet failed: " + JSON.stringify(faucetA));

  console.log("Auth passed! Alice balance:", faucetA.balance, "Bob balance:", regB.balance);

  console.log("2. Testing Wager & Table Match Payouts...");
  const decks = await fetch(`${BASE}/api/decks`).then((r) => r.json());
  const a = client("player-a", "Alice", regA.token);
  const b = client("player-b", "Bob", regB.token);
  await Promise.all([a.ready, b.ready]);

  // Create table with 200 Gold wager
  a.send({ t: "create", name: "High Stakes Duel", format: "duel", wager: 200 });
  const joinedA = await waitFor(a.inbox, (m) => m.t === "joined");
  const code = joinedA.code;

  b.send({ t: "join", code });
  await waitFor(b.inbox, (m) => m.t === "joined");

  // Pick decks
  a.send({ t: "action", a: { kind: "pickDeck", deckId: decks[0].id } });
  b.send({ t: "action", a: { kind: "pickDeck", deckId: decks[1].id } });
  await waitFor(a.inbox, (m) => m.t === "state" && m.state.seats[0].deckId);
  await waitFor(b.inbox, (m) => m.t === "state" && m.state.seats[1].deckId);

  // Ready and Start
  a.send({ t: "action", a: { kind: "ready", ready: true } });
  b.send({ t: "action", a: { kind: "ready", ready: true } });
  await waitFor(a.inbox, (m) => m.t === "state" && m.state.seats.every((s) => s.ready));

  a.send({ t: "action", a: { kind: "start" } });
  const startedState = await waitFor(a.inbox, (m) => m.t === "state" && m.state.started);
  if (!startedState.state.escrowed || startedState.state.pot !== 400) {
    throw new Error("Wager escrow failed: " + JSON.stringify(startedState.state));
  }
  console.log("Match started with pot:", startedState.state.pot, "escrowed:", startedState.state.escrowed);

  // Bob concedes -> Alice should win the 400 pot minus 3% DAO fee (12 gold)!
  b.send({ t: "action", a: { kind: "concede" } });
  const endedState = await waitFor(a.inbox, (m) => m.t === "state" && m.state.ended);
  if (endedState.state.winnerSeat !== 0 || !endedState.state.payout || endedState.state.payout.amount !== 388 || endedState.state.payout.fee !== 12) {
    throw new Error("Payout state invalid: " + JSON.stringify(endedState.state.payout));
  }
  console.log("Alice won! Payout (after 3% DAO fee):", endedState.state.payout);

  const finalA = await fetch(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${regA.token}` },
  }).then((r) => r.json());
  const finalB = await fetch(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${regB.token}` },
  }).then((r) => r.json());

  // Verify Alice balance updated: was start - 200 (bet) + 388 (payout)
  // NOTE: since the Adventure Systems update, completing daily quests / achieving
  // milestones on a win also rewards bonus gold, so only the wager delta is exact.
  const startA = 1500;
  const startB = 1000;
  const minA = startA - 200 + 388;
  const minB = startB - 200;
  if (!(finalA.user.balance >= minA) || finalA.user.wins !== 1) {
    throw new Error("Alice final balance incorrect: " + JSON.stringify(finalA.user));
  }
  if (!(finalB.user.balance >= minB) || finalB.user.losses !== 1) {
    throw new Error("Bob final balance incorrect: " + JSON.stringify(finalB.user));
  }
  console.log("Balances verified! Alice:", finalA.user.balance, "(Wins: 1, >= " + minA + ") Bob:", finalB.user.balance, "(Losses: 1, >= " + minB + ")");

  // Test DAO Treasury received fee
  const dao = await fetch(`${BASE}/api/dao`).then((r) => r.json());
  if (dao.balance === undefined || !dao.transactions || dao.transactions.length === 0) {
    throw new Error("DAO check failed: " + JSON.stringify(dao));
  }
  console.log("DAO Treasury verified! Balance:", dao.balance, "Fee rate:", dao.feePercent, "%");

  // Test Leaderboard
  const lb = await fetch(`${BASE}/api/leaderboard`).then((r) => r.json());
  const topAlice = lb.find((u) => u.username === regA.username);
  if (!topAlice || topAlice.balance < 1688) throw new Error("Leaderboard check failed: " + JSON.stringify(lb));
  console.log("Leaderboard verified! Alice on leaderboard with " + topAlice.balance + " Gold (>= 1688).");

  a.ws.close();
  b.ws.close();
  console.log("ALL AUTH & WAGER BACKEND TESTS PASSED! 🎉");
})().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
