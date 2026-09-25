const { RpgMap, MapData } = require('@rpgjs/server');

// ── Homeroom map (the overworld lobby) ──────────────────────────────────────
@MapData({
  id: 'homeroom',
  file: require('./maps/homeroom.tmx'),  // Tiled JSON/TMX — we'll use a JSON map
  name: 'The Homeroom',
  events: [],  // populated dynamically
})
class HomeroomMap extends RpgMap {
  onLoad() {
    // Spawn the sparring dummy in the center of the south courtyard
    this.createDynamicEvent({
      x: 400,
      y: 480,
      name: 'sparring-dummy',
    });
  }
}

// ── Arena map ────────────────────────────────────────────────────────────────
@MapData({
  id: 'arena',
  file: require('./maps/arena.tmx'),
  name: 'The Grand Arena',
  events: [],
})
class ArenaMap extends RpgMap {}

module.exports = { HomeroomMap, ArenaMap };
