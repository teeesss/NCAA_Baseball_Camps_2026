const puppeteer = require("puppeteer");
const fs = require("fs");

const targets = [
  { name: "Ball State", url: "https://ballstatebaseballcamps.totalcamps.com/" },
  { name: "BYU", url: "https://www.byusportscamps.com/baseball" },
  {
    name: "Cal State Fullerton",
    url: "https://info.collegebaseballcamps.com/csf-baseball/",
  },
  {
    name: "Central Michigan",
    url: "https://cmubaseballcamps.totalcamps.com/About%20Us",
  },
];

async function check() {
  const browser = await puppeteer.launch({ headless: true });
  const results = [];

  for (const target of targets) {
    console.log(`Checking ${target.name} at ${target.url}...`);
    const page = await browser.newPage();
    try {
      await page.goto(target.url, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Basic text extraction
      const content = await page.evaluate(() => document.body.innerText);

      // Specifically look for dates and prices
      const has2026 = content.includes("2026");
      const hasCamps = !content
        .toLowerCase()
        .includes("no camps currently available");

      results.push({
        name: target.name,
        url: target.url,
        has2026,
        hasCamps,
        content: content.slice(0, 500), // snippet
      });
    } catch (e) {
      results.push({ name: target.name, error: e.message });
    }
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(
    "src/debug/results_user_targets.json",
    JSON.stringify(results, null, 2),
  );
  console.log("Results saved to src/debug/results_user_targets.json");
}

check();
