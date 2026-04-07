"use strict";

const fs = require("fs");
const path = require("path");

// ── Master Blacklist Loader ──────────────────────────────────
const BLACKLIST_FILE = path.join(__dirname, "../../blacklist.json");
const BLACKLISTED_DOMAINS = JSON.parse(
  fs.readFileSync(BLACKLIST_FILE, "utf8"),
).domains;

// ── Unified Extraction Constants ─────────────────────────────
// SINGLE SOURCE OF TRUTH — all scripts must require() from here.
// Never hardcode these values in runner scripts or engine files.
const CURRENT_SCRIPT_VERSION = 10; // V10 unified engine

// Summer-only date patterns (Jun/Jul/Aug). Includes date ranges (Jun 15-18).
const DATE_PATTERNS = [
  // Named month with optional range: "June 15", "July 7-10", "Aug 3, 2026"
  /\b(jun(?:e)?|jul(?:y)?|aug(?:ust)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*[-–]\s*\d{1,2}(?:st|nd|rd|th)?)?(?:,?\s*2026)?/gi,
  // Numeric summer dates: 6/15/2026, 07/08/26
  /\b0?[678]\/(?:0[1-9]|[12]\d|3[01])(?:\/(?:2026|26))?/g,
  // ISO format: 2026-06-15
  /\b2026[-/]0?[678][-/]\d{2}/g,
];

// Stale years to reject when found without 2026 context
const STALE_YEARS = ["2021", "2022", "2023", "2024", "2025"];

// Cost pattern: single prices, ranges ($175-$225), FREE, Complimentary, + suffix
const COST_PATTERN =
  /\$[\d,]+(?:\.\d{2})?(?:\s*[-–\/]\s*\$[\d,]+(?:\.\d{2})?)?(?:\s*\+)?|FREE|Complimentary|No cost|Free of charge/gi;

// Simpler pattern for numeric extraction (captures the digit group after $)
const COST_NUMERIC_PATTERN = /\$\s*(\d[\d,.]*(?:\.\d{2})?)/g;

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Camp tier name extraction — used in extractDataFromText
const CAMP_NAME_PATTERN =
  /([A-Z][A-Za-z0-9\s\/&\-]+(?:Camp|Clinic|Prospect|Showcase|Elite|Year-Round|Program|Academy|Session|Tournament|Tryout))/;

// Phrases that indicate a portal has no upcoming camps — do NOT store data if found
const NO_EVENTS_PHRASES = [
  "no upcoming events",
  "currently there are no upcoming",
  "check back soon",
  "no camps scheduled",
  "no events scheduled",
  "coming soon",
  "camps will be posted",
  "dates to be announced",
  "check back later",
  "no events at this time",
];

// Sub-crawl link keywords — what links to follow during deep page crawl
const SUB_CRAWL_KEYWORDS = [
  "camp",
  "clinic",
  "register",
  "prospect",
  "showcase",
  "detail",
  "event",
  "elite",
  "youth",
  "summer",
  "pricing",
];

// Search providers (DDG, Bing, Yahoo) — deterministic round-robin by school DB index
const SEARCH_PROVIDERS = [
  {
    name: "DDG",
    url: (q) => `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
    selector: ".result__a",
  },
  {
    name: "Bing",
    url: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
    selector: "li.b_algo h2 a",
  },
  {
    name: "Yahoo",
    url: (q) => `https://search.yahoo.com/search?p=${encodeURIComponent(q)}`,
    selector: "h3.title a, div.algo h3 a, .compTitle a",
  },
];

// Browser restart interval (schools per restart) — prevents memory leaks
const BROWSER_RESTART_EVERY = 10;

// Per-school processing timeout in milliseconds
const SCHOOL_TIMEOUT_MS = 90000;

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

const PRICE_THRESHOLDS = {
  CRITICAL_ANOMALY: 5, // < $5 -> Auto-purge and requeue
  SUSPICIOUS_LOW: 50, // < $50 -> immediate flag for detailed look
  VERIFY_MANUALLY: 100, // < $100 -> flag, probably single day but verify
  MAX_EXPECTED: 1500, // > $1500 -> suspicious high
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
  // Constants
  BLACKLISTED_DOMAINS,
  REJECT_SPORTS,
  OFFICIAL_PLATFORMS,
  DATE_PATTERNS,
  STALE_YEARS,
  COST_PATTERN,
  COST_NUMERIC_PATTERN,
  EMAIL_PATTERN,
  CAMP_NAME_PATTERN,
  NO_EVENTS_PHRASES,
  SUB_CRAWL_KEYWORDS,
  SEARCH_PROVIDERS,
  PRICE_THRESHOLDS,
  GENERIC_EMAIL_PREFIXES,
  SUBDOMAIN_BLACKLIST_PREFIXES,
  CURRENT_SCRIPT_VERSION,
  OFFICIAL_PLATFORM_SCORE_BONUS,
  BROWSER_RESTART_EVERY,
  SCHOOL_TIMEOUT_MS,
  // Functions
  isBlacklistedUrl,
  isWrongSport,
  isTeamCampOrLegacy,
  isOfficialPlatform,
};
