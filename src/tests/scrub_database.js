"use strict";

const fs = require("fs");
const path = require("path");
const { 
  REJECT_SPORTS, 
  isWrongSport, 
  isTeamCampOrLegacy,
  GENERIC_EMAIL_PREFIXES,
  BLACKLISTED_EMAIL_DOMAINS,
  isBlacklistedUrl
} = require("../utils/config");
const { applyCompletenessFlags } = require("../utils/field_checker");

const DATA_PATH = path.resolve(__dirname, "../../camps_data.json");
const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

const fixMode = process.argv.includes("--fix");

const JUNK_EMAILS = [
  "integrity-finance.com",
  "domain.com",
  "parking.com",
  "parked.com",
  "placeholder",
  "example.com",
  "your-company.com",
  "bocaratontribune.com",
  "kidvoyage.com"
];

function cleanText(text) {
  if (!text) return "";
  return text
    .replace(/[\u2028\u2029]/g, "") // Strip hidden line separators
    .replace(/\s+/g, " ")
    .trim();
}

let sportPurges = 0;
let legacyPurges = 0;
let junkTextPurges = 0;
let tbaFixes = 0;
let emailPurges = 0;
let pricePurges = 0;

data.forEach((school) => {
  if (school.isVerified) return; // Never touch manually verified

  let modified = false;

  // Global Text Normalization
  ["dates", "cost", "details", "whatToBring", "pointOfContact", "contact"].forEach(field => {
    if (school[field]) {
      const cleaned = cleanText(school[field]);
      if (cleaned !== school[field]) {
        school[field] = cleaned;
        modified = true;
      }
    }
  });

  // --- 1. Sport Validation ---
  const urlsToCheck = [school.campUrl, school.sourceUrl, school.logoDomain].filter(Boolean);
  const foundWrongSport = urlsToCheck.some(url => {
    const lower = url.toLowerCase();
    return REJECT_SPORTS.some(sport => lower.includes(sport) && !lower.includes("baseball"));
  });

  if (foundWrongSport) {
    sportPurges++;
    if (fixMode) {
      school.dates = "TBA";
      school.cost = "TBA";
      school.campTiers = [];
      school.details = "Blacklisted wrong sport domain detected.";
      school.campUrl = "TBA";
      modified = true;
    }
  }

  // --- 2. Stale Legacy Data (2025/2024) ---
  const legacyContext = [school.dates, school.campUrl, school.sourceUrl, JSON.stringify(school.campTiers)].filter(Boolean).join(" ");
  if (isTeamCampOrLegacy(legacyContext)) {
    legacyPurges++;
    if (fixMode) {
      school.dates = "TBA";
      school.cost = "TBA";
      school.campTiers = [];
      school.details = "Legacy 2025 data purged.";
      modified = true;
    }
  }

  // --- 3. Junk Text Density Filter ---
  const textFields = [school.details, school.whatToBring].filter(Boolean);
  const hasJunkText = textFields.some(text => {
    const lower = text.toLowerCase();
    const navKeywords = ["skip ad", "opens in new window", "facebook", "twitter", "instagram", "youtube", "privacy policy"];
    const count = navKeywords.filter(kw => lower.includes(kw)).length;
    return count >= 3 || text.length > 1000; // Suspect if heavily navigation-linked or massive
  });

  if (hasJunkText) {
    junkTextPurges++;
    if (fixMode) {
      school.details = "";
      school.whatToBring = "Necessary Equipment:\nGlove, bat, helmet, cleats, baseball pants, water bottle, sunscreen.";
      modified = true;
    }
  }

  // --- 4. TBA Mismatch (TBA but has sub-dates) ---
  if (school.dates !== "TBA" && (!school.campTiers || school.campTiers.length === 0)) {
    tbaFixes++;
    // This implies we found some text which might be dates but no tiers. Recheck.
    if (fixMode) modified = true; 
  }

  // --- 5. Junk Email/POC Purge ---
  const emailFields = [school.email, school.campPOCEmail].filter(Boolean);
  const isJunkEmail = emailFields.some(email => {
    const lower = email.toLowerCase();
    const [prefix, domain] = lower.split("@");
    if (GENERIC_EMAIL_PREFIXES.includes(prefix)) return true;
    if (BLACKLISTED_EMAIL_DOMAINS.includes(domain)) return true;
    if (JUNK_EMAILS.some(junk => lower.includes(junk))) return true;
    return false;
  });

  if (isJunkEmail) {
    emailPurges++;
    if (fixMode) {
      school.email = "N/A";
      school.campPOCEmail = "N/A";
      school.pointOfContact = "N/A";
      school.contact = (school.contact || "").split("|")[0].trim(); // Keep name if exists
      modified = true;
    }
  }

  // --- 6. Price Anomaly Purge ---
  if (school.cost && school.cost !== "TBA" && school.cost !== "FREE") {
    const { PRICE_THRESHOLDS, COST_NUMERIC_PATTERN } = require("../utils/config");
    COST_NUMERIC_PATTERN.lastIndex = 0;
    const matches = [...school.cost.matchAll(COST_NUMERIC_PATTERN)];
    if (matches.length > 0) {
      const isBadPrice = matches.some(m => {
        const val = parseFloat(m[1].replace(/,/g, ""));
        return !isNaN(val) && val < PRICE_THRESHOLDS.CRITICAL_ANOMALY;
      });

      if (isBadPrice) {
        pricePurges++;
        if (fixMode) {
          school.cost = "TBA";
          school.campTiers = (school.campTiers || []).map(t => ({...t, cost: "TBA"}));
          school.details = (school.details || "") + "\nPurged suspicious low price (below schema threshold).";
          modified = true;
        }
      }
    }
  }

  // --- 7. Apply Final Flags & Queue for Engine ---
  // V12.5 Hardening: If record has purged data but is still marked 'checked', force a re-queue
  const isStuck = school.isChecked && (school.details || "").includes("Purged");
  
  if ((modified || isStuck) && fixMode) {
    applyCompletenessFlags(school); // Re-flag what's missing now
    school.isChecked = false; // Bypass TTL for a fresh repair run
    school.lastChecked = null; // Ensure it looks "New" to the engine
    school.scriptVersion = 12.5; // Mark as eligible for V12.5 repair
  }
});

console.log("\n--- ATOMIC SCRUBBER REPORT ---");
console.log(`Wrong Sport Domains Purged:      ${sportPurges}`);
console.log(`Legacy 2025 Data Purged:         ${legacyPurges}`);
console.log(`Junk Navigation Text Purged:     ${junkTextPurges}`);
console.log(`TBA/Tier Mismatches Flagged:     ${tbaFixes}`);
console.log(`Junk Emails Purged:              ${emailPurges}`);
console.log(`Price Anomalies Purged:          ${pricePurges}`);
console.log(`------------------------------`);

if (fixMode) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  console.log("\n[SUCCESS] Script executed with --fix. Database scrubbed and targets re-queued.");
} else {
  console.log("\nRun with --fix to apply these purges and re-queue affected schools.");
}

