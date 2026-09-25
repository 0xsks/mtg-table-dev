const { WebSocket } = require("ws");
const BASE = "http://127.0.0.1:8877";

async function run() {
  console.log("=== MULTIVERSE COMPREHENSIVE SUITE ===");

  // 1. Check HTTP asset loading
  console.log("\n1. Verifying Static Assets & Routes...");
  const files = [
    "/",
    "/vendor/p5.min.js",
    "/js/fx.js",
    "/js/profile.js",
    "/js/dao.js",
    "/js/dnd.js",
    "/js/admin.js",
    "/css/app.css"
  ];
  for (const f of files) {
    const res = await fetch(`${BASE}${f}`);
    if (!res.ok) throw new Error(`Asset ${f} returned status ${res.status}`);
    const text = await res.text();
    if (text.length < 10) throw new Error(`Asset ${f} returned suspiciously short content`);
    console.log(`  ✓ ${f} (${text.length} bytes, HTTP ${res.status})`);
  }

  // 2. User registration, profile upload, avatar check
  console.log("\n2. Testing Player Profile, Cute Stats & Avatar Upload...");
  const rand = Math.random().toString(36).slice(2, 8);
  const u = {
    username: `wizard_${rand}`,
    password: "Password123!",
    displayName: "Archmage Lily ✨",
  };
  const regRes = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(u),
  }).then((r) => r.json());
  if (!regRes.ok || !regRes.token) throw new Error("Registration failed: " + JSON.stringify(regRes));
  const token = regRes.token;
  const userId = regRes.user.id;
  console.log(`  ✓ Registered user ${u.username} (${userId})`);

  // Check initial stats
  if (!regRes.user.stats || !Array.isArray(regRes.user.badges)) {
    throw new Error("Missing stats or badges in user object: " + JSON.stringify(regRes.user));
  }
  console.log(`  ✓ Initial stats: Streak: ${regRes.user.stats.streak}, Badges: ${regRes.user.badges.join(", ")}`);

  // Upload custom base64 avatar & update bio
  const fakePngBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const profRes = await fetch(`${BASE}/api/auth/profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      displayName: "Archmage Lily [Fairy Queen]",
      bio: "Master of Sylvan forests and shimmering illusion spells 🌿✨",
      avatarData: fakePngBase64,
    }),
  }).then((r) => r.json());
  if (!profRes.ok || !profRes.user) throw new Error("Profile update failed: " + JSON.stringify(profRes));
  console.log(`  ✓ Updated profile: displayName="${profRes.user.displayName}", avatar="${profRes.user.avatar}"`);

  // Fetch avatar image
  const avatarRes = await fetch(`${BASE}/api/avatars/${userId}`);
  if (!avatarRes.ok) throw new Error("Failed to fetch avatar image: " + avatarRes.status);
  const avatarBuf = await avatarRes.arrayBuffer();
  if (avatarBuf.byteLength === 0) throw new Error("Avatar image returned empty body");
  console.log(`  ✓ Fetched avatar image: ${avatarBuf.byteLength} bytes`);

  // 3. User Custom Decks
  console.log("\n3. Testing Custom Decks linked to Player Profile...");
  const createDeckRes = await fetch(`${BASE}/api/decks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: "Sylvan Blossom Ramp",
      format: "Commander",
      commander: "Omnath, Locus of Mana",
      cards: [
        { name: "Forest", count: 35, board: "main" },
        { name: "Llanowar Elves", count: 4, board: "main" },
        { name: "Birds of Paradise", count: 4, board: "main" },
        { name: "Craterhoof Behemoth", count: 1, board: "main" },
      ],
    }),
  }).then((r) => r.json());
  if (!createDeckRes || !createDeckRes.id) throw new Error("Failed to create deck: " + JSON.stringify(createDeckRes));
  console.log(`  ✓ Created deck "${createDeckRes.name}" (ID: ${createDeckRes.id}) for user ${userId}`);

  // Fetch user's decks
  const userDecks = await fetch(`${BASE}/api/decks?userId=${userId}`).then((r) => r.json());
  if (!Array.isArray(userDecks) || !userDecks.some((d) => d.id === createDeckRes.id)) {
    throw new Error("User deck filtering failed: " + JSON.stringify(userDecks));
  }
  console.log(`  ✓ Verified deck filtering by user: ${userDecks.length} deck(s) found`);

  // Clean up test deck
  await fetch(`${BASE}/api/decks/${createDeckRes.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  // 4. Custom Match Wager & Table
  console.log("\n4. Testing Custom Match Wager Table Creation via WebSocket...");
  const customWager = 350; // Custom wager amount
  const wsClient = await new Promise((resolve, reject) => {
    const ws = new WebSocket("ws://127.0.0.1:8877/ws");
    const inbox = [];
    ws.on("error", reject);
    ws.on("open", () => {
      ws.send(JSON.stringify({ t: "hello", token }));
    });
    ws.on("message", (data) => {
      const msg = JSON.parse(String(data));
      inbox.push(msg);
      if (msg.t === "hello") {
        resolve({ ws, inbox });
      }
    });
  });

  // Create table with custom wager
  wsClient.ws.send(JSON.stringify({
    t: "create",
    name: "High Stakes Forest Duel",
    wager: customWager,
    vsBot: true,
  }));

  // Wait for joined message
  const joinedMsg = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout waiting for table join")), 5000);
    const interval = setInterval(() => {
      const m = wsClient.inbox.find((x) => x.t === "joined");
      if (m) {
        clearTimeout(timeout);
        clearInterval(interval);
        resolve(m);
      }
    }, 30);
  });

  // Fetch table via HTTP GET /api/tables/:code
  const tableCheck = await fetch(`${BASE}/api/tables/${joinedMsg.code}`).then((r) => r.json());
  if (tableCheck.wager !== customWager) {
    throw new Error(`Table wager mismatch: expected ${customWager}, got ${tableCheck.wager}`);
  }
  console.log(`  ✓ Table created with custom wager ${tableCheck.wager} Gold (Code: ${joinedMsg.code})`);
  wsClient.ws.close();

  // 5. DAO Governance & Treasury
  console.log("\n5. Testing DAO Treasury, Proposals & Voting...");
  const daoBefore = await fetch(`${BASE}/api/dao`).then((r) => r.json());
  const initialBalance = daoBefore.balance;
  console.log(`  ✓ DAO balance: ${initialBalance} Gold, Active proposals: ${daoBefore.proposals.length}`);

  // Submit proposal
  const propRes = await fetch(`${BASE}/api/dao/propose`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: "🌸 Enchanted Meadow Audio Pack",
      description: "Commission an indie lo-fi artist to craft 3 fantasy background ambient loops for the Fairy and Princess themes.",
      cost: 1800,
    }),
  }).then((r) => r.json());
  if (!propRes.ok || !propRes.proposal) throw new Error("Proposal creation failed: " + JSON.stringify(propRes));
  const newPropId = propRes.proposal.id;
  console.log(`  ✓ Created DAO proposal "${propRes.proposal.title}" (ID: ${newPropId})`);

  // Vote on an existing proposal (prop-2)
  const voteRes = await fetch(`${BASE}/api/dao/vote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      proposalId: "prop-2",
      vote: "for",
    }),
  }).then((r) => r.json());
  if (!voteRes.ok) throw new Error("Voting failed: " + JSON.stringify(voteRes));
  console.log(`  ✓ Voted "for" proposal prop-2: ${voteRes.message}`);

  // 6. Admin Panel API
  console.log("\n6. Testing Admin Panel API & Passkey Access...");
  const adminKey = "arcane-dao-2026";
  const overviewRes = await fetch(`${BASE}/api/admin/overview`, {
    headers: { "x-admin-key": adminKey },
  }).then((r) => r.json());
  if (!overviewRes.ok || !overviewRes.stats) throw new Error("Admin overview failed: " + JSON.stringify(overviewRes));
  console.log(`  ✓ Admin overview: Users: ${overviewRes.stats.totalUsers}, Gold: ${overviewRes.stats.totalGold}, DAO: ${overviewRes.stats.daoBalance}`);

  // Grant gold via admin
  const grantRes = await fetch(`${BASE}/api/admin/user/gold`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": adminKey,
    },
    body: JSON.stringify({
      targetUserId: userId,
      amount: 500,
      reason: "Tournament MVP grant",
    }),
  }).then((r) => r.json());
  if (!grantRes.ok || grantRes.user.balance !== 1500) {
    throw new Error("Admin gold grant failed: " + JSON.stringify(grantRes));
  }
  console.log(`  ✓ Admin granted 500 Gold to user ${userId}. New balance: ${grantRes.user.balance}`);

  // Adjust DAO fee
  const feeRes = await fetch(`${BASE}/api/admin/dao/fee`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": adminKey,
    },
    body: JSON.stringify({ feePercent: 3 }),
  }).then((r) => r.json());
  if (!feeRes.ok || feeRes.feePercent !== 3) throw new Error("Admin fee adjust failed: " + JSON.stringify(feeRes));
  console.log(`  ✓ Admin confirmed DAO fee rate at ${feeRes.feePercent}%`);

  console.log("\n✨ ALL TESTS COMPLETED SUCCESSFULLY! ALL REQUIREMENTS VERIFIED! ✨\n");
}

run().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
