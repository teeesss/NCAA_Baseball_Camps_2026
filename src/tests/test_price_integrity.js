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

  if (fixMode) {
    console.log("\n AUTO-FIX MODE: Processing suspicious prices...");
    const reextractSchools = new Set();

    violations.forEach((v) => {
      // If the price is exactly $1, it's 99% likely the entire page/data is highly erroneous.
      // Purge the extracted data and re-queue the school for fresh extraction.
      const isCriticalAnomaly = v.level === "CRITICAL";

      if (isCriticalAnomaly) {
        data[v.schoolIdx].campTiers = [];
        data[v.schoolIdx].cost = "TBA";
        data[v.schoolIdx].campDates = "TBA";
        data[v.schoolIdx].details =
          "Data purged due to critical anomaly (found $1 pricing artifact). Re-queueing.";
        data[v.schoolIdx].auditStatus = "PRICE_ANOMALY";
        data[v.schoolIdx].isChecked = false;
        data[v.schoolIdx].isVerified = false;
        data[v.schoolIdx].updateLog = data[v.schoolIdx].updateLog || [];
        data[v.schoolIdx].updateLog.push(
          `Critical Price Anomaly: Found $1 cost. Purged all data and forced re-queue for next scraper run.`,
        );
        reextractSchools.add(v.school);
      } else if (v.level === "MISSING_DOLLAR") {
        // Add $ prefix to bare numbers in cost field
        if (
          v.field === "cost" &&
          data[v.schoolIdx].cost &&
          data[v.schoolIdx].cost !== "TBA"
        ) {
          data[v.schoolIdx].cost = data[v.schoolIdx].cost
            .split("|")
            .map((p) => p.trim())
            .map((p) => (/^\d/.test(p) ? `$${p}` : p))
            .join(" | ");
          data[v.schoolIdx].updateLog = data[v.schoolIdx].updateLog || [];
          data[v.schoolIdx].updateLog.push(
            `Price integrity fix: Added $ prefix to bare numbers in cost field.`,
          );
        } else if (
          v.field === "campTiers" &&
          data[v.schoolIdx].campTiers[v.tierIdx]
        ) {
          const c = data[v.schoolIdx].campTiers[v.tierIdx].cost;
          if (/^\d/.test(c))
            data[v.schoolIdx].campTiers[v.tierIdx].cost = `$${c}`;
        }
      } else {
        // Standard floor violation (e.g. $2, $3 application fees). Just replace cost with TBA.
        // Or if it's SUSPICIOUS/VERIFY, flag it for manual review
        if (v.level === "SUSPICIOUS" || v.level === "VERIFY") {
          data[v.schoolIdx].auditStatus = "PRICE_CHECK_NEEDED";
          data[v.schoolIdx].isChecked = false;
          data[v.schoolIdx].isVerified = false;
          data[v.schoolIdx].updateLog = data[v.schoolIdx].updateLog || [];
          data[v.schoolIdx].updateLog.push(
            `Price integrity flag [${v.level}]: found low cost "${v.cost}". Needs manual review.`,
          );
        } else {
          if (v.field === "campTiers") {
            data[v.schoolIdx].campTiers[v.tierIdx].cost = "TBA";
          } else if (v.field === "cost") {
            data[v.schoolIdx].cost = "TBA";
          }
        }
      }
    });
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    console.log(`\n Fixed ${violations.length} entries in camps_data.json`);

    if (reextractSchools.size > 0) {
      console.log(
        `\n TRIGGERING IMMEDIATE RE-EXTRACTION FOR ${reextractSchools.size} CRITTICAL ANOMALIES...`,
      );
      // Update the queue first
      console.log(" -> Running quality_audit.js to rebuild queue...");
      try {
        execSync("node quality_audit.js", { stdio: "inherit" });
      } catch (e) {
        /* ignore */
      }

      for (const school of reextractSchools) {
        console.log(` -> Launching smart_extract.js for "${school}"...`);
        try {
          execSync(`node smart_extract.js --school="${school}"`, {
            stdio: "inherit",
          });
        } catch (e) {
          console.error(`    Extraction failed for ${school}:`, e.message);
        }
      }
      console.log(" -> Re-evaluation complete.");
      console.log(" Re-run: node generate_html.js to regenerate the UI");
    } else {
      console.log(" Re-run: node generate_html.js to regenerate the UI");
    }
  } else {
    console.log(
      `\n Found ${violations.length} suspicious prices under $${PRICE_THRESHOLDS.VERIFY_MANUALLY}.`,
    );
    console.log(" Run with --fix to auto-replace with TBA or flag for review:");
    console.log("   node src/tests/test_price_integrity.js --fix");
  }
  process.exit(1);
} else {
  console.log("\n Price Integrity: PASSED");
  console.log(
    `   (Checked ${data.length} schools, no prices under $${PRICE_THRESHOLDS.VERIFY_MANUALLY} found)`,
  );
  process.exit(0);
}
