const fs = require("fs");
const path = require("path");

// ──────────────────────────────────────────────────────────────
// merge_baseballcampsusa_v2.js
//
// Intelligent merge using mascot_lookup.js for high-fidelity
// matching between baseballcampsusa_parsed.json (309 entries)
// and camps_data.json (521 schools).
//
// Scoring: mascot signal, word overlap, disambiguation penalties
// Min threshold: 50 — anything below is rejected.
//──────────────────────────────────────────────────────────────

const campsPath = path.join(__dirname, "camps_data.json");
const parsedPath = path.join(__dirname, "baseballcampsusa_parsed.json");
const mascotPath = path.join(__dirname, "src", "utils", "mascot_lookup.js");

const campsData = JSON.parse(fs.readFileSync(campsPath, "utf8"));
const parsedData = JSON.parse(fs.readFileSync(parsedPath, "utf8"));

const { getMascot } = require(mascotPath);

// ── Configuration ──────────────────────────────────────────
const MIN_SCORE = 50;

// Disambiguator tokens: if the parsed listing contains one of these
// words but our camps entry does NOT, it's almost certainly a
// different school. Heavy penalty applied.
const DISAMBIGUATORS = [
  "monticello",
  "tech",
  "wesleyan",
  "college",
  "christian",
  "community",
  "junior",
  "academy",
  "institute",
  "seminary",
  "prep",
  "military",
  "biblical",
  "divinity",
  "theological",
];

// ── Helpers ────────────────────────────────────────────────

/**
 * Tokenize a string into meaningful words, removing noise.
 */
