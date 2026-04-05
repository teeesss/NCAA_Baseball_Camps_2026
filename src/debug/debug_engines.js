const puppeteer = require("puppeteer");

async function debugEngines() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const p = await browser.newPage();
  await p.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
  );

  const query = "Alabama baseball camp 2026";
  const engines = [
    {
      name: "Brave",
      url: `https://search.brave.com/search?q=${encodeURIComponent(query)}`,
    },
    {
      name: "Ask",
      url: `https://www.ask.com/web?q=${encodeURIComponent(query)}`,
    },
    {
      name: "Google",
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    },
  ];

  for (const e of engines) {
    try {
      console.log(`Debugging ${e.name}...`);
      await p.goto(e.url, { waitUntil: "networkidle2", timeout: 30000 });
      await p.screenshot({ path: `${e.name.toLowerCase()}_debug.png` });
      const title = await p.title();
      const text = await p.evaluate(() =>
        document.body.innerText.substring(0, 500),
      );
      console.log(`[${e.name}] Title: ${title}`);
      console.log(`[${e.name}] Text snippet: ${text.replace(/\n/g, " ")}...`);
    } catch (err) {
      console.log(`[${e.name}] Error: ${err.message}`);
    }
  }

  await browser.close();
}
debugEngines();
