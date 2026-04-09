"use strict";

const fs = require("fs");
const path = require("path");

// ── Master Blacklist Loader ──────────────────────────────────
const BLACKLIST_FILE = path.join(__dirname, "../../blacklist.json");
const BLACKLISTED_DOMAINS = JSON.parse(
  fs.readFileSync(BLACKLIST_FILE, "utf8"),
).domains;

// ── Verified URLs Loader ─────────────────────────────────────
const RAW_DATA_DIR = path.join(__dirname, "../../data/raw");
const VERIFIED_FILES = [
  "!bcusa.com_fixed.json",
  "!playnsports_fixed.json",
  "!totalcamps.com.json",
];

let AUTHORITATIVE_URLS = {}; // university -> url

try {
  // We need mascot_lookup for matching, but to avoid circular dependencies
  // (if mascot_lookup requires config), we'll load it carefully or do a simple match.
  // Actually mascot_lookup doesn't seem to require config.
const { MASCOT_LOOKUP } = require("./mascot_lookup"); 
  
  VERIFIED_FILES.forEach((file) => {
    const filePath = path.join(RAW_DATA_DIR, file);
    if (fs.existsSync(filePath)) {
      const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
      content.forEach((item) => {
        if (item.school && item.url) {
          // Store raw for now, we'll match later
          AUTHORITATIVE_URLS[item.school.toLowerCase()] = item.url;
        }
      });
    }
  });
} catch (e) {
  // console.log(`[CONFIG] Warning: Could not load verified URLs: ${e.message}`);
}

/**
 * Returns a verified camp URL for a school name if found in the authoritative lists.
 */
function getVerifiedUrl(universityName) {
  const { getMascot } = require("./mascot_lookup");
  const mascot = getMascot(universityName);
  const lowerUni = universityName.toLowerCase();
  
  // Try exact university name
  if (AUTHORITATIVE_URLS[lowerUni]) return AUTHORITATIVE_URLS[lowerUni];
  
  // Try university + mascot (e.g. "Abilene Christian Wildcats")
  if (mascot) {
    const fullMatch = `${lowerUni} ${mascot.toLowerCase()}`;
    if (AUTHORITATIVE_URLS[fullMatch]) return AUTHORITATIVE_URLS[fullMatch];
  }
  
  // Try university Mascot (some files might just use Mascot)
  if (mascot && AUTHORITATIVE_URLS[mascot.toLowerCase()]) return AUTHORITATIVE_URLS[mascot.toLowerCase()];

  return null;
}

// ── Unified Extraction Constants ─────────────────────────────
// SINGLE SOURCE OF TRUTH — all scripts must require() from here.
// Never hardcode these values in runner scripts or engine files.
const CURRENT_SCRIPT_VERSION = 12.5; // Updated 2026-04-09: $50 floor + commerce blacklisting

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

