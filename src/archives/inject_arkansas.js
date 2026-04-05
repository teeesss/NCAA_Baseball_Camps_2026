// Inject verified Arkansas camp data into camps_data.json
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("camps_data.json", "utf8"));
const verified = JSON.parse(
  fs.readFileSync("verified_arkansas_camps.json", "utf8"),
);

const ark = data.find((d) => d.university === "Arkansas");
if (ark) {
  ark.campUrl = verified.campUrl;
  ark.campTiers = verified.campTiers;

  // Build summary dates from tiers (ages 12+ only)
  let allDates = [];
  let costs = [];
  for (let tier of verified.campTiers) {
    // Parse age range
    let ageText = tier.ages;
    let minAge = 0,
      maxAge = 99;
    let m = ageText.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (m) {
      minAge = parseInt(m[1]);
      maxAge = parseInt(m[2]);
    }
    let m2 = ageText.match(/(\d+)\s*\+/);
    if (m2) {
      minAge = parseInt(m2[1]);
      maxAge = 99;
    }
    if (ageText.includes("8th")) {
      minAge = 13;
      maxAge = 18;
    }

    // Skip camps that don't accept 12+
    if (maxAge < 12) {
      console.log(
        `  ⊘ Skipping "${tier.name}" (${tier.ages}) - max age below 12`,
      );
      continue;
    }

    console.log(`  ✓ Including "${tier.name}" (${tier.ages}) - $${tier.cost}`);
    for (let s of tier.sessions) {
      allDates.push(s.dates.replace(", 2026", ""));
    }
    let cost = parseFloat(tier.cost.replace("$", ""));
    if (cost > 0) costs.push(cost);
  }

  ark.dates = [...new Set(allDates)].join(" | ") + " 2026";
  if (costs.length > 0) {
    let min = Math.min(...costs);
    let max = Math.max(...costs);
    ark.cost = min === max ? `$${min}` : `$${min} - $${max}`;
  }
  ark.isVerified = true;
  ark.isChecked = true;
  ark.scriptVersion = 3;

  console.log(`\nArkansas updated:`);
  console.log(`  Dates: ${ark.dates}`);
  console.log(`  Cost: ${ark.cost}`);
  console.log(`  Camp URL: ${ark.campUrl}`);
  console.log(`  Tiers: ${ark.campTiers.length}`);

  fs.writeFileSync("camps_data.json", JSON.stringify(data, null, 2));
  console.log("\nSaved to camps_data.json ✓");
} else {
  console.log("ERROR: Arkansas not found in camps_data.json");
}
