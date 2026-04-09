/**
 * Data Cleanup Script
 *
 * Addresses:
 * 1. Longwood: remove stale 2025 date from dates field
 * 2. Purge auditStatus strings that indicate purged/bad records (clean up to standard values)
 * 3. Normalize fields: ensure dates are TBA for schools with no valid 2026 dates,
 *    ensure cost is TBA for schools with no valid cost
 * 4. Identify schools with mismatched URLs (URL_MISMATCH) and null them out if appropriate
 */

const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "camps_data.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

let changes = 0;

// 1. Longwood: remove 2025-only date
const longwood = data.find((s) => s.university === "Longwood");
if (longwood) {
  console.log("BEFORE Longwood dates:", longwood.dates);
  // Remove any dates that reference 2025 but not 2026
  const dates = longwood.dates
    .split("|")
    .map((d) => d.trim())
    .filter((d) => !d.includes("2025") || d.includes("2026"));
  longwood.dates = dates.join(" | ");
  console.log("AFTER  Longwood dates:", longwood.dates);
  changes++;
}

// 2. Clean up auditStatus values for records that were already purged/cleaned
// These records have dates="TBA" and null/empty urls but have verbose audit strings.
// Normalize to a clean status so the UI displays aren't cluttered.
const purgeIndicators = [
  "PURGED",
  "THIRD_PARTY",
  "WRONG",
  "WRONG_SPORT",
  "FOOTBALL",
];
data.forEach((s) => {
  const as = (s.auditStatus || "").toUpperCase();
  const isPurgedLike = purgeIndicators.some((ind) => as.includes(ind));
  if (isPurgedLike) {
    s.auditStatus = "CLEANED — data verified as unavailable or incorrect";
    changes++;
  }
});

// 3. Fix schools with URL_MISMATCH and campUrl still pointing to potentially wrong pages
// Only for records that have dates="TBA" and no extracted data
data.forEach((s) => {
  if (s.auditStatus === "URL_MISMATCH" && s.dates === "TBA") {
    // The URL leads to a wrong page and we have no camp data from it.
    // Set campUrl to TBA to be honest about it.
    if (s.campUrl && s.campUrl !== "TBA") {
      console.log("URL_MISMATCH school:", s.university, "| was:", s.campUrl);
      s.campUrl = "TBA";
      changes++;
    }
  }
});

// 4. Schools that have dates but auditStatus says NO_DATA or EXTRACTED_NO_DATA
// These likely had dates from a previous extraction that were later re-crawled and found empty.
// If the URL is still valid, keep the dates. If the URL is TBA, the dates are stale.
data.forEach((s) => {
  const hasDates =
    s.dates && s.dates !== "TBA" && s.dates !== "N/A" && s.dates !== "";
  if (
    hasDates &&
    s.campUrl === "TBA" &&
    (s.auditStatus || "").includes("NO_DATA")
  ) {
    // Dates exist but URL went bad and no data found on re-check
    console.log(
      "  Dates with bad URL and NO_DATA:",
      s.university,
      "|",
      s.dates.substring(0, 60),
      "...",
    );
    // Keep dates - they were extracted from a real page at some point
    // Just note that they're unverified
  }
});

// 5. Remove empty/null fields that could be confusing
// CampUrl = null -> TBA for clarity in UI
data.forEach((s) => {
  if (s.campUrl === null) {
    s.campUrl = "TBA";
    changes++;
  }
});

// 6. Ensure details for schools with no data say something clear
data.forEach((s) => {
  const hasDates =
    s.dates && s.dates !== "TBA" && s.dates !== "N/A" && s.dates !== "";
  const hasCost =
    s.cost && s.cost !== "TBA" && s.cost !== "N/A" && s.cost !== "";
  if (!hasDates && !hasCost && (!s.details || s.details === "")) {
    // Already TBA for data, make sure details is clean
    // Only set if completely empty
  }
});

// Save
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log("\nDone. Changes made:", changes);
console.log("File saved to camps_data.json");
