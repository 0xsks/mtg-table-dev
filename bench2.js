const https = require('https');

async function bench() {
  const start = Date.now();
  const iterations = 500;
  for (let i = 0; i < iterations; i++) {
    await new Promise((resolve) => {
      https.get('https://127.0.0.1:8888/api/cards?q=goblin&type=creature&cmc=2,3&colors=UR&colorMode=any', { rejectUnauthorized: false }, (res) => {
        res.on('data', () => {});
        res.on('end', resolve);
      });
    });
  }
  const end = Date.now();
  console.log(`Average time: ${(end - start) / iterations}ms per request`);
}
bench();
