/**
 * Price Integrity Test — validates that no camp has suspiciously low prices
 * Run BEFORE any push/deploy to catch bad extraction data.
 *
 * Usage: node src/tests/test_price_integrity.js
 * Usage: node src/tests/test_price_integrity.js --fix (auto-replaces bad prices with "TBA")
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const DATA_PATH = path.resolve(__dirname, "../../camps_data.json");
const { PRICE_THRESHOLDS } = require("../utils/config.js");
const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

const fixMode = process.argv.includes("--fix");
const violations = [];

data.forEach((school, schoolIdx) => {
  // Skip manually browser-verified records — prices confirmed by human crawl
  if (school.isVerified === true) return;
  if (school.auditStatus && school.auditStatus.startsWith("VERIFIED_BROWSER"))
    return;

  // Check campTiers
  if (school.campTiers && Array.isArray(school.campTiers)) {
    school.campTiers.forEach((tier, tierIdx) => {
      if (!tier.cost || tier.cost === "TBA") return;

      // Skip FREE costs
      if (tier.cost.toLowerCase().includes("free")) return;

      // Extract ALL dollar amounts from the cost string
      const prices = (tier.cost.match(/\$?[\d,]+(?:\.\d{2})?/g) || []).map(
        (p) => parseFloat(p.replace(/[\$,]/g, "")),
      );

      if (prices.length === 0) return;

      // Flag bare numbers (no $ prefix) — should never happen
      const hasDollar = /\$/.test(tier.cost);
      if (!hasDollar) {
        violations.push({
          school: school.university,
          tier: tier.name,
          cost: tier.cost,
          minPrice: Math.min(...prices),
          level: "MISSING_DOLLAR",
          url: school.campUrl || "N/A",
          field: "campTiers",
          schoolIdx,
          tierIdx,
        });
      }

      const minPrice = Math.min(...prices.filter((p) => !isNaN(p)));

      if (minPrice >= 0 && minPrice < PRICE_THRESHOLDS.VERIFY_MANUALLY) {
        let level =
          minPrice < PRICE_THRESHOLDS.CRITICAL_ANOMALY
            ? "CRITICAL"
            : minPrice < PRICE_THRESHOLDS.SUSPICIOUS_LOW
              ? "SUSPICIOUS"
              : "VERIFY";

        violations.push({
          school: school.university,
          tier: tier.name,
          cost: tier.cost,
          minPrice: minPrice,
          level: level,
          url: school.campUrl || "N/A",
          field: "campTiers",
          schoolIdx,
          tierIdx,
        });
      }
    });
  }

  // Check top-level cost field
  if (school.cost && school.cost !== "TBA" && school.cost.trim() !== "") {
    // Check for bare numbers (digits without $ prefix)
    const bareNumberMatch = school.cost.match(/\b\d[,.\d]*/);
    const hasDollarSign = /\$/.test(school.cost);
    let prices = [];

    // Extract dollar amounts if present
    prices = (school.cost.match(/\$[\d,]+(?:\.\d{2})?/g) || []).map((p) =>
      parseFloat(p.replace(/[\$,]/g, "")),
    );

    // If no $ prices but bare numbers found, extract them too
    if (prices.length === 0 && bareNumberMatch) {
      prices = (school.cost.match(/\b[\d,]+(?:\.\d{2})?/g) || []).map((p) =>
        parseFloat(p.replace(/[\$,]/g, "")),
      );
    }

    if (prices.length > 0) {
      const minPrice = Math.min(...prices.filter((p) => !isNaN(p)));
      if (minPrice < PRICE_THRESHOLDS.VERIFY_MANUALLY) {
        let level =
          minPrice < PRICE_THRESHOLDS.CRITICAL_ANOMALY
            ? "CRITICAL"
            : minPrice < PRICE_THRESHOLDS.SUSPICIOUS_LOW
              ? "SUSPICIOUS"
              : "VERIFY";

        violations.push({
          school: school.university,
          tier: "top-level",
          cost: school.cost,
          minPrice: minPrice,
          level: level,
          url: school.campUrl || "N/A",
          field: "cost",
          schoolIdx,
        });
      }

      // Flag bare numbers even if prices seem reasonable
      if (!hasDollarSign && bareNumberMatch) {
        violations.push({
          school: school.university,
          tier: "top-level",
          cost: school.cost,
          minPrice: minPrice,
          level: "MISSING_DOLLAR",
          url: school.campUrl || "N/A",
          field: "cost",
          schoolIdx,
        });
      }
    }
  }
});

if (violations.length > 0) {
  console.log("\n PRICE INTEGRITY VIOLATIONS DETECTED");
  console.log("=============================================");
  violations.forEach((v, i) => {
    console.log(
      `  ${i + 1}. [${v.level}] ${v.school} ("${v.tier}") — cost: "${v.cost}" | url: ${v.url}`,
    );
  });

  const hasCritical = violations.some(
    (v) =>
      v.level === "CRITICAL" ||
      v.level === "SUSPICIOUS" ||
      v.level === "MISSING_DOLLAR",
  );

  if (fixMode) {
    console.log("\n AUTO-FIX MODE: Processing suspicious prices...");
    violations.forEach((v) => {
      const isCriticalAnomaly = v.level === "CRITICAL";

      if (isCriticalAnomaly) {
        data[v.schoolIdx].campTiers = [];
        data[v.schoolIdx].cost = "TBA";
        data[v.schoolIdx].campDates = "TBA";
        data[v.schoolIdx].isChecked = false;
        data[v.schoolIdx].auditStatus = "PRICE_ANOMALY";
      } else if (v.level === "MISSING_DOLLAR") {
        if (v.field === "cost") {
          data[v.schoolIdx].cost = data[v.schoolIdx].cost
            .split("|")
            .map((p) => p.trim())
            .map((p) => (/^\d/.test(p) ? `$${p}` : p))
            .join(" | ");
        } else if (v.field === "campTiers") {
          const c = data[v.schoolIdx].campTiers[v.tierIdx].cost;
          if (/^\d/.test(c))
            data[v.schoolIdx].campTiers[v.tierIdx].cost = `$${c}`;
        }
      }
    });
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    console.log(`\n Fixed ${violations.length} entries in camps_data.json`);
    process.exit(0);
  } else {
    console.log(
      `\n Found ${violations.length} suspicious prices under $${PRICE_THRESHOLDS.VERIFY_MANUALLY}.`,
    );
    if (hasCritical) {
      console.log(" ❌ CRITICAL violations found. Blocking pipeline.");
      process.exit(1);
    } else {
      console.log(" ✅ All violations are [VERIFY] level. Proceeding.");
      process.exit(0);
    }
  }
} else {
  console.log("\n Price Integrity: PASSED");
  process.exit(0);
}
