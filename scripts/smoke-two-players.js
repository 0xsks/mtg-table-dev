#!/usr/bin/env node
"use strict";
const { WebSocket } = require("ws");

const URL = process.env.URL || "ws://127.0.0.1:8877/ws";

function client(playerId, name) {
  const ws = new WebSocket(URL);
  const inbox = [];
  let send;
  const ready = new Promise((resolve, reject) => {
    ws.on("error", reject);
    ws.on("open", () => {
      send = (obj) => ws.send(JSON.stringify(obj));
      send({ t: "hello", playerId, name });
    });
    ws.on("message", (buf) => {
      const msg = JSON.parse(String(buf));
      inbox.push(msg);
      if (msg.t === "hello") resolve({ ws, send, inbox });
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
  const decks = await fetch("http://127.0.0.1:8877/api/decks").then((r) => r.json());
  const playable = decks.filter((d) => d.counts && d.counts.main >= 20);
  if (playable.length < 2) throw new Error("need starter decks");
  const a = client("smoke-a", "Alice");
  const b = client("smoke-b", "Bob");
  await Promise.all([a.ready, b.ready]);
  a.send({ t: "create", name: "Smoke", format: "duel" });
  const joined = await waitFor(a.inbox, (m) => m.t === "joined");
  const code = joined.code;
  b.send({ t: "join", code });
  await waitFor(b.inbox, (m) => m.t === "joined");
  a.send({ t: "action", a: { kind: "pickDeck", deckId: playable[0].id } });
  b.send({ t: "action", a: { kind: "pickDeck", deckId: playable[1].id } });
  await waitFor(a.inbox, (m) => m.t === "state" && m.state.seats[0].deckId);
  await waitFor(b.inbox, (m) => m.t === "state" && m.state.seats[1].deckId);
  a.send({ t: "action", a: { kind: "ready", ready: true } });
  b.send({ t: "action", a: { kind: "ready", ready: true } });
  await waitFor(a.inbox, (m) => m.t === "state" && m.state.seats.every((s) => s.ready));
  a.send({ t: "action", a: { kind: "start" } });
  const err = a.inbox.find((m) => m.t === "error");
  if (err) throw new Error("alice error: " + err.error);
  const state = await waitFor(a.inbox, (m) => m.t === "state" && m.state.started);
  const sa = state.state.seats[0];
  const opp = state.state.seats[1];
  if (!sa.zones.hand.length) throw new Error("alice has no hand");
  if (!opp.zones.hand.hidden) throw new Error("bob hand leaked to alice");
  const land = sa.zones.hand.find((c) => /\bLand\b/i.test(c.type_line));
  const card = land || sa.zones.hand[0];
  a.send({ t: "action", a: { kind: "move", iid: card.iid, toZone: "battlefield", x: 0.4, y: 0.5 } });
  const moved = await waitFor(
    a.inbox,
    (m) =>
      m.t === "state" &&
      (m.state.seats[0].zones.battlefield.some((c) => c.iid === card.iid) ||
        (m.state.stack || []).some((c) => c.iid === card.iid))
  );
  if (!moved) throw new Error("move failed");
  a.ws.close();
  b.ws.close();
  console.log("smoke ok", code, "hand", sa.zones.hand.length, "opp hidden", opp.zones.hand.count);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
