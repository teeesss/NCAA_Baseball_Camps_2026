"use strict";

/**
 * Merge playnsports.com data (school+mascot + URL) into camps_data.json.
 *
 * Strategy: Strip mascot from playnsports school name, then match DB universities
 * by normalized name. MASCOT IS USED ONLY FOR VERIFICATION, not for matching.
 * This prevents false matches from generic mascots.
 *
 * Usage: node merge_playnsports_with_mascots.js
 */

const fs = require("fs");
const { MASCOT_LOOKUP } = require("./src/utils/mascot_lookup.js");

const pnData = JSON.parse(fs.readFileSync("!playnsports_clean.json", "utf8"));
const data = JSON.parse(fs.readFileSync("camps_data.json", "utf8"));

// ── Build reverse mascot map: normalized mascot -> count of schools ──
const mascotFreq = {};
for (const [, mascot] of Object.entries(MASCOT_LOOKUP)) {
  const key = mascot.toLowerCase().replace(/[^a-z0-9]/g, "");
  mascotFreq[key] = (mascotFreq[key] || 0) + 1;
}

// ── Build DB lookup: normalized school name -> record ──
// We build MULTIPLE normalized variants per school for matching
const dbSchools = data.map((s) => ({
  record: s,
  uni: s.university,
  mascot: (MASCOT_LOOKUP[s.university] || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""),
}));

// Normalizer: strip filler words, lowercase, remove non-alnum
function norm(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(
      /\b( university|college|state\b| tech\b| a&m\b| and\b| at\b| the\b| of\b| for\b| in\b| on\b| north\b| south\b| east\b| west\b| eastern\b| western\b| northern\b| southern\b| central\b)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, "");
}

// ── Known mascot suffixes to strip from playnsports entries (sorted longest first) ──
const MASCOT_SUFFIXES = `
abilene christian wildcats adams state grizzlies air force falcons akron zips
alcorn state braves appalachian state mountaineers arizona state sun devils
arizona wildcards bethany lutheran vikings biola eagles bradley braves
brevard tornados bryant stratton bobcats bushnell beacons butler bulldogs
cal poly mustangs camp hurricanes campbell camels campbellsville tigers
carl albert state vikings catawba indians charleston cougars charlotte 49ers
clarke pride clemson tigers cleveland community college yetis coker cobras
concord mountain lions connors state cowboys cox high falcons creighton bluejays
csun matadors dakota state trojans davidson wildcats davis elkins senators
dayton flyers daytona state falcons decatur high eagles dordt defenders
duke blue devils east carolina pirates east georgia state bobcats
eastern oklahoma state mountaineers elon phoenix ellsworth panthers
embry riddle eagles erskine flying fleet fairleigh dickinson devils
felician golden falcons florence darlington stingers francis marion patriots
frederick cougars fresno state bulldogs galveston whitecaps
gardner webb runnin bulldogs garrett lakers georgia bulldogs
georgia gwinnett grizzlies georgia southern eagles greensboro pride
high point panthers hope international royals houston christian huskies
jacksonville dolphins judson eagles lander bearcats le moyne dolphins
lebanon valley dutchmen lenoir community college lancers lenoir rhyne bears
limestone saints lincoln lions longwood lancers louisiana ragin cajuns
lycoming warriors maine black bears maryland terrapins mary washington eagles
mceachern high indians mcpherson bulldogs michigan wolverines
midamerica nazarene pioneers middle tennessee blue raiders misericordia cougars
missouri western griffons montreat cavaliers morehead state eagles mott bears
nc state wolfpack new mexico lobos new orleans privateers newberry wolves
nicholls state colonels north carolina a t aggies north florida ospreys
north greenville crusaders northeastern state riverhawks northern illinois huskies
northern kentucky norse northwestern state demons nova southeastern sharks
oklahoma christian eagles paine lions pomperaug high panthers
prairie view a m panthers presbyterian blue hose queens royals
quinnipiac bobcats reagan high raiders redlands community college cougars
redmond high panthers rice owls roanoke maroons rockingham eagles
sacred heart pioneers saint elizabeth eagles saint peter s peacocks
san diego state aztecs san diego toreros savannah state tigers
seminole state raiders south florida bulls southeast missouri state redhawks
southeastern blackhawks southwestern moundbuilders spring hill badgers
st andrews knights stanford cardinal tennessee tech golden eagles
texas state bobcats thomas night hawks toccoa falls screaming eagles
towson tigers trevecca nazarene trojans tulane green wave
tusculum pioneers uc riverside highlanders ucf knights uic flames
unc asheville bulldogs unc pembroke braves uncg spartans
usc beaufort sand sharks usc lancaster lancers usc upstate spartans
vcu rams virginia tech hokies wagner seahawks wake forest demon deacons
wake tech eagles wellington high crusaders widener pride wingate bulldogs
`
  .trim()
  .split(/\n/)
  .map((s) => s.trim());

