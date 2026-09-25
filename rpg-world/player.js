const { RpgPlayer, RpgEvent, EventData, EventMode, Move, Speed, Direction } = require('@rpgjs/server');

// ── Player class ────────────────────────────────────────────────────────────
const MtgPlayer = {
  onConnected(player) {
    player.setHitbox(24, 16);
    player.speed = Speed.Normal;
    player.name = player.name || 'Planeswalker';
    player.hp = 100;
    player.maxHp = 100;

    // Sync display name / avatar from MTG auth if provided
    const { displayName, avatar } = player.getParams() || {};
    if (displayName) player.name = displayName;

    player.changeMap('homeroom', {
      x: 400,
      y: 300,
    });
  },

  onDisconnected(player) {
    // nothing to clean up — RpgServerEngine removes the player automatically
  },

  onMove(player) {
    // Called each tick the player moves — can add stamina drain etc here
  },

  onDead(player) {
    player.hp = player.maxHp;
    player.teleport({ x: 400, y: 300 });
  },
};

// ── Sparring Dummy NPC ───────────────────────────────────────────────────────
@EventData({
  name: 'sparring-dummy',
  mode: EventMode.Shared,
  hitbox: { width: 32, height: 32 },
})
class SparringDummy extends RpgEvent {
  onInit(event) {
    event.setGraphic('dummy');
    event.speed = Speed.Slow;
  }

  async onAction(event, player) {
    await player.showText('The training dummy invites you to duel! Ready?', {
      talkWith: event,
    });
    await player.showChoices('Start sparring session?', [
      { text: '⚔️  Yes, let\'s go!', value: 'yes' },
      { text: '🚪 Not now',        value: 'no'  },
    ]).then(({ value }) => {
      if (value === 'yes') {
        // Emit to client — the client will open the sparring overlay
        player.emit('open-sparring', { dummyId: event.id });
      }
    });
  }
}

module.exports = { MtgPlayer, SparringDummy };
