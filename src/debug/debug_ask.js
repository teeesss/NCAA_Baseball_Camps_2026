const puppeteer = require('puppeteer');

async function debugAsk() {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const p = await browser.newPage();
    await p.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    const q = "Alabama baseball camp 2026";
    await p.goto(`https://www.ask.com/web?q=${encodeURIComponent(q)}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await p.screenshot({ path: `ask_debug.png` });
    const title = await p.title();
    const text = await p.evaluate(() => document.body.innerText.substring(0, 500));
    console.log(`[Ask] Title: ${title}`);
    console.log(`[Ask] Text snippet: ${text.replace(/\n/g, ' ')}...`);
    await browser.close();
}
debugAsk();
