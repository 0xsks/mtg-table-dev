// Test: Adventure Systems — booster packs & collection, daily quests & streaks,
// achievements, bot difficulty & rewards, limited draft mode.
// Run against the dev server (PORT=8888):
//   node scripts/test-adventure-systems.js
import assert from "node:assert";
import WebSocket from "ws";

const PORT = process.env.PORT || 8888;
const API = `http://127.0.0.1:${PORT}/api`;
const WS_URL = `ws://127.0.0.1:${PORT}/ws`;

const R = (s) => (Math.random().toString(36).slice(2, 8) + s).slice(0, 30);
const UNAME = "tadv" + R("");

let token = null;
let user = null;
let balance = 0;

async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers,
    body: opts.body && typeof opts.body !== "string" ? JSON.stringify(opts.body) : opts.body,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${j.error || res.statusText}`);
  return j;
}

function connectClient(playerId, name, token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const stateListeners = [];
    ws.on("open", () => ws.send(JSON.stringify({ t: "hello", playerId, name, token })));
    ws.on("message", (buf) => {
      const msg = JSON.parse(String(buf));
      if (msg.t === "state" && stateListeners.length) stateListeners.shift()(msg.state);
      if (msg.t === "hello")
        resolve({
          ws,
          send(o) {
            ws.send(JSON.stringify(o));
          },
          waitForState() {
            return new Promise((res) => stateListeners.push(res));
          },
          close() {
            ws.close();
          },
        });
    });
    ws.on("error", reject);
  });
}

async function run() {
  console.log("=== TEST: Adventure Systems ===");

  // 1. register
  console.log("1. Register test planeswalker…");
  const reg = await api("/auth/register", { method: "POST", body: { username: UNAME, password: "test1234", displayName: "Advent Tester" } });
  token = reg.token;
  user = reg.user;
  balance = user.balance;
  assert(balance === 1000, `starter gold should be 1000 (got ${balance})`);
  console.log(`✓ registered ${UNAME} with ${balance} 🪙`);

  // 2. packs catalog
  console.log("2. Fetch booster pack catalog…");
  const cat = await api("/shop/packs");
  assert(cat.packs.length >= 10, `expected >= 10 sets (got ${cat.packs.length})`);
  const fdn = cat.packs.find((p) => p.id === "fdn");
  assert(fdn && fdn.price === 200, "Foundations booster should exist at 200g");
  assert(fdn.counts.common >= 100, `Foundations should have plenty of commons (${fdn.counts.common})`);
  const lea = cat.packs.find((p) => p.id === "lea");
  assert(lea && lea.counts.rare >= 100, `Alpha should draw from old-school printings (rare=${lea ? lea.counts.rare : 0})`);
  console.log(`✓ catalog ready: ${cat.packs.length} sets (e.g. ${fdn.name} @ ${fdn.price}🪙, ${lea.name} @ ${lea.price}🪙)`);

  // 3. daily quests view
  console.log("3. Fetch daily quests…");
  const q0 = await api("/quests");
  assert(q0.quests.length === 4, "should show exactly 4 daily quests");
  assert(q0.daily && q0.daily.nextReward === 100, "first daily reward should be 100");
  assert(q0.daily.claimed === false, "not claimed yet");
  console.log(`✓ quests: ${q0.quests.map((q) => `${q.icon}${q.name}`).join(" | ")} (day ${q0.day})`);

  // 4. limited draft
  console.log("4. Start a Limited draft…");
  const draftSets = await api("/draft/sets");
  assert(draftSets.sets.length >= 4, `draft sets should exist (${draftSets.sets.length})`);
  const ds = await api("/draft/start", { method: "POST", body: { setCode: "fdn" } });
  assert(ds.state && !ds.state.complete, "draft should start incomplete");
  assert(ds.state.pack.length === 14, "first pack should have 14 cards (10C/3U/1R)");
  balance = ds.balance;
  assert(balance === 700, `draft entry should cost 300 (balance ${balance})`);
  console.log(`✓ draft started vs 7 AI drafters, 21 picks to make (balance ${balance} 🪙)`);

  // 5. pick all
  let picks = 0;
  let last = null;
  while (true) {
    const st = await api("/draft/state");
    if (!st.state || st.state.complete) break;
    last = await api("/draft/pick", { method: "POST", body: { index: 0 } });
    picks += 1;
    if (picks > 30) throw new Error("draft loop overran");
  }
  assert(picks === 21, `expected 21 picks (got ${picks})`);
  assert(last.state && last.state.complete, "draft should be complete");
  console.log(`✓ made ${picks} picks (7 × 3 packs)`);

  // 6. build draft deck
  console.log("6. Build draft deck…");
  const deckRes = await api("/draft/deck", { method: "POST" });
  const deck = deckRes.deck;
  assert(deck && deck.draft === true, "deck should be flagged as a draft deck");
  const totalCards = deck.cards.reduce((a, c) => a + (c.count || 1), 0);
  assert(totalCards === 40, `draft deck should be 40 cards (got ${totalCards})`);
  const lands = deck.cards.filter((c) => /Plains|Island|Swamp|Mountain|Forest/.test(c.name));
  assert(lands.length >= 1, "deck should include basic lands");
  console.log(`✓ draft deck "${deck.name}" built (${totalCards} cards, ${lands.reduce((a, l) => a + l.count, 0)} basics)`);

  // 7. daily claim (twice → second must fail)
  console.log("7. Claim daily reward…");
  const claim = await api("/quests/claim", { method: "POST" });
  assert(claim.reward === 100, `first daily reward should be 100 (got ${claim.reward})`);
  assert(claim.streak === 1, "streak should be 1");
  balance = claim.balance;
  let claimedTwice = false;
  try {
    await api("/quests/claim", { method: "POST" });
  } catch (e) {
    claimedTwice = true;
  }
  assert(claimedTwice, "second claim should fail");
  console.log(`✓ daily reward +100 claimed, streak=1, second claim rejected (balance ${balance})`);

  // 8. faucet for pack money
  console.log("8. Claim faucet (test budget)…");
  const f = await api("/auth/faucet", { method: "POST" });
  balance = f.balance;
  console.log(`✓ faucet +500 (balance ${balance})`);

  // 9. open packs
  console.log("9. Open 5 Foundations boosters…");
  let uniqueBefore = 0;
  for (let i = 0; i < 5; i++) {
    const open = await api("/shop/packs/open", { method: "POST", body: { setCode: "fdn" } });
    assert(open.pack.length >= 11, `pack ${i + 1} should have cards (${open.pack.length})`);
    uniqueBefore = open.uniqueCards;
    balance = open.balance;
  }
  assert(uniqueBefore >= 40, `5 packs should yield >= 40 unique (got ${uniqueBefore})`);
  assert(balance > 0, `achievement rewards should have flowed in (balance ${balance})`);
  console.log(`✓ 5 packs opened, unique cards: ${uniqueBefore}, balance ${balance} 🪙`);

  // 10. collection endpoint
  console.log("10. Fetch collection…");
  const coll = await api("/collection");
  assert(coll.total >= 60, `collection total should be >= 60 (got ${coll.total})`);
  assert(coll.unique >= 40, `collection unique should be >= 40 (got ${coll.unique})`);
  console.log(`✓ collection: ${coll.total} cards, ${coll.unique} unique`);

  // 11. achievements
  console.log("11. Fetch achievements…");
  const ach = await api("/achievements");
  assert(ach.total >= 15, `catalog should have >= 15 achievements (${ach.total})`);
  const packRat = ach.list.find((a) => a.id === "pack_rat");
  assert(packRat && packRat.unlocked, "pack_rat should be unlocked after 5 packs");
  const firstWin = ach.list.find((a) => a.id === "first_win");
  assert(firstWin && !firstWin.unlocked, "first_win should not be unlocked yet");
  console.log(`✓ achievements: ${ach.unlockedCount}/${ach.total} unlocked`);

  // 12. bot match at hard difficulty + rewards
  console.log("12. Hard AI match & bounty…");
  const b = await connectClient("tadv-bot-" + R(""), "Advent Tester", token);
  const statePromise = b.waitForState();
  b.send({ t: "create", name: "Hard AI Test", format: "duel", wager: 0, vsBot: true, botDifficulty: "hard" });
  const st0 = await statePromise;
  assert(st0.botDifficulty === "hard", `table should record hard difficulty (${st0.botDifficulty})`);
  const botSeat = st0.seats.findIndex((s) => s.isBot);
  assert(botSeat >= 0, "bot should be seated");
  assert(/Titan/i.test(st0.seats[botSeat].name), `hard bot should be Titan (${st0.seats[botSeat].name})`);

  const decks = await api("/decks");
  const starter = decks.find((d) => d.starter) || decks[0];
  const pickState = b.waitForState();
  b.send({ t: "action", a: { kind: "pickDeck", deckId: starter.id } });
  const started = await pickState;
  assert(started.started === true, "game should start against the bot");

  // player goes first — kill the bot immediately
  const endState = b.waitForState();
  b.send({ t: "action", a: { kind: "life", seat: botSeat, delta: -99 } });
  let final = await endState;
  let guard = 0;
  while (!final.ended && guard++ < 30) {
    final = await b.waitForState();
  }
  assert(final.ended, "match should end");
  assert(final.winnerSeat === 0, `player should win (winnerSeat ${final.winnerSeat})`);
  assert(final.payout && final.payout.botReward === 200, `hard bounty should be 200 (${final.payout ? final.payout.botReward : "none"})`);
  b.close();

  const me = await api("/auth/me");
  assert(me.user.stats.botWins === 1, `botWins should be 1 (${me.user.stats.botWins})`);
  assert(me.user.stats.games === 1, `games should be 1 (${me.user.stats.games})`);
  assert(me.user.stats.draftsPlayed === 0, "draft deck match not played (draftsPlayed should be 0)");
  const gain = me.user.balance - balance;
  assert(gain >= 200 && gain <= 500, `bot bounty + quest rewards should be 200..500 (gain ${gain})`);
  console.log(`✓ hard AI defeated → bounty + quest gold netted ${gain} 🪙 (balance ${me.user.balance})`);

  // 13. achievements after win
  console.log("13. Achievements after first win…");
  const ach2 = await api("/achievements");
  const fw = ach2.list.find((a) => a.id === "first_win");
  assert(fw && fw.unlocked, "first_win should now be unlocked");
  console.log(`✓ ${ach2.unlockedCount}/${ach2.total} achievements unlocked`);

  // 14. quests after events
  console.log("14. Quest progress after events…");
  const q1 = await api("/quests");
  const map = Object.fromEntries(q1.quests.map((q) => [q.id, q]));
  if (map.play_game) assert(map.play_game.done, "play_game should be done");
  if (map.win_game) assert(map.win_game.done, "win_game should be done");
  if (map.win_bot) assert(map.win_bot.done, "win_bot should be done");
  if (map.open_pack) assert(map.open_pack.done, "open_pack should be done");
  console.log(`✓ quests: ${q1.quests.map((q) => `${q.icon}${q.done ? "✅" : `${q.progress}/${q.target}`}`).join(" | ")}`);

  console.log("\nALL ADVENTURE SYSTEMS TESTS PASSED! 🎉");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});