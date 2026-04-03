const puppeteer = require('puppeteer');

async function debugSearch(q) {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const p = await browser.newPage();
    try {
        console.log(`\n--- Testing DDG (HTML) for: ${q} ---`);
        await p.goto(`https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded' });
        let ddgLinks = await p.evaluate(() => Array.from(document.querySelectorAll('.result__a')).map(a => a.href));
        console.log(`DDG Results (${ddgLinks.length}):`, ddgLinks.slice(0, 3));

        console.log(`\n--- Testing Bing for: ${q} ---`);
        await p.goto(`https://www.bing.com/search?q=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded' });
        let bingLinks = await p.evaluate(() => Array.from(document.querySelectorAll('#b_results .b_algo h2 a')).map(a => a.href));
        console.log(`Bing Results (${bingLinks.length}):`, bingLinks.slice(0, 3));

        console.log(`\n--- Testing Ask for: ${q} ---`);
        await p.goto(`https://www.ask.com/web?q=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded' });
        let askLinks = await p.evaluate(() => Array.from(document.querySelectorAll('.PartialSearchResults-item-title-link')).map(a => a.href));
        console.log(`Ask Results (${askLinks.length}):`, askLinks.slice(0, 3));

    } catch (e) {
        console.error("Debug Error:", e.message);
    }
    await browser.close();
}

debugSearch("Central Washington University baseball camp 2026");
