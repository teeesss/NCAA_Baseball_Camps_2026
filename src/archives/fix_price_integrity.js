/**
 * Price Integrity Fix — patches all suspicious low prices permanently
 * Usage: node src/tests/fix_price_integrity.js
 */
const fs = require("fs");
const path = require("path");

const DATA_PATH = path.resolve(__dirname, "../../camps_data.json");

let data;
try {
  data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
} catch (e) {
  console.error("Failed to read camps_data.json:", e.message);
  process.exit(1);
}

let fixed = 0;

data.forEach((school) => {
  let schoolFixed = false;

  // Helper to safely check if cost is suspiciously low
  function fixCost(obj, field) {
    if (!obj[field] || obj[field] === "TBA") return false;
    const prices = (obj[field].match(/\$[\d,]+(?:\.\d{2})?/g) || []).map((p) =>
      parseFloat(p.replace(/[\$,]/g, "")),
    );
    if (prices.length === 0) return false;
    const minPrice = Math.min(...prices.filter((p) => !isNaN(p)));
    if (minPrice >= 0 && minPrice < 5) {
      obj[field] = "TBA";
      school.updateLog = school.updateLog || [];
      school.updateLog.push(
        `Price integrity fix: replaced suspicious cost "${obj[field]}" with TBA (under $5)`,
      );
      return true;
    }
    return false;
  }

  if (school.campTiers && Array.isArray(school.campTiers)) {
    school.campTiers.forEach((tier) => {
      if (fixCost(tier, "cost")) {
        schoolFixed = true;
      }
    });
  }

  if (fixCost(school, "cost")) {
    schoolFixed = true;
  }

  if (schoolFixed) fixed++;
});

fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

console.log(`\n Fixed ${fixed} schools in camps_data.json`);
console.log(" Prices under $5 replaced with 'TBA'");
console.log(" Re-run: node src/tests/test_price_integrity.js to verify");
console.log(" Then: node generate_html.js to regenerate the UI");
