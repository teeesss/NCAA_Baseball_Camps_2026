const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

async function test() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--no-sandbox", "--disable-features=SafeBrowsing"],
  });
  const page = await browser.newPage();

  const REFERERS = [
    "https://www.google.com/",
    "https://www.bing.com/",
    "https://search.yahoo.com/",
    "https://duckduckgo.com/",
    "https://www.facebook.com/",
  ];
  const ref = REFERERS[0];

  try {
    console.log(
      `Navigating to http://famubaseballcamps.com/ with NO headers or UA...`,
    );
    await page.goto("http://famubaseballcamps.com/", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    console.log("Success! Page loaded.");
    console.log("Final URL:", page.url());
  } catch (e) {
    console.log("Error caught:", e.message);
  } finally {
    await browser.close();
  }
}

test();
