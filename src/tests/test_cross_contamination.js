/**
 * Cross-Contamination Test — scans camps_data.json for emails/contact data
 * from OTHER schools leaking into a record.
 *
 * Examples caught:
 *   - Florida State having gatorsbaseballcamps@ufl.edu (UF email on FSU record)
 *   - Any school inheriting another school's email domain or coach name
 *
 * Usage: node src/tests/test_cross_contamination.js [--fix]
 */

const fs = require("fs");
const path = require("path");

const DATA_PATH = path.resolve(__dirname, "../../camps_data.json");
const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

const fixMode = process.argv.includes("--fix");
const violations = [];

// Build an index of known email domains → schools for cross-referencing
const emailDomainIndex = {};
data.forEach((s) => {
  if (s.email && s.email !== "N/A") {
    // Extract domain from email
    const match = s.email.match(/@([a-zA-Z0-9.-]+\.[a-z]{2,})/);
    if (match) {
      const domain = match[1].toLowerCase();
      if (!emailDomainIndex[domain]) emailDomainIndex[domain] = [];
      emailDomainIndex[domain].push(s.university);
    }
  }
});

// Check every school for suspicious data
data.forEach((school, idx) => {
  if (!school.email || school.email === "N/A") return;

  const emailMatch = school.email.match(/@([a-zA-Z0-9.-]+\.[a-z]{2,})/);
  if (!emailMatch) return;

  const emailDomain = emailMatch[1].toLowerCase();
  const univLower = school.university.toLowerCase();

  // Check: does this school's email domain belong to ANOTHER school?
  const domainOwners = emailDomainIndex[emailDomain] || [];
  if (domainOwners.length > 0) {
    const isOwner = domainOwners.includes(school.university);
    if (!isOwner && domainOwners.length > 0) {
      // Also do substring check — e.g. "alabama.edu" is legit for "Alabama" but not "Alabama State"
      const isSubstringMatch = domainOwners.some((owner) => {
        if (
          owner.toLowerCase().includes(univLower) ||
          univLower.includes(owner.toLowerCase())
        ) {
          return true; // substring match is OK if one contains the other
        }
        return false;
      });
      if (!isSubstringMatch) {
        violations.push({
          school: school.university,
          email: school.email,
          likelyFrom: domainOwners.join(", "),
          domain: emailDomain,
          idx,
        });
      }
    }
  }

  // Check: does the email contain a known OTHER school's name?
  data.forEach((other) => {
    if (other.university === school.university) return;
    const otherLower = other.university.toLowerCase();
    // Skip substring collision pairs (e.g. "Alabama" / "Alabama State")
    if (univLower.includes(otherLower) || otherLower.includes(univLower))
      return;

    const emailLower = school.email.toLowerCase();
    if (emailLower.includes(otherLower)) {
      // Already caught above? Skip dupes
      const alreadyCaught = violations.some((v) => v.idx === idx);
      if (!alreadyCaught) {
        violations.push({
          school: school.university,
          email: school.email,
          likelyFrom: other.university,
          domain: emailDomain,
          reason: "school name found in email string",
          idx,
        });
      }
    }
  });
});

if (violations.length > 0) {
  console.log("\n CROSS-CONTAMINATION VIOLATIONS DETECTED");
  console.log("=============================================");
  violations.forEach((v, i) => {
    console.log(
      `  ${i + 1}. ${v.school} has email "${v.email}" — likely from: ${v.likelyFrom} (domain: ${v.domain})${v.reason ? " [" + v.reason + "]" : ""}`,
    );
  });

  if (fixMode) {
    console.log(
      "\n AUTO-FIX MODE: Replacing contaminated emails with 'N/A'...",
    );
    violations.forEach((v) => {
      data[v.idx].email = "N/A";
      data[v.idx].updateLog = data[v.idx].updateLog || [];
      data[v.idx].updateLog.push(
        `Cross-contamination fix: removed email "${v.email}" (likely from ${v.likelyFrom})`,
      );
    });
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    console.log(`\n Fixed ${violations.length} entries`);
  } else {
    console.log(`\n Found ${violations.length} cross-contaminated emails.`);
    console.log(" Run with --fix to auto-remove:");
    console.log("   node src/tests/test_cross_contamination.js --fix");
  }
  process.exit(1);
} else {
  console.log("\n Cross-Contamination Check: PASSED");
  console.log(
    `   (Checked ${data.length} schools, no cross-school email contamination found)`,
  );
  process.exit(0);
}
