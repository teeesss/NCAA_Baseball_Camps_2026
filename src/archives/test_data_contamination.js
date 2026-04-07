/**
 * Data Contamination Test — scans camps_data.json for cross-school email leaks.
 *
 * Catches cases like Florida State having gatorsbaseballcamps@ufl.edu.
 * Builds a .edu domain → school ownership index from the data itself,
 * then flags any school whose email domain belongs to a DIFFERENT school.
 *
 * Usage: node src/tests/test_data_contamination.js
 * Usage: node src/tests/test_data_contamination.js --fix
 */
const fs = require("fs");
const path = require("path");

const DATA_PATH = path.resolve(__dirname, "../../camps_data.json");
const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

const fixMode = process.argv.includes("--fix");
const violations = [];

// Build a school → owned .edu domains index
const schoolDomains = {};
data.forEach((school) => {
  if (!school.email || school.email === "N/A") return;
  if (!school.email.includes("@") || !school.email.includes(".edu")) return;
  const domain = school.email.split("@")[1].toLowerCase();
  if (!schoolDomains[school.university])
    schoolDomains[school.university] = new Set();
  schoolDomains[school.university].add(domain);
});

// For each school, check if its email/contact/campPOC fields contain
// a .edu domain that belongs to a DIFFERENT school
data.forEach((school, idx) => {
  const schoolShort = school.university
    .toLowerCase()
    .replace(/\s*(university|college|state)\s*/gi, "")
    .trim();

  // Fields to check for embedded email domains
  ["email", "campPOC", "contact", "headCoach"].forEach((field) => {
    const value = school[field];
    if (!value || value === "N/A" || value === "TBA") return;
    if (typeof value !== "string") return;

    const emailMatch = value.match(/@([a-zA-Z0-9.-]+\.[a-z]{2,})/);
    if (!emailMatch) return;

    const domain = emailMatch[1].toLowerCase();
    // Skip generic email providers
    if (
      ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"].includes(domain)
    )
      return;

    // Check if this domain is owned by ANOTHER school
    Object.entries(schoolDomains).forEach(([owner, domains]) => {
      if (owner === school.university) return;
      if (!domains.has(domain)) return;

      // Skip substring pairs (Alabama / Alabama State)
      const ownerShort = owner
        .toLowerCase()
        .replace(/\s*(university|college|state)\s*/gi, "")
        .trim();
      if (schoolShort.includes(ownerShort) || ownerShort.includes(schoolShort))
        return;

      const alreadyCaught = violations.some(
        (v) => v.idx === idx && v.field === field && v.contaminatedBy === owner,
      );
      if (!alreadyCaught) {
        violations.push({
          school: school.university,
          field,
          value,
          contaminatedBy: owner,
          domain,
          idx,
        });
      }
    });
  });
});

if (violations.length > 0) {
  console.log("\n DATA CONTAMINATION VIOLATIONS DETECTED");
  console.log("===============================================");
  violations.forEach((v, i) => {
    console.log(
      `  ${i + 1}. ${v.school} (${v.field}): "${v.value}" — contaminated by: ${v.contaminatedBy} (domain: ${v.domain})`,
    );
  });

  if (fixMode) {
    console.log(
      "\n AUTO-FIX MODE: Replacing contaminated fields with 'N/A'...",
    );
    const seen = new Set();
    violations.forEach((v) => {
      const key = `${v.idx}-${v.field}`;
      if (!seen.has(key)) {
        data[v.idx][v.field] = "N/A";
        data[v.idx].updateLog = data[v.idx].updateLog || [];
        data[v.idx].updateLog.push(
          `Data contamination fix: removed ${v.field} "${v.value}" (domain ${v.domain} belongs to ${v.contaminatedBy})`,
        );
        seen.add(key);
      }
    });
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    console.log(`\n Fixed ${seen.size} fields in camps_data.json`);
  } else {
    console.log(`\n Found ${violations.length} cross-contaminated fields.`);
    console.log(" Run with --fix to auto-remove:");
    console.log("   node src/tests/test_data_contamination.js --fix");
  }
  process.exit(1);
} else {
  console.log("\n Data Contamination Check: PASSED");
  console.log(
    `   (Checked ${data.length} schools, no cross-school contamination found)`,
  );
  process.exit(0);
}
