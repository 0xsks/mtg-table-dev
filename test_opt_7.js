const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('data/cards.json', 'utf8'));

// Test if moving variables outside loop correctly maintains logic
let type = "creature";
let match = false;
let startTime = Date.now();
for (let i = 0; i < 1000; i++) {
  for (const c of cards) {
      if (type && !c.type_line.toLowerCase().includes(type)) continue;
      match = true;
  }
}
let time1 = Date.now() - startTime;

for (const c of cards) {
    c._type_line_lower = (c.type_line || "").toLowerCase();
}

startTime = Date.now();
for (let i = 0; i < 1000; i++) {
  for (const c of cards) {
      if (type && !c._type_line_lower.includes(type)) continue;
      match = true;
  }
}
let time2 = Date.now() - startTime;

console.log(`Original: ${time1}ms, Optimized: ${time2}ms`);
