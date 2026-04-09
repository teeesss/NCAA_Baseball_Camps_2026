/**
 * Field Completeness Test — scans the database to auto-flag missing or suspicious data
 * into the new `recheck` schema.
 *
 * Usage: node src/tests/test_field_completeness.js
 * Usage: node src/tests/test_field_completeness.js --fix
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { 
  isEmailMissingOrJunk, 
  isCostMissing, 
  isCostSuspicious, 
  isDateMissing,
  applyCompletenessFlags 
} = require("../utils/field_checker");

const DATA_PATH = path.resolve(__dirname, "../../camps_data.json");
const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

const fixMode = process.argv.includes("--fix");

let emailIssues = 0;
let costIssues = 0;
let dateIssues = 0;
let schoolsToRequeue = 0;

data.forEach((school) => {
  if (school.isVerified) return; // Skip manually verified

  let needsRequeuing = false;

  if (isEmailMissingOrJunk(school)) {
    emailIssues++;
    needsRequeuing = true;
  }
  
  if (isCostMissing(school) || isCostSuspicious(school)) {
    costIssues++;
    needsRequeuing = true;
  }
  
  if (isDateMissing(school)) {
    dateIssues++;
    needsRequeuing = true;
  }

    if (needsRequeuing) {
    schoolsToRequeue++;
    if (fixMode) {
      applyCompletenessFlags(school);
    }
  }
});

console.log("\n--- FIELD COMPLETENESS AUDIT ---");
console.log(`Schools with Missing/Junk Email: ${emailIssues}`);
console.log(`Schools with Missing/Suspicious Cost: ${costIssues}`);
console.log(`Schools with Missing Dates: ${dateIssues}`);
console.log(`--------------------------------`);
console.log(`TOTAL SCHOOLS NEEDING RECHECK: ${schoolsToRequeue} / ${data.length}`);

if (fixMode) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  console.log("\n[AUTO-FIX] Applied targeted `recheck` flags and marked `isChecked = false` for the extraction engine.");
} else if (schoolsToRequeue > 0) {
  console.log("\nRun with --fix to apply granular `recheck` flags and queue them for the next engine run.");
}
