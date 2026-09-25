const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', error => console.log('PAGEERR:', error.message));

  await page.goto('http://localhost:8888/#/');
  await new Promise(r => setTimeout(r, 1000));
  
  // Evaluate hero and canvas matrix state
  const state = await page.evaluate(() => {
     try {
       // if window.MTG_HOMEROOM_INST is exposed? No, it's not.
       // but we can just check if any error happened globally?
       return { 
           hasError: !!window.lastError 
       };
     } catch(e) { return e.message; }
  });
  console.log(state);
  await browser.close();
})();
