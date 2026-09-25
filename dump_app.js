const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:8877/#/');
  await new Promise(r => setTimeout(r, 2000));
  const html = await page.evaluate(() => document.getElementById('app').innerHTML);
  console.log("APP HTML:\n", html.substring(0, 1000));
  await browser.close();
})();
