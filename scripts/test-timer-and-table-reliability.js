import WebSocket from "ws";
import assert from "node:assert";
import fs from "node:fs";

const PORT = process.env.PORT || 8888;
const WS_URL = `ws://127.0.0.1:${PORT}/ws`;
const API_URL = `http://127.0.0.1:${PORT}/api`;

function connectClient(playerId, name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const messages = [];
    const stateListeners = [];

    ws.on("open", () => {
      ws.send(JSON.stringify({ t: "hello", playerId, name }));
    });

    ws.on("message", (buf) => {
      const msg = JSON.parse(String(buf));
      messages.push(msg);
      if (msg.t === "state" && stateListeners.length) {
        const cb = stateListeners.shift();
        cb(msg.state);
      }
      if (msg.t === "hello") {
        resolve({
          ws,
          messages,
          send(obj) {
            ws.send(JSON.stringify(obj));
          },
          waitForState() {
            return new Promise((res) => {
              stateListeners.push(res);
            });
          },
          close() {
            ws.close();
          },
        });
      }
    });

    ws.on("error", reject);
  });
}

async function run() {
  console.log("--- TEST: Timer and Table Reliability ---");

  // 1. WebSocket Ping / Pong Keepalive Test
  console.log("1. Testing WebSocket Ping / Pong keepalive...");
  const p1 = await connectClient("test-p1-timer", "Alice");
  let gotPong = false;
  p1.ws.on("message", (buf) => {
    const msg = JSON.parse(String(buf));
    if (msg.t === "pong") gotPong = true;
  });
  p1.send({ t: "ping", time: Date.now() });
  await new Promise((r) => setTimeout(r, 200));
  assert.strictEqual(gotPong, true, "Server should respond with pong on keepalive ping");
  console.log("✓ Ping / Pong keepalive verified");

  // 2. Table Creation with Untimed Default (timerEnabled: false)
  console.log("2. Testing table creation (untimed by default)...");
  const statePromise1 = p1.waitForState();
  p1.send({
    t: "create",
    name: "Reliability Match",
    format: "duel",
    wager: 0,
    timerEnabled: false,
  });
  const state1 = await statePromise1;
  assert.strictEqual(state1.timerEnabled, false, "Table should be untimed by default");
  const code = state1.code;
  console.log(`✓ Table ${code} created with timerEnabled = false`);

  // 3. Toggling Timer on/off via setTimer action
  console.log("3. Testing setTimer toggle action...");
  let statePromise2 = p1.waitForState();
  p1.send({
    t: "action",
    a: { kind: "setTimer", enabled: true },
  });
  let state2 = await statePromise2;
  assert.strictEqual(state2.timerEnabled, true, "Timer should be enabled after setTimer action");

  statePromise2 = p1.waitForState();
  p1.send({
    t: "action",
    a: { kind: "setTimer", enabled: false },
  });
  state2 = await statePromise2;
  assert.strictEqual(state2.timerEnabled, false, "Timer should be disabled after setTimer action");
  console.log("✓ Timer toggling works via setTimer action");

  // 4. Player 2 Joins and Starts Game
  console.log("4. Player 2 joins and picks starter decks...");
  const p2 = await connectClient("test-p2-timer", "Bob");
  const p2StatePromise = p2.waitForState();
  p2.send({ t: "join", code });
  const p2State = await p2StatePromise;
  assert.strictEqual(p2State.seats[1].name, "Bob", "Player 2 should be in seat 1");

  // Pick starter decks
  const decks = await (await fetch(`${API_URL}/decks`)).json();
  const starter1 = decks.find((d) => d.starter) || decks[0];
  const starter2 = decks.find((d) => d.starter && d.id !== starter1.id) || decks[1] || decks[0];

  const p1Pick = p1.waitForState();
  p1.send({ t: "action", a: { kind: "pickDeck", deckId: starter1.id } });
  await p1Pick;

  const p2Pick = p2.waitForState();
  p2.send({ t: "action", a: { kind: "pickDeck", deckId: starter2.id } });
  await p2Pick;

  const startPromise = p1.waitForState();
  p1.send({ t: "action", a: { kind: "start" } });
  const startedState = await startPromise;
  assert.strictEqual(startedState.started, true, "Game should be started");
  assert.strictEqual(startedState.seats[0].zones.hand.length, 7, "P1 should have 7 cards in hand");
  assert.strictEqual(startedState.seats[1].zones.hand.count, 7, "P2 should have 7 cards in hand (hidden count)");
  console.log("✓ Game started successfully");

  // 5. Table Persistence Check (data/tables.json)
  console.log("5. Testing table persistence to data/tables.json...");
  assert.strictEqual(fs.existsSync("data/tables.json"), true, "data/tables.json should exist");
  const savedTables = JSON.parse(fs.readFileSync("data/tables.json", "utf8"));
  const foundInFile = savedTables.find((t) => t.code === code);
  assert(foundInFile, "Started table must be saved in data/tables.json");
  assert.strictEqual(foundInFile.started, true, "Saved table must have started = true");
  console.log("✓ Table is persistently stored on disk");

  // 6. Protection Against DELETE on Started Tables
  console.log("6. Testing protection against deleting started table...");
  const delRes = await fetch(`${API_URL}/tables/${code}`, { method: "DELETE" });
  assert.strictEqual(delRes.status, 400, "Should reject DELETE for an active started match");
  const delBody = await delRes.json();
  assert(delBody.error.includes("active table"), "Error message should mention active table");
  console.log("✓ Started table is protected from accidental/malicious deletion");

  // 7. Player Disconnect & Reconnect Reliability (Never kicked!)
  console.log("7. Testing disconnect and reconnection into started table...");
  // P2 disconnects
  p2.close();
  await new Promise((r) => setTimeout(r, 200));

  // P2 reconnects with new socket / same playerId
  const p2Reconnect = await connectClient("test-p2-timer", "Bob");
  const p2ReconnectStatePromise = p2Reconnect.waitForState();
  p2Reconnect.send({ t: "join", code });
  const restoredState = await p2ReconnectStatePromise;

  assert.strictEqual(restoredState.started, true, "Table is still started");
  assert.strictEqual(restoredState.you, 1, "Player 2 restored into seat 1");
  assert.strictEqual(restoredState.seats[1].name, "Bob", "Player 2 name preserved");
  assert.strictEqual(restoredState.seats[1].zones.hand.length, 7, "Hand cards preserved");
  console.log("✓ Reconnection seamlessly restored player into their active match");

  // 8. Reconnection with a brand new playerId taking over disconnected seat
  console.log("8. Testing seat recovery when player ID changes...");
  p2Reconnect.close();
  await new Promise((r) => setTimeout(r, 200));

  const p2NewId = await connectClient("test-p2-new-session", "Bob");
  const p2NewIdStatePromise = p2NewId.waitForState();
  p2NewId.send({ t: "join", code, takeOver: true });
  const restoredState2 = await p2NewIdStatePromise;

  assert.strictEqual(restoredState2.started, true, "Table is still running");
  assert.strictEqual(restoredState2.you, 1, "Player restored into seat 1");
  console.log("✓ Seat takeOver on started match successfully restored player");

  p1.close();
  p2NewId.close();
  console.log("\nALL RELIABILITY AND TIMER TESTS PASSED SUCCESSFULLY! 🎉");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
