/**
 * Clean up remaining issues from !Task099.txt audit
 * Run after contact field normalization
 */
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../../camps_data.json");
const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

let fixes = 0;

// ── Fix 1: Multiple emails separated by | in campPOCEmail ──
data.forEach((s) => {
  if (!s.campPOCEmail) return;
  if (s.campPOCEmail.includes("|")) {
    // Take the first email (most relevant to the school)
    const emails = s.campPOCEmail.split("|").map((e) => e.trim());
    // Prefer the email from the school's own domain
    const uni = s.university.toLowerCase();
    // Extract likely domain parts from university name
    const domainMatch = s.campUrl?.match(/:\/\/(?:www\.)?([^/]+)/);
    const host = domainMatch ? domainMatch[1] : "";

    const chosen =
      emails.find((e) => host && e.toLowerCase().includes(host)) || emails[0];

    if (chosen !== s.campPOCEmail) {
      console.log(
        `[${fixes + 1}] ${s.university}: Multiple emails "${s.campPOCEmail}" → "${chosen}"`,
      );
      s.campPOCEmail = chosen;
      fixes++;
    }
  }
});

// ── Fix 2: Legacy 2025 dates contamination ──
data.forEach((s) => {
  if (!s.dates || s.dates === "TBA") return;
  const dates = s.dates.split("|").map((d) => d.trim());
  const has2025 = dates.some((d) => d.includes("2025") && !d.includes("2026"));
  if (has2025) {
    // Keep only 2026 dates
    const filtered = dates.filter(
      (d) => !d.includes("2025") || d.includes("2026"),
    );
    if (filtered.length === 0) {
      s.dates = "TBA";
    } else {
      s.dates = filtered.join(" | ");
    }
    console.log(
      `[${fixes + 1}] ${s.university}: Removed 2025 dates → "${s.dates}"`,
    );
    fixes++;
  }
});

// ── Fix 3: Contaminated campTiers (non-baseball content) ──
const nonBaseballKeywords = [
  "piano",
  "soccer",
  "ice hockey",
  "band camp",
  "softball",
  "swimming",
  "tennis",
  "wrestling",
  "volleyball",
  "basketball",
  "football",
  "gymnastics",
  "cheer",
  "lacrosse",
];

data.forEach((s) => {
  if (!s.campTiers || s.campTiers.length === 0) return;
  const originalLen = s.campTiers.length;
  const filtered = s.campTiers.filter((t) => {
    const text = (t.name || "").toLowerCase();
    return !nonBaseballKeywords.some((kw) => text.includes(kw));
  });
  if (filtered.length < originalLen) {
    s.campTiers = filtered;
    console.log(
      `[${fixes + 1}] ${s.university}: Removed ${originalLen - filtered.length} non-baseball tiers (${originalLen} → ${filtered.length})`,
    );
    fixes++;
  }
});

// ── Fix 4: Suspicious $1 prices in campTiers ──
data.forEach((s) => {
  if (!s.campTiers || s.campTiers.length === 0) return;
  let changed = false;
  s.campTiers.forEach((t) => {
    if (t.cost === "$1" || t.cost === "$1.00") {
      t.cost = "TBA";
      changed = true;
    }
  });
  if (changed) {
    console.log(`[${fixes + 1}] ${s.university}: Fixed suspicious $1 prices`);
    fixes++;
  }
});

// ── Fix 5: Conflicting fields (dates exist but details say "No 2026 camps") ──
const conflictingSchools = ["Richmond", "Ouachita Baptist", "Thomas Jefferson"];
data.forEach((s) => {
  if (conflictingSchools.some((n) => s.university.includes(n))) {
    if (
      s.details &&
      s.details.toLowerCase().includes("no 2026 camps posted") &&
      s.dates &&
      s.dates !== "TBA"
    ) {
      console.log(
        `[${fixes + 1}] ${s.university}: Dates conflict with details. Details: "${s.details}"`,
      );
      // Don't auto-fix — flag for review
      fixes++;
    }
  }
});

fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

console.log(`\n✅ Cleaned ${fixes} issues`);
