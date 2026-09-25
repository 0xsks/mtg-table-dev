#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const readline = require("readline");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "data", "oracle-cards.jsonl.gz");
const OUT = path.join(ROOT, "data", "cards.json");
const META = path.join(ROOT, "data", "catalog-meta.json");

const SKIP_LAYOUTS = new Set([
  "art_series",
  "emblem",
  "vanguard",
  "scheme",
  "planar",
  "reversible_card",
]);

function slimFace(face) {
  if (!face) return null;
  return {
    name: face.name || "",
    mana_cost: face.mana_cost || "",
    type_line: face.type_line || "",
    oracle_text: face.oracle_text || "",
    power: face.power ?? null,
    toughness: face.toughness ?? null,
    loyalty: face.loyalty ?? null,
    image: face.image_uris?.normal || null,
    image_small: face.image_uris?.small || null,
  };
}

function slim(card) {
  const layout = card.layout || "";
  if (SKIP_LAYOUTS.has(layout)) return null;
  if (card.content_warning) return null;

  const type = card.type_line || "";
  const isToken = /\bToken\b/i.test(type) || layout.includes("token");
  const legal = card.legalities || {};

  const faces = Array.isArray(card.card_faces)
    ? card.card_faces.map(slimFace).filter(Boolean)
    : null;

  const image =
    card.image_uris?.normal ||
    faces?.[0]?.image ||
    null;
  const imageSmall =
    card.image_uris?.small ||
    faces?.[0]?.image_small ||
    null;

  return {
    id: card.id,
    oracle_id: card.oracle_id,
    name: card.name,
    mana_cost: card.mana_cost || faces?.[0]?.mana_cost || "",
    cmc: card.cmc ?? 0,
    type_line: type,
    oracle_text: card.oracle_text || "",
    colors: card.colors || faces?.[0]?.colors || [],
    color_identity: card.color_identity || [],
    keywords: card.keywords || [],
    power: card.power ?? null,
    toughness: card.toughness ?? null,
    loyalty: card.loyalty ?? null,
    layout,
    rarity: card.rarity || "",
    set: card.set || "",
    set_name: card.set_name || "",
    collector_number: card.collector_number || "",
    token: isToken,
    produced_mana: card.produced_mana || null,
    legalities: {
      standard: legal.standard || "not_legal",
      pioneer: legal.pioneer || "not_legal",
      modern: legal.modern || "not_legal",
      legacy: legal.legacy || "not_legal",
      vintage: legal.vintage || "not_legal",
      pauper: legal.pauper || "not_legal",
      commander: legal.commander || "not_legal",
    },
    image,
    image_small: imageSmall,
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

  const cards = [];
  let raw = 0;
  let skipped = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    raw += 1;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      skipped += 1;
      continue;
    }
    const s = slim(obj);
    if (!s || !s.name || !s.image) {
      skipped += 1;
      continue;
    }
    cards.push(s);
  }

  cards.sort((a, b) => a.name.localeCompare(b.name));
  fs.writeFileSync(OUT, JSON.stringify(cards));
  fs.writeFileSync(
    META,
    JSON.stringify(
      {
        source: "scryfall oracle-cards",
        imported_at: new Date().toISOString(),
        raw,
        kept: cards.length,
        skipped,
        bytes: fs.statSync(OUT).size,
      },
      null,
      2
    )
  );
  console.log(
    `imported ${cards.length} cards (${skipped} skipped, ${raw} raw) -> ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
