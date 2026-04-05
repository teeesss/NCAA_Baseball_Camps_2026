const puppeteer = require("puppeteer");

async function test() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const p = await browser.newPage();
  const engines = [
    { name: "Bing", url: "https://www.bing.com/search?q=test" },
    { name: "Brave", url: "https://search.brave.com/search?q=test" },
    { name: "DDG", url: "https://duckduckgo.com/html?q=test" },
    { name: "Yahoo", url: "https://search.yahoo.com/search?p=test" },
  ];

  for (let engine of engines) {
    console.log(`Testing ${engine.name}...`);
    try {
      const start = Date.now();
      await p.goto(engine.url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      console.log(`✅ ${engine.name} took ${Date.now() - start}ms`);
    } catch (e) {
      console.error(`❌ ${engine.name} failed: ${e.message}`);
    }
  }
  await browser.close();
}

test();
