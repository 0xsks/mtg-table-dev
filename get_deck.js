const fs = require('fs');
let code = fs.readFileSync('public/js/rpg.js', 'utf8');

// Add a variable for active deck name
code = code.replace(/let hero = \{[\s\S]*?\};/, 
  `$&
    let activeDeckName = "No Deck Selected";
    (async () => {
      try {
        const did = sessionStorage.getItem("mtg-selected-deck");
        if (did) {
           const deck = await (window.MTG && window.MTG.api ? window.MTG.api(\`/api/decks/\${did}\`) : Promise.reject());
           if (deck && deck.name) activeDeckName = deck.name;
        } else {
           const decks = await (window.MTG && window.MTG.api ? window.MTG.api("/api/decks") : Promise.reject());
           if (decks && decks.length > 0) activeDeckName = decks[0].name;
        }
      } catch (e) {}
    })();`
);

// Add the badge below the portrait
code = code.replace(
  /<div class="dfk-portrait-wrap" id="dfk-card-portrait" title="Click to view Planeswalker Profile">[\s\S]*?<\/div>/,
  `$&
          <div class="dfk-active-deck-badge" title="Active Deck: \${activeDeckName}" style="text-align: center; font-size: 9px; margin-top: 4px; background: rgba(0,0,0,0.5); padding: 2px 4px; border-radius: 4px; border: 1px solid var(--line); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60px;">
             🎴 \${activeDeckName}
          </div>`
);

fs.writeFileSync('public/js/rpg.js', code);
