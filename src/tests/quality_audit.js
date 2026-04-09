/**
 * QUALITY AUDIT ENGINE
 * ============================================================
 * Scans camps_data.json and scores every school on data quality.
 * Produces 'missing_data_queue.json' — the prioritized work list
 * that the smart extraction engine will consume.
 *
 * Quality Tiers:
 *   COMPLETE  (100) — Has: campUrl + dates + cost + contact + email
 *   GOOD      (75)  — Has: campUrl + dates + cost  (missing contact or email)
 *   PARTIAL   (50)  — Has: campUrl + dates          (missing cost)
 *   LOW       (25)  — Has: campUrl only             (missing dates)
 *   EMPTY     (0)   — No campUrl / generic fallback
 *
 * Auto-Verified Flag:
 *   autoVerified = true  when: campUrl is non-generic AND has real dates AND has cost
 *   autoVerifiedPartial = true when: campUrl found but missing dates or cost
 *
 * Usage:  node quality_audit.js
 * Output: missing_data_queue.json
 * ============================================================
 */

"use strict";

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../../camps_data.json");
const OUTPUT_FILE = path.join(__dirname, "missing_data_queue.json");

// Generic/fallback URLs that indicate no real camp page was found
const GENERIC_URL_PATTERNS = [
  "google.com/search",
  "bing.com/search",
  "duckduckgo.com",
  "wikipedia.org",
  "en.m.wikipedia",
  "ncaa.org",
  "athleticnet.com",
  "/sports/baseball$",
];

// Date patterns — strict 2026 reference
const DATE_2026_REGEX = /\b2026\b/;
const DATE_STALE_REGEX = /\b2025\b/;
const DATE_NUMERIC_REGEX = /\d{1,2}\/\d{1,2}\/2026/;

function isGenericUrl(url) {
  if (!url || url.trim() === "") return true;
  return GENERIC_URL_PATTERNS.some((p) => {
    if (p.startsWith("/") && p.endsWith("$")) {
      return new RegExp(p).test(url);
    }
    return url.toLowerCase().includes(p.toLowerCase());
  });
}

function hasRealDate(record) {
  const dateText = [
    record.dates || "",
    record.details || "",
    ...(record.campTiers || []).map((t) => t.dates || ""),
  ].join(" ");
  const has2026 =
    DATE_2026_REGEX.test(dateText) || DATE_NUMERIC_REGEX.test(dateText);
  const isStale = DATE_STALE_REGEX.test(dateText) && !has2026;
  return has2026 && !isStale;
}

function hasRealCost(record) {
  const costText = [
    record.cost || "",
    ...(record.campTiers || []).map((t) => t.cost || ""),
  ].join(" ");
  return /\$\s*\d+/.test(costText);
}

function hasContact(record) {
  const c = (record.contact || "").trim();
  return (
    c.length > 3 &&
    !c.toLowerCase().includes("tbd") &&
    !c.toLowerCase().includes("n/a")
  );
}

function hasEmail(record) {
  return (
    /@[a-zA-Z0-9.-]+\.[a-z]{2,}/.test(record.contact || "") ||
    /@[a-zA-Z0-9.-]+\.[a-z]{2,}/.test(record.email || "")
  );
}

function scoreRecord(record) {
  const generic = isGenericUrl(record.campUrl);
  const dates = hasRealDate(record);
  const cost = hasRealCost(record);
  const contact = hasContact(record);
  const email = hasEmail(record);

  const missing = [];
  if (generic) missing.push("campUrl");
  if (!dates) missing.push("dates");
  if (!cost) missing.push("cost");
  if (!contact) missing.push("contact");
  if (!email) missing.push("email");

  let score = 0;
  let tier = "EMPTY";

  if (!generic && dates && cost && contact && email) {
    score = 100;
    tier = "COMPLETE";
  } else if (!generic && dates && cost) {
    score = 75;
    tier = "GOOD";
  } else if (!generic && dates) {
    score = 50;
    tier = "PARTIAL";
  } else if (!generic) {
    score = 25;
    tier = "LOW";
  } else {
    score = 0;
    tier = "EMPTY";
  }

  // Auto-Verified logic
  const autoVerified = !generic && dates && cost;
  const autoVerifiedPartial = !generic && (dates || cost) && !(dates && cost);

  return { score, tier, missing, autoVerified, autoVerifiedPartial };
}

