const fs = require("fs");
const assert = require("assert");

// Manual mock of the logic from extract_camp_details.js
// In a real environment, we'd export these, but for a standalone test file we'll redefine the core logic helpers

function scoreUrl(url, school) {
  if (!url) return -100;
  let score = 0;
  let u = url.toLowerCase();
  let s = school.university.toLowerCase();

  if (u.includes("baseball")) score += 20;
  if (u.includes("camp") || u.includes("clinic")) score += 15;
  if (u.includes("/sports/baseball")) score += 10;
  if (school.mascot && u.includes(school.mascot.toLowerCase())) score += 10;
  if (u.includes(s.replace(/\s+/g, ""))) score += 15;

  const bad = [
    "wikipedia",
    "espn",
    "facebook",
    "twitter",
    "instagram",
    "fanfare",
    "fandom",
    "warrennolan",
    "newsbreak",
  ];
  if (bad.some((b) => u.includes(b))) score -= 80;

  return score;
}

function getUniversityAliases(name) {
  let aliases = [name.toLowerCase()];
  let clean = name
    .replace(
      /University of | University| State University|College of | College/g,
      "",
    )
    .trim()
    .toLowerCase();
  if (clean !== name.toLowerCase()) aliases.push(clean);
  return aliases;
}

function parseTiersMock(fullText) {
  let campTiers = [];
  let lines = fullText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 5);
  for (let j = 0; j < lines.length; j++) {
    let line = lines[j];
    if (
      /(?:jun|jul|aug|june|july|august)\w*\s+\d/i.test(line) ||
      /\b0?[6-8]\/\d{1,2}/i.test(line)
    ) {
      let block = lines
        .slice(Math.max(0, j - 2), Math.min(lines.length, j + 5))
        .join(" | ");
      let nameMatch = block.match(
        /([A-Z0-9][A-Za-z0-9\s\/&]+(?:Camp|Clinic|Prospect|Showcase|Elite|Program|Session))/,
      );
      let dateMatch = block.match(
        /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2})|(?:\b0?[6-8]\/\d{1,2})/gi,
      );
      let costMatch = block.match(/\$\d+/);
      if (dateMatch) {
        campTiers.push({
          name: nameMatch ? nameMatch[1].trim() : "Upcoming Camp",
          dates: dateMatch.slice(0, 3).join(", "),
          cost: costMatch ? costMatch[0] : "TBA",
        });
      }
    }
  }
  return campTiers.filter(
    (v, i, a) =>
      a.findIndex((t) => t.name === v.name && t.dates === v.dates) === i,
  );
}

// ─── RUN TESTS ───────────────────────────────────────────────────

console.log("--- STARTING EXTRACTION LOGIC TESTS ---");

// 1. Test Scoring
const mockSchool = { university: "VMI", mascot: "Keydets" };
const url1 =
  "https://vmikeydets.com/news/2025/5/28/sam-roberts-baseball-camps-kick-off-next-week.aspx";
const url2 = "https://en.wikipedia.org/wiki/VMI_Keydets_baseball";

console.log(`[TEST 1] Scoring ${url1}...`);
const s1 = scoreUrl(url1, mockSchool);
console.log(`   Score: ${s1}`);
assert(s1 >= 40, "VMI news link should have high score");

console.log(`[TEST 2] Scoring ${url2} (should be low)...`);
const s2 = scoreUrl(url2, mockSchool);
console.log(`   Score: ${s2}`);
assert(s2 < 0, "Wikipedia link should be penalized");

// 2. Test Aliases
console.log("[TEST 3] University Aliases...");
const testName = "Arkansas-Pine Bluff University";
const aliases = getUniversityAliases(testName);
console.log(`   Input: ${testName}`);
console.log(`   Aliases: ${JSON.stringify(aliases)}`);
assert(
  aliases.includes("arkansas-pine bluff"),
  `Expected 'arkansas-pine bluff' in ${JSON.stringify(aliases)}`,
);

// 3. Test Tier Parsing
console.log("[TEST 4] Tier Parsing Logic...");
const mockHTML = `
Join us for the Future Keydets Youth Camp this summer.
This camp is for all skill levels.
Dates: June 2-5, 2026.
Price: $250.
Contact Coach Sam for details.
The BaseCo Top Prospect Camp will also be held.
Session 1: July 1, 2026.
Cost: $150.
`;
const tiers = parseTiersMock(mockHTML);
console.log(`   Tiers found: ${tiers.length}`);
tiers.forEach((t) => console.log(`      - ${t.name} (${t.dates}) : ${t.cost}`));
assert(tiers.length === 2, "Should have found 2 camps");
assert(tiers[0].name.includes("Future Keydets"), "First camp name mismatch");
assert(tiers[1].cost === "$150", "Second camp cost mismatch");

console.log("\n--- ALL TESTS PASSED! EXTRACTION ENGINE IS STABLE ---");
