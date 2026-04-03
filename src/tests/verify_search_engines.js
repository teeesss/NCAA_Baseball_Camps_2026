const puppeteer = require('puppeteer');
const fs = require('fs');

async function testEngines() {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const p = await browser.newPage();
    await p.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

    const query = "Alabama baseball camp 2026";
    const engines = [
        { name: "Bing", url: `https://www.bing.com/search?q=${encodeURIComponent(query)}`, selector: '#b_results .b_algo h2 a, h2 a' },
        { name: "Brave", url: `https://search.brave.com/search?q=${encodeURIComponent(query)}`, selector: 'a.result-header, h3 a, #results a' },
        { name: "Yahoo", url: `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`, selector: '.title a, .compTitle a, #web h3 a, .algo a' },
        { name: "Ask", url: `https://www.ask.com/web?q=${encodeURIComponent(query)}`, selector: '.PartialSearchResults-item-title-link, a.result-link, h3 a' },
        { name: "Google", url: `https://www.google.com/search?q=${encodeURIComponent(query)}`, selector: '#search a[href^="http"]:not([href*="google.com"])' }
    ];

    console.log(`\n--- VERIFYING SEARCH ENGINES ---`);
    for (const e of engines) {
        try {
            console.log(`\nTesting ${e.name}...`);
            await p.goto(e.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await new Promise(r => setTimeout(r, 2000)); // Brief pause for dynamic content
            
            const count = await p.evaluate((sel) => {
                return Array.from(document.querySelectorAll(sel)).length;
            }, e.selector);
            
            console.log(`✅ ${e.name}: Found ${count} results.`);
            if (count === 0) {
                console.log(`⚠️  Warning: 0 results for ${e.name}. Selector might need update.`);
            }
        } catch (err) {
            console.log(`❌ ${e.name} failed: ${err.message.substring(0, 80)}`);
        }
    }

    await browser.close();
    console.log(`\n--- VERIFICATION COMPLETE ---`);
}

testEngines();