function run() {
  console.log("\n🔍 NCAA Baseball Camp QUALITY AUDIT");
  console.log("=====================================\n");

  if (!fs.existsSync(DATA_FILE)) {
    console.error(`❌ camps_data.json not found at ${DATA_FILE}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  console.log(`📋 Total records: ${data.length}`);

  const { CONFERENCE_LOOKUP } = require("../utils/conference_lookup.js");

  function getPrestige(university, division) {
    if (division === "DII") return 0;
    const conf = CONFERENCE_LOOKUP[university] || "Other";

    // Explicit Elite DI Power Programs (Priority #1)
    const elite = [
      "Arkansas",
      "LSU",
      "Florida",
      "Florida State",
      "Vanderbilt",
      "Tennessee",
      "Texas",
      "Texas A&M",
      "Wake Forest",
      "North Carolina",
      "Clemson",
      "Virginia",
      "Stanford",
      "Oklahoma",
      "Oklahoma State",
      "Ole Miss",
      "Mississippi State",
      "TCU",
      "Auburn",
      "South Carolina",
    ];
    if (elite.includes(university)) return 10000;

    const weights = {
      SEC: 1000,
      ACC: 900,
      "Big 12": 850,
      "Big Ten": 800,
      "Sun Belt": 700,
      American: 650,
      "Big West": 600,
      MVC: 550,
      WCC: 500,
      "Mountain West": 450,
      "C-USA": 400,
      ASUN: 350,
      SoCon: 300,
      CAA: 250,
    };
    return weights[conf] || 100;
  }

  const urlMap = new Map();
  const duplicates = [];
  const suspiciousPrices = [];

  const results = [];
  const tierCounts = { COMPLETE: 0, GOOD: 0, PARTIAL: 0, LOW: 0, EMPTY: 0 };
  let autoVerifiedCount = 0;
  let autoVerifiedPartialCount = 0;

  for (const record of data) {
    const { score, tier, missing, autoVerified, autoVerifiedPartial } =
      scoreRecord(record);
    tierCounts[tier]++;
    if (autoVerified) autoVerifiedCount++;
    if (autoVerifiedPartial) autoVerifiedPartialCount++;

    const prestige = getPrestige(record.university, record.division);

    results.push({
      university: record.university,
      division: record.division || "DI",
      score,
      prestige,
      tier,
      missing,
      autoVerified,
      autoVerifiedPartial,
      isVerified: record.isVerified || false,
      isChecked: record.isChecked || false,
      scriptVersion: record.scriptVersion || 0,
      campUrl: record.campUrl || "",
      currentDates: record.dates || "",
      currentCost: record.cost || "",
      currentContact: record.contact || "",
    });

    // Anomaly: Duplicate URLs
    const url = record.campUrl || "";
    if (url && url.length > 10 && !isGenericUrl(url)) {
      if (urlMap.has(url)) {
        duplicates.push({ url, s1: urlMap.get(url), s2: record.university });
      } else {
        urlMap.set(url, record.university);
      }
    }

    // Anomaly: Suspicious Price (<$40 or >$500 with 'Team')
    const costText = record.cost || "";
    const detailsText = record.details || "";
    const costMatch = costText.match(/\$?([\d,]+)/);
    if (costMatch) {
      const price = parseInt(costMatch[1].replace(/,/g, ""));
      const isTeam =
        costText.toLowerCase().includes("team") ||
        detailsText.toLowerCase().includes("team");
      if (price > 0 && (price < 40 || (price >= 500 && isTeam))) {
        suspiciousPrices.push({
          university: record.university,
          cost: costText,
          reason: price < 40 ? "Too Low" : "Likely Team",
        });
      }
    }
  }

  // Sort Logic:
  // 1. Division I first (pushed by prestige weight)
  // 2. Highest Prestige first (SEC > MidMajor)
  // 3. Lowest score within prestige group first (Fix EMPTY before PARTIAL)
  results.sort(
    (a, b) =>
      b.prestige - a.prestige ||
      a.score - b.score ||
      a.university.localeCompare(b.university),
  );

  // Build queue — only schools that are NOT complete AND not manually verified
  const queue = results
    .filter((r) => r.score < 100)
    .filter((r) => !(r.isVerified && r.scriptVersion >= 5)); // protect verified records

  // Stats
  console.log("\n📊 Quality Tier Distribution:");
  console.log(`   ✅ COMPLETE  (100): ${tierCounts.COMPLETE}`);
  console.log(`   👍 GOOD      ( 75): ${tierCounts.GOOD}`);
  console.log(`   ⚠️  PARTIAL   ( 50): ${tierCounts.PARTIAL}`);
  console.log(`   🔴 LOW       ( 25): ${tierCounts.LOW}`);
  console.log(`   ❌ EMPTY     (  0): ${tierCounts.EMPTY}`);
  console.log(`\n   🤖 Auto-Verified (full):    ${autoVerifiedCount}`);
  console.log(`   🔶 Auto-Verified (partial): ${autoVerifiedPartialCount}`);
  console.log(`\n   📌 Schools needing work:    ${queue.length}`);

  // Missing field breakdown
  const fieldCounts = {};
  for (const r of queue) {
    for (const f of r.missing) {
      fieldCounts[f] = (fieldCounts[f] || 0) + 1;
    }
  }
  console.log("\n🔧 Missing Field Frequency (in queue):");
  for (const [field, count] of Object.entries(fieldCounts).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`   ${field.padEnd(12)}: ${count} schools`);
  }

  // ANOMALY REPORTING
  if (duplicates.length > 0) {
    console.log("\n🚩 RED FLAG: DUPLICATE URLS DETECTED:");
    duplicates.forEach((d) =>
      console.log(`   - [${d.url}] shared by: "${d.s1}" AND "${d.s2}"`),
    );
  } else {
    console.log("\n✅ NO duplicate URLs detected.");
  }

  if (suspiciousPrices.length > 0) {
    console.log("\n⚠️  SUSPICIOUS PRICING (<$100) DETECTED:");
    suspiciousPrices.forEach((p) =>
      console.log(`   - "${p.university}": ${p.cost}`),
    );
  } else {
    console.log("\n✅ NO suspicious low prices detected.");
  }

  // Write queue file
  const output = {
    generatedAt: new Date().toISOString(),
    totalRecords: data.length,
    tierCounts,
    autoVerifiedCount,
    autoVerifiedPartialCount,
    queueLength: queue.length,
    missingFieldFrequency: fieldCounts,
    queue,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(
    `\n✅ Queue written → missing_data_queue.json (${queue.length} schools to process)\n`,
  );

  // Also stamp autoVerified flags back into camps_data.json
  let updated = 0;
  for (const record of data) {
    const { autoVerified, autoVerifiedPartial } = scoreRecord(record);
    if (
      record.autoVerified !== autoVerified ||
      record.autoVerifiedPartial !== autoVerifiedPartial
    ) {
      record.autoVerified = autoVerified;
      record.autoVerifiedPartial = autoVerifiedPartial;
      updated++;
    }
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(
    `🏷️  Stamped autoVerified flags on ${updated} records in camps_data.json\n`,
  );
}

run();
