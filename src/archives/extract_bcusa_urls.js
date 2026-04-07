"use strict";
/**
 * Targeted extraction for 75 BCUSA-sourced schools with NEW_SOURCE_DETECTED auditStatus.
 * Runs V6 extraction engine only on newly updated camp URLs.
 */

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { MASCOT_LOOKUP } = require("./src/utils/mascot_lookup.js");

const DATA_FILE = path.join(__dirname, "camps_data.json");
const BLACKLIST_FILE = path.join(__dirname, "blacklist.json");
const LOG_FILE = path.join(__dirname, "bcusa_extract.log");

function log(msg) {
  console.log(msg);
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
}

// -- Load data --
let data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
const blacklist = JSON.parse(fs.readFileSync(BLACKLIST_FILE, "utf8"));

const {
  BLACKLISTED_DOMAINS,
  isBlacklistedUrl,
  isWrongSport,
  isTeamCampOrLegacy,
  DATE_PATTERNS,
  COST_PATTERN,
  EMAIL_PATTERN,
  COST_RANGE,
  GENERIC_EMAIL_PREFIXES,
  CURRENT_SCRIPT_VERSION,
} = require("./src/utils/config");

// -- Filter schools with NEW_SOURCE_DETECTED --
const pendingSchools = data.filter(
  (s) => s.auditStatus === "NEW_SOURCE_DETECTED" && s.campUrl,
);
log(`Schools to extract: ${pendingSchools.length}`);
if (pendingSchools.length === 0) {
  log("No schools pending. Exiting.");
  process.exit(0);
}

// -- Extraction logic (simplified V6) --
async function extractPageContent(browser, url, school, mascot) {
  const page = await browser.newPage();
  log(`  -> Loading ${url}`);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  } catch (e) {
    log(`    Page timeout: ${e.message}`);
    await page.close();
    return null;
  }

  // Check for school name match
  let bodyText = "";
  try {
    bodyText = await page.evaluate(() => document.body.innerText);
  } catch (e) {
    log(`    Could not extract body text`);
    bodyText = await page.evaluate(() =>
      document.documentElement.innerHTML.substring(0, 50000),
    );
  }

  const title = await page.title().catch(() => "");
  const titleLower = title.toLowerCase();
  const bodyLower = bodyText.toLowerCase();

  if (titleLower.includes("404") || titleLower.includes("not found")) {
    log(`    404/not found`);
    await page.close();
    return null;
  }

  // Basic validation - does school/mascot appear?
  const schoolLower = school.toLowerCase();
  const mascotLower = (mascot || "").toLowerCase();
  const hasBaseball =
    bodyLower.includes("baseball camp") || bodyLower.includes("camp");

  if (!hasBaseball) {
    log(`    No camp-related content found`);
    await page.close();
    return null;
  }

  // Extract dates
  let dates = [];
  for (const pat of DATE_PATTERNS) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(bodyText)) !== null) {
      dates.push(m[0].trim());
    }
  }
  dates = [...new Set(dates)].slice(0, 5);

  // Extract costs
  let costs = [];
  const campKeywords =
    /camp|clinic|registration|register|fee|tuition|cost|price|per\s+player/gi;
  let match;
  while ((match = campKeywords.exec(bodyText)) !== null) {
    const wind = bodyText.substring(
      Math.max(0, match.index - 150),
      Math.min(bodyText.length, match.index + 150),
    );
    COST_PATTERN.lastIndex = 0;
    let cm;
    while ((cm = COST_PATTERN.exec(wind)) !== null) {
      const val = parseFloat(cm[1].replace(/,/g, ""));
      if (val >= COST_RANGE.MIN && val <= COST_RANGE.MAX) costs.push(val);
    }
  }
  costs = [...new Set(costs)].sort((a, b) => a - b);

  // Extract email
  let email = null;
  EMAIL_PATTERN.lastIndex = 0;
  let emails = bodyText.match(EMAIL_PATTERN) || [];
  for (let e of emails) {
    e = e.toLowerCase();
    const parts = e.split("@");
    if (parts[0].length < 3) continue;
    const tld = parts[1].split(".").pop();
    const validTlds = ["edu", "com", "org", "net"];
    if (
      validTlds.includes(tld) &&
      !BLACKLISTED_DOMAINS.some((b) => e.includes(b)) &&
      !["example", "noreply", "sentry", "support", "webmaster"].some((g) =>
        e.startsWith(g + "@"),
      )
    ) {
      email = e;
      break;
    }
  }

  let datesStr = dates.length ? dates.join(" | ") : null;
  let costStr = costs.length ? costs.map((c) => "$" + c).join(" / ") : null;

  log(
    `    ${datesStr ? "Dates:" : "No dates found:"} ${datesStr || "Not found"}`,
  );
  log(`    ${costStr ? "Cost:" : "No cost found:"} ${costStr || "Not found"}`);
  log(`    ${email ? "Email:" : "No email found:"} ${email || "Not found"}`);

  await page.close();
  return { datesStr, costStr, email, found: !!(datesStr || costStr || email) };
}

// -- Main: Puppeteer extraction --
(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  let successCount = 0;
  let skipCount = 0;

  for (const school of pendingSchools) {
    const university = school.university;
    const campUrl = school.campUrl || school.url;
    log(`\n--- ${university} ---`);
    log(`  URL: ${campUrl}`);

    try {
      const result = await extractPageContent(
        browser,
        campUrl,
        university,
        MASCOT_LOOKUP[university],
      );

      if (result) {
        // Update data
        if (result.datesStr) {
          school.campDates = result.datesStr;
          school.datesUpdateDate = Date.now();
        }
        if (result.costStr) {
          school.prices = result.costStr;
          school.priceUpdateDate = Date.now();
        }
        if (result.email) {
          if (!school.email) {
            school.email = result.email;
          } else if (school.email !== result.email) {
            school.email = school.email.includes(result.email)
              ? school.email
              : school.email + " | " + result.email;
          }
        }
        school.lastUpdateDate = Date.now();
        school.isChecked = true;
        school.scriptVersion = CURRENT_SCRIPT_VERSION;

        if (result.found) {
          successCount++;
          log(`  Data extracted and saved`);
        } else {
          skipCount++;
          school.auditStatus = "EXTRACTED_NO_DATA";
          log(`  Page loaded but no structured data found`);
        }
      } else {
        skipCount++;
        school.auditStatus = "URL_UNREACHABLE";
        log(`  Page unavailable, marked for review`);
      }
    } catch (e) {
      log(`  Error: ${e.message.substring(0, 100)}`);
      school.auditStatus = "EXTRACTION_ERROR";
      school.isChecked = true;
      skipCount++;
    }

    // Save after each school
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

    // Rate limit
    await new Promise((r) => setTimeout(r, 2000));
  }

  await browser.close();

  log(`\n--- SUMMARY ---`);
  log(`  Success: ${successCount}`);
  log(`  Skipped/Error: ${skipCount}`);
  log(`  Total processed: ${pendingSchools.length}`);
})().catch((e) => {
  log(`Fatal error: ${e.message}`);
  process.exit(1);
});
