// Test the actual fix for the contamination logic
const { getMascot } = require("./src/utils/mascot_lookup.js");

// CURRENT (buggy) logic from extraction_engine.js lines 286-287
function checkContamination_CURRENT(title, targetUni, allSchoolNames) {
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
      // BUGGY LINE: This is wrong - it triggers if EITHER the other mascot OR other name is mentioned
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

// PROPOSED FIX: Better mascot-identity check
function checkContamination_FIXED(title, targetUni, allSchoolNames) {
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
    // FIXED: Only trigger if the site mentions the OTHER school's mascot
    // AND does NOT mention OUR school's mascot (to avoid false positives on legitimate sites)
    const otherMascot = (getMascot(other) || "").toLowerCase();
    if (
      otherMascot &&
      otherMascot.length > 3 &&
      otherMascot !== targetMascot &&
      (targetLower.includes(oLower) || oLower.includes(targetLower))
    ) {
      // FIXED LOGIC: Only contaminated if OTHER mascot is mentioned BUT OUR mascot is NOT mentioned
      // This prevents legitimate sites like "Arizona State Sun Devils" from being flagged
      // just because they mention "Arizona State" in the title
      const mentionsOtherMascot = titleLower.includes(otherMascot);
      const mentionsOwnMascot = titleLower.includes(targetMascot);

      if (mentionsOtherMascot && !mentionsOwnMascot) {
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

// Test cases
console.log("=== TESTING CONTAMINATION LOGIC FIX ===\n");

const testCases = [
  {
    title: "Arizona State Sun Devils Baseball Camp",
    target: "Arizona State",
    desc: "Legitimate ASU site",
  },
  {
    title: "Arizona Wildcats Baseball Camp",
    target: "Arizona",
    desc: "Legitimate UA site",
  },
  {
    title: "Arizona State vs Arizona Baseball Showdown",
    target: "Arizona State",
    desc: "Mentions both - should NOT be contaminated",
  },
  {
    title: "Wildcat Baseball Camp - Home of the Wildcats",
    target: "Arizona State",
    desc: "Only mentions wildcats (rival) - SHOULD be contaminated",
  },
  {
    title: "Sun Devil Baseball Camp - Go Devils!",
    target: "Arizona State",
    desc: "Only mentions sun devils (own) - should NOT be contaminated",
  },
  {
    title: "Arizona Baseball Camp at ASU Facilities",
    target: "Arizona State",
    desc: "Mentions Arizona but not ASU mascot - tricky case",
  },
  {
    title: "Arizona State Athletics Department",
    target: "Arizona State",
    desc: "Generic ASU site",
  },
];

const allSchools = ["Arizona", "Arizona State"];

testCases.forEach(({ title, target, desc }) => {
  const currentResult = checkContamination_CURRENT(title, target, allSchools);
  const fixedResult = checkContamination_FIXED(title, target, allSchools);

  console.log(`${desc.padEnd(50)} | "${title}"`);
  console.log(`  Target: ${target}`);
  console.log(`  Current: ${currentResult || "null"}`);
  console.log(`  Fixed:   ${fixedResult || "null"}`);
  console.log();
});

// Test the specific case from the logs
console.log("=== SPECIFIC LOG CASE ANALYSIS ===");
console.log(
  "From log: https://www.sundevilsbaseballcamps.com triggered Contamination (Arizona)",
);
console.log("What title would cause this with CURRENT logic?");

// Let's think what title on the sundevils site would trigger the CURRENT buggy logic:
// It would need to either:
// 1. Include "wildcats" (Arizona mascot) - OR
// 2. Include "arizona" (the other school name)

// Since it's a sundevils site, #2 is very likely - it probably says "Arizona State" somewhere
// Let's test that hypothesis:
const testTitle = "Arizona State Sun Devils Baseball Camp - Sundevils.com";
console.log(`\nTesting: "${testTitle}"`);
console.log(`Target: Arizona State`);
const current = checkContamination_CURRENT(
  testTitle,
  "Arizona State",
  allSchools,
);
const fixed = checkContamination_FIXED(testTitle, "Arizona State", allSchools);
console.log(`Current result: ${current || "null"}`);
console.log(`Fixed result:   ${fixed || "null"}`);
console.log(
  `If current returns Arizona but fixed returns null, the fix works!`,
);