// Schools that are just a state name (e.g. "Arkansas", "Alabama")
// These need a Geographic Marker Guard in checkContamination to prevent false positives.
const GENERIC_STATE_SCHOOLS = [
  "Alabama", "Arkansas", "California", "Delaware", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "Ohio", "Oklahoma", "Oregon",
  "Texas", "Utah", "Vermont", "Virginia", "Washington", "Wisconsin", "Wyoming"
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

// Domains that are valid for camp URLs but should NEVER be extracted as POC emails
const BLACKLISTED_EMAIL_DOMAINS = [
  "playnsports.com",
  "ryzer.com",
  "totalcamps.com",
  "active.com",
  "activekids.com",
  "summercamps.com",
  "summercamp.com"
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
const SCHOOL_TIMEOUT_MS = 45000;

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

const EXTERNAL_PORTAL_PATTERNS = [
  /inthezonebaseballcamps\.org/i,
  /baseballcamps\.org/i,
  /baseballevents\.com/i,
  /totalcamps\.com/i,
  /ryzer\.com/i,
  /playnsports\.com/i,
  /readysetregister\.com/i,
  /abcsportscamps\.com/i,
  /campsnetwork\.com/i
];

const PRICE_THRESHOLDS = {
  CRITICAL_ANOMALY: 30, // < $30 -> Auto-purge (mostly processing fees/parking/merch)
  SUSPICIOUS_LOW: 40,   // < $40 -> flag for review
  VERIFY_MANUALLY: 100, // < $100 -> possibly single-day
  MAX_EXPECTED: 1500,  // > $1500 -> suspicious high
};

const GENERIC_EMAIL_PREFIXES = [
  "example",
  "noreply",
  "sentry",
  "webmaster",
  "support",
  "admissions",
  "register",
  "info",
  "athletics",
  "admission",
  "registration",
  "office",
  "general",
  "marketing",
  "info",
  "help",
  "web",
  "feedback",
  "contact",
  "admin",
  "accessibility",
  "privacy",
  "tickets",
  "boxoffice",
  "merchandise",
  "store",
  "shop",
];
const SUBDOMAIN_BLACKLIST_PREFIXES = [
  "m.",
  "mobile.",
  "beta.",
  "dev.",
  "stage.",
];

const GENERIC_PORTAL_SUBPATHS = [
  "/find-camps",
  "/search",
  "/sign-in",
  "/login",
  "/register",
  "/account",
  "/contact",
  "/about",
  "/privacy",
  "/terms",
  "/cart",
  "/checkout",
  "/camps-clinics",
  "/upcoming-events",
];

function isExternalBridge(url, linkText, targetUni) {
  if (!url || !url.startsWith("http")) return false;
  const lowerUrl = url.toLowerCase();

  // Rule 0: Reject root-level generic paths on platforms
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();
    if (
      GENERIC_PORTAL_SUBPATHS.some(
        (p) => path.startsWith(p) || path === p || path === p + "/",
      )
    ) {
      return false;
    }
    // Reject root of a platform domain (too generic)
    if (path === "/" || path === "" || path === "/index.php" || path === "/index.html") {
        return false;
    }
  } catch (e) {
    return false;
  }

  // Rule 1: Link text must be strong
  const lowerText = (linkText || "").toLowerCase();
  const hasStrongText = /register|here|portal|details|info|camp/i.test(
    lowerText,
  );
  if (!hasStrongText) return false;

  // Rule 2: Host must match a known AUTHORITATIVE platform
  const matchesPortal = OFFICIAL_PLATFORMS.some((platform) => lowerUrl.includes(platform));
  if (!matchesPortal) return false;

  // Rule 3: Identity in URL (V12.1 Safeguard)
  // For platforms like playnsports or totalcamps, the URL should have a fragment of the uni or mascot
  if (targetUni) {
    const uniFragment = targetUni.split(" ")[0].toLowerCase();
    const { getMascot } = require("./mascot_lookup");
    const mascot = (getMascot(targetUni) || "").toLowerCase().split(" ")[0];

    const hasIdentityInUrl =
      lowerUrl.includes(uniFragment) || (mascot && mascot.length > 3 && lowerUrl.includes(mascot));
    
    // V12.6 Exceptional ID-based Link Support:
    // Some links are direct session registrations (Ryzer ID, etc.) and don't have the uni name in URL.
    // If the link is highly granular (contains ID or specific path), we allow it.
    const isGranularIdLink = 
      (lowerUrl.includes("ryzer.com") && lowerUrl.includes("id=")) ||
      (lowerUrl.includes("playnsports.com") && lowerUrl.includes("/organization/")) ||
      (lowerUrl.includes("totalcamps.com") && lowerUrl.includes("/shop/"));

    // If no identity in URL, we ONLY allow it if it's NOT a major platform OR it's a granular ID link
    if (!hasIdentityInUrl && !isGranularIdLink && (lowerUrl.includes("playnsports") || lowerUrl.includes("totalcamps") || lowerUrl.includes("ryzer"))) {
        return false;
    }
  }

  return true;
}

// ── Shared Logic Helpers ─────────────────────────────────────
function isBlacklistedUrl(url) {
  if (!url) return true;
  const lower = url.toLowerCase();
  
  // Rule 1: Master Blacklist Domains
  if (BLACKLISTED_DOMAINS.some((domain) => lower.includes(domain.toLowerCase()))) {
    return true;
  }

  // Rule 2: Strict Sport Domain Exclusion (V12.3 Hardening)
  // If the DOMAIN contains a different sport, reject it immediately (no exceptions).
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    
    const hasForbiddenSport = REJECT_SPORTS.some(sport => domain.includes(sport));
    if (hasForbiddenSport) return true;
  } catch (e) {
    // If URL parsing fails, fall back to basic string check
    if (REJECT_SPORTS.some(sport => lower.includes(sport) && !lower.includes("baseball"))) return true;
  }

  return false;
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
  
  // Rule 1: 2025 dates/URL without 2026 context (Strict Legacy)
  if (has2025 && !has2026) return true;

  // Rule 2: Specifically check for 2025 in a URL context (e.g. "sports/2025/...")
  // We only reject this if the text doesn't explicitly confirm 2026 elsewhere.
  if (lower.includes("http") && lower.includes("2025") && !has2026) return true;

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
  BLACKLISTED_EMAIL_DOMAINS,
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
  GENERIC_STATE_SCHOOLS,
  GENERIC_EMAIL_PREFIXES,
  SUBDOMAIN_BLACKLIST_PREFIXES,
  CURRENT_SCRIPT_VERSION,
  OFFICIAL_PLATFORM_SCORE_BONUS,
  BROWSER_RESTART_EVERY,
  SCHOOL_TIMEOUT_MS,
  AUTHORITATIVE_URLS,
  MAX_SUB_CRAWL_DEPTH: 2,
  MAX_SUB_CRAWL_PAGES: 12,
  DOMAIN_RESTRICTED_CRAWLING: true,
  // Functions
  isBlacklistedUrl,
  isWrongSport,
  isTeamCampOrLegacy,
  isOfficialPlatform,
  isExternalBridge,
  getVerifiedUrl,
};
