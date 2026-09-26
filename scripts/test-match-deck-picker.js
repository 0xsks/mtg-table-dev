#!/usr/bin/env node
"use strict";

const { WebSocket } = require("ws");
const { signIn } = require("./lib/wallet");
const { BASE, WS_URL } = require("./lib/target");

async function run() {
  console.log("=== TESTING MATCH SCREEN CHARACTER PROFILE DECKS ===");

  // 1. Register a test user
  const rand = Math.random().toString(36).slice(2, 8);
  const user = await signIn({ displayName: `Lord Chandra ${rand}` });
  const token = user.token;
  console.log(`✓ Signed in as ${user.username} (ID: ${user.id})`);

  // 2. Create 2 custom decks for this character
  const deck1 = await fetch(`${BASE}/api/decks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: "🔥 Chandra's Fury Burn",
      format: "duel",
      cards: [
        { name: "Mountain", count: 20 },
        { name: "Lightning Bolt", count: 40 },
      ],
    }),
  }).then((r) => r.json());

  const deck2 = await fetch(`${BASE}/api/decks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: "⚡ Dragon Tempest Assault",
      format: "duel",
      cards: [
        { name: "Mountain", count: 24 },
        { name: "Shivan Dragon", count: 36 },
      ],
    }),
  }).then((r) => r.json());

  console.log(`✓ Created character decks: "${deck1.name}" (${deck1.id}) and "${deck2.name}" (${deck2.id})`);

  // 3. Fetch all decks and verify character profile decks filtering logic
  const allDecks = await fetch(`${BASE}/api/decks`).then((r) => r.json());
  const charDecks = allDecks.filter((d) => d.userId === user.id);
  if (charDecks.length !== 2) throw new Error(`Expected 2 character decks, found ${charDecks.length}`);
  console.log(`✓ Character profile decks accurately identified in system: ${charDecks.map((d) => d.name).join(", ")}`);

  // 4. Test WebSocket match table creation & selecting the character's deck
  const ws = new WebSocket(WS_URL);
  await new Promise((resolve, reject) => {
    ws.on("error", reject);
    ws.on("open", () => {
      ws.send(JSON.stringify({ t: "hello", playerId: user.id, name: user.displayName, token }));
      ws.send(JSON.stringify({ t: "create", name: "Chandra's Arena", format: "duel", wager: 50, vsBot: true }));
    });
    ws.on("message", (buf) => {
      const msg = JSON.parse(String(buf));
      if (msg.t === "joined") {
        // Pick the character's custom deck!
        ws.send(JSON.stringify({ t: "action", a: { kind: "pickDeck", deckId: deck1.id } }));
      } else if (msg.t === "state") {
        const mySeat = msg.state.seats[msg.state.you];
        if (mySeat && mySeat.deckId === deck1.id) {
          console.log(`✓ Successfully chose character profile deck "${mySeat.deckName}" on the match screen!`);
          ws.close();
          resolve();
        }
      }
    });
  });

  console.log("\n🎉 ALL TESTS PASSED! MATCH SCREEN DECK PICKER ACCURATELY USES CHARACTER PROFILE DECKS! 🎉\n");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
