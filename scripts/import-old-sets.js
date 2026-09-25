#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const readline = require("readline");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "data", "default-cards.jsonl.gz");
const OUT = path.join(ROOT, "data", "old-printings.json");
const SETS_OUT = path.join(ROOT, "data", "old-sets.json");

const SET_GROUPS = [
  {
    id: "oldschool",
    name: "Old School 93/94",
    sets: [
      ["lea", "Alpha"],
      ["leb", "Beta"],
      ["2ed", "Unlimited"],
      ["3ed", "Revised"],
      ["arn", "Arabian Nights"],
      ["atq", "Antiquities"],
      ["leg", "Legends"],
      ["drk", "The Dark"],
      ["fem", "Fallen Empires"],
    ],
  },
  {
    id: "iceage",
    name: "Ice Age era",
    sets: [
      ["ice", "Ice Age"],
      ["all", "Alliances"],
      ["hml", "Homelands"],
      ["csp", "Coldsnap"],
      ["chr", "Chronicles"],
    ],
  },
  {
    id: "core",
    name: "Core sets",
    sets: [
      ["4ed", "Fourth Edition"],
      ["5ed", "Fifth Edition"],
      ["6ed", "Sixth Edition"],
      ["7ed", "Seventh Edition"],
    ],
  },
  {
    id: "mirage",
    name: "Mirage block",
    sets: [
      ["mir", "Mirage"],
      ["vis", "Visions"],
      ["wth", "Weatherlight"],
    ],
  },
  {
    id: "tempest",
    name: "Tempest block",
    sets: [
      ["tmp", "Tempest"],
      ["sth", "Stronghold"],
      ["exo", "Exodus"],
    ],
  },
  {
    id: "urza",
    name: "Urza's block",
    sets: [
      ["usg", "Urza's Saga"],
      ["ulg", "Urza's Legacy"],
      ["uds", "Urza's Destiny"],
    ],
  },
  {
    id: "masques",
    name: "Masques block",
    sets: [
      ["mmq", "Mercadian Masques"],
      ["nem", "Nemesis"],
      ["pcy", "Prophecy"],
    ],
  },
  {
    id: "invasion",
    name: "Invasion block",
    sets: [
      ["inv", "Invasion"],
      ["pls", "Planeshift"],
      ["apc", "Apocalypse"],
    ],
  },
  {
    id: "odyssey",
    name: "Odyssey block",
    sets: [
      ["ody", "Odyssey"],
      ["tor", "Torment"],
      ["jud", "Judgment"],
    ],
  },
  {
    id: "onslaught",
    name: "Onslaught block",
    sets: [
      ["ons", "Onslaught"],
      ["lgn", "Legions"],
      ["scg", "Scourge"],
    ],
  },
  {
    id: "portal",
    name: "Portal & Starter",
    sets: [
      ["por", "Portal"],
      ["p02", "Portal Second Age"],
      ["ptk", "Portal Three Kingdoms"],
      ["s99", "Starter 1999"],
      ["s00", "Starter 2000"],
    ],
  },
  {
    id: "mirrodin",
    name: "Mirrodin block",
    sets: [
      ["mrd", "Mirrodin"],
      ["dst", "Darksteel"],
      ["5dn", "Fifth Dawn"],
    ],
  },
  {
    id: "kamigawa",
    name: "Kamigawa block",
    sets: [
      ["chk", "Champions of Kamigawa"],
      ["bok", "Betrayers of Kamigawa"],
      ["sok", "Saviors of Kamigawa"],
    ],
  },
  {
    id: "ravnica",
    name: "Ravnica block",
    sets: [
      ["rav", "Ravnica: City of Guilds"],
      ["gpt", "Guildpact"],
      ["dis", "Dissension"],
    ],
  },
  {
    id: "timespiral",
    name: "Time Spiral block",
    sets: [
      ["tsp", "Time Spiral"],
      ["tsb", "Timeshifted"],
      ["plc", "Planar Chaos"],
      ["fut", "Future Sight"],
    ],
  },
  {
    id: "lorwyn",
    name: "Lorwyn & Shadowmoor",
    sets: [
      ["lrw", "Lorwyn"],
      ["mor", "Morningtide"],
      ["shm", "Shadowmoor"],
      ["eve", "Eventide"],
    ],
  },
  {
    id: "alara",
    name: "Shards of Alara block",
    sets: [
      ["ala", "Shards of Alara"],
      ["con", "Conflux"],
      ["arb", "Alara Reborn"],
    ],
  },
  {
    id: "zendikar",
    name: "Zendikar block",
    sets: [
      ["zen", "Zendikar"],
      ["wwk", "Worldwake"],
      ["roe", "Rise of the Eldrazi"],
    ],
  },
  {
    id: "scars",
    name: "Scars of Mirrodin",
    sets: [
      ["som", "Scars of Mirrodin"],
      ["mbs", "Mirrodin Besieged"],
      ["nph", "New Phyrexia"],
    ],
  },
  {
    id: "innistrad",
    name: "Innistrad block",
    sets: [
      ["isd", "Innistrad"],
      ["dka", "Dark Ascension"],
      ["avr", "Avacyn Restored"],
    ],
  },
  {
    id: "rtr",
    name: "Return to Ravnica block",
    sets: [
      ["rtr", "Return to Ravnica"],
      ["gtc", "Gatecrash"],
      ["dgm", "Dragon's Maze"],
    ],
  },
  {
    id: "theros",
    name: "Theros block",
    sets: [
      ["ths", "Theros"],
      ["bng", "Born of the Gods"],
      ["jou", "Journey into Nyx"],
    ],
  },
  {
    id: "tarkir",
    name: "Khans of Tarkir block",
    sets: [
      ["ktk", "Khans of Tarkir"],
      ["frf", "Fate Reforged"],
      ["dtk", "Dragons of Tarkir"],
    ],
  },
  {
    id: "modernhorizons",
    name: "Modern Horizons",
    sets: [
      ["mh1", "Modern Horizons"],
      ["mh2", "Modern Horizons 2"],
      ["mh3", "Modern Horizons 3"],
    ],
  },
  {
    id: "commander",
    name: "Commander Sets",
    sets: [
      ["cmd", "Commander 2011"],
      ["c13", "Commander 2013"],
      ["c14", "Commander 2014"],
      ["c15", "Commander 2015"],
      ["c16", "Commander 2016"],
      ["c17", "Commander 2017"],
      ["c18", "Commander 2018"],
      ["c19", "Commander 2019"],
      ["c20", "Commander 2020"],
      ["c21", "Commander 2021"],
      ["cmr", "Commander Legends"],
      ["clb", "Battle for Baldur's Gate"],
      ["cmm", "Commander Masters"],
    ],
  },
  {
    id: "moderncore",
    name: "Modern Core Sets",
    sets: [
      ["8ed", "Eighth Edition"],
      ["9ed", "Ninth Edition"],
      ["10e", "Tenth Edition"],
      ["m10", "Magic 2010"],
      ["m11", "Magic 2011"],
      ["m12", "Magic 2012"],
      ["m13", "Magic 2013"],
      ["m14", "Magic 2014"],
      ["m15", "Magic 2015"],
      ["ori", "Magic Origins"],
      ["m19", "Core Set 2019"],
      ["m20", "Core Set 2020"],
      ["m21", "Core Set 2021"],
    ],
  },
  {
    id: "masters",
    name: "Masters Series",
    sets: [
      ["mma", "Modern Masters"],
      ["mm2", "Modern Masters 2015"],
      ["ema", "Eternal Masters"],
      ["mm3", "Modern Masters 2017"],
      ["ima", "Iconic Masters"],
      ["a25", "Masters 25"],
      ["uma", "Ultimate Masters"],
      ["2xm", "Double Masters"],
      ["2x2", "Double Masters 2022"],
      ["dmr", "Dominaria Remastered"],
    ],
  },
];

