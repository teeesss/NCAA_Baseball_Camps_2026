const fs = require("fs");
const googleIt = require("google-it");

const dataFile = "camps_data.json";
let data = JSON.parse(fs.readFileSync(dataFile, "utf8"));

async function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function run() {
  let toProcess = data.filter(
    (d) =>
      d.campUrl &&
      d.campUrl.match(/^https:\/\/(www\.)?[^\/]+\.(edu|com)\/?$/i) &&
      !d.campUrl.includes("ryzer") &&
      !d.campUrl.includes("totalcamps") &&
      !d.campUrl.includes("baseballcamps"),
  );

  console.log(
    `Found ${toProcess.length} generic root domains. Fetching actual links for the first 30...`,
  );

  // Process first 30 to avoid rate limits
  toProcess = toProcess.slice(0, 30);
  let updated = 0;

  for (let i = 0; i < toProcess.length; i++) {
    let d = toProcess[i];
    console.log(
      `[${i + 1}/${toProcess.length}] Searching for: ${d.university} baseball camp`,
    );
    try {
      const results = await googleIt({
        query: d.university + " baseball camp 2026 registration",
        disableConsole: true,
        limit: 3,
      });
      if (results && results.length > 0) {
        const best = results.find(
          (r) =>
            r.link.includes("ryzer.com") ||
            r.link.includes("totalcamps.com") ||
            r.link.includes("camps.com") ||
            r.link.includes("athletics") ||
            r.link.includes("sports.com"),
        );

        if (best) {
          d.campUrl = best.link;
          updated++;
          console.log(`   -> Found: ${best.link}`);
        } else {
          d.campUrl = results[0].link;
          updated++;
          console.log(`   -> Fallback: ${results[0].link}`);
        }
      }
    } catch (e) {
      console.log(`   -> Failed: ${e.message}`);
    }
    await delay(1000); // 1 second delay to avoid getting banned
  }

  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  console.log(`\nUpdated ${updated} records with deep links.`);
}

run().catch(console.error);
