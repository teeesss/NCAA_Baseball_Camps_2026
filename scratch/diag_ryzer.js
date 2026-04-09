
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto('https://www.laneburroughscamps.com/', { waitUntil: 'networkidle2' });
    
    // Check for Ryzer links with IDs
    const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => ({
            href: a.href,
            text: a.innerText.trim()
        })).filter(l => l.href.includes('ryzer.com') || l.href.includes('register'));
    });
    
    console.log('Ryzer or Register Links found:', JSON.stringify(links, null, 2));
    
    // Check for iframes (Ryzer sometimes embeds)
    const iframes = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('iframe')).map(f => f.src);
    });
    console.log('Iframes found:', JSON.stringify(iframes, null, 2));
    
    await browser.close();
})();