// Build a set of all mascot words from the suffixes
const ALL_MASCOT_WORDS = new Set();
for (const suffix of MASCOT_SUFFIXES) {
  const parts = suffix.split(/\s+/);
  // The mascot is typically the last 1-3 words
  for (let i = Math.max(0, parts.length - 3); i < parts.length; i++) {
    ALL_MASCOT_WORDS.add(parts.slice(i).join(""));
  }
}

// Also add known common mascots
const COMMON_MASCOTS = [
  "wildcats",
  "eagles",
  "panthers",
  "bulldogs",
  "tigers",
  "bears",
  "lions",
  "hawks",
  "knights",
  "rams",
  "warriors",
  "spartans",
  "wolves",
  "cougars",
  "hornets",
  "crusaders",
  "falcon",
  "fencers",
  "cardinal",
];
COMMON_MASCOTS.forEach((m) => ALL_MASCOT_WORDS.add(m));

/**
 * Strip mascot suffix from a school name string.
 * Uses MASCOT_LOOKUP directly to verify.
 */
function stripMascot(fullName) {
  const lower = fullName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim();

  // Try stripping known mascots from the MASCOT_LOOKUP (longest first)
  const allMascots = [
    ...new Set(
      Object.values(MASCOT_LOOKUP).map((m) =>
        m
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .trim(),
      ),
    ),
  ].sort((a, b) => b.length - a.length);

  for (const mascot of allMascots) {
    const mascotWords = mascot.split(/\s+/);
    if (mascotWords.length <= 1) continue; // skip single-word mascots initially
    const mascotSuffix = " " + mascot;
    if (lower.endsWith(mascotSuffix)) {
      const schoolPart = lower
        .slice(0, lower.length - mascotSuffix.length)
        .trim();
      return {
        school: schoolPart,
        mascot: mascot.replace(/\s/g, ""),
      };
    }
  }

  // Try single-word mascots
  const words = lower.split(/\s+/);
  if (words.length <= 1) return { school: lower, mascot: "" };

  const lastWord = words[words.length - 1];
  const isMascot = ALL_MASCOT_WORDS.has(lastWord) || mascotFreq[lastWord] > 0;

  if (isMascot) {
    return {
      school: words.slice(0, -1).join(" "),
      mascot: lastWord,
    };
  }

  // Not a recognizable mascot
  return { school: lower, mascot: "" };
}

// ── Match each entry ──
const matches = [];
const uncertain = [];
const skipped = [];

