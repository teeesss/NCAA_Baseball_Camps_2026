"use strict";
const fs = require("fs");
const parsed = JSON.parse(
  fs.readFileSync("!baseball_camp_urls_baseballcampsusa.com.json", "utf8"),
);
const data = JSON.parse(fs.readFileSync("camps_data.json", "utf8"));

// Simple substring matching
const matched = [];
const unmatched = [];

parsed.forEach((p) => {
  if (
    !p.school.toLowerCase().includes("baseball") &&
    !p.school.toLowerCase().includes("camp")
  ) {
    unmatched.push(p.school);
    return;
  }

  let found = null;
  for (const db of data) {
    const dbLower = db.university.toLowerCase();
    const dbWords = dbLower.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    const allMatch = dbWords.every((w) => p.school.toLowerCase().includes(w));
    if (allMatch && dbWords.length >= 1) {
      found = db.university;
      break;
    }
  }

  if (found) matched.push({ school: p.school, dbSchool: found, url: p.url });
  else unmatched.push(p.school);
});

console.log("Total parsed entries:", parsed.length);
console.log("Potential DB matches:", matched.length);
console.log("Unmatched:", unmatched.length);

// Show all matches
console.log("\n=== ALL MATCHES (" + matched.length + ") ===");
matched.forEach((m, i) => {
  console.log(i + 1 + ". " + m.school + " → " + m.dbSchool + " | " + m.url);
});
