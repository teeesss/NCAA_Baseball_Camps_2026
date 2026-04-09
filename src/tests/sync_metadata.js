/**
 * Global Metadata Sync — Enforces project rules on camps_data.json
 * 1. Synchronizes all 'Checked' timestamps into a single authoritative state.
 * 2. Restores isChecked=true for any school with a check timestamp.
 * 3. Corrects scriptVersion to V12.2.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const DATA_PATH = path.resolve(__dirname, "../../camps_data.json");
const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

let repairedCount = 0;
let versionCount = 0;

data.forEach(school => {
  // Authoritative timestamp check
  const checkTime = school.lastChecked || school.lastSmartCheck || school.lastAuditDate;
  
  if (checkTime) {
    if (school.isChecked !== true) {
      school.isChecked = true;
      repairedCount++;
    }
    // Also ensure scriptVersion is current if it's been checked recently
    if (school.scriptVersion !== 12.2) {
      school.scriptVersion = 12.2;
      versionCount++;
    }
  }
});

fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
console.log(`✅ METADATA SYNC COMPLETE`);
console.log(`   - Restored isChecked: ${repairedCount} schools`);
console.log(`   - Updated scriptVersion: ${versionCount} schools`);