for (const entry of pnData) {
  const { school: pnSchoolClean, mascot: pnMascot } = stripMascot(entry.school);
  const pnSchoolNorm = norm(pnSchoolClean);

  if (pnSchoolNorm.length < 3) {
    skipped.push({ entry, reason: "school name too short after stripping" });
    continue;
  }

  // ── Match against DB schools ──
  let bestMatch = null;
  let bestScore = 0;

  for (const db of dbSchools) {
    const dbNorm = norm(db.uni);

    // Exact normalized match
    if (pnSchoolNorm === dbNorm) {
      bestMatch = db;
      bestScore = 100;
      break;
    }

    // One contains the other (bidirectional check, both must be substantial)
    if (pnSchoolNorm.length > 4 && dbNorm.length > 4) {
      const contains =
        dbNorm.includes(pnSchoolNorm) || pnSchoolNorm.includes(dbNorm);
      // Additional check: if DB name contains PN name and they share significant overlap
      if (contains) {
        // Compute overlap ratio
        const shorter =
          pnSchoolNorm.length < dbNorm.length ? pnSchoolNorm : dbNorm;
        const longer =
          pnSchoolNorm.length < dbNorm.length ? dbNorm : pnSchoolNorm;
        // Check if shorter is a significant portion of longer
        const overlapRatio = shorter.length / longer.length;
        if (overlapRatio > 0.6) {
          const score = overlapRatio * 80;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = db;
          }
        }
      }
    }
  }

  if (!bestMatch) {
    skipped.push({
      entry,
      reason: "no school name match for: " + pnSchoolClean,
    });
    continue;
  }

  // ── Verify mascot ──
  const dbMascot = bestMatch.mascot;

  if (pnMascot && dbMascot && pnMascot === dbMascot) {
    // Perfect match: school + mascot both align
    matches.push({
      school: bestMatch.uni,
      url: entry.url,
      confidence: "HIGH",
      reason: "school+mascot exact",
    });
  } else if (pnMascot && dbMascot && pnMascot !== dbMascot) {
    // School name matched but mascot is wrong — could be wrong match
    uncertain.push({
      school: bestMatch.uni,
      url: entry.url,
      pnSchool: entry.school,
      dbMascot,
      pnMascot,
    });
  } else if (pnMascot && !dbMascot) {
    // Playnsports has mascot but DB doesn't - medium confidence
    matches.push({
      school: bestMatch.uni,
      url: entry.url,
      confidence: "MEDIUM",
      reason: "school match, no DB mascot",
    });
  } else {
    // No mascot on either side - school name match only
    matches.push({
      school: bestMatch.uni,
      url: entry.url,
      confidence: "MEDIUM",
      reason: "school name match only",
    });
  }
}

// ── Deduplicate matches ──
const seenSchools = new Set();
const deduped = [];
for (const m of matches) {
  if (!seenSchools.has(m.school)) {
    seenSchools.add(m.school);
    deduped.push(m);
  }
}

const highConf = deduped.filter((m) => m.confidence === "HIGH");
const medConf = deduped.filter((m) => m.confidence === "MEDIUM");

console.log("PlayNSports entries:", pnData.length);
console.log("HIGH confidence matches:", highConf.length);
console.log("MEDIUM confidence:", medConf.length);
console.log("Uncertain (school match, mascot mismatch):", uncertain.length);
console.log("Skipped:", skipped.length);

// ── Show all matches ──
console.log("\n=== HIGH CONFIDENCE (school+mascot exact) ===");
for (const m of highConf) {
  console.log("  " + m.school + " => " + m.url);
}

console.log("\n=== MEDIUM CONFIDENCE (review) ===");
for (const m of medConf) {
  console.log("  " + m.school + " => " + m.url + " [" + m.reason + "]");
}

if (uncertain.length > 0) {
  console.log("\n=== UNCERTAIN (school matches but mascot DOES NOT) ===");
  for (const u of uncertain) {
    console.log(
      "  " +
        u.school +
        " (DB mascot: " +
        u.dbMascot +
        ') vs "' +
        u.pnSchool +
        '" (PN mascot: ' +
        u.pnMascot +
        ")",
    );
  }
}

// ── Apply ONLY HIGH confidence matches ──
const dataMap = {};
data.forEach((s) => (dataMap[s.university] = s));

let applied = 0;
const appliedList = [];

for (const m of highConf) {
  const rec = dataMap[m.school];
  if (!rec) continue;

  const existingUrl = (rec.campUrl || "").replace(/\/$/, "").toLowerCase();
  const newUrl = m.url.replace(/\/$/, "");
  if (existingUrl && existingUrl === newUrl.toLowerCase()) continue;

  rec.url = m.url;
  rec.campUrl = m.url + "/";
  rec.isChecked = false;
  rec.auditStatus = "NEW_SOURCE_DETECTED";
  rec.sourceUrl = "https://playnsports.com";
  applied++;
  appliedList.push({ school: m.school, url: m.url });
}

appliedList.sort((a, b) => a.school.localeCompare(b.school));
console.log("\n=== Applied (" + applied + " HIGH confidence URL updates) ===");
for (const u of appliedList) {
  console.log("  " + u.school + " => " + u.url);
}

console.log("\nDone. Applied " + applied + " URL updates.");
fs.writeFileSync("camps_data.json", JSON.stringify(data, null, 2));
