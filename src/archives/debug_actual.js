const { getMascot } = require("./src/utils/mascot_lookup.js");

// Exact copy of the function from extraction_engine.js
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

// Test the exact case from the logs
console.log("Testing the exact case from logs:");
console.log('Title: "Arizona State Sun Devils Baseball Camp"');
console.log('Target: "Arizona State"');
console.log('Checking against: ["Arizona", "Arizona State"]');

const result = checkContamination(
  "Arizona State Sun Devils Baseball Camp",
  "Arizona State",
  ["Arizona", "Arizona State"],
);

console.log("");
console.log("Result:", result);
console.log("Expected: null");
console.log(
  "If result is not null, that means contamination was incorrectly detected",
);

// Let's trace through each step manually
console.log("");
console.log("=== MANUAL TRACE ===");
const titleLower = "Arizona State Sun Devils Baseball Camp".toLowerCase();
const targetLower = "Arizona State".toLowerCase();
const other = "Arizona";
const oLower = other.toLowerCase();

console.log("titleLower:", titleLower);
console.log("targetLower:", targetLower);
console.log("other:", other);
console.log("oLower:", oLower);

const targetIsState = targetLower.includes(" state");
const otherIsState = oLower.includes(" state");

console.log("targetIsState:", targetIsState);
console.log("otherIsState:", otherIsState);
console.log("targetIsState !== otherIsState:", targetIsState !== otherIsState);

if (targetIsState !== otherIsState) {
  const targetBase = targetLower
    .replace(/ state| university| college/g, "")
    .trim();
  const otherBase = oLower.replace(/ state| university| college/g, "").trim();

  console.log("targetBase:", targetBase);
  console.log("otherBase:", otherBase);
  console.log("targetBase === otherBase:", targetBase === otherBase);

  if (targetBase === otherBase) {
    const titleHasState = titleLower.includes(" state");
    console.log("titleHasState:", titleHasState);
    console.log(
      "titleHasState !== targetIsState:",
      titleHasState !== targetIsState,
    );

    if (titleHasState !== targetIsState) {
      console.log("-> STATE CONTAMINATION WOULD BE TRIGGERED HERE");
    } else {
      console.log("-> STATE CONTAMINATION NOT TRIGGERED (values are equal)");
    }
  }
}

// Let's also test what the title actually contains
console.log("");
console.log("=== TITLE ANALYSIS ===");
console.log("Title:", '"Arizona State Sun Devils Baseball Camp"');
console.log("Lowercase title:", '"' + titleLower + '"');
console.log('Contains " state":', titleLower.includes(" state"));
console.log('Position of " state":', titleLower.indexOf(" state"));
