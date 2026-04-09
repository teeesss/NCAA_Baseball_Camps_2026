// Test script to debug the Arizona State contamination issue
const { getMascot } = require("./src/utils/mascot_lookup.js");

// Exact copy of the checkContamination function from extraction_engine.js
function checkContamination(title, targetUni, allSchoolNames) {
  const titleLower = title.toLowerCase();
  const targetLower = targetUni.toLowerCase();
  const targetIsState = targetLower.includes(" state");
  const targetMascot = (getMascot(targetUni) || "").toLowerCase();

  for (const other of allSchoolNames) {
    if (other === targetUni) continue;
    const oLower = other.toLowerCase();

    // 1. State-aware pair check (Alabama vs Alabama State)
    const otherIsState = oLower.includes(" state");
    if (targetIsState !== otherIsState) {
      const targetBase = targetLower
        .replace(/ state| university| college/g, "")
        .trim();
      const otherBase = oLower
        .replace(/ state| university| college/g, "")
        .trim();
      if (targetBase === otherBase) {
        const titleHasState = titleLower.includes(" state");
        if (titleHasState !== targetIsState) return other;
      }
    }

    // 2. Mascot-identity check (Identity logic: Gators ≠ Seminoles)
    // If the rival name overlaps with our target (Florida vs Florida State),
    // and the page mentions the rival's mascot but not ours, it's contaminated.
    const otherMascot = (getMascot(other) || "").toLowerCase();
    if (
      otherMascot &&
      otherMascot.length > 3 &&
      otherMascot !== targetMascot &&
      (targetLower.includes(oLower) || oLower.includes(targetLower))
    ) {
      if (titleLower.includes(otherMascot) || titleLower.includes(oLower)) {
        return other;
      }
    }

    // 3. Bidirectional substring skip (Arkansas contains Kansas)
    if (targetLower.includes(oLower) || oLower.includes(targetLower)) continue;

    // 4. Strict boundary check for other schools
    const escaped = oLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(titleLower)) return other;
  }
  return null;
}

console.log("=== CONTAMINATION DEBUG TEST ===\n");

// Test the exact scenario from the logs
console.log("1. Testing the exact log scenario:");
console.log("   URL: https://www.sundevilsbaseballcamps.com/");
console.log("   Error: Contamination (Arizona). Skip.");
console.log("   This suggests the page title triggered false contamination\n");

console.log("2. Testing various possible page titles from sundevils site:\n");

const testCases = [
  {
    title: "Arizona State Sun Devils Baseball Camp",
    desc: "Pure Arizona State title",
  },
  { title: "Sundevils Baseball Camps", desc: "Brand-only title" },
  { title: "Arizona State Baseball Camp - Sundevils", desc: "Mixed branding" },
  { title: "Sun Devil Baseball Camp 2026", desc: "Sun Devil variation" },
  {
    title: "Arizona State Athletics Baseball Camp",
    desc: "Athletics department",
  },
  {
    title: "ASU Baseball Camp - Home of the Sun Devils",
    desc: "ASU abbreviation",
  },
  {
    title: "Arizona vs Arizona State Baseball Showcase",
    desc: "Mentions both schools",
  },
  {
    title: "Wildcat Baseball Camp at ASU Facilities",
    desc: "Mentions wildcats at ASU",
  },
  {
    title: "Arizona State Baseball Camp Featuring Wildcat Alumni",
    desc: "Wildcats reference",
  },
];

const targetUni = "Arizona State";
const allSchools = ["Arizona", "Arizona State"];

testCases.forEach(({ title, desc }) => {
  const result = checkContamination(title, targetUni, allSchools);
  console.log(`${desc.padEnd(45)} | "${title}"`);
  console.log(`Result: ${result || "null (no contamination)"}\n`);
});

console.log("3. Debugging the state logic for Arizona vs Arizona State:\n");
console.log("   Arizona State: targetIsState = true");
console.log("   Arizona: otherIsState = false");
console.log("   targetIsState !== otherIsState =", true !== false);
console.log('   Arizona State base (no state): "arizona"');
console.log('   Arizona base: "arizona"');
console.log("   Bases match = true");
console.log(
  '   Title "Arizona State Sun Devils Baseball Camp" contains " state" = true',
);
console.log("   titleHasState !== targetIsState =", true !== true);
console.log("   -> STATE CONTAMINATION SHOULD NOT BE TRIGGERED\n");

console.log("4. Checking if it might be the mascot logic instead:\n");
console.log("   Arizona State mascot:", getMascot("Arizona State"));
console.log("   Arizona mascot:", getMascot("Arizona"));
console.log("   Arizona mascot length > 3:", getMascot("Arizona").length > 3);
console.log(
  "   Arizona mascot ≠ Arizona State mascot:",
  getMascot("Arizona") !== getMascot("Arizona State"),
);
console.log(
  '   Does "Arizona State Sun Devils Baseball Camp" contain "wildcats"?',
  "Arizona State Sun Devils Baseball Camp".toLowerCase().includes("wildcats"),
);

console.log("\n=== CONCLUSION ===");
console.log(
  "If the contamination is happening, it is likely from the MAScot-IDENTITY check",
);
console.log(
  "where a legitimate Arizona State site somehow has content that matches",
);
console.log("the Arizona Wildcats mascot, triggering a false positive.");
