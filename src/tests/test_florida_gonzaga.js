/**
 * TEST SUITE: Florida & Gonzaga Data Integrity
 * ═══════════════════════════════════════════════
 * Validates that verified camp data for Florida (SEC/DI) and
 * Gonzaga (WCC/DI) passes all quality gates.
 *
 * Run: node src/tests/test_florida_gonzaga.js
 * Expected: All tests PASS (0 failures)
 * ═══════════════════════════════════════════════
 */

"use strict";

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../../camps_data.json");
const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

let passed = 0;
let failed = 0;

function assert(condition, testName, detail) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${testName}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

console.log("\n═══════════════════════════════════════════════");
console.log(" TEST SUITE: Florida & Gonzaga Data Integrity");
console.log("═══════════════════════════════════════════════\n");

// ── FLORIDA ──────────────────────────────────────────────
const fl = data.find((r) => r.university === "Florida");
console.log("📋 GROUP 1: Florida Gators (SEC / DI)");

assert(fl !== undefined, "Florida record exists in database");

if (fl) {
  assert(fl.division === "DI", "Division is DI", `got: ${fl.division}`);
  assert(fl.conference === "SEC", "Conference is SEC", `got: ${fl.conference}`);

  // URL must be 2026 page, not the old 2025 youth camp
  assert(
    fl.campUrl && fl.campUrl.includes("2026"),
    "Camp URL contains 2026 (not legacy)",
    `got: ${fl.campUrl}`,
  );
  assert(
    !fl.campUrl || !fl.campUrl.includes("2025"),
    "Camp URL does NOT reference 2025",
  );

  // Dates
  assert(
    fl.dates && fl.dates.includes("July"),
    "Dates include July sessions",
    `got: ${fl.dates}`,
  );
  assert(
    fl.dates && fl.dates !== "TBA",
    "Dates are not TBA",
    `got: ${fl.dates}`,
  );

  // Cost
  assert(fl.cost && fl.cost !== "TBA", "Cost is not TBA", `got: ${fl.cost}`);
  const costVal = parseFloat((fl.cost || "").replace(/[^0-9.]/g, ""));
  assert(
    costVal >= 100 && costVal <= 2000,
    "Cost in valid range ($100-$2000)",
    `got: $${costVal}`,
  );

  // Contact
  assert(
    fl.contact && fl.contact.includes("@"),
    "Contact has email",
    `got: ${fl.contact}`,
  );
  assert(
    fl.contact && fl.contact.toLowerCase().includes("ufl.edu"),
    "Email domain is ufl.edu",
    `got: ${fl.contact}`,
  );

  // Verification status
  assert(fl.isHumanVerified === true, "Marked as human verified");
  assert(
    fl.auditStatus === "VERIFIED",
    "Audit status is VERIFIED",
    `got: ${fl.auditStatus}`,
  );

  // Camp tiers
  assert(
    Array.isArray(fl.campTiers) && fl.campTiers.length >= 2,
    "Has multiple camp tiers",
    `got: ${fl.campTiers?.length || 0} tiers`,
  );
  if (fl.campTiers && fl.campTiers.length) {
    const hsExp = fl.campTiers.find((t) => t.name.includes("HS Experience"));
    assert(
      hsExp && hsExp.cost === "$1,350",
      "HS Experience tier has correct price ($1,350)",
      `got: ${hsExp?.cost}`,
    );
  }
}

// ── GONZAGA ──────────────────────────────────────────────
const gz = data.find((r) => r.university === "Gonzaga");
console.log("\n📋 GROUP 2: Gonzaga Bulldogs (WCC / DI)");

assert(gz !== undefined, "Gonzaga record exists in database");

if (gz) {
  assert(gz.division === "DI", "Division is DI", `got: ${gz.division}`);
  assert(gz.conference === "WCC", "Conference is WCC", `got: ${gz.conference}`);

  // URL must be the zagsbaseballcamps portal, not the broken 2018 gozags link
  assert(
    gz.campUrl && gz.campUrl.includes("zagsbaseballcamps"),
    "Camp URL is zagsbaseballcamps.com (not broken gozags 2018)",
    `got: ${gz.campUrl}`,
  );
  assert(gz.urlBroken !== true, "URL is NOT marked as broken");

  // Dates
  assert(
    gz.dates && gz.dates !== "TBA",
    "Dates are not TBA",
    `got: ${gz.dates}`,
  );
  assert(
    gz.dates && (gz.dates.includes("June") || gz.dates.includes("July")),
    "Dates include summer months",
    `got: ${gz.dates}`,
  );

  // Cost
  assert(gz.cost && gz.cost !== "TBA", "Cost is not TBA", `got: ${gz.cost}`);
  const gzCostVal = parseFloat((gz.cost || "").replace(/[^0-9.]/g, ""));
  assert(
    gzCostVal >= 50 && gzCostVal <= 500,
    "Cost in valid range ($50-$500)",
    `got: $${gzCostVal}`,
  );

  // Contact
  assert(
    gz.contact && gz.contact.includes("@"),
    "Contact has email",
    `got: ${gz.contact}`,
  );
  assert(
    gz.contact && gz.contact.toLowerCase().includes("gonzaga.edu"),
    "Email domain is gonzaga.edu",
    `got: ${gz.contact}`,
  );
  assert(
    gz.contact && gz.contact.includes("Evan Wells"),
    "Contact includes POC name (Evan Wells)",
    `got: ${gz.contact}`,
  );

  // Verification status
  assert(gz.isHumanVerified === true, "Marked as human verified");
  assert(
    gz.auditStatus === "VERIFIED",
    "Audit status is VERIFIED",
    `got: ${gz.auditStatus}`,
  );

  // Camp tiers
  assert(
    Array.isArray(gz.campTiers) && gz.campTiers.length >= 3,
    "Has 3+ camp tiers",
    `got: ${gz.campTiers?.length || 0} tiers`,
  );
  if (gz.campTiers && gz.campTiers.length) {
    const bigDogs = gz.campTiers.find((t) => t.name.includes("Big Dogs"));
    assert(
      bigDogs && bigDogs.cost === "$140",
      "Big Dogs tier has correct price ($140)",
      `got: ${bigDogs?.cost}`,
    );
  }
}

// ── CROSS-CONTAMINATION CHECK ────────────────────────────
console.log("\n📋 GROUP 3: Cross-Contamination Safety");

// Florida should not have Gonzaga data
if (fl && gz) {
  assert(
    !fl.contact.includes("gonzaga"),
    'Florida contact does not contain "gonzaga"',
  );
  assert(
    !gz.contact.includes("ufl.edu"),
    'Gonzaga contact does not contain "ufl.edu"',
  );
  assert(
    fl.campUrl !== gz.campUrl,
    "Florida and Gonzaga do not share the same campUrl",
  );
}

// North Florida / South Florida / Florida State should be separate
const ufRelated = data.filter((r) => r.university.includes("Florida"));
console.log(`  ℹ️  Found ${ufRelated.length} "Florida" entries in database`);
for (const r of ufRelated) {
  if (r.university !== "Florida") {
    assert(
      !r.campUrl || r.campUrl !== fl?.campUrl,
      `${r.university} has its own unique URL (not Florida's)`,
    );
  }
}

// ── SUMMARY ──────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════");
console.log(
  ` RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} tests`,
);
console.log("═══════════════════════════════════════════════\n");

process.exit(failed > 0 ? 1 : 0);
