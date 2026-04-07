"use strict";

const {
  BLACKLISTED_DOMAINS,
  REJECT_SPORTS,
  isBlacklistedUrl: isBlacklisted,
} = require("./config");

// ── URL Unwrapper (DDG, Yahoo, Bing, other proxy redirects) ───────
function unwrapUrl(url) {
  if (!url || !url.startsWith("http")) return url;
  try {
    const u = new URL(url);
    // DuckDuckGo, Yahoo, Bing, Google proxy redirects
    const real =
      u.searchParams.get("uddg") ||
      u.searchParams.get("RU") ||
      u.searchParams.get("u") ||
      u.searchParams.get("q");
    if (real && real.startsWith("http")) return real;
  } catch (e) {}
  return url;
}

// ── Search Engine URL Detector ────────────────────────────────────
// Detects URLs that are search engine redirects/proxies, not real destinations
function isSearchEngineUrl(url) {
  if (!url || url === "TBA" || !url.startsWith("http")) return false;
  const u = url.toLowerCase();
  const seHosts = [
    "duckduckgo.com/l/",
    "duckduckgo.com/html/",
    "duckduckgo.com/?",
    "search.yahoo.com/search",
    "google.com/search",
    "google.com/url?",
    "bing.com/search",
    "bing.com/ck/a?",
  ];
  if (seHosts.some((h) => u.includes(h))) return true;
  // Contains search proxy path AND has query params that look like redirect unwrapping
  try {
    const parsed = new URL(url);
    const searchParams = ["uddg", "RU", "url", "q"];
    return searchParams.some((p) => parsed.searchParams.has(p));
  } catch (e) {
    return true; // Unparseable = treat as bad
  }
}

// ── Generic Page Detector ─────────────────────────────────────────
function isGenericPage(url) {
  if (!url || url === "TBA" || !url.startsWith("http")) return false;
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "").toLowerCase();
    // First check: is this a dedicated camp domain? (e.g. alabamabaseballcamps.com)
    const hostname = u.hostname.toLowerCase();
    if (hostname.includes("camp") || hostname.includes("clinic")) return false;
    // Root paths with no camp-specific path segment
    const genericRoots = ["", "/", "/athletics", "/sports", "/baseball"];
    if (genericRoots.includes(path)) return true;
  } catch (e) {
    return true;
  }
  return false;
}

// ── Camp URL Path Validator ───────────────────────────────────────
// Returns true if the URL path or hostname contains camp-relevant keywords
// OR is an official athletics baseball page (valid fallback per CLAUDE.md)
function isCampRelatedUrl(url) {
  if (!url || url === "TBA") return true;
  try {
    const u = new URL(url);
    const fullPath = (u.pathname + (u.search || "")).toLowerCase();
    const hostname = u.hostname.toLowerCase();
    // Domain-level camp signal (e.g. alabamabaseballcamps.com)
    if (hostname.includes("camp") || hostname.includes("clinic")) return true;
    // Known third-party camp platforms — their /organization/ paths are team-specific camp pages
    if (hostname.includes("playnsports")) return true;
    if (hostname.includes("totalcamps")) return true;
    if (hostname.includes("summercamp")) return true;
    // Official athletics baseball page — valid fallback when no camp-specific page exists
    if (/\/sports\/baseball/.test(fullPath)) return true;
    // Camp keyword patterns that indicate a specific camp/registration page
    const campPatterns = [
      /camp/,
      /clinic/,
      /register/,
      /recruit/,
      /prospect/,
      /showcase/,
      /elite.*camp/,
      /youth.*camp/,
      /team.*camp/,
      /pricing/,
      /details/,
    ];
    return campPatterns.some((re) => re.test(fullPath));
  } catch (e) {
    return false;
  }
}

// ── Comprehensive Blacklist Check ─────────────────────────────────
function isBlacklistedUrl(url) {
  if (!url || url === "TBA" || !url.startsWith("http")) return false;
  // First check search engine URLs
  if (isSearchEngineUrl(url)) return true;
  // Then check centralized blacklist
  if (isBlacklisted(url)) return true;

  // Step 3: Sport Contamination & Merch Check
  const urlLower = url.toLowerCase();

  // Exclude merch, tickets, and news sites globally
  const rejectKeywords = [
    "/shop",
    "/store",
    "merchandise",
    "ticket",
    "seatgeek",
    "stubhub",
    "news",
    "article",
  ];
  if (rejectKeywords.some((k) => urlLower.includes(k))) {
    return true;
  }

  // Ensure other sports domains aren't mistakenly approved
  let isWrongSportDomain = false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    isWrongSportDomain = REJECT_SPORTS.some((sport) => {
      const cleanSport = sport.replace(/\s+/g, "");
      return hostname.includes(cleanSport) && !hostname.includes("baseball");
    });
  } catch (e) {}

  // Also reject path elements that explicitly designate other sports
  const pathSportRejection = REJECT_SPORTS.some((sport) => {
    const cleanSport = sport.replace(/\s+/g, "");
    return (
      urlLower.includes(`/${cleanSport}`) && !urlLower.includes("baseball")
    );
  });

  if (isWrongSportDomain || pathSportRejection) {
    return true;
  }

  return false;
}

