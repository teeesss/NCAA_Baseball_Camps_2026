/**
 * Repair isChecked — restores isChecked=true for schools with existing lastChecked dates
 * to ensure the new 3-day/14-day TTL logic is respected.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const DATA_PATH = path.resolve(__dirname, "../../camps_data.json");
const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

let repaired = 0;
data.forEach(school => {
  if (!school.isChecked && school.lastChecked) {
    school.isChecked = true;
    repaired++;
  }
});

fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
console.log(`Repaired isChecked for ${repaired} schools with valid timestamps.`);