const WANT = new Map();
for (const g of SET_GROUPS) {
  for (const [code, name] of g.sets) WANT.set(code, { code, name, group: g.id, groupName: g.name });
}

function slim(card) {
  const type = card.type_line || "";
  const isToken = /\bToken\b/i.test(type) || (card.layout || "").includes("token");
  if (isToken) return null;
  if (card.layout === "art_series" || card.layout === "token") return null;
  const faces = Array.isArray(card.card_faces)
    ? card.card_faces.map((f) => ({
        name: f.name || "",
        mana_cost: f.mana_cost || "",
        type_line: f.type_line || "",
        oracle_text: f.oracle_text || "",
        power: f.power ?? null,
        toughness: f.toughness ?? null,
        loyalty: f.loyalty ?? null,
        image: f.image_uris?.normal || null,
        image_small: f.image_uris?.small || null,
      }))
    : null;
  const image = card.image_uris?.normal || faces?.[0]?.image || null;
  if (!image) return null;
  const legal = card.legalities || {};
  return {
    id: card.id,
    oracle_id: card.oracle_id,
    name: card.name,
    mana_cost: card.mana_cost || faces?.[0]?.mana_cost || "",
    cmc: card.cmc ?? 0,
    type_line: type,
    oracle_text: card.oracle_text || "",
    colors: card.colors || [],
    color_identity: card.color_identity || [],
    keywords: card.keywords || [],
    power: card.power ?? null,
    toughness: card.toughness ?? null,
    loyalty: card.loyalty ?? null,
    layout: card.layout || "",
    rarity: card.rarity || "",
    set: card.set || "",
    set_name: card.set_name || "",
    collector_number: card.collector_number || "",
    token: false,
    produced_mana: card.produced_mana || null,
    legalities: {
      standard: legal.standard || "not_legal",
      pioneer: legal.pioneer || "not_legal",
      modern: legal.modern || "not_legal",
      legacy: legal.legacy || "not_legal",
      vintage: legal.vintage || "not_legal",
      pauper: legal.pauper || "not_legal",
      commander: legal.commander || "not_legal",
      oldschool: legal.oldschool || "not_legal",
      premodern: legal.premodern || "not_legal",
    },
    image,
    image_small: card.image_uris?.small || faces?.[0]?.image_small || null,
    faces: faces && faces.length > 1 ? faces : null,
  };
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error("missing", SRC);
    process.exit(1);
  }
  const input = fs.createReadStream(SRC).pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  const bySet = {};
  for (const code of WANT.keys()) bySet[code] = [];
  let raw = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    raw += 1;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const code = obj.set;
    if (!WANT.has(code)) continue;
    const s = slim(obj);
    if (!s) continue;
    bySet[code].push(s);
  }
  const cards = [];
  const setsMeta = SET_GROUPS.map((g) => ({
    id: g.id,
    name: g.name,
    sets: g.sets.map(([code, name]) => ({
      code,
      name,
      count: (bySet[code] || []).length,
    })),
  }));
  for (const g of SET_GROUPS) {
    for (const [code] of g.sets) {
      const list = bySet[code] || [];
      list.sort((a, b) => a.name.localeCompare(b.name));
      cards.push(...list);
      console.log(`${code}: ${list.length}`);
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(cards));
  fs.writeFileSync(SETS_OUT, JSON.stringify(setsMeta, null, 2));
  console.log(`wrote ${cards.length} old-school printings -> ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
