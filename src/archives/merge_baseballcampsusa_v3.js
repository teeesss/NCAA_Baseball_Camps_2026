"use strict";

/**
 * Strict merge: only match when baseballcampsusa entry unambiguously contains our university name.
 * Uses full university name substring matching + whole-word boundary checks.
 * Zero tolerance for cross-contamination. If it's ambiguous, skip it.
 */

const fs = require("fs");

const parsedData = JSON.parse(
  fs.readFileSync("!baseball_camp_urls_baseballcampsusa.com.json", "utf8"),
);
const data = JSON.parse(fs.readFileSync("camps_data.json", "utf8"));
const { MASCOT_LOOKUP } = require("./src/utils/mascot_lookup.js");

// ── Utility: check if word appears as WHOLE WORD in text ──
function wholeWordExists(word, text) {
  // \b boundary - won't match "ball" inside "baseball"
  return new RegExp(
    "\\b" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
    "i",
  ).test(text);
}

// ── Utility: normalize for comparison ──
function normalize(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Build matches ──
const universityNames = data.map((s) => s.university);

const results = [];
const skipped = [];

// Generic words to ignore when scoring
const GENERIC_WORDS = [
  "baseball",
  "camp",
  "camps",
  "camping",
  "university",
  "college",
  "academy",
  "llc",
  "inc",
];

for (const entry of parsedData) {
  const school = entry.school;
  const url = entry.url;
  const lowerSchool = school.toLowerCase();

  // Skip non-baseball
  if (
    !lowerSchool.includes("baseball") &&
    !lowerSchool.includes("camp") &&
    !lowerSchool.includes("prospect")
  )
    continue;

  // Skip personal academies / coach names without school affiliation
  if (
    lowerSchool.match(
      /^(mike|chris|jake|jeff|bobby|keller|eli|brett|david|franklin bush|scot hemmings|james ramsey|mitchell|collin martin|charlie migl|tyler|zack|jbd|prime|heartland|sage|malibu|bealsy|godinez|jason|dunn|ds |sudduth|renauro|maverick|eagles|wolf pack|prime|mules|racer|polar bear|spider|golden gopher|garnet charger|jays|lion|n\.?o\.?w)/i,
    ) &&
    !lowerSchool.includes("university") &&
    !lowerSchool.includes("college")
  )
    continue;

  let bestMatch = null;

  for (const uni of universityNames) {
    const lowerUni = normalize(uni);
    const uniWords = lowerUni
      .split(" ")
      .filter((w) => w.length > 2 && !GENERIC_WORDS.includes(w));

    if (uniWords.length === 0) continue;

    // ── PRIMARY CHECK: every significant word from university must appear as WHOLE WORD in listing ──
    const allMatch = uniWords.every((w) => wholeWordExists(w, school));
    if (!allMatch) continue;

    // ── SAFETY: listing must NOT have a disambiguating word our uni lacks ──
    const listingTokens = lowerSchool
      .split(/[^a-z0-9']+/)
      .filter((w) => w.length > 2);
    const disambig = [
      "monticello",
      "wesleyan",
      "tech",
      "christian",
      "aquinas",
      "baldwin",
      "state",
      "southern",
      "northern",
      "eastern",
      "western",
      "central",
      "college",
      "institute",
      "military",
    ];
    const extraDisambig = disambig.filter(
      (d) => listingTokens.includes(d) && !lowerUni.split(" ").includes(d),
    );
    // If listing has "state" but our uni doesn't → likely different school
    // But "state" alone isn't enough — only reject if there are other disambiguators too
    if (extraDisambig.length > 1) continue;

    // ── CRITICAL: Alabama contamination ──
    // If our uni is "Alabama" and listing has "state", "am&m", "huntsville", "south" → reject
    if (
      lowerUni === "alabama" &&
      /state|a&|m&m|huntsville|south/i.test(listingTokens.join(" "))
    )
      continue;
    // Similarly: "Alabama State" should NOT match "Alabama" or "Alabama A&M"
    // and "Alabama A&M" should NOT match "Alabama" or "Alabama State"

    // ── CRITICAL: Texas Southern should NOT match Texas ──
    // "Texas Southern - Baseball" must go to "Texas Southern", NOT "Texas"
    if (lowerUni === "texas" && listingTokens.includes("southern")) continue;

    // ── CRITICAL: Arkansas Monticello / Arkansas Tech should NOT match Arkansas ──
    if (
      (lowerUni === "arkansas" &&
        (listingTokens.includes("monticello") ||
          listingTokens.includes("tech"))) ||
      (lowerUni === "arkansas tech university" &&
        listingTokens.includes("monticello"))
    )
      continue;

    // ── CRITICAL: Illinois Wesleyan should NOT match Illinois ──
    if (lowerUni === "illinois" && listingTokens.includes("wesleyan")) continue;

    // ── CRITICAL: Connecticut Baseball School (jimpenders) should NOT match UConn ──
    if (lowerUni === "connecticut" && listingTokens.includes("school"))
      continue;

    // ── CRITICAL: Michigan Sports Camps should match Michigan ──
    // "Michigan Sports Camps - Baseball" → camps.mgoblue.com/baseball ✓
    // But Wayne State (Michigan) should NOT match Michigan
    if (lowerUni === "michigan" && listingTokens.includes("wayne")) continue;

    // ── CRITICAL: North Carolina should NOT match North Carolina A&T (they're different schools) ──
    // But "Univ. of North Carolina - Baseball" → carolinabaseballcamps.com matches UNC
    // The listing must NOT match a MORE-SPECIFIC school in our database
    const moreSpecific = universityNames.find(
      (other) =>
        other !== uni &&
        normalize(other).includes(lowerUni) &&
        normalize(other).length > lowerUni.length,
    );
    if (moreSpecific) {
      const moreSpecificWords = normalize(moreSpecific)
        .split(" ")
        .filter((w) => w.length > 2 && !GENERIC_WORDS.includes(w));
      const moreSpecificMatch = moreSpecificWords.every((w) =>
        wholeWordExists(w, school),
      );
      if (moreSpecificMatch) continue; // The more specific school wins — skip this one
    }

    // ── Score: count unique matching non-generic words ──
    const score = uniWords.filter((w) => wholeWordExists(w, school)).length;

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { university: uni, url, score };
    }
  }

  if (bestMatch) {
    results.push(bestMatch);
  } else {
    skipped.push({ parsed: school, url });
  }
}

// ── Deduplicate ──
const deduped = {};
for (const r of results) {
  if (!deduped[r.university] || r.score > deduped[r.university].score) {
    deduped[r.university] = r;
  }
}

const finalMatches = Object.values(deduped);
console.log("Parsed entries:", parsedData.length);
console.log("Raw matches:", results.length);
console.log("Deduplicated high-confidence matches:", finalMatches.length);

// ── Apply (only score >= 2) ──
const dataMap = {};
data.forEach((s) => (dataMap[s.university] = s));

const safeMatches = finalMatches.filter((m) => m.score >= 2);
let applied = 0;

console.log("\n=== Safe matches to apply (score >= 2) ===");
safeMatches.sort((a, b) => b.score - a.score);

for (const m of safeMatches) {
  const rec = dataMap[m.university];
  if (!rec) continue;

  const newUrl = m.url.replace(/\/$/, "");
  const existingUrl = (rec.url || "").replace(/\/$/, "").toLowerCase();
  const existingCampUrl = (rec.campUrl || "").replace(/\/$/, "").toLowerCase();

  // Skip if we already have this exact URL or a better camp-specific one
  if (
    newUrl.toLowerCase() === existingUrl ||
    newUrl.toLowerCase() === existingCampUrl
  )
    continue;
  if (
    existingCampUrl.includes("baseball") ||
    existingCampUrl.includes("camp") ||
    existingCampUrl.includes("ryzer")
  ) {
    // Already have a camp URL — keep it
    continue;
  }

  console.log(
    "  " + m.university + " -> " + m.url + " (score: " + m.score + ")",
  );

  rec.url = m.url;
  rec.campUrl = m.url + "/";
  rec.isChecked = false;
  rec.auditStatus = "NEW_SOURCE_DETECTED";
  rec.sourceUrl = "https://baseballcampsusa.com";
  applied++;
}

// Show what was skipped (low score)
const lowScore = finalMatches.filter((m) => m.score < 2);
if (lowScore.length) {
  console.log("\n=== Skipped (score < 2 — potential mismatches) ===");
  lowScore.sort((a, b) => b.score - a.score);
  for (const m of lowScore) {
    console.log(
      "  " + m.university + " -> " + m.url + " (score: " + m.score + ")",
    );
  }
}

// Show skipped parsed entries
console.log("\n=== Skipped parsed entries (no match found) ===");
console.log(skipped.length, "entries skipped");
console.log("Applied:", applied, "URL updates");

fs.writeFileSync("camps_data.json", JSON.stringify(data, null, 2));
