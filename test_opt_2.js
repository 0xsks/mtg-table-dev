const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('data/cards.json', 'utf8')).slice(0, 1000);

for(const c of cards) {
    if(!c._type_line_lower) {
        c._type_line_lower = (c.type_line || "").toLowerCase();
        c._name_lower = c.name.toLowerCase();
        c._name_clean = c._name_lower.replace(/[\x27\x60\u2019]/g, "");
    }
}
