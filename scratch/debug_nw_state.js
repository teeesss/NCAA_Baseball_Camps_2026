
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    const url = 'https://www.northwesternbaseballcamps.com/';
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    const links = await page.$$eval('a', els => els.map(a => ({
        href: a.href,
        text: a.innerText.trim()
    })));
    
    console.log(`Found ${links.length} links:`);
    links.forEach(l => {
        if (l.href.includes('ryzer.com')) {
            console.log(`RYZER LINK: [${l.text}] -> ${l.href}`);
        }
    });
    
    await browser.close();
})();
