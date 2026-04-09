// Focused test on just the first case
const { getMascot } = require("./src/utils/mascot_lookup.js");

// Exact copy of the checkContamination function from extraction_engine.js
function checkContamination(title, targetUni, allSchoolNames) {
  const titleLower = title.toLowerCase();
  const targetLower = targetUni.toLowerCase();
  const targetIsState = targetLower.includes(" state");
  const targetMascot = (getMascot(targetUni) || "").toLowerCase();

  console.log(`\n=== Testing: "${title}" vs "${targetUni}" ===`);
  console.log(`titleLower: "${titleLower}"`);
  console.log(`targetLower: "${targetLower}"`);
  console.log(`targetIsState: ${targetIsState}`);
  console.log(`targetMascot: "${targetMascot}"`);

  for (const other of allSchoolNames) {
    if (other === targetUni) {
      console.log(`Skipping ${other} (same as target)`);
      continue;
    }
    const oLower = other.toLowerCase();
    console.log(`\nChecking against "${other}":`);
    console.log(`  oLower: "${oLower}"`);

    // 1. State-aware pair check (Alabama vs Alabama State)
    const otherIsState = oLower.includes(" state");
    console.log(`  otherIsState: ${otherIsState}`);
    console.log(
      `  targetIsState !== otherIsState: ${targetIsState !== otherIsState}`,
    );

    if (targetIsState !== otherIsState) {
      const targetBase = targetLower
        .replace(/ state| university| college/g, "")
        .trim();
      const otherBase = oLower
        .replace(/ state| university| college/g, "")
        .trim();
      console.log(`  targetBase: "${targetBase}"`);
      console.log(`  otherBase: "${otherBase}"`);
      console.log(`  targetBase === otherBase: ${targetBase === otherBase}`);

      if (targetBase === otherBase) {
        const titleHasState = titleLower.includes(" state");
        console.log(`  titleHasState: ${titleHasState}`);
        console.log(
          `  titleHasState !== targetIsState: ${titleHasState !== targetIsState}`,
        );

        if (titleHasState !== targetIsState) {
          console.log(`  -> RETURNING ${other} DUE TO STATE CONTAMINATION`);
          return other;
        } else {
          console.log(`  -> State check passed (no contamination)`);
        }
      }
    }

    // 2. Mascot-identity check (Identity logic: Gators ≠ Seminoles)
    // If the rival name overlaps with our target (Florida vs Florida State),
    // and the page mentions the rival's mascot but not ours, it's contaminated.
    const otherMascot = (getMascot(other) || "").toLowerCase();
    console.log(
      `  otherMascot: "${otherMascot}" (length: ${otherMascot.length})`,
    );
    console.log(`  otherMascot length > 3: ${otherMascot.length > 3}`);
    console.log(
      `  otherMascot !== targetMascot: ${otherMascot !== targetMascot}`,
    );
    console.log(
      `  targetLower includes oLower: ${targetLower.includes(oLower)}`,
    );
    console.log(
      `  oLower includes targetLower: ${oLower.includes(targetLower)}`,
    );

    const mascotCondition =
      otherMascot.length > 3 &&
      otherMascot !== targetMascot &&
      (targetLower.includes(oLower) || oLower.includes(targetLower));
    console.log(`  mascotCondition: ${mascotCondition}`);

    if (mascotCondition) {
      const titleIncludesOtherMascot = titleLower.includes(otherMascot);
      const titleIncludesOther = titleLower.includes(oLower);
      console.log(`  title includes otherMascot: ${titleIncludesOtherMascot}`);
      console.log(`  title includes other: ${titleIncludesOther}`);

      if (titleIncludesOtherMascot || titleIncludesOther) {
        console.log(`  -> RETURNING ${other} DUE TO MASCOT CONTAMINATION`);
        return other;
      } else {
        console.log(`  -> Mascot check passed (no contamination)`);
      }
    }

    // 3. Bidirectional substring skip (Arkansas contains Kansas)
    const biSubstring =
      targetLower.includes(oLower) || oLower.includes(targetLower);
    console.log(
      `  bidirectional substring (target in other or other in target): ${biSubstring}`,
    );
    if (biSubstring) {
      console.log(
        `  -> SKIPPING remaining checks due to bidirectional substring`,
      );
      continue;
    }

    // 4. Strict boundary check for other schools
    const escaped = oLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    console.log(`  escaped pattern: /\\b${escaped}\\b/`);
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    const strictMatch = regex.test(titleLower);
    console.log(`  strictMatch: ${strictMatch}`);

    if (strictMatch) {
      console.log(
        `  -> RETURNING ${other} DUE TO STRICT BOUNDARY CONTAMINATION`,
      );
      return other;
    } else {
      console.log(`  -> Strict boundary check passed (no contamination)`);
    }
  }
  console.log(`  -> NO CONTAMINATION DETECTED WITH ANY SCHOOL`);
  return null;
}

// Test the exact case
const result = checkContamination(
  "Arizona State Sun Devils Baseball Camp",
  "Arizona State",
  ["Arizona", "Arizona State"],
);

console.log(`\nFINAL RESULT: ${result}`);
