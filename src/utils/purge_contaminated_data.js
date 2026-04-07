/**
 * purge_contaminated_data.js
 *
 * Targeted data cleanup for schools where the extraction engine pulled data
 * from the wrong sport domain or a schedule page. Identified by test_price_integrity.js.
 *
 * Run: node src/utils/purge_contaminated_data.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../../camps_data.json");
const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

// Backup first
const backup = DATA_FILE.replace(".json", `_backup_purge_${Date.now()}.json`);
fs.copyFileSync(DATA_FILE, backup);
console.log(`📦 Backup: ${path.basename(backup)}`);

let purged = 0;

// ── Known contaminated records ────────────────────────────────────────────────
const CONTAMINATION_RULES = [
  {
    school: "Southeastern Oklahoma State University",
    badDomains: ["savagestormfootball", "football"],
    reason: "Football camp domain — wrong sport",
  },
  {
    school: "Ball State",
    badDomains: ["/schedule/"],
    reason: "Schedule page — not a camp registration URL",
  },
  {
    school: "NJIT",
    badDomains: ["/schedule/"],
    reason: "Schedule page — ticket prices, not camp fees",
  },
  {
    school: "St. Cloud State University",
    badDomains: ["hcubaseballcamps.com"],
    reason:
      "Third-party aggregator for Hutchinson area camps, not SCSU official",
  },
];

for (const rule of CONTAMINATION_RULES) {
  const record = data.find(
    (d) => d.university.toLowerCase() === rule.school.toLowerCase(),
  );
  if (!record) {
    console.log(`⚠️  Not found in DB: ${rule.school}`);
    continue;
  }

  const url = (
    record.campUrl ||
    record.sourceUrl ||
    record.url ||
    ""
  ).toLowerCase();
  const isBad = rule.badDomains.some((d) => url.includes(d));

  if (isBad) {
    console.log(`\n🗑️  Purging: ${rule.school}`);
    console.log(`   URL: ${record.campUrl || "N/A"}`);
    console.log(`   Reason: ${rule.reason}`);

    // Clear the corrupted camp data
    record.campTiers = [];
    record.dates = "TBA";
    record.cost = "TBA";
    record.campUrl = null;
    record.sourceUrl = null;
    record.auditStatus = `PURGED_${new Date().toISOString().slice(0, 10).replace(/-/g, "")} — ${rule.reason}`;
    record.isChecked = false; // Re-queue for fresh extraction
    record.scriptVersion = 0;
    record.lastUpdateDate = Date.now();

    purged++;
  } else {
    console.log(`✓  ${rule.school} — URL clean (${url.substring(0, 60)})`);
  }
}

console.log(
  `\n📊 Summary: ${purged} records purged and re-queued for extraction.`,
);

fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
console.log(`✅ Saved. Run test_price_integrity.js to verify.`);
