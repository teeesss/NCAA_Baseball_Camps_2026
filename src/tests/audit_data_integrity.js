/**
 * Comprehensive data audit for camps_data.json
 * Checks for: missing $ signs, date issues, missing fields, anomalies
 */

const data = require("../../camps_data.json");
const fs = require("fs");
const path = require("path");

const issues = {
  missingDollar: [],
  datesInJSONNotTBA: [],
  datesWithMissingCommas: [],
  missingUniversity: [],
  missingConference: [],
  suspectEmails: [],
  suspectCoachNames: [],
  extremelyLongDetails: [],
  veryLongUpdateLogs: [],
  emptyDatesNoTBA: [],
  campTiersWithOddCosts: [],
  emptySourceUrls: [],
  missingScriptVersion: [],
  missingConfidence: [],
  divisionMismatch: [],
  urlStatusFailed: [],
  emptyStrings: [],
  duplicateUniveristies: [],
  suspiciousPrices: [],
  missingCommasInDatesContent: [],
  dateFormatsInconsistent: [],
  emptyEmailOrContact: [],
  conflictingFields: [],
};

const uniCounts = {};

for (let i = 0; i < data.length; i++) {
  const s = data[i];
  const idx = i;
  const uni = s.university || "UNKNOWN";

  // Duplicate check
  if (!uniCounts[uni]) uniCounts[uni] = [];
  uniCounts[uni].push(idx);

  // Missing dollar sign in cost (but not TBA or empty)
  if (s.cost && s.cost !== "TBA" && s.cost !== "" && s.cost !== "N/A") {
    if (!s.cost.trim().startsWith("$") && !s.cost.trim().startsWith("Free")) {
      issues.missingDollar.push({ idx, uni, cost: s.cost });
    }
  }

  // Costs that are just numbers
  if (/^\d+(\.\d+)?$/.test(s.cost)) {
    issues.missingDollar.push({
      idx,
      uni,
      cost: s.cost,
      note: "bare number, no $",
    });
  }

  // Dates that exist but are more than just "TBA"
  if (
    s.campDates &&
    s.campDates !== "TBA" &&
    s.campDates !== "" &&
    s.campDates !== "N/A"
  ) {
    issues.datesInJSONNotTBA.push({
      idx,
      uni,
      dates: truncate(s.campDates, 120),
    });
  }

  // Missing commas in date strings
  if (s.campDates && typeof s.campDates === "string") {
    // Check for missing commas like "June 5 2026" instead of "June 5, 2026"
    if (
      /^[A-Z][a-z]+ \d{1,2} \d{4}/.test(s.campDates) &&
      !s.campDates.includes(",")
    ) {
      issues.missingCommasInDatesContent.push({ idx, uni, dates: s.campDates });
    }
    // Check for patterns like "Jun 12 - 13 2026" missing comma before year
    if (
      /\d{1,2} \d{4}/.test(s.campDates) &&
      !/\d{1,2}, \d{4}/.test(s.campDates)
    ) {
      // Could be "15 2026" missing comma
    }
  }

  // Missing university
  if (!s.university || s.university === "") {
    issues.missingUniversity.push({ idx });
  }

  // Missing or empty conference
  if (!s.conference || s.conference === "") {
    issues.missingConference.push({ idx, uni });
  }

  // Suspect emails
  if (s.email && s.email !== "N/A" && s.email !== "") {
    const e = s.email.toLowerCase();
    if (!e.includes("@")) {
      issues.suspectEmails.push({
        idx,
        uni,
        email: s.email,
        issue: "no @ sign",
      });
    }
    if (e.includes(" ") && !e.includes("|")) {
      issues.suspectEmails.push({
        idx,
        uni,
        email: s.email,
        issue: "has spaces but no | separator",
      });
    }
    // Multiple emails separated incorrectly
    if (e.split("@").length > 2) {
      issues.suspectEmails.push({
        idx,
        uni,
        email: s.email,
        issue: "multiple @ signs",
      });
    }
  }

  // Suspect coach names
  if (s.headCoach && s.headCoach !== "N/A" && s.headCoach !== "") {
    if (s.headCoach.includes("@")) {
      issues.suspectCoachNames.push({
        idx,
        uni,
        coach: s.headCoach,
        issue: "contains email",
      });
    }
    if (s.headCoach.length < 3) {
      issues.suspectCoachNames.push({
        idx,
        uni,
        coach: s.headCoach,
        issue: "too short",
      });
    }
  }

  // Extremely long details (could be HTML dump)
  if (s.details && s.details.length > 500) {
    issues.extremelyLongDetails.push({
      idx,
      uni,
      detailsLen: s.details.length,
      preview: truncate(s.details, 100),
    });
  }

  // Very long update log
  if (s.updateLog && s.updateLog.length > 5) {
    issues.veryLongUpdateLogs.push({ idx, uni, logCount: s.updateLog.length });
  }

  // Empty dates (not even TBA)
  if (s.campDates === "" || s.campDates === undefined) {
    issues.emptyDatesNoTBA.push({ idx, uni });
  }

  // Camp tiers with odd costs
  if (s.campTiers && Array.isArray(s.campTiers)) {
    for (const tier of s.campTiers) {
      if (
        tier.cost &&
        !String(tier.cost).startsWith("$") &&
        tier.cost !== "TBA"
      ) {
        issues.campTiersWithOddCosts.push({
          idx,
          uni,
          tier: tier.name,
          cost: tier.cost,
        });
      }
      // Check for $1 prices (bogus)
      if (tier.cost === "$1" || tier.cost === 1) {
        issues.suspiciousPrices.push({
          idx,
          uni,
          tier: tier.name,
          cost: tier.cost,
        });
      }
    }
  }

  // Top-level cost of $1
  if (String(s.cost).trim() === "$1" || s.cost === 1) {
    issues.suspiciousPrices.push({ idx, uni, cost: s.cost });
  }

  // Empty sourceUrls
  if (!s.sourceUrl || s.sourceUrl === "") {
    issues.emptySourceUrls.push({ idx, uni });
  }

  // Missing scriptVersion
  if (s.scriptVersion === undefined || s.scriptVersion === null) {
    issues.missingScriptVersion.push({ idx, uni });
  }

  // Missing confidenceScore
  if (s.confidenceScore === undefined || s.confidenceScore === null) {
    issues.missingConfidence.push({ idx, uni });
  }

  // Failed URL status
  if (s._urlStatus && s._urlStatus !== "LIVE") {
    issues.urlStatusFailed.push({ idx, uni, status: s._urlStatus });
  }

  // Empty strings where N/A would be better (campPOCEmail can be empty if no email found)
  if (s.campPOCEmail === "" && s.campPOCEmail === undefined) {
    issues.emptyStrings.push({ idx, uni, field: "campPOCEmail" });
  }

  // Check if dates exist but details say something contradictory
  if (
    s.campDates &&
    s.campDates !== "TBA" &&
    s.details &&
    s.details.toLowerCase().includes("no 2026 camp")
  ) {
    issues.conflictingFields.push({
      idx,
      uni,
      dates: s.campDates,
      detailsPreview: truncate(s.details, 80),
    });
  }

  // Date format check - look for dates without proper formatting
  if (
    s.campDates &&
    typeof s.campDates === "string" &&
    s.campDates !== "TBA" &&
    s.campDates !== "N/A"
  ) {
    // Check for single date with no year
    if (/^\d{1,2}\/\d{1,2}$/.test(s.campDates)) {
      issues.dateFormatsInconsistent.push({
        idx,
        uni,
        dates: s.campDates,
        issue: "missing year",
      });
    }
    // Check for date ranges without separator
    if (/\d{4}\d{4}/.test(s.campDates)) {
      issues.dateFormatsInconsistent.push({
        idx,
        uni,
        dates: s.campDates,
        issue: "years concatenated",
      });
    }
  }

  // Check for price ranges that look odd (e.g., "$0")
  if (
    s.cost === "$0" ||
    s.cost === "$" ||
    s.cost === "TBD" ||
    s.cost === "tbd"
  ) {
    issues.suspiciousPrices.push({ idx, uni, cost: s.cost, field: "cost" });
  }

  // Check updateLog for contamination
  if (s.updateLog) {
    for (const log of s.updateLog) {
      if (log.length > 300) {
        issues.veryLongUpdateLogs.push({
          idx,
          uni,
          logLen: log.length,
          note: "single log entry very long",
        });
      }
      // Check if update log contains raw HTML or page content
      if (log.includes("<") && log.includes(">")) {
        issues.extremelyLongDetails.push({
          idx,
          uni,
          note: "updateLog contains HTML-like content",
          preview: truncate(log, 100),
        });
      }
    }
  }
}

