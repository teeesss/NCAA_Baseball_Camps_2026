const fs = require("fs");
const d = JSON.parse(fs.readFileSync("camps_data.json", "utf8"));

let lostTierSchools = 0;
let emptyCamps = 0;
let goodCamps = 0;
let tbaCamps = 0;
const examples = [];
const emptyTierExamples = [];
const noEmailExamples = [];

d.forEach((s) => {
  const hasDates = s.dates && s.dates !== "TBA";
  const hasCost = s.cost && s.cost !== "TBA" && s.cost.trim() !== "";
  const hasTiers =
    s.campTiers && Array.isArray(s.campTiers) && s.campTiers.length > 0;

  if (hasDates && hasCost && !hasTiers) {
    lostTierSchools++;
    if (examples.length < 5)
      examples.push({
        school: s.university,
        dates: s.dates.substring(0, 50),
        cost: s.cost.substring(0, 30),
      });
  } else if (hasTiers) {
    goodCamps++;
  } else if (!hasDates) {
    tbaCamps++;
  } else {
    emptyCamps++;
  }

  // Schools with dates but EMPTY campTiers
  if (hasDates && !hasTiers) {
    if (emptyTierExamples.length < 5)
      emptyTierExamples.push({
        school: s.university,
        dates: s.dates.substring(0, 50),
        tiers: s.campTiers?.length || 0,
      });
  }

  // Schools with email in DB but UI doesn't show it
  if (s.email && !s.email.includes("N/A") && s.email.trim()) {
    if (!s.campPOCEmail || s.campPOCEmail.trim() === "") {
      if (noEmailExamples.length < 5)
        noEmailExamples.push({
          school: s.university,
          email: s.email,
          contact: (s.contact || "").substring(0, 40),
          campPOCEmail: s.campPOCEmail || "(missing)",
        });
    }
  }
});

console.log("=== CAMP DATA INTEGRITY ===");
console.log("Total: " + d.length);
console.log("GOOD (has campTiers): " + goodCamps);
console.log(
  "LOST TIERS (has dates+cost but empty campTiers): " + lostTierSchools,
);
console.log("TBA/No Data: " + tbaCamps);
console.log("Empty: " + emptyCamps);

console.log("\n--- Schools with dates but empty campTiers (lost data) ---");
emptyTierExamples.forEach((e) =>
  console.log("  " + e.school + ': "' + e.dates + '" (tiers: ' + e.tiers + ")"),
);

console.log("\n--- Schools with email in DB but UI missing it ---");
noEmailExamples.forEach((e) =>
  console.log(
    "  " +
      e.school +
      ': email="' +
      e.email +
      '" contact="' +
      e.contact +
      '" campPOCEmail="' +
      e.campPOCEmail +
      '"',
  ),
);
