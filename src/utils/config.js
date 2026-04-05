"use strict";

const fs = require("fs");
const path = require("path");

// ── Master Blacklist Loader ──────────────────────────────────
const BLACKLIST_FILE = path.join(__dirname, "../../blacklist.json");
const BLACKLISTED_DOMAINS = JSON.parse(
  fs.readFileSync(BLACKLIST_FILE, "utf8"),
).domains;

// ── Unified Extraction Constants ──────────────────────────────
const CURRENT_SCRIPT_VERSION = 14;

const DATE_PATTERNS = [
  /\b(jun|jul|aug)[a-z]*\.?\s+\d{1,2}(?:[-–]\d{1,2})?,?\s*2026/gi,
  /\b0?[678]\/\d{1,2}\/2026/g,
  /\b2026[-/]0?[678][-/]\d{2}/g,
];

const COST_PATTERN = /\$\s*(\d[\d,.]*(?:\.\d{2})?)/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const REJECT_SPORTS = [
  "football",
  "basketball",
  "soccer",
  "tennis",
  "swimming",
  "golf",
  "volleyball",
  "wrestling",
  "lacrosse",
  "softball",
  "hockey",
  "track and field",
];

const OFFICIAL_PLATFORMS = [
  "ryzer.com",
  "thegoodgame.com",
  "totalcamps.com",
  "eventlink.com",
  "campsnetwork.com",
  "abcsportscamps.com",
  "playnsports.com",
  "reflow.com",
  "active.com",
  "activekids.com",
];

const COST_RANGE = {
  MIN: 100,
  MAX: 1500,
  SUSPICIOUS_MIN: 75,
};

const GENERIC_EMAIL_PREFIXES = [
  "example",
  "noreply",
  "sentry",
  "webmaster",
  "support",
];
const SUBDOMAIN_BLACKLIST_PREFIXES = [
  "m.",
  "mobile.",
  "beta.",
  "dev.",
  "stage.",
];

// ── Shared Logic Helpers ─────────────────────────────────────
function isBlacklistedUrl(url) {
  if (!url) return true;
  const lower = url.toLowerCase();
  return BLACKLISTED_DOMAINS.some((domain) =>
    lower.includes(domain.toLowerCase()),
  );
}

function isWrongSport(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  if (
    lower.includes("baseball") ||
    lower.includes("pitcher") ||
    lower.includes("hitting")
  )
    return false;
  return REJECT_SPORTS.some(
    (sport) =>
      lower.includes(sport + " camp") || lower.includes(sport + " clinic"),
  );
}

function isTeamCampOrLegacy(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  const has2025 = lower.includes("2025");
  const has2026 = lower.includes("2026");
  if (has2025 && !has2026) return true;
  const isTeamCamp = /\bteam\s+camp\b/i.test(lower);
  // Reject "team camp" standalone but allow when it also mentions individual camps
  if (isTeamCamp && !lower.includes("individual")) return true;
  return false;
}

function isOfficialPlatform(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return OFFICIAL_PLATFORMS.some((platform) => lower.includes(platform));
}

const OFFICIAL_PLATFORM_SCORE_BONUS = 50;

module.exports = {
  BLACKLISTED_DOMAINS,
  REJECT_SPORTS,
  OFFICIAL_PLATFORMS,
  DATE_PATTERNS,
  COST_PATTERN,
  EMAIL_PATTERN,
  COST_RANGE,
  GENERIC_EMAIL_PREFIXES,
  SUBDOMAIN_BLACKLIST_PREFIXES,
  CURRENT_SCRIPT_VERSION,
  OFFICIAL_PLATFORM_SCORE_BONUS,
  isBlacklistedUrl,
  isWrongSport,
  isTeamCampOrLegacy,
  isOfficialPlatform,
};