function tokenize(str) {
  return str
    .toLowerCase()
    .replace(/\band\b|\bor\b|\bof\b|\bthe\b|\bfor\b/g, "")
    .split(/[^a-z0-9&'-]+/)
    .filter((w) => w.length > 1);
}

/**
 * Check if a string contains a whole-word match (case-insensitive).
 * Uses word boundaries to avoid substring contamination.
 */
function wordContains(haystack, needle) {
  const lowerH = haystack.toLowerCase();
  const lowerN = needle.toLowerCase();
  // Try exact word boundary match first
  const regex = new RegExp(`\\b${escapeRegex(lowerN)}\\b`, "i");
  return regex.test(haystack);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Compute word overlap score between two sets of tokens.
 */
function overlapScore(tokensA, tokensB) {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setB = new Set(tokensB);
  const matches = tokensA.filter((t) => setB.has(t)).length;
  // Normalize by the smaller set — this rewards recall
  const denom = Math.min(tokensA.length, tokensB.length);
  return (matches / denom) * 100;
}

/**
 * Check if the parsed listing contains a disambiguator
 * that is NOT present in the target university name.
 */
function disambiguationPenalty(parsedTokens, uniName) {
  let penalty = 0;
  const uniLower = uniName.toLowerCase();

  for (const token of DISAMBIGUATORS) {
    const inParsed = parsedTokens.includes(token);
    const inUni = uniLower.includes(token);
    if (inParsed && !inUni) {
      penalty += 50; // Heavy: likely a different institution
    } else if (inParsed && inUni) {
      penalty += 0; // Both have it — neutral
    }
  }
  return penalty;
}

/**
 * Extract the core name from a parsed school entry.
 * E.g. "Alabama Crimson Tide Baseball Camps" → "Alabama Crimson Tide"
 *      "Abilene Christian - Baseball" → "Abilene Christian"
 */
function extractCoreName(rawName) {
  return rawName
    .replace(/\s*[-–—]\s*Baseball.*$/i, "")
    .replace(/\s*Baseball\s+Camps?$/i, "")
    .replace(/\s*Camps?$/i, "")
    .trim();
}

// ── Main matching logic ────────────────────────────────────

let matchedCount = 0;
let updatedCount = 0;
let skippedCount = 0;
const matchLog = [];

for (const entry of parsedData) {
  const parsedName = entry.school;
  const parsedUrl = entry.url;
  const parsedCore = extractCoreName(parsedName);
  const parsedTokens = tokenize(parsedName);

  // Score every school in camps_data
  const candidates = [];

  for (const school of campsData) {
    const uniName = school.university;
    const uniTokens = tokenize(uniName);

    // ── 1. Mascot Signal (HIGH) ──────────────────────────
    const mascot = getMascot(uniName);
    let mascotScore = 0;
    if (mascot) {
      // Check if mascot appears in the parsed listing (word boundary)
      if (wordContains(parsedName, mascot)) {
        mascotScore = 40; // Strong positive signal
      } else {
        // Mascot plural/singular variants
        if (mascot.endsWith("s")) {
          const singular = mascot.slice(0, -1);
          if (wordContains(parsedName, singular)) {
            mascotScore = 40;
          }
        } else {
          const plural = mascot + "s";
          if (wordContains(parsedName, plural)) {
            mascotScore = 40;
          }
        }
      }
    }

    // ── 2. Core Name / University Match ──────────────────
    const uniCoreTokens = tokenize(uniName);
    const wordOverlap = overlapScore(parsedTokens, uniTokens);

    // ── 3. Exact / Alias Match Bonus ─────────────────────
    let exactBonus = 0;
    if (parsedCore.toLowerCase() === uniName.toLowerCase()) {
      exactBonus = 30;
    } else if (parsedName.toLowerCase().includes(uniName.toLowerCase())) {
      exactBonus = 20;
    } else if (uniName.toLowerCase().includes(parsedCore.toLowerCase())) {
      exactBonus = 15;
    }

    // ── 4. Disambiguation Penalty ────────────────────────
    const penalty = disambiguationPenalty(parsedTokens, uniName);

    // ── 5. ALABAMA RULE (legacy protection) ──────────────
    const isAlabamaSpecial =
      uniName.toLowerCase() === "alabama" ||
      parsedCore.toLowerCase() === "alabama";
    if (
      isAlabamaSpecial &&
      uniName.toLowerCase() !== "alabama" &&
      parsedCore.toLowerCase() !== "alabama"
    ) {
      continue; // Skip contamination
    }
    if (
      uniName.toLowerCase() === "alabama" &&
      parsedCore.toLowerCase() !== "alabama"
    ) {
      continue;
    }
    if (
      parsedCore.toLowerCase() === "alabama" &&
      uniName.toLowerCase() !== "alabama"
    ) {
      continue;
    }

    // ── Composite Score ──────────────────────────────────
    const score = mascotScore + wordOverlap + exactBonus - penalty;

    if (score > 0) {
      candidates.push({
        school,
        score,
        mascotScore,
        wordOverlap,
        exactBonus,
        penalty,
      });
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    skippedCount++;
    continue;
  }

  // ── Ambiguity Check ──────────────────────────────────────
  // If the top two candidates are very close in score, skip to avoid false matches.
  const best = candidates[0];
  const second = candidates[1];

  if (
    second &&
    second.score >= best.score * 0.75 &&
    second.score >= MIN_SCORE
  ) {
    // Ambiguous: two schools score similarly
    skippedCount++;
    matchLog.push({
      type: "AMBIGUOUS",
      parsed: parsedName,
      candidates: candidates.slice(0, 3).map((c) => ({
        school: c.school.university,
        score: c.score,
      })),
    });
    continue;
  }

  // ── Threshold Check ──────────────────────────────────────
  if (best.score < MIN_SCORE) {
    skippedCount++;
    continue;
  }

  // ── URL Update Logic ─────────────────────────────────────
  matchedCount++;
  const existingUrl = best.school.url || "";
  const existingSourceUrl = best.school.sourceUrl || "";

  // Determine if the new URL is "better"
  const newUrl = parsedUrl.replace(/\/$/, ""); // Strip trailing slash for comparison
  const existingClean = existingUrl.replace(/\/$/, "");
  const sourceClean = existingSourceUrl.replace(/\/$/, "");

  const isAlreadySame = newUrl === existingClean || newUrl === sourceClean;

  if (isAlreadySame) {
    continue; // Already have this URL
  }

  // Heuristics: is the new URL baseball-camp-specific?
  const newUrlIsCampSpecific = /baseball|camp|ryzer/i.test(newUrl);

  const existingIsGeneric =
    !existingUrl ||
    /athletics\.com$|\/athletics$|\.edu\/\w+\/baseball$/i.test(existingClean) ||
    existingClean === "" ||
    existingClean === "N/A" ||
    existingClean === "TBA";

  if (newUrlIsCampSpecific || existingIsGeneric) {
    best.school.url = newUrl;
    best.school.sourceUrl = newUrl;
    best.school.isChecked = false;
    best.school.auditStatus = "NEW_SOURCE_DETECTED";
    updatedCount++;
    matchLog.push({
      type: "UPDATED",
      parsed: parsedName,
      university: best.school.university,
      score: best.score,
      oldUrl: existingClean,
      newUrl,
      mascotScore: best.mascotScore,
      wordOverlap: Math.round(best.wordOverlap),
      penalty: best.penalty,
    });
  } else {
    matchLog.push({
      type: "SKIPPED_URL",
      parsed: parsedName,
      university: best.school.university,
      score: best.score,
      reason: "existing URL appears adequate",
      existingUrl: existingClean,
      newUrl,
    });
  }
}

// ── Save ───────────────────────────────────────────────────
fs.writeFileSync(campsPath, JSON.stringify(campsData, null, 2));

// ── Summary ────────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════════");
console.log("  baseballcampsusa_v2 Merge Summary");
console.log("═══════════════════════════════════════════════════");
console.log(`  Parsed entries processed:  ${parsedData.length}`);
console.log(`  High-confidence matches:   ${matchedCount}`);
console.log(`  URLs updated:              ${updatedCount}`);
console.log(`  Skipped (low/ambiguous):   ${skippedCount}`);
console.log("═══════════════════════════════════════════════════\n");

// Print updated entries
const updates = matchLog.filter((m) => m.type === "UPDATED");
if (updates.length > 0) {
  console.log("UPDATED URLs:");
  for (const u of updates) {
    console.log(
      `  ${u.university}` +
        `\n    Score: ${u.score} (mascot=${u.mascotScore}, overlap=${u.wordOverlap}, penalty=${u.penalty})` +
        `\n    ${u.oldUrl || "EMPTY"} → ${u.newUrl}`,
    );
  }
}

// Print ambiguous entries for manual review
const ambiguous = matchLog.filter((m) => m.type === "AMBIGUOUS");
if (ambiguous.length > 0) {
  console.log(`\nAMBIGUOUS (${ambiguous.length} — manual review recommended):`);
  for (const a of ambiguous) {
    console.log(
      `  "${a.parsed}" → ${a.candidates.map((c) => `${c.school} (${c.score})`).join(", ")}`,
    );
  }
}

// Print skipped-url entries
const skippedUrls = matchLog.filter((m) => m.type === "SKIPPED_URL");
if (skippedUrls.length > 0) {
  console.log(`\nSKIPPED URL UPDATES (${skippedUrls.length}):`);
  for (const s of skippedUrls) {
    console.log(
      `  ${s.university}: "${s.existingUrl}" (new: ${s.newUrl}, score: ${s.score})`,
    );
  }
}

console.log(`\nDone. ${updatedCount} URLs written to camps_data.json`);
