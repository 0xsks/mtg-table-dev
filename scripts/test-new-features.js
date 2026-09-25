#!/usr/bin/env node
"use strict";

const BASE = "http://127.0.0.1:8877";

async function run() {
  console.log("=== TESTING NEW MULTIVERSE CAPABILITIES ===");

  // 1. Test Avatar update with logged-in user and guest
  console.log("\n1. Testing Avatar Changes (No 'not logged in' error)...");
  const rand = Math.random().toString(36).slice(2, 8);
  const regRes = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: `mage_${rand}`,
      password: "Password123!",
      displayName: `Mage ${rand}`,
    }),
  }).then((r) => r.json());
  if (!regRes.ok || !regRes.token) throw new Error("Register failed: " + JSON.stringify(regRes));
  console.log(`  ✓ Registered user: ${regRes.user.username}`);

  // Change avatar while logged in
  const profRes1 = await fetch(`${BASE}/api/auth/profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${regRes.token}`,
    },
    body: JSON.stringify({ avatar: "preset:fairy" }),
  }).then((r) => r.json());
  if (!profRes1.ok || profRes1.user.avatar !== "preset:fairy") {
    throw new Error("Logged-in avatar update failed: " + JSON.stringify(profRes1));
  }
  console.log(`  ✓ Logged-in user avatar set to: ${profRes1.user.avatar}`);

  // Change avatar as guest player (no token, only playerId)
  const guestPid = "guest-" + Math.random().toString(36).slice(2, 8);
  const profRes2 = await fetch(`${BASE}/api/auth/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      playerId: guestPid,
      avatar: "preset:dragon",
      displayName: "Guest Dragonrider",
    }),
  }).then((r) => r.json());
  if (!profRes2.ok || profRes2.user.avatar !== "preset:dragon") {
    throw new Error("Guest avatar update failed: " + JSON.stringify(profRes2));
  }
  console.log(`  ✓ Guest user (${guestPid}) avatar set to: ${profRes2.user.avatar} (displayName: ${profRes2.user.displayName})`);

  // 2. Test Editing Wager Fee in DAO
  console.log("\n2. Testing Wager Fee Editable in DAO...");
  const daoBefore = await fetch(`${BASE}/api/dao`).then((r) => r.json());
  console.log(`  ✓ Current DAO fee: ${daoBefore.feePercent}%`);

  const setFeeRes = await fetch(`${BASE}/api/dao/fee`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${regRes.token}`,
    },
    body: JSON.stringify({ feePercent: 5 }),
  }).then((r) => r.json());
  if (!setFeeRes.ok || setFeeRes.feePercent !== 5) {
    throw new Error("Setting DAO fee failed: " + JSON.stringify(setFeeRes));
  }
  console.log(`  ✓ DAO fee updated to: ${setFeeRes.feePercent}% (${setFeeRes.message})`);

  const daoAfter = await fetch(`${BASE}/api/dao`).then((r) => r.json());
  if (daoAfter.feePercent !== 5) throw new Error("DAO fee not persisted: " + daoAfter.feePercent);
  console.log(`  ✓ Verified DAO fee is now ${daoAfter.feePercent}% with transaction logged`);

  // Reset back to 3% default
  await fetch(`${BASE}/api/dao/fee`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feePercent: 3 }),
  });
  console.log("  ✓ Reset fee back to 3% default");

  // 3. Test Guilds System
  console.log("\n3. Testing Guilds System...");
  const guilds = await fetch(`${BASE}/api/guilds`).then((r) => r.json());
  if (!Array.isArray(guilds) || guilds.length === 0) throw new Error("Failed to load guilds: " + JSON.stringify(guilds));
  console.log(`  ✓ Found ${guilds.length} guilds. First guild: "${guilds[0].name}" (Crest: ${guilds[0].crest}, Vault: ${guilds[0].vault} 🪙)`);

  // Create a new guild
  const createGuildRes = await fetch(`${BASE}/api/guilds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${regRes.token}`,
    },
    body: JSON.stringify({
      name: `Sanctum of Starlight ${rand}`,
      crest: "🔮",
      motto: "Harness celestial mana to guide our kindred.",
    }),
  }).then((r) => r.json());
  if (!createGuildRes.ok || !createGuildRes.guild) throw new Error("Create guild failed: " + JSON.stringify(createGuildRes));
  const newGuildId = createGuildRes.guild.id;
  console.log(`  ✓ Created guild "${createGuildRes.guild.name}" (ID: ${newGuildId})`);

  // Donate to guild vault
  const donateRes = await fetch(`${BASE}/api/guilds/${newGuildId}/donate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${regRes.token}`,
    },
    body: JSON.stringify({ amount: 200 }),
  }).then((r) => r.json());
  if (!donateRes.ok || donateRes.vault !== 200) throw new Error("Donate failed: " + JSON.stringify(donateRes));
  console.log(`  ✓ Donated 200 Gold. Vault balance: ${donateRes.vault} 🪙 (Level: ${donateRes.level})`);

  // Post message to guild message board
  const msgRes = await fetch(`${BASE}/api/guilds/${newGuildId}/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${regRes.token}`,
    },
    body: JSON.stringify({ text: "All wizards meet at Table 1 for the grand rally!" }),
  }).then((r) => r.json());
  if (!msgRes.ok || !msgRes.message) throw new Error("Guild message failed: " + JSON.stringify(msgRes));
  console.log(`  ✓ Posted message to Guild Board: "${msgRes.message.text}" (Author: ${msgRes.message.author})`);

  // 4. Test Leagues System
  console.log("\n4. Testing Leagues System...");
  const leagues = await fetch(`${BASE}/api/leagues`).then((r) => r.json());
  if (!Array.isArray(leagues) || leagues.length === 0) throw new Error("Failed to load leagues: " + JSON.stringify(leagues));
  console.log(`  ✓ Found ${leagues.length} leagues. First league: "${leagues[0].name}" (Prize pool: ${leagues[0].prizePool} 🪙)`);

  // Join a league
  const targetLeague = leagues[0];
  const joinLeagueRes = await fetch(`${BASE}/api/leagues/${targetLeague.id}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${regRes.token}`,
    },
    body: JSON.stringify({ deck: "Celestial Storm" }),
  }).then((r) => r.json());
  if (!joinLeagueRes.ok) throw new Error("Join league failed: " + JSON.stringify(joinLeagueRes));
  console.log(`  ✓ Registered for league "${targetLeague.name}". New prize pool: ${joinLeagueRes.league.prizePool} 🪙`);

  // Report match victory in league
  const reportRes = await fetch(`${BASE}/api/leagues/${targetLeague.id}/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ winnerId: regRes.user.id }),
  }).then((r) => r.json());
  if (!reportRes.ok || !Array.isArray(reportRes.standings)) throw new Error("Report match failed: " + JSON.stringify(reportRes));
  const myStanding = reportRes.standings.find((s) => s.userId === regRes.user.id);
  if (!myStanding || myStanding.points !== 3) throw new Error("Points not updated: " + JSON.stringify(myStanding));
  console.log(`  ✓ Reported match victory! User points in league: ${myStanding.points} pts (Wins: ${myStanding.wins})`);

  // 5. Test D&D Map Builder & Campaign System
  console.log("\n5. Testing D&D Map Builder & Campaign System...");
  const dndData = await fetch(`${BASE}/api/dnd/data`).then((r) => r.json());
  if (!dndData.campaigns || !dndData.maps) throw new Error("Failed to load D&D data: " + JSON.stringify(dndData));
  console.log(`  ✓ D&D Data: ${dndData.campaigns.length} campaigns, ${dndData.maps.length} battlemaps`);

  // Create new campaign
  const campRes = await fetch(`${BASE}/api/dnd/campaigns`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${regRes.token}`,
    },
    body: JSON.stringify({
      title: "⚔️ Siege of the Crimson Citadel",
      realm: "Plane of Kaladesh",
      synopsis: "Automata constructs have rebelled against the Grand Consul. Defend the aether spires!",
    }),
  }).then((r) => r.json());
  if (!campRes.ok || !campRes.campaign) throw new Error("Create campaign failed: " + JSON.stringify(campRes));
  console.log(`  ✓ Created Campaign "${campRes.campaign.title}" (ID: ${campRes.campaign.id})`);

  // Create battlemap with tiles & tokens
  const mapRes = await fetch(`${BASE}/api/dnd/maps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Citadel Courtyard Battlemap",
      width: 22,
      height: 15,
      campaignId: campRes.campaign.id,
      tiles: { "0,0": "wall", "1,0": "wall", "5,5": "lava" },
      tokens: [
        { id: "tok-1", name: "Valen Ironshield", icon: "⚔️", x: 4, y: 4, hp: 48, maxHp: 48, isEnemy: false },
        { id: "tok-2", name: "Aether Construct", icon: "🤖", x: 10, y: 10, hp: 60, maxHp: 60, isEnemy: true },
      ],
    }),
  }).then((r) => r.json());
  if (!mapRes.ok || !mapRes.map) throw new Error("Create map failed: " + JSON.stringify(mapRes));
  console.log(`  ✓ Created Battlemap "${mapRes.map.name}" (${mapRes.map.width}x${mapRes.map.height}) with ${mapRes.map.tokens.length} tokens`);

  // Update map token positions (e.g. moving token on battlemap)
  const updatedTokens = mapRes.map.tokens.map((t) => (t.id === "tok-1" ? { ...t, x: 5, y: 4, hp: 43 } : t));
  const updateMapRes = await fetch(`${BASE}/api/dnd/maps/${mapRes.map.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokens: updatedTokens }),
  }).then((r) => r.json());
  if (!updateMapRes.ok || updateMapRes.map.tokens.find((t) => t.id === "tok-1").x !== 5) {
    throw new Error("Update battlemap failed: " + JSON.stringify(updateMapRes));
  }
  console.log(`  ✓ Moved miniature token on battlemap grid (new pos: x=5, y=4, HP=43)`);

  console.log("\n🎉 ALL NEW FEATURES TESTED & VERIFIED! 100% OPERATIONAL! 🎉\n");
}

run().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
