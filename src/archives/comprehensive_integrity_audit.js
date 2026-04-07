const fs = require("fs");

const DATA_FILE = "x:/NCAA-DivisonI-Baseball-Camps-2026/camps_data.json";
const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

console.log("--- COMPREHENSIVE INTEGRITY AUDIT ---");
console.log(`Total Schools: ${data.length}`);

let issues = [];

// 1. Schools with NO URL but dates/costs (Legacy cleanup)
const soupless = data.filter(
  (x) =>
    !x.campUrl &&
    x.cost &&
    x.cost !== "TBA" &&
    x.cost !== "Contact for pricing",
);
if (soupless.length) {
  issues.push(
    `CRITICAL: Found ${soupless.length} schools with prices but no Source URL: ${soupless.map((x) => x.university).join(", ")}`,
  );
}

// 2. Schools with NO LOGO and NO DOMAIN (Hard fallback issues)
const noVisual = data.filter((x) => !x.logoFile && !x.logoDomain);
if (noVisual.length) {
  issues.push(
    `UI: ${noVisual.length} schools have no logo domain (favicons won't work). Found for: ${noVisual
      .slice(0, 5)
      .map((x) => x.university)
      .join(", ")}`,
  );
}

// 3. Checked but empty (Possible Extraction Failure)
const checkedEmpty = data.filter(
  (x) => x.isChecked && x.dates === "TBA" && (!x.cost || x.cost === "TBA"),
);
if (checkedEmpty.length) {
  issues.push(
    `DATA: ${checkedEmpty.length} schools are 'isChecked' but have NO dates or costs. (May need Phase 3 auditing).`,
  );
}

// 4. Duplicate Universities
const counts = {};
data.forEach((x) => {
  counts[x.university] = (counts[x.university] || 0) + 1;
});
const dups = Object.keys(counts).filter((k) => counts[k] > 1);
if (dups.length) {
  issues.push(`STRUCTURE: Duplicate universities found: ${dups.join(", ")}`);
}

// 5. Malformed/Generic Emails
const genericEmails = data.filter(
  (x) =>
    x.contact &&
    /gmail\.com|hotmail\.com|ryzer\.com/i.test(x.contact) &&
    !x.contact.includes("|"),
);
if (genericEmails.length) {
  issues.push(
    `CONTACT: ${genericEmails.length} schools have non-edu emails as primary contact (risk of generic portal capture).`,
  );
}

// 6. Character corruption
const corrupt = data.filter(
  (x) => x.cost && (x.cost.includes("") || x.cost.includes("\n")),
);
if (corrupt.length) {
  issues.push(
    `CLEANUP: Found ${corrupt.length} entries with character corruption or newlines in pricing.`,
  );
}

console.log("\n--- AUDIT RESULTS ---");
if (issues.length === 0) {
  console.log("✅ All high-level integrity checks passed!");
} else {
  issues.forEach((msg) => console.log("⚠️ " + msg));
  console.log(
    "\nRecommendation: Run scrubbing scripts or re-audit specified programs.",
  );
}
