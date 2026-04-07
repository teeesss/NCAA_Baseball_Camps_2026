const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const DATA_FILE = path.join(__dirname, "../../camps_data.json");
const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

const YEAR_REGEX = /2026/g;
const SUMMER_MONTH_REGEX = /Jun|Jul|Aug|June|July|August|0[678]\/|[678]\//i;

async function verifyFidelity() {
  console.log("\n🛡️ STARTING YEAR FIDELITY VERIFICATION");
  console.log("=====================================\n");

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  );

  let modifiedCount = 0;
  const targets = data.filter(
    (d) => d.dates !== "TBA" || (d.campTiers && d.campTiers.length > 0),
  );

  for (let i = 0; i < targets.length; i++) {
    const item = targets[i];
    console.log(`[${i + 1}/${targets.length}] Checking ${item.university}...`);

    let hasExplicit2026 = false;

    // 1. Check if 2026 is already in details or dates
    if (YEAR_REGEX.test(item.dates) || YEAR_REGEX.test(item.details)) {
      hasExplicit2026 = true;
    }

    // 2. Deep Check: Fetch the URL if year is missing or ambiguous
    if (!hasExplicit2026 && item.campUrl && item.campUrl.startsWith("http")) {
      try {
        process.stdout.write(`  ↳ Fetching ${item.campUrl}... `);
        await page.goto(item.campUrl, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
        const bodyText = await page.evaluate(() => document.body.innerText);

        if (bodyText.includes("2026")) {
          console.log("✅ Found 2026");
          hasExplicit2026 = true;
        } else if (bodyText.includes("2025") && !bodyText.includes("2026")) {
          console.log("❌ Only 2025 found (LEGACY)");
        } else {
          console.log("❓ Ambiguous (No year)");
        }
      } catch (e) {
        console.log(`⚠️ Fetch failed: ${e.message}`);
      }
    }

    // 3. Enforcement
    if (!hasExplicit2026) {
      console.log(
        `  ‼️ REJECTED: ${item.university} has no verified 2026 data. Reverting to TBA.`,
      );
      item.dates = "TBA";
      item.cost = "TBA";
      item.isVerified = false;
      item.isChecked = false; // allow re-extraction
      item.details =
        "(Rejected by Fidelity Audit: No 2026 mention found on page)";
      modifiedCount++;
    }
  }

  if (modifiedCount > 0) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(
      `\n✅ Audit complete. Reverted ${modifiedCount} records to TBA.`,
    );
  } else {
    console.log("\n✅ Audit complete. All records passed 2026 fidelity check.");
  }

  await browser.close();
}

verifyFidelity();