// Check for duplicate universities
for (const [uni, indices] of Object.entries(uniCounts)) {
  if (indices.length > 1) {
    issues.duplicateUniveristies.push({ uni, indices });
  }
}

// Print results
function printSection(title, items) {
  if (items.length === 0) return;
  process.stdout.write(`\n${"=".repeat(80)}\n`);
  process.stdout.write(`${title} (${items.length} found)\n`);
  process.stdout.write("=".repeat(80) + "\n\n");
  for (const item of items) {
    process.stdout.write(`  [${item.idx}] ${item.uni || item.note || ""}\n`);
    for (const [key, val] of Object.entries(item)) {
      if (key !== "idx" && key !== "uni" && key !== "note") {
        process.stdout.write(`    ${key}: ${val}\n`);
      }
    }
  }
  process.stdout.write("\n");
}

process.stdout.write(`\nAudit complete: ${data.length} entries scanned`);
process.stdout.write(`\n${new Date().toISOString()}\n`);

printSection("MISSING $ IN COST", issues.missingDollar);
printSection("DATES BEYOND TBA IN JSON", issues.datesInJSONNotTBA);
printSection("MISSING COMMAS IN DATES", issues.missingCommasInDatesContent);
printSection("MISSING UNIVERSITY", issues.missingUniversity);
printSection("MISSING CONFERENCE", issues.missingConference);
printSection("SUSPECT EMAILS", issues.suspectEmails);
printSection("SUSPECT COACH NAMES", issues.suspectCoachNames);
printSection(
  "EXTREMELY LONG DETAILS (>500 chars)",
  issues.extremelyLongDetails,
);
printSection("VERY LONG UPDATE LOGS", issues.veryLongUpdateLogs);
printSection("EMPTY DATES (NOT EVEN TBA)", issues.emptyDatesNoTBA);
printSection("CAMP TIERS WITH ODD COSTS", issues.campTiersWithOddCosts);
printSection("SUSPICIOUS PRICES ($1, $0, empty)", issues.suspiciousPrices);
printSection("EMPTY SOURCE URLS", issues.emptySourceUrls);
printSection("MISSING SCRIPT VERSION", issues.missingScriptVersion);
printSection("MISSING CONFIDENCE SCORE", issues.missingConfidence);
printSection("DIVISION MISMATCH", issues.divisionMismatch);
printSection("FAILED URL STATUS", issues.urlStatusFailed);
printSection("EMPTY STRINGS FIELDS", issues.emptyStrings);
printSection("CONFLICTING FIELDS (dates vs details)", issues.conflictingFields);
printSection("INCONSISTENT DATE FORMATS", issues.dateFormatsInconsistent);
printSection("DUPLICATE UNIVERSITIES", issues.duplicateUniveristies);

