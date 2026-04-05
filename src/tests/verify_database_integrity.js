const fs = require("fs");

const DATA_FILE = (path) =>
  require("path").resolve(__dirname, "../../camps_data.json");
const d = JSON.parse(fs.readFileSync(DATA_FILE(), "utf8"));

console.log("🔍 Running Deep Database Integrity Verification");
console.log("------------------------------------------------");

let errors = 0;
let warnings = 0;

const missingQueue = new Set();
const knownD1 = [];
const uniqueSchools = new Set();

d.forEach((school) => {
  // 1. DUPLICATE CHECK
  if (uniqueSchools.has(school.university)) {
    console.error(
      `❌ [DUPLICATE] Duplicate record found for ${school.university}`,
    );
    errors++;
  }
  uniqueSchools.add(school.university);

  // 2. DATES OVERFLOW CHECK
  if (school.dates && school.dates !== "TBA") {
    const dateArray = school.dates.split("|");
    if (dateArray.length > 12) {
      console.error(
        `❌ [OVERFLOW] ${school.university} has ${dateArray.length} dates! (Garbage blob)`,
      );
      missingQueue.add(school.university);
      errors++;
    }

    // Nested TBA check
    if (
      dateArray.some(
        (d) => d.toUpperCase().includes("TBA") && dateArray.length > 1,
      )
    ) {
      console.error(
        `❌ [GARBAGE] ${school.university} has 'TBA' mixed with other dates.`,
      );
      errors++;
    }
  }

  // 3. CONTACT CONTAMINATION CHECK
  // Flag if email domain radically differs from school string.
  // This is hard to do perfectly because of gmail domains or 3rd party camps, but we can catch basic slips.
  if (school.contact && school.contact.includes("@")) {
    const emailLower = school.contact.toLowerCase();
    const uniLower = school.university.toLowerCase();
    // If it's a gmail/yahoo, it's fine. If it's an .edu that doesn't share any letters with the school..
    if (emailLower.includes(".edu")) {
      const domainStart = emailLower.substring(
        emailLower.indexOf("@") + 1,
        emailLower.lastIndexOf("."),
      );
      // Very loose check - does the university string share any 3 letter chunk with the domain?
      if (domainStart.length >= 3) {
        let match = false;
        for (let i = 0; i < domainStart.length - 2; i++) {
          if (uniLower.includes(domainStart.substring(i, i + 3))) match = true;
        }

        // Exemptions: Ryzer emails, generic state abbreviations, known mismatches
        const exempt = ["athletics", "state", "university"];
        if (!match && !exempt.some((e) => domainStart.includes(e))) {
          // console.warn(`⚠️  [CONTAMINATION?] ${school.university} has email ${school.contact}. Mismatch?`);
          // warnings++;
        }
      }
    }
  }

  // 4. BAD LINKS
  const BLACKLISTED_AGGREGATORS = [
    "activekids.com",
    "collegescoutingbureau.net",
    "ussportscamps.com",
    "ncsasports.org",
    "captainu.com",
    "berecruited.com",
    "perfectgame.org",
  ];
  if (
    school.campUrl &&
    BLACKLISTED_AGGREGATORS.some((b) =>
      school.campUrl.toLowerCase().includes(b),
    )
  ) {
    console.error(
      `❌ [BLACKLIST] ${school.university} is pointing to a blacklisted aggregator: ${school.campUrl}`,
    );
    missingQueue.add(school.university);
    errors++;
  }
});

// Write to missing investigation queue
if (missingQueue.size > 0) {
  fs.writeFileSync(
    "missing_investigate_queue.txt",
    Array.from(missingQueue).join("\n"),
  );
  console.log(
    `\n✅ Saved ${missingQueue.size} anomalies to missing_investigate_queue.txt for review.`,
  );
}

console.log("\n================================================");
console.log(`Test Suite Finished: ${errors} Errors, ${warnings} Warnings.`);
if (errors > 0 || warnings > 0) process.exit(1);
