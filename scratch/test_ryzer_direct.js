
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    const url = 'https://register.ryzer.com/camp.cfm?sport=2&id=322348';
    console.log(`Navigating to Ryzer Direct Link: ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    const text = await page.evaluate(() => document.body.innerText);
    console.log('--- PAGE TEXT SNIPPET ---');
    console.log(text.substring(0, 1000));
    console.log('--- END SNIPPET ---');
    
    const costs = text.match(/\$[\d,]+(?:\.\d{2})?/g);
    console.log('Found Costs:', costs);
    
    await browser.close();
})();
