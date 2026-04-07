const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../../camps_data.json");
const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

// ── Load config (single source of truth) ────────────────────────────
const { BLACKLISTED_DOMAINS } = require("../utils/config");
const badDomains = BLACKLISTED_DOMAINS;

// Placeholder dates to scrub (e.g. 06/20/2026 often from common scrapers)
const placeholderPatterns = [
  /06\/20(?!\/2026)/, // 06/20 but not 06/20/2026 (guards against month/year)
  /07\/20(?!\/2026)/,
  /08\/20(?!\/2026)/,
  /\b20th\b/i,
];

let modified = 0;

for (const record of data) {
  let needsScrub = false;
  let reason = "";

  // 1. Check bad domains
  if (record.campUrl && badDomains.some((b) => record.campUrl.includes(b))) {
    needsScrub = true;
    reason = `Bad domain: ${record.campUrl}`;
  }

  // 2. Check low cost (< $50 is almost always junk/discount placeholder)
  if (!needsScrub && record.cost && record.cost !== "TBA") {
    const match = record.cost.match(/\$\s*(\d{1,})/);
    if (match) {
      const val = parseInt(match[1], 10);
      if (val < 50) {
        needsScrub = true;
        reason = `Suspiciously low cost: ${record.cost}`;
      }
    }
  }

  // 3. Check placeholder dates / date overflows
  if (!needsScrub && record.dates && record.dates !== "TBA") {
    const dates = record.dates.split("|").map((d) => d.trim());

    // Check for "MM/20" placeholder pattern (e.g. 06/20 vs 06/20/2026)
    if (placeholderPatterns.some((p) => p.test(record.dates))) {
      const anySuspicious = dates.some((d) =>
        placeholderPatterns.some((p) => p.test(d)),
      );
      if (anySuspicious) {
        needsScrub = true;
        reason = `Placeholder dates: ${record.dates}`;
      }
    }

    // Check for massive overflows (likely generic calendars)
    if (!needsScrub && dates.length > 12) {
      needsScrub = true;
      reason = `Overflow dates (${dates.length}): likely generic sidebar scrape.`;
    }
  }

  // 4. Force reset for specific known bad entries (NJIT, Miss St, SDSU, Memphis)
  const forceReset = [
    "NJIT",
    "Mississippi State",
    "South Dakota State",
    "University of Memphis",
    "Memphis",
  ];
  if (!needsScrub && forceReset.some((f) => record.university.includes(f))) {
    // If they have suspiciously generic info, reset them
    if (
      record.cost === "$55" ||
      record.cost === "$1" ||
      (record.dates && record.dates.includes("2026-06-20"))
    ) {
      needsScrub = true;
      reason = `Force reset (Known bad data reported for ${record.university})`;
    }
  }

  if (needsScrub) {
    console.log(`Scrubbing ${record.university} (Reason: ${reason})`);
    record.campUrl = "";
    record.dates = "TBA";
    record.cost = "TBA";
    record.contact = "";
    record.email = "";
    record.isVerified = false; // reset verification
    record.autoVerified = false;
    record.autoVerifiedPartial = false;
    record.isChecked = false;
    record.details =
      "(Scrubbed due to invalid data; queueing for re-extraction)";
    modified++;
  }
}

if (modified > 0) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(`\n✅ Scrubbed ${modified} records.`);
} else {
  console.log("\n✅ No bad records found.");
}
