const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const DATA_FILE = "camps_data.json";
const PRIORITY_SCHOOLS = {
  Gonzaga: "http://www.zagsbaseballcamps.com/",
  Hofstra:
    "https://readysetregister.com/customer_service/reproduction.php?id=381",
  Houston: "https://houstonbaseballcamps.totalcamps.com/",
  Nevada: "https://wolfpackbaseballcamps.com/",
  "North Carolina": "https://carolinabaseballcamps.com/",
  Princeton: "https://princetonsportscamps.com/baseball.htm",
  Richmond: "https://spiderbaseballcamps.com/",
  "Santa Clara": "https://santaclarabaseballcamps.com/",
  Texas: "https://texaslonghorns.com/sports/2023/3/22/baseball-camp",
  "UMass-Lowell": "https://umlowellbaseballcamps.com/",
  Vanderbilt: "https://vanderbiltbaseballcamps.com/",
  Washington: "https://washingtonbaseballcamps.com/",
};

async function fixPriority() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const browser = await puppeteer.launch({
    headless: true,
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });
  const page = await browser.newPage();

  for (const uni of Object.keys(PRIORITY_SCHOOLS)) {
    const url = PRIORITY_SCHOOLS[uni];
    console.log(`\n🎯 Fixing ${uni}...`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await new Promise((r) => setTimeout(r, 3000));

      const info = await page.evaluate(() => {
        const text = document.body.innerText;
        const findDates = (t) => {
          const months = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
          ];
          const regex = new RegExp(
            `(?:${months.join("|")})\\s+\\d{1,2}(?:\\s*-\\s*\\d{1,2})?,?\\s*(?:2026|'26)`,
            "gi",
          );
          const found = t.match(regex);
          return found ? Array.from(new Set(found)).join(" | ") : "TBA";
        };
        const findCost = (t) => {
          const regex = /\$\d{2,3}(?:\.\d{2})?/g;
          const found = t.match(regex);
          if (!found) return "TBA";
          const numeric = found.map((f) => parseFloat(f.replace("$", "")));
          const filtered = numeric.filter((n) => n > 45 && n < 550);
          return filtered.length ? filtered.join(" | ") : "TBA";
        };
        return {
          dates: findDates(text),
          cost: findCost(text),
        };
      });

      const record = data.find((r) => r.university === uni);
      if (record) {
        record.campUrl = url;
        record.dates = info.dates;
        record.cost = info.cost;
        record.isVerified = true;
        record.isChecked = true;
        record.scriptVersion = 13;
        console.log(`  ✅ Done: ${info.dates} | ${info.cost}`);
      }
    } catch (err) {
      console.log(`  ❌ ${uni} error: ${err.message}`);
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  await browser.close();
  console.log("\n✅ PRIORITY FIX COMPLETE");
}

fixPriority();