// Also check for entries where campDates exists but generate_html might not show them
process.stdout.write("\n\n" + "=".repeat(80) + "\n");
process.stdout.write(
  "DATE RENDERING CHECK: entries with campDates that should appear in UI\n",
);
process.stdout.write("=".repeat(80) + "\n\n");

const realDates = data.filter(
  (s) =>
    s.campDates &&
    s.campDates !== "TBA" &&
    s.campDates !== "" &&
    s.campDates !== "N/A" &&
    s.campDates !== "No 2026 camps posted as of April 2026" &&
    !s.campDates.toLowerCase().includes("no information"),
);

process.stdout.write(
  `Found ${realDates.length} entries with actual camp dates:\n\n`,
);
for (const s of realDates) {
  const idx = data.indexOf(s);
  process.stdout.write(
    `  [${idx}] ${s.university}: ${truncate(s.campDates, 100)}\n`,
  );
}

// Check for campTiers that have dates
const tiersWithDates = data.filter(
  (s) =>
    s.campTiers &&
    Array.isArray(s.campTiers) &&
    s.campTiers.some((t) => t.dates && t.dates !== "TBA"),
);

process.stdout.write(
  `\nFound ${tiersWithDates.length} entries with dates in campTiers:\n\n`,
);
for (const s of tiersWithDates) {
  const idx = data.indexOf(s);
  const activeTiers = s.campTiers.filter((t) => t.dates && t.dates !== "TBA");
  process.stdout.write(
    `  [${idx}] ${s.university}: ${JSON.stringify(activeTiers.map((t) => ({ name: t.name, dates: t.dates })))}\n`,
  );
}

function truncate(str, maxLen) {
  if (!str) return "";
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + "...";
}
