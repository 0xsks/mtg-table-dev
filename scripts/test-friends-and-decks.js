#!/usr/bin/env node
"use strict";

const WebSocket = require("ws");

const BASE = "http://127.0.0.1:8877";

async function req(url, opts = {}) {
  const res = await fetch(BASE + url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${opts.method || "GET"} ${url} failed: ${res.status} ${errText}`);
  }
  return res.json();
}

function uid(n = 6) {
  return Math.random().toString(36).slice(2, 2 + n);
}

async function run() {
  console.log("=== 1. Testing Deck Builder Save & Account Association ===");

  // Register user for deck testing
  const u1Name = `deckwiz_${uid()}`;
  const reg1 = await req("/api/auth/register", {
    method: "POST",
    body: { username: u1Name, password: "password123", displayName: "Deck Wizard" },
  });
  const token1 = reg1.token;
  const user1 = reg1.user;
  console.log("Registered test user:", user1.username, user1.id);

  // 1a. Create new deck authenticated
  const newDeck = await req("/api/decks", {
    method: "POST",
    headers: { Authorization: `Bearer ${token1}` },
    body: {
      name: "Thunder Dragon Aggro",
      format: "duel",
      cards: [{ id: "069cfaa5-bba4-4503-b54e-b98fa9f0a0fc", count: 4, name: "Healer's Hawk" }],
    },
  });
  console.log("Created deck:", newDeck.id, "userId:", newDeck.userId, "starter:", newDeck.starter);
  if (newDeck.userId !== user1.id) throw new Error("Deck userId was not associated with user!");
  if (newDeck.starter !== false) throw new Error("Deck should not be starter!");

  // 1b. Verify deck appears in user's deck list
  const userDecks = await req(`/api/decks?userId=${encodeURIComponent(user1.id)}`);
  if (!userDecks.some((d) => d.id === newDeck.id)) throw new Error("Saved deck not in user's deck list!");
  console.log("Verified deck appears in user deck list. Count:", userDecks.length);

  // 1c. Test starter deck forking on PUT
  // Read an existing starter deck (or any deck with starter: true)
  const allDecks = await req("/api/decks");
  const starter = allDecks.find((d) => d.starter);
  if (starter) {
    console.log("Found starter deck to fork:", starter.id, starter.name);
    const starterDetail = await req(`/api/decks/${starter.id}`);
    const forked = await req(`/api/decks/${starter.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token1}` },
      body: {
        ...starterDetail,
        name: "My Forked Starter Deck",
        cards: [...starterDetail.cards, { id: "069cfaa5-bba4-4503-b54e-b98fa9f0a0fc", count: 2, name: "Bonus Card" }],
      },
    });
    console.log("Forked deck result:", forked.id, "forked:", forked.forked, "starter:", forked.starter, "userId:", forked.userId);
    if (forked.id === starter.id) throw new Error("Starter deck should have been forked to a new ID!");
    if (forked.starter !== false) throw new Error("Forked deck must not be starter!");
    if (forked.userId !== user1.id) throw new Error("Forked deck must belong to current user!");

    // Clean up forked deck
    await req(`/api/decks/${forked.id}`, { method: "DELETE" });
  }

  // Clean up created deck
  await req(`/api/decks/${newDeck.id}`, { method: "DELETE" });
  console.log("Deck save tests passed!");

  console.log("\n=== 2. Testing Online Presence & WebSocket ===");

  // Connect a WebSocket client
  const p1Id = `p_test_${uid()}`;
  const ws = new WebSocket("ws://127.0.0.1:8877/ws");
  await new Promise((resolve, reject) => {
    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          t: "hello",
          playerId: p1Id,
          name: "Online Wizard",
          token: token1,
          location: "builder",
          statusText: "Crafting Spells",
        })
      );
      setTimeout(resolve, 300);
    });
    ws.on("error", reject);
  });

  const presenceList = await req("/api/presence");
  console.log("Presence count:", presenceList.length);
  const foundMe = presenceList.find((p) => p.userId === user1.id || p.playerId === p1Id);
  if (!foundMe) throw new Error("Connected player not found in presence list!");
  console.log("Found player in presence:", foundMe.displayName, foundMe.status);

  // Update presence via REST
  await req("/api/presence/update", {
    method: "POST",
    headers: { Authorization: `Bearer ${token1}` },
    body: { location: "guilds", statusText: "Browsing Guilds" },
  });

  const updatedPresence = await req("/api/presence");
  const foundUpdated = updatedPresence.find((p) => p.userId === user1.id);
  console.log("Updated presence status:", foundUpdated?.status);

  console.log("\n=== 3. Testing Friends System ===");

  // Register a second user
  const u2Name = `friendwiz_${uid()}`;
  const reg2 = await req("/api/auth/register", {
    method: "POST",
    body: { username: u2Name, password: "password123", displayName: "Friend Wizard" },
  });
  const token2 = reg2.token;
  const user2 = reg2.user;

  // 3a. User1 sends friend request to User2 by username
  const sendReq = await req("/api/friends/request", {
    method: "POST",
    headers: { Authorization: `Bearer ${token1}` },
    body: { toUsername: user2.username },
  });
  console.log("Sent friend request:", sendReq.request.id, "to:", sendReq.request.toUsername);
  if (!sendReq.ok || !sendReq.request) throw new Error("Friend request failed!");

  // 3b. User2 checks incoming requests
  const user2Friends = await req("/api/friends", {
    headers: { Authorization: `Bearer ${token2}` },
  });
  console.log("User2 incoming requests count:", user2Friends.incoming.length);
  const foundReq = user2Friends.incoming.find((r) => r.id === sendReq.request.id);
  if (!foundReq) throw new Error("Incoming request not visible to User2!");

  // 3c. User2 accepts the request
  const acceptRes = await req("/api/friends/respond", {
    method: "POST",
    headers: { Authorization: `Bearer ${token2}` },
    body: { requestId: foundReq.id, action: "accept" },
  });
  console.log("User2 accepted request:", acceptRes.ok);
  if (!acceptRes.accepted) throw new Error("Request accept failed!");

  // 3d. Verify both are friends now
  const friendsList1 = await req("/api/friends", {
    headers: { Authorization: `Bearer ${token1}` },
  });
  const friendsList2 = await req("/api/friends", {
    headers: { Authorization: `Bearer ${token2}` },
  });
  console.log("User1 friends count:", friendsList1.friends.length);
  console.log("User2 friends count:", friendsList2.friends.length);
  if (!friendsList1.friends.some((f) => f.userId === user2.id)) {
    throw new Error("User2 not in User1 friends list!");
  }
  if (!friendsList2.friends.some((f) => f.userId === user1.id)) {
    throw new Error("User1 not in User2 friends list!");
  }

  // 3e. User1 challenges User2 to a match
  const chRes = await req("/api/friends/challenge", {
    method: "POST",
    headers: { Authorization: `Bearer ${token1}` },
    body: { toId: user2.id, wager: 250, format: "commander" },
  });
  console.log("Duel challenge created table:", chRes.tableCode);
  if (!chRes.ok || !chRes.tableCode) throw new Error("Challenge failed!");

  // 3f. Remove friend
  const friendshipId = friendsList1.friends[0].friendshipId;
  await req(`/api/friends/${friendshipId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token1}` },
  });
  const afterRm = await req("/api/friends", {
    headers: { Authorization: `Bearer ${token1}` },
  });
  if (afterRm.friends.some((f) => f.friendshipId === friendshipId)) {
    throw new Error("Friendship not removed!");
  }
  console.log("Friend removed successfully.");

  // Close WS
  ws.close();

  console.log("\n✅ ALL TESTS PASSED SUCCESSFULLY! ✨");
}

run().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
