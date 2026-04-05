"use strict";

/**
 * Checks for cross-contamination between universities with similar names
 * (e.g., "Alabama" vs "Alabama State", "Arkansas" vs "Kansas").
 *
 * Also optionally checks for Mascot-based contamination if mascotLookup is provided.
 *
 * @param {string} text - The raw text/URL to check.
 * @param {string} targetUniversity - The university we are looking for.
 * @param {Array<string>} allUniversities - List of all known universities.
 * @param {Object} mascotLookup - Optional { [uni]: mascot } map.
 * @returns {boolean} - true if contaminated, false otherwise.
 */
function isContaminated(
  text,
  targetUniversity,
  allUniversities,
  mascotLookup = null,
) {
  if (!text || !targetUniversity || !allUniversities) return false;

  const textLower = text.toLowerCase();
  const targetLower = targetUniversity.toLowerCase();

  // 1. Initial check: Does the text even contain our target?
  if (!textLower.includes(targetLower)) {
    // If no name match, check mascot match?
    // No, isContaminated is for FALSE POSITIVES.
    // If name isn't there, there's no contamination to worry about (it's a No Match).
    return false;
  }

  // 2. Name-based Contamination (Substrings)
  for (const uni of allUniversities) {
    const rivalLower = uni.toLowerCase();
    if (rivalLower === targetLower) continue;

    // Case A: Rival contains Target (e.g. Rival="Alabama State", Target="Alabama")
    if (rivalLower.includes(targetLower)) {
      if (textLower.includes(rivalLower)) {
        // Check if it's ONLY the rival or if target is standalone too.
        // For safety in automation, if the larger rival is present, we flag as contaminated.
        return true;
      }
    }

    // Case B: Target contains Rival (e.g. Target="Arkansas", Rival="Kansas")
    // This is handled automatically by the loop when it reaches "Arkansas" vs "Kansas".
  }

  // 3. Mascot-based Contamination (Identity Logic)
  // If we are looking for "Florida State" (Seminoles), but the page has "Gators" (UF), fail.
  if (mascotLookup) {
    const targetMascot = (mascotLookup[targetUniversity] || "").toLowerCase();

    for (const uni of allUniversities) {
      if (uni === targetUniversity) continue;

      // If the rival school's name is a substring of our target's name (e.g. "Florida" is in "Florida State")
      // OR if our target's name is a substring of the rival's name (e.g. "Arkansas" in "Arkansas State")
      // then we check the rival's mascot.
      if (
        uni.toLowerCase().includes(targetLower) ||
        targetLower.includes(uni.toLowerCase())
      ) {
        const rivalMascot = (mascotLookup[uni] || "").toLowerCase();
        // Skip shared mascots (e.g. "Knights" for UCF and Bellarmine) to avoid false contamination
        if (
          rivalMascot &&
          rivalMascot.length > 3 &&
          rivalMascot !== targetMascot &&
          textLower.includes(rivalMascot)
        ) {
          // If the text mentions the mascot of a name-overlapping rival, it's contaminated.
          // e.g., Target="Florida State", Rival="Florida", Text contains "Gators" -> return true.
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Strict boundary matcher to ensure "Florida" matches exactly, not just "Florida State".
 */
function isStrictBoundaryMatch(text, target) {
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  return regex.test(text);
}

module.exports = { isContaminated, isStrictBoundaryMatch };
