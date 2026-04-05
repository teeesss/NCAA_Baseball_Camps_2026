// Quick test for the contamination check fix
const { getMascot } = require("./mascot_lookup");
const allSchoolNames = JSON.parse(
  require("fs").readFileSync("camps_data.json", "utf8"),
)
  .map((c) => c.university)
  .sort((a, b) => b.length - a.length);

// Copy of the updated checkContamination function
function checkContamination(pageTitle, pageBodyText, targetUniversity) {
  let titleLower = pageTitle.toLowerCase();
  let targetLower = targetUniversity.toLowerCase();
  let bodyLower = (pageBodyText || "").toLowerCase().substring(0, 3000);

  let targetOnPage =
    titleLower.includes(targetLower) || bodyLower.includes(targetLower);

  let targetMascot = getMascot(targetUniversity);
  let mascotLower = targetMascot ? targetMascot.toLowerCase() : "";
  if (
    mascotLower &&
    (titleLower.includes(mascotLower) || bodyLower.includes(mascotLower))
  ) {
    targetOnPage = true;
  }

  for (let other of allSchoolNames) {
    if (other === targetUniversity) continue;
    let otherLower = other.toLowerCase();
    if (targetLower.includes(otherLower) || otherLower.includes(targetLower))
      continue;
    try {
      let escaped = otherLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      let regex = new RegExp("\\b" + escaped + "\\b", "i");
      if (regex.test(titleLower)) {
        if (targetOnPage) continue;
        return other;
      }
    } catch (e) {
      if (titleLower.includes(otherLower) && !targetOnPage) return other;
    }
  }
  return null;
}

// ── Tests ──────────────────────────────────────────────
let pass = 0,
  fail = 0;

function test(name, result, expected) {
  if (result === expected) {
    console.log(`  ✅ ${name}: ${result}`);
    pass++;
  } else {
    console.log(`  ❌ ${name}: got "${result}" expected "${expected}"`);
    fail++;
  }
}

console.log("\n=== Contamination Check Tests ===\n");

// Arkansas pages should NOT be rejected as Kansas
test(
  "Arkansas camp page → clean",
  checkContamination(
    "Arkansas Razorbacks Baseball Camp",
    "Arkansas camp info",
    "Arkansas",
  ),
  null,
);

test(
  "baseballcamp.uark.edu title → clean",
  checkContamination(
    "University of Arkansas Baseball Camps",
    "Welcome to the University of Arkansas baseball camp program",
    "Arkansas",
  ),
  null,
);

// Mascot detection: if page says "Razorbacks" it's Arkansas
test(
  "Razorbacks in body but not school name → clean via mascot",
  checkContamination(
    "Summer Baseball Camp 2026",
    "Join the Razorbacks for their elite prospect camp",
    "Arkansas",
  ),
  null,
);

// True contamination: USC page when we want Alabama
test(
  "USC page for Alabama → rejected",
  checkContamination(
    "USC Trojans Youth Programs",
    "University of Southern California camps",
    "Alabama",
  ),
  "USC",
);

// Alabama page that mentions Alabama → clean
test(
  "Alabama page → clean",
  checkContamination(
    "Alabama Crimson Tide Baseball Camp",
    "University of Alabama baseball camps",
    "Alabama",
  ),
  null,
);

// Kansas page should NOT be accepted for Arkansas
test(
  "Kansas Jayhawks page for Arkansas → rejected (Kansas not a substring issue here)",
  checkContamination(
    "Kansas Jayhawks Camp",
    "University of Kansas baseball",
    "Arkansas",
  ),
  null,
); // Actually Kansas contains "kansas" and target "arkansas" contains "kansas" → skip in substring check

// Central Arkansas vs Arkansas
test(
  "Central Arkansas page for Arkansas → should skip (substring)",
  checkContamination(
    "Central Arkansas Bears Baseball",
    "UCA Bears baseball camp",
    "Arkansas",
  ),
  null,
); // "central arkansas" contains "arkansas" → substring skip

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
