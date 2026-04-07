"use strict";

/**
 * Merge baseballcampsusa data with schools + mascots into camps_data.json.
 * Uses mascot name matching as primary signal — eliminates all cross-contamination.
 */

const fs = require("fs");
const { MASCOT_LOOKUP } = require("./src/utils/mascot_lookup.js");

const bcData = JSON.parse(fs.readFileSync("!bcusa.com_fixed.json", "utf8"));
const data = JSON.parse(fs.readFileSync("camps_data.json", "utf8"));

// ── Build reverse mascot → school map ──
// Key: mascot lowercased, Value: database school name
const mascotToSchool = {};
for (const [school, mascot] of Object.entries(MASCOT_LOOKUP)) {
  const key = mascot.toLowerCase().replace(/[^a-z0-9]/g, "");
  mascotToSchool[key] = school;
}

// Also index by university name
const uniMap = {};
data.forEach((s) => (uniMap[s.university] = s));

const results = [];
const skipped = [];

for (const entry of bcData) {
  const bcSchool = entry.school;
  const url = entry.url;
  const bcLower = bcSchool.toLowerCase();

  // ── Primary match: mascot ──
  const mascotWord = bcLower.replace(/[^a-z0-9 ]/g, " ").trim();
  // Extract last 1-3 words as mascot (e.g. "Abilene Christian Wildcats" → "wildcats")
  const words = mascotWord.split(/\s+/);
  // Try progressively longer mascot strings to avoid false partials
  for (let i = words.length - 1; i >= Math.max(0, words.length - 3); i--) {
    const candidate = words
      .slice(i)
      .join("")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (mascotToSchool[candidate]) {
      results.push({
        school: mascotToSchool[candidate],
        url,
        mascot: candidate,
        matchedOn: "mascot",
      });
      break;
    }
  }
}

// Deduplicate
const deduped = {};
for (const r of results) {
  if (!deduped[r.school]) deduped[r.school] = r;
}

const finalMatches = Object.values(deduped);
console.log("BC entries:", bcData.length);
console.log("Mascot matches:", Object.keys(deduped).length);

// Apply
const dataMap = {};
data.forEach((s) => (dataMap[s.university] = s));

let applied = 0;
const updates = [];

for (const m of finalMatches) {
  const rec = dataMap[m.school];
  if (!rec) continue;

  const existingUrl = (rec.campUrl || "").replace(/\/$/, "").toLowerCase();
  const newUrl = m.url.replace(/\/$/, "");

  if (existingUrl && existingUrl === newUrl.toLowerCase()) continue;

  rec.url = m.url;
  rec.campUrl = m.url + "/";
  rec.isChecked = false;
  rec.auditStatus = "NEW_SOURCE_DETECTED";
  rec.sourceUrl = "https://baseballcampsusa.com";
  applied++;
  updates.push({ school: m.school, url: m.url, mascot: m.mascot });
}

updates.sort((a, b) => a.school.localeCompare(b.school));
console.log("\n=== Applied (" + applied + ") ===");
updates.forEach((u) =>
  console.log("  " + u.school + " (" + u.mascot + ") => " + u.url),
);

console.log("\nDone. Applied " + applied + " URL updates.");
fs.writeFileSync("camps_data.json", JSON.stringify(data, null, 2));