// ── URL Quality Gate ──────────────────────────────────────────────
// Returns { passed, reason, url } after running all validations
function validateUrl(url, schoolName, isGuessed = false) {
  if (!url || !url.startsWith("http")) {
    return { passed: false, reason: "empty_or_invalid", url: null };
  }

  let testUrl = unwrapUrl(url);
  if (testUrl !== url) url = testUrl; // unwrapped the real URL

  // Step 1: Blacklist check (includes search engine detection)
  if (isBlacklistedUrl(url)) {
    return { passed: false, reason: "blacklisted", url: null };
  }

  // Step 2: PDF check
  if (url.toLowerCase().includes(".pdf")) {
    return { passed: false, reason: "pdf", url: null };
  }

  // Step 3: Generic page check
  if (isGenericPage(url)) {
    return { passed: false, reason: "generic_page", url: null };
  }

  // Step 4: Camp relevance check
  if (!isCampRelatedUrl(url)) {
    return { passed: false, reason: "not_camp_related", url: null };
  }

  return { passed: true, url };
}

// ── Score URL (centralised — all runners delegate here) ──────────────────────
// V9 improvements: Alabama state-aware URL penalty + coach last-name bonus
function scoreUrl(
  url,
  school,
  mascotGetter,
  getCoachSearch,
  isGuessed = false,
) {
  if (!url) return -100;
  let score = 0;
  const u = url.toLowerCase();
  const s = (school.university || "").toLowerCase();
  const coach =
    typeof getCoachSearch === "function" ? getCoachSearch(school) : "";
  const mascot = (
    school.mascot ||
    (typeof mascotGetter === "function"
      ? mascotGetter(school.university)
      : "") ||
    ""
  ).toLowerCase();

  // ── V9: Alabama vs Alabama State URL penalty ────────────────────────────
  const targetIsState = s.includes("alabama") && s.includes("state");
  const targetIsUA =
    s === "university of alabama" || (s === "alabama" && !s.includes("state"));
  if (targetIsState && u.includes("rolltide")) score -= 150; // Alabama State → rolltide is UA
  if (targetIsUA && u.includes("alasu")) score -= 150; // Alabama → alasu is Alabama State

  // Positive signals
  if (u.includes("baseball")) score += 40;
  if (u.includes("camp") || u.includes("clinic")) score += 30;
  if (u.includes("/sports/baseball")) score += 15;

  // Coach last-name bonus (V8 improvement)
  if (coach && coach.split(" ").length >= 2) {
    const lastName = coach.split(" ").pop().toLowerCase();
    if (lastName && lastName.length > 3 && u.includes(lastName)) score += 35;
  }
  if (mascot && mascot.length > 3 && u.includes(mascot.replace(/\s+/g, "")))
    score += 20;

  const cleanS = s.replace(/\s+/g, "");
  if (cleanS.length > 3 && u.includes(cleanS)) score += 25;

  const shortS = s
    .replace(/university|state|college| of /gi, "")
    .trim()
    .replace(/\s+/g, "");
  if (shortS.length > 3 && u.includes(shortS)) score += 15;

  // Third-party official camp platforms
  if (u.includes("ryzer.com")) score += 50;
  if (u.includes("totalcamps.com")) score += 50;
  if (u.includes("active.com")) score += 40;

  // .edu bonus only if camp-related path
  if (u.includes(".edu")) {
    score += 10;
    if (isGenericPage(url)) score -= 80;
  }

  if (isGuessed) score -= 40;

  // Negative signals
  if (u.includes("/schedule") || u.includes("/roster") || u.includes("/news/"))
    score -= 30;
  if (u.includes("2025")) score -= 100; // Stale year
  if (u.includes("shop/") || u.includes("/store") || u.includes("merchandise"))
    score -= 150;

  // Centralised blacklist
  if (isBlacklistedUrl(url)) score -= 200;

  // Camp path bonus
  if (isCampRelatedUrl(url)) score += 25;

  return score;
}

module.exports = {
  unwrapUrl,
  isSearchEngineUrl,
  isGenericPage,
  isCampRelatedUrl,
  isBlacklistedUrl,
  validateUrl,
  scoreUrl,
};
