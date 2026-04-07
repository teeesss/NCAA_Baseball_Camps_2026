const puppeteer = require("puppeteer");
async function test() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const p = await browser.newPage();
  const q = "Alabama baseball camp 2026";
  await p.goto(`https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
    waitUntil: "domcontentloaded",
  });
  const links = await p.evaluate(() =>
    Array.from(document.querySelectorAll("a.result__a")).map((a) => a.href),
  );
  console.log(`✅ DuckDuckGo: Found ${links.length} results.`);
  await browser.close();
}
test();
