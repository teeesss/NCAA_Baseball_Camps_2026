/**
 * extraction_engine.js — V12.5 Unified Authoritative Extraction Engine
 *
 * THIS IS THE SINGLE SOURCE OF TRUTH FOR ALL EXTRACTION LOGIC.
 *
 * DO NOT duplicate any logic from this file into smart_extract.js or any other runner.
 * All runner scripts must `require()` and call `runExtraction()` from here.
 *
 * Best-of-breed synthesis across V6–V9:
 *   ✅ puppeteer-extra stealth (V6/smart_extract)
 *   ✅ Summer-only dates with range support (V7/V8 + config.js DATE_PATTERNS)
 *   ✅ Cost ranges + FREE + Complimentary (V8 COST_PATTERN via config.js)
 *   ✅ PRICE_THRESHOLDS validation (config.js)
 *   ✅ Extended camp name keywords: Academy, Session, Tryout, Tournament (V8)
 *   ✅ Stale year filter 2021–2024 (V7/V8, centralised in config.js STALE_YEARS)
 *   ✅ isWrongSport() sport filter (config.js)
 *   ✅ "No Upcoming Events" detection — smart hybrid (NEW — was missing everywhere)
 *   ✅ V9 Alabama-vs-Alabama-State contamination check
 *   ✅ url_validator.js URL scoring + validation (centralised)
 *   ✅ V8 URL guessing: school + short + mascot + coach last name
 *   ✅ V7/V8 priority DB URL (tries camp.campUrl first)
 *   ✅ V8/V9 deterministic search engine rotation by DB index
 *   ✅ harvestEmails() with .edu weighting + V9 junk filter
 *   ✅ V9 dual contact fields: camp.email + camp.pointOfContact separate
 *   ✅ V9 sourceUrl separate from campUrl
 *   ✅ V7/V8 alreadyQueued Set sub-crawl deduplication
 *   ✅ V7–V9 browser restart every BROWSER_RESTART_EVERY schools
 *   ✅ V9 per-school 90s timeout via setTimeout
 *   ✅ Central blacklist.json via config.js (no inline hardcoding)
 *   ✅ SEARCH_PROVIDERS, SUB_CRAWL_KEYWORDS, NO_EVENTS_PHRASES all from config.js
 */

"use strict";

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const fs = require("fs");
const path = require("path");

const {
  getMascot,
  buildSearchQuery,
  getUniversityAliases,
} = require("./mascot_lookup");
const {
  unwrapUrl,
  isBlacklistedUrl,
  isGenericPage,
  isCampRelatedUrl,
  scoreUrl: centralScoreUrl,
  isSearchEngineUrl,
} = require("./url_validator");
const {
  BLACKLISTED_DOMAINS,
  BLACKLISTED_EMAIL_DOMAINS,
  REJECT_SPORTS,
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
  BROWSER_RESTART_EVERY,
  SCHOOL_TIMEOUT_MS,
  CURRENT_SCRIPT_VERSION,
  isWrongSport,
  isTeamCampOrLegacy,
  isExternalBridge,
  getVerifiedUrl,
  MAX_SUB_CRAWL_DEPTH,
  MAX_SUB_CRAWL_PAGES,
  DOMAIN_RESTRICTED_CRAWLING,
} = require("./config");
const { shouldExtractField, clearRecheckFlag, isFullExtractionRun } = require("./schema");
const { applyCompletenessFlags } = require("./field_checker");

const DATA_FILE = path.join(__dirname, "../../camps_data.json");
const BACKUP_DIR = path.join(__dirname, "../../data/backups");
const LOG_DIR = path.join(__dirname, "../../data/logs");
const LOG_FILE = path.join(LOG_DIR, "smart_extract.log");

// Ensure directories exist
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
function log(msg) {
  // Strip hidden line/paragraph separators that get scraped from bad HTML text
  const cleanMsg = msg.replace(/[\u2028\u2029]/g, "");
  const line = `[${new Date().toISOString()}] ${cleanMsg}`;
  console.log(line);
  logStream.write(line + "\n");
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract a usable coach name from a camp record's contact/pointOfContact field.
 * Returns "" if the field is TBA, an email, too short, or not a real name.
 */
function getCoachName(camp) {
  const input = camp.pointOfContact || camp.contact || "";
  if (!input) return "";
  let raw = input
    .split("|")[0]
    .trim()
    .replace(/\(.*?\)/g, "")
    .trim();
  if (!raw || raw.toLowerCase().includes("tba")) return "";
  if (raw.includes("@") || raw.length < 4) return "";
  if (!/^[A-Za-z][A-Za-z'\-.]+(?:\s+[A-Za-z][A-Za-z'\-.]+)+$/.test(raw))
    return "";
  return raw;
}

/**
 * Build URL guesses (school name + abbreviation + mascot + coach last name variants).
 * Pulled from V8 — most comprehensive set.
 */
function buildGuessedUrls(camp) {
  const guessed = [];
  const cleanUni = camp.university
    .replace(/The /gi, "")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
  const shortName = camp.university
    .replace(/University|State|College| of/gi, "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
  const mascot = (camp.mascot || getMascot(camp.university) || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  const coach = getCoachName(camp).toLowerCase();

  if (cleanUni.length < 30) {
    guessed.push(`https://www.${cleanUni}baseballcamps.com`);
    guessed.push(`https://www.${cleanUni}baseball.com`);
  }
  if (shortName.length > 2 && shortName !== cleanUni && shortName.length < 20) {
    guessed.push(`https://www.${shortName}baseballcamps.com`);
    guessed.push(`https://www.${shortName}baseball.com`);
  }
  if (mascot && mascot.length > 3 && mascot.length < 15) {
    guessed.push(`https://www.${mascot}baseballcamps.com`);
  }
  // V8: coach last-name-as-URL guess
  if (coach && coach.split(" ").length >= 2) {
    const lastName = coach.split(" ").pop();
    if (lastName && lastName.length > 3) {
      guessed.push(`https://www.${lastName}baseballcamp.com`);
      guessed.push(`https://www.${lastName}baseball.com`);
    }
  }
  return [...new Set(guessed)];
}

/**
 * Score a URL for how likely it is to contain valid camp data.
 * Delegates to centralised url_validator.js scoreUrl, passing helpers.
 */
function scoreUrl(url, camp, isGuessed = false) {
  return centralScoreUrl(url, camp, getMascot, getCoachName, isGuessed);
}

/**
 * Harvest emails from page text, weighted towards .edu and baseball domains.
 * Filters out junk/generic emails. (V8 + V9 combined best approach.)
 */
function harvestEmails(text) {
  const matches = text.match(EMAIL_PATTERN) || [];
  const cleaned = matches.filter((e) => {
    const lower = e.toLowerCase();
    if (GENERIC_EMAIL_PREFIXES.some((g) => lower.startsWith(g + "@")))
      return false;
    if (/bootstrap|example|domain|noreply|sentry|webmaster/i.test(lower))
      return false;
    if (BLACKLISTED_DOMAINS.some((b) => lower.includes(b))) return false;
    if (BLACKLISTED_EMAIL_DOMAINS.some((b) => lower.includes(b))) return false;
    return true;
  });
  return [...new Set(cleaned)]
    .sort((a, b) => {
      const aScore =
        (a.includes(".edu") ? 10 : 0) +
        (a.toLowerCase().includes("baseball") ? 5 : 0);
      const bScore =
        (b.includes(".edu") ? 10 : 0) +
        (b.toLowerCase().includes("baseball") ? 5 : 0);
      return bScore - aScore;
    })
    .slice(0, 3);
}

/**
 * Extract a person's name that appears near/before an email address in text.
 * Handles patterns like:
 *   "Drew Bishop at Drew.Bishop@..."
 *   "contact John Smith: jsmith@..."
 *   "email Jane Doe at jane@"
 *   "Jane Doe — jane@"
 * Returns the cleaned name string or "".
 */
function extractNameNearEmail(text) {
  // Match: capitalized name (First Last, optionally with middle initial) near/at email
  // Look for common patterns:
  //   "... emailing Drew Bishop at Drew.Bishop@ ..."
  //   "... contact: John Smith | jsmith@ ..."
  //   "... Jane Doe - jane@"
  //   "... Jane Doe jane@"
  const patterns = [
    /\b(?:emailing|contact|reach|asking for|questions to|directed to)\s+([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+){1,2})\s+(?:at|:)\s+/i,
    /\b([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+){1,2})\s+(?:at|:)\s+[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/,
    /\b([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+){1,2})\s+[-–—]\s+[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/,
    /\b([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+){1,2})\s+[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const name = m[1].trim();
      // Validate: skip generic words that might false-match
      const skipWords = [
        "contact",
        "email",
        "reach",
        "send",
        "ask",
        "questions",
        "registration",
        "info",
        "for",
        "more",
        "details",
        "click",
        "here",
        "visit",
        "website",
      ];
      if (
        !skipWords.includes(name.toLowerCase()) &&
        name.length >= 4 &&
        name.length <= 40
      ) {
        // Must be mostly alphabetic (allow apostrophe/hyphen)
        if (/^[A-Za-z'\- ]+$/.test(name)) return name;
      }
    }
  }
  return "";
}

/**
 * Contamination check: V10 state-aware version.
 * "Alabama" vs "Alabama State" handled correctly with word boundaries.
 * Also handles bidirectional substring (Kansas in Arkansas).
 * INTEGRATED: Mascot check (Florida State vs Florida Gators).
 */
/**
 * Contamination check: V11 state-aware version.
 * "Alabama" vs "Alabama State" handled correctly with word boundaries.
 * Also handles bidirectional substring (Kansas in Arkansas).
 * INTEGRATED: Mascot check (Florida State vs Florida Gators).
 */
function checkContamination(text, targetUni, allSchoolNames, targetCoach = "") {
  const textLower = text.toLowerCase();
  const targetLower = targetUni.toLowerCase();
  const targetIsState = targetLower.includes(" state");
  const targetMascot = (getMascot(targetUni) || "").toLowerCase();
  const targetAliases = getUniversityAliases(targetUni);

  // ── V11: Robust Alias-based Contamination Detection ──────────────────────────
  // Check if the text contains a school name or nickname of any OTHER school.
  // We avoid name soup by requiring word boundaries.
  for (const other of allSchoolNames) {
    if (other === targetUni) continue;
    const oLower = other.toLowerCase();

    // 1. State-aware pair check (Alabama vs Alabama State)
    const otherIsState = oLower.includes(" state");
    if (targetIsState !== otherIsState) {
      const targetBase = targetLower
        .replace(/ state| university| college/g, "")
        .trim();
      const otherBase = oLower
        .replace(/ state| university| college/g, "")
        .trim();
      if (targetBase === otherBase) {
        // Only flag if the base name is even in the text
        if (textLower.includes(targetBase)) {
          const textHasState = textLower.includes(" state");
          if (textHasState !== targetIsState) return other;
        }
      }
    }

    // 2. Mascot-identity check (Identity logic: Gators ≠ Seminoles)
    const otherMascot = (getMascot(other) || "").toLowerCase();
    if (
      otherMascot &&
      otherMascot.length > 3 &&
      otherMascot !== targetMascot &&
      !targetAliases.includes(otherMascot)
    ) {
      // Check both plural and singular versions (Sun Devils vs Sun Devil)
      const otherMascotSingular = otherMascot.endsWith("s")
        ? otherMascot.slice(0, -1)
        : otherMascot;
      
      // If the page mentions the other school's mascot but not our own, it's suspect
      // But we must be careful: if both are "Wildcats", we already skipped (otherMascot !== targetMascot)
      const hasOtherMascot = 
        textLower.includes(otherMascot) || 
        (otherMascotSingular.length > 3 && textLower.includes(otherMascotSingular));
        
      if (hasOtherMascot && !textLower.includes(targetMascot)) {
        // Use word boundaries for mascot check
        const mascotRegex = new RegExp(`\\b(${otherMascot}|${otherMascotSingular})\\b`, "i");
        if (mascotRegex.test(textLower)) return `${other} (${otherMascot})`;
      }
    }

    // 3. Bidirectional substring skip (Arkansas contains Kansas)
    // We let these pass the simple string check because they are ambiguous 
    // and handled by the state-aware logic above.
    if (targetLower.includes(oLower) || oLower.includes(targetLower)) continue;

    // 4. Strict boundary check for other schools (e.g. "Auburn" in Alcorn State text)
    const escaped = oLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const otherRegex = new RegExp(`\\b${escaped}\\b`, "i");
    if (otherRegex.test(textLower)) {
      // V12.5: Geographic Marker Guard
      // If 'other' is just a state name (e.g. Arkansas), only flag if it's likely a school reference
      const isGenericState = GENERIC_STATE_SCHOOLS.includes(other);
      if (isGenericState) {
        // Only flag if it looks like a school reference (e.g. "Missouri University" or matching mascot)
        const academicRegex = new RegExp(`\\b${escaped}\\b\\s*\\b(university|u of|state|college)\\b`, "i");
        const hasAcademicRef = academicRegex.test(textLower);
        const hasOtherMascot = otherMascot && new RegExp(`\\b${otherMascot}\\b`, "i").test(textLower);
        
        if (!hasAcademicRef && !hasOtherMascot) continue;
      }
      return other;
    }
    
    // 5. Alias check (e.g. "UNF", "ULL", "FSU") - check known abbreviations
    const aliases = getUniversityAliases(other);
    for (const alias of aliases) {
      if (alias.length < 3) continue; // Skip short ones like "AL", "UC"
      // Skip if it's our school, our primary mascot, or one of our valid aliases
      if (targetLower.includes(alias) || targetAliases.includes(alias)) continue;
      
      // V12.5: Coach Name Guard
      // If the alias matches the head coach's first or last name, skip contamination check.
      // E.g. "Lane" for Lane Burroughs (Louisiana Tech) shouldn't be flagged as "Lane College".
      if (targetCoach && targetCoach.toLowerCase().includes(alias)) continue;
      
      const aliasRegex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (aliasRegex.test(textLower)) return `${other} (${alias})`;
    }
  }
  return null;
}

/**
 * Helper to extract anchor hrefs from a page given a selector.
 */
async function extractSearchLinks(page, selector) {
  try {
    return await page.evaluate(
      (sel) =>
        Array.from(document.querySelectorAll(sel))
          .map((a) => a.href)
          .filter((h) => h && h.startsWith("http")),
      selector,
    );
  } catch (e) {
    return [];
  }
}

/**
 * Helper to extract entire page text safely.
 * Eliminates duplicate evaluate() blocks.
 */
async function getPageText(page) {
  try {
    return await page.evaluate(() => document.body?.innerText || "");
  } catch (e) {
    return "";
  }
}

/**
 * Check if page text contains "no upcoming events" phrases.
 * Returns true if the page clearly says there are no events.
 * "Smart hybrid" (Decision 2C): if highest-scored URL → mark TBA; if lower → skip.
 */
function pageHasNoEvents(text) {
  const lower = text.toLowerCase();
  return NO_EVENTS_PHRASES.some((phrase) => lower.includes(phrase));
}

// ── Core Extraction: extractDataFromText ─────────────────────────────────────
/**
 * Parse the concatenated page text and extract camp tiers.
 * Uses all centralised patterns from config.js.
 * Returns an array of { name, dates, cost } objects.
 */
function extractDataFromText(fullText, targetUni, allSchoolNames) {
  if (isWrongSport(fullText)) {
    log("       ⚠️ [Filter] Page not about baseball — skipping.");
    return [];
  }

  const campTiers = [];
  const lines = fullText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 4);

  // Build a combined date regex for testing each line
  const DATE_TEST = new RegExp(
    DATE_PATTERNS.map((p) => p.source).join("|"),
    "gi",
  );

  const SKIP_KEYWORDS = [
    " vs ",
    " vs. ",
    " @ ",
    " at ",
    "tournament",
    "bracket",
    "playoffs",
    "round",
    "standings",
    "box score",
    "game recap",
    "postgame",
  ];
  const SPORT_CONTAMINATION = REJECT_SPORTS;

  for (let j = 0; j < lines.length; j++) {
    const line = lines[j];
    DATE_TEST.lastIndex = 0;
    if (!DATE_TEST.test(line)) continue;

    const block = lines
      .slice(Math.max(0, j - 3), Math.min(lines.length, j + 7))
      .join(" | ");
    const low = block.toLowerCase();

    // Skip game schedules
    if (SKIP_KEYWORDS.some((k) => low.includes(k))) continue;


    // Skip stale years
    if (STALE_YEARS.some((y) => low.includes(y) && !low.includes("2026")))
      continue;

    // Sport contamination: skip if non-baseball sport detected without baseball keyword
    const hasCampKeyword =
      /camp|clinic|prospect|showcase|register|enroll|sign.?up|instruction|lesson/i.test(
        block,
      );
    const hasBaseballKeyword =
      /baseball|pitcher|batter|hitting|infield|outfield|pitching|catching/i.test(
        block,
      );
    const hasBadSport = SPORT_CONTAMINATION.some((s) => low.includes(s));
    if (hasBadSport && !hasBaseballKeyword) continue;
    if (!hasCampKeyword && !hasBaseballKeyword) continue;

    // Extract dates
    const dateMatches = [];
    for (const pat of DATE_PATTERNS) {
      pat.lastIndex = 0;
      let m;
      while ((m = pat.exec(block)) !== null) dateMatches.push(m[0].trim());
    }
    const uniqueDates = [...new Set(dateMatches)].slice(0, 4);
    if (uniqueDates.length === 0) continue;

    // Extract cost
    COST_PATTERN.lastIndex = 0;
    const costMatch = COST_PATTERN.exec(block);
    let cost = "TBA";
    if (costMatch) {
      const rawCost = costMatch[0].trim();
      
      // V12.5 Range Fix: Extract ALL prices from the string and take the highest valid one
      COST_NUMERIC_PATTERN.lastIndex = 0;
      let m;
      let validPrices = [];
      while ((m = COST_NUMERIC_PATTERN.exec(rawCost)) !== null) {
        const val = parseFloat(m[1].replace(/,/g, ""));
        if (!isNaN(val)) {
          // If it meets the anamoly floor, it's a candidate
          if (val >= PRICE_THRESHOLDS.CRITICAL_ANOMALY && val <= PRICE_THRESHOLDS.MAX_EXPECTED) {
            validPrices.push(val);
          }
        }
      }

      if (validPrices.length > 0) {
        const val = Math.max(...validPrices);
        // Validate price floor - Use the highest valid price in the range
        if (val >= PRICE_THRESHOLDS.CRITICAL_ANOMALY) {
          // V11: Contextual check for low prices — could be a fee, not a camp cost
          if (val < 60) {
            const FEE_DISQUALIFIERS = [
              "parking", "processing fee", "deposit", "registration fee",
              "application fee", "convenience fee", "service charge",
              "handling", "non-refundable fee", "late fee", "admin fee",
              "transaction fee", "facility fee", "ticket", "shipping",
              "estimated delivery", "taxes", "order total", "subtotal",
            ];
            const blockLow = block.toLowerCase();
            const isFee = FEE_DISQUALIFIERS.some((f) => blockLow.includes(f));
            if (isFee) {
              log(
                `       ⚠️ [Price] Rejected low price "${rawCost}" (val: ${val}) — surrounding text indicates a fee, not a camp cost.`,
              );
            } else {
              cost = rawCost;
            }
          } else {
            cost = rawCost;
          }
        } else {
          log(
            `       ⚠️ [Price] Rejected suspicious price "${rawCost}" (val: ${val}). Setting TBA.`,
          );
        }
      } else {
        // FREE, Complimentary, etc. — keep as-is
        cost = rawCost;
      }
    }

    // Extract camp name
    CAMP_NAME_PATTERN.lastIndex = 0;
    const nameMatch = CAMP_NAME_PATTERN.exec(block);
    const tierName = nameMatch ? nameMatch[1].trim() : "Baseball Camp";

    // Mismatch sport check: skip if the tier name explicitly contains a wrong sport
    // (e.g. "Football Prospect Camp" matched on a portal that also mentions baseball)
    if (REJECT_SPORTS.some(s => tierName.toLowerCase().includes(s))) {
      log(`       ⚠️ [Sport Filter] Tier "${tierName}" rejected (wrong sport: ${REJECT_SPORTS.find(s => tierName.toLowerCase().includes(s))}).`);
      continue;
    }

    // V10: Per-tier contamination check — skip if this specific tier name belongs to another school
    // This is critical for sites like playnsports.com that list many schools
    if (allSchoolNames && targetUni) {
      const culprit = checkContamination(tierName, targetUni, allSchoolNames);
      if (culprit) {
        log(
          `       ⚠️ [Contamination] Tier "${tierName}" belongs to ${culprit}. Skipping tier.`,
        );
        continue;
      }
    }

    campTiers.push({ name: tierName, dates: uniqueDates.join(", "), cost });
  }

  // Deduplicate: normalize dates (strip ordinals) for comparison key
  const seen = new Set();
  const filtered = campTiers.filter((t) => {
    const firstDate = (t.dates.split(",")[0] || "")
      .trim()
      .toLowerCase()
      .replace(/st|nd|rd|th/g, "");
    const key = t.name.toLowerCase().substring(0, 30) + "::" + firstDate;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (filtered.length > 0) {
    log(
      `       📋 [Tiers] ${filtered.length} found. Sample: ${filtered
        .slice(0, 2)
        .map((t) => `"${t.name}"`)
        .join(" | ")}`,
    );
  } else {
    log("       📋 [Tiers] None found on this page.");
  }

  return filtered;
}

/**
 * Detect major camp portal platforms from URL or text content.
 */
function detectPortalPlatform(url, text) {
  const lowerUrl = (url || "").toLowerCase();
  const lowerText = (text || "").toLowerCase();
  
  if (lowerUrl.includes("ryzer.com") || lowerText.includes("ryzer")) return "Ryzer";
  if (lowerUrl.includes("playnsports.com") || lowerText.includes("playnsports")) return "PlayNSports";
  if (lowerUrl.includes("totalcamps.com") || lowerText.includes("totalcamps")) return "TotalCamps";
  if (lowerUrl.includes("abcsportscamps.com") || lowerText.includes("abcsportscamps")) return "AbcSportsCamps";
  if (lowerUrl.includes("campsnetwork.com") || lowerText.includes("campsnetwork")) return "CampsNetwork";
  if (lowerUrl.includes("eventlink.com") || lowerText.includes("eventlink")) return "Eventlink";
  if (lowerUrl.includes("readysetregister.com") || lowerText.includes("readysetregister")) return "ReadySetRegister";
  
  return null;
}

// ── Search Engine Query Runner ────────────────────────────────────────────────
/**
 * Run search queries for a school using round-robin engine rotation.
 * Uses SEARCH_PROVIDERS from config.js — no hardcoding.
 */
async function runSearchQueries(page, camp, dbIndex) {
  const engine = SEARCH_PROVIDERS[dbIndex % SEARCH_PROVIDERS.length];
  const mascot = getMascot(camp.university) || "";
  const coach = getCoachName(camp);

  log(
    `   → [ENGINE] ${engine.name} (rotation slot ${(dbIndex % SEARCH_PROVIDERS.length) + 1}/${SEARCH_PROVIDERS.length})`,
  );

  const queries = [];
  if (mascot) queries.push(`${camp.university} ${mascot} baseball camps 2026`);
  queries.push(`"${camp.university}" baseball camps 2026`);
  if (coach) queries.push(`${coach} baseball camp 2026`);
  const cleanName = camp.university
    .replace(/University|State|College| of/gi, "")
    .trim();
  if (cleanName !== camp.university && cleanName.length > 3)
    queries.push(`${cleanName} baseball camps 2026`);

  const links = [];
  for (const q of queries.slice(0, 3)) {
    try {
      log(`      ↳ [${engine.name}] ${q.substring(0, 70)}`);
      await page.goto(engine.url(q), {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      const found = await extractSearchLinks(page, engine.selector);
      if (found && found.length > 0) {
        links.push(...found);
        log(`      ✓ [${engine.name}] ${found.length} results`);
        if (found.length >= 5) break; // Good batch — don't hammer engine
      }
    } catch (e) {
      log(`      ✕ [${engine.name}]: ${e.message.substring(0, 60)}`);
    }
    await delay(1200 + Math.random() * 600);
  }

  // Coach fallback if first pass was thin
  if (links.length < 5 && coach) {
    const q2 = `${coach} baseball camp 2026`;
    try {
      await page.goto(engine.url(q2), {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      const found2 = await extractSearchLinks(page, engine.selector);
      if (found2) links.push(...found2);
    } catch (e) {}
  }

  return [...new Set(links.filter((l) => l && l.startsWith("http")))];
}

// ── Main Extraction Runner ────────────────────────────────────────────────────
/**
 * runExtraction(opts) — called by smart_extract.js (thin shell).
 *
 * @param {object} opts
 * @param {string|null}  opts.schoolFilter  - filter to specific school(s)
 * @param {number|null}  opts.limit         - max schools to process
 * @param {boolean}      opts.forceRequeue  - process even if isChecked=true
 */
async function runExtraction({
  schoolFilter = null,
  limit = null,
  forceRequeue = false,
} = {}) {
  let data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const allSchoolNames = data.map((d) => d.university);

  // Queue: schools that need processing
  let toProcess = data.filter((d) => {
    // Before filtering, quickly apply structural completeness updates so missing data defaults to needing a recheck
    Object.assign(d, applyCompletenessFlags(d));

    if (!forceRequeue && d.isVerified) return false; // Never touch manually verified unless forced

    // 1. Calculate Age
    const lastCheckedDate = d.lastChecked || d.lastUpdateDate || 0;
    const ageMs = Date.now() - new Date(lastCheckedDate).getTime();
    const daysOld = ageMs / (1000 * 60 * 60 * 24);
    
    // 2. Define authoritative TTL rules
    const TTL_DAYS = d.division === "DI" ? 3 : 14;
    const isAgedOut = daysOld >= TTL_DAYS;
    const needsTargetedRecheck = d.recheck && Object.values(d.recheck).some(flag => flag === true);
    const isNew = !d.isChecked;

    // 3. Execution Decision
    if (forceRequeue) return true;
    if (isNew) return true; // Brand new school never checked

    // If it's already been checked and hasn't aged out yet, we skip it regardless of missing data
    if (!isAgedOut) return false;

    // It's aged out, so we re-process if:
    // a) It has missing data flagged for recheck
    if (needsTargetedRecheck) return true;

    // b) The engine version has updated
    if ((d.scriptVersion || 0) !== CURRENT_SCRIPT_VERSION) return true;

    // c) It's just time for a periodic full refresh (e.g. checked once, succeeded, but that was > 30 days ago)
    if (daysOld > 30) return true;

    return false;
  });

  if (schoolFilter) {
    const filters = schoolFilter
      .toLowerCase()
      .split(",")
      .map((s) => s.trim());
    toProcess = toProcess.filter((d) =>
      filters.some((f) => d.university.toLowerCase().includes(f)),
    );
  }
  if (limit) toProcess = toProcess.slice(0, limit);

  log(
    `\n🚀 V${CURRENT_SCRIPT_VERSION} Unified Engine Starting. Target: ${toProcess.length} schools.`,
  );
  log(
    `   Database: ${data.length} total | ${data.filter((d) => d.isVerified).length} verified`,
  );

  // Backup before run
  const backupName = `camps_data_backup_${Date.now()}.json`;
  const backupPath = path.join(BACKUP_DIR, backupName);
  fs.copyFileSync(DATA_FILE, backupPath);
  log(`📦 Backup created in data/backups/: ${backupName}`);

  let browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--window-size=1920,1080",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  for (let i = 0; i < toProcess.length; i++) {
    // Periodic browser restart to prevent memory leaks
    if (i > 0 && i % BROWSER_RESTART_EVERY === 0) {
      log(
        `\n[SYSTEM] Restarting browser at school ${i}/${toProcess.length}...`,
      );
      await browser.close().catch(() => {});
      await delay(2000);
      browser = await puppeteer.launch({
        headless: "new",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--window-size=1920,1080",
        ],
        ignoreDefaultArgs: ["--enable-automation"],
      });
    }

    const camp = toProcess[i];
    const dbIndex = data.indexOf(camp);

    log(`\n${"═".repeat(60)}`);
    log(`[${i + 1}/${toProcess.length}] Processing: ${camp.university}`);
    log(
      `   Coach: ${getCoachName(camp) || "(none/TBA)"} | Version: ${camp.scriptVersion || 0}`,
    );
    log("═".repeat(60));

    const p = await browser.newPage();

    // Stealth settings
    await p.setViewport({
      width: 1920 + Math.floor(Math.random() * 80),
      height: 1080 + Math.floor(Math.random() * 80),
    });
    await p.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    );
    await p.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      Object.defineProperty(navigator, "deviceMemory", { get: () => 8 });
      Object.defineProperty(navigator, "hardwareConcurrency", {
        get: () => 16,
      });
      window.chrome = { runtime: {} };
    });

    // CHECKPOINT: mark school before processing so watchdog/restart can skip it safely
    camp.isChecked = true;
    camp.scriptVersion = CURRENT_SCRIPT_VERSION;
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

    // Per-school timeout guard
    const schoolTimeout = setTimeout(() => {
      log(
        `   ⏰ Timeout (${SCHOOL_TIMEOUT_MS / 1000}s) for ${camp.university}. Closing page.`,
      );
      p.close().catch(() => {});
    }, SCHOOL_TIMEOUT_MS);

    try {
      // ── Phase A: Build URL candidate list (V11 4-Tier Resolution) ───────────
      //
      // TIER 1: Authoritative master JSON files take absolute priority.
      //         If found → use it, skip all search. Score 500.
      //
      // TIER 2: School not in master files, but has a campUrl in DB that
      //         resolves (HTTP 200) AND contains baseball/camp content.
      //         Use it directly. Score 300.
      //
      // TIER 2a: campUrl exists but is dead (4xx/5xx/timeout) or generic.
      //          Fall through to Tier 3.
      //
      // TIER 3: No URL from Tier 1 or 2. Run web search, find consensus.

      let searchLinks = [];
      let verifiedUrl = getVerifiedUrl(camp.university);
      let resolvedTier = null;

      if (verifiedUrl) {
        // ── TIER 1 ──────────────────────────────────────────────────────────
        log(`   → [TIER 1] Authoritative source: ${verifiedUrl}`);
        searchLinks.push(verifiedUrl);
        resolvedTier = 1;

      } else if (
        camp.campUrl &&
        camp.campUrl.startsWith("http") &&
        !isBlacklistedUrl(camp.campUrl)
      ) {
        // ── TIER 2 / 2a: Validate existing campUrl ──────────────────────────
        log(`   → [TIER 2] Checking existing campUrl: ${camp.campUrl}`);
        try {
          const checkResp = await p.goto(camp.campUrl, {
            waitUntil: "domcontentloaded",
            timeout: 25000,
          });
          const checkStatus = checkResp ? checkResp.status() : 0;

          if (checkStatus >= 200 && checkStatus < 400) {
            const checkText = await getPageText(p);
            const hasBaseballOrCamp =
              /baseball|camp|clinic|prospect|register/i.test(checkText);

            if (hasBaseballOrCamp) {
              // ── TIER 2: Valid ────────────────────────────────────────────
              log(`   → [TIER 2] ✅ Valid — using existing campUrl`);
              searchLinks.push(camp.campUrl);
              verifiedUrl = camp.campUrl; // Treat like verified for scoring
              resolvedTier = 2;
            } else {
              log(`   → [TIER 2a] ⚠️  campUrl resolves but has no camp content — falling to Tier 3`);
            }
          } else {
            log(`   → [TIER 2a] ⚠️  campUrl returned HTTP ${checkStatus} — falling to Tier 3`);
          }
        } catch (e) {
          log(`   → [TIER 2a] ⚠️  campUrl unreachable (${e.message.substring(0, 50)}) — falling to Tier 3`);
        }

        if (resolvedTier === null) {
          log(`   → [TIER 3] Running web search (Tier 2a fallback)`);
          const engineResults = await runSearchQueries(p, camp, dbIndex);
          searchLinks.push(...engineResults);
          resolvedTier = 3;
        }
      } else {
        log(`   → [TIER 3] No prior URL — running web search`);
        const engineResults = await runSearchQueries(p, camp, dbIndex);
        searchLinks.push(...engineResults);
        resolvedTier = 3;
      }

      // URL pattern guesses (Tier 4 fallbacks only — never override Tier 1/2 or Tier 3 search results)
      const guessed = resolvedTier <= 2 ? [] : buildGuessedUrls(camp);

      // Score, dedupe, drop clearly bad URLs, take top 15 from search results
      const scoredSearch = searchLinks
        .map((u) => ({
          url: u,
          score: u === verifiedUrl ? (resolvedTier === 1 ? 500 : 300) : scoreUrl(u, camp, false),
          isGuessed: false,
          tierLabel: resolvedTier === 3 ? "TIER 3" : `TIER ${resolvedTier}`,
        }))
        .filter((x) => x.score > -50)
        .sort((a, b) => b.score - a.score)
        .filter(
          (x, idx, self) => self.findIndex((y) => y.url === x.url) === idx,
        )
        .slice(0, 15);

      // Score guesses separately as Tier 4
      const scoredGuessed = guessed
        .map((u) => ({
          url: u,
          score: scoreUrl(u, camp, true),
          isGuessed: true,
          tierLabel: "TIER 4",
        }))
        .filter((x) => x.score > -50)
        .sort((a, b) => b.score - a.score)
        .filter(
          (x, idx, self) => self.findIndex((y) => y.url === x.url) === idx,
        )
        .slice(0, 5);

      // Merge sequentially so Tier 4 is ALWAYS processed after Tier 3 failures
      const scored = [...scoredSearch, ...scoredGuessed];

      log(`   → ${scored.length} candidates. Top 3:`);
      scored
        .slice(0, 3)
        .forEach((s) =>
          log(
            `      ${s.score >= 50 ? "★" : s.score >= 20 ? "•" : "○"} [${String(s.score).padStart(3)}][${s.tierLabel}] ${s.url}`,
          ),
        );

      // ── Phase B: Validate & Sub-Crawl ─────────────────────────────────────
      const aliases = getUniversityAliases(camp.university);
      let success = false;
      let bestEmails = [];
      let isTopUrl = true; // First in scored list = highest priority

      for (const item of scored) {
        const candidate = item.url;
        try {
          log(`\n   → Navigating [${item.score}][${item.tierLabel}]: ${candidate}`);
          const resp = await p.goto(candidate, {
            waitUntil: "domcontentloaded",
            timeout: 25000,
          });
          if (!resp || resp.status() >= 400) {
            log(`      ✕ HTTP ${resp?.status() || "error"}`);
            isTopUrl = false;
            continue;
          }

          await delay(600 + Math.random() * 400);
          const text = await getPageText(p);
          const title = (await p.title()) || "";

          // ── "No Upcoming Events" — smart hybrid (Decision 2C) ──
          if (pageHasNoEvents(text)) {
            if (isTopUrl && item.score >= 50) {
              // Top/official portal says no events → mark TBA authoritatively
              log(
                `      ⚠️ Official portal says no upcoming events. Marking TBA.`,
              );
              camp.cost = "TBA";
              camp.dates = "TBA";
              camp.campTiers = [];
              camp.details =
                "Official portal confirms no 2026 camps posted yet.";
              camp.auditStatus = "NO_EVENTS_CONFIRMED";
              camp.lastUpdateDate = Date.now();
              fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            } else {
              log(
                `      ↷ Lower-ranked page has no events — skipping, trying next.`,
              );
            }
            isTopUrl = false;
            continue;
          }

          // School alias / mascot match check
          const { getMascot } = require("./mascot_lookup.js");
          const mascot = (camp.mascot || getMascot(camp.university) || "").toLowerCase();
          const contentHasMascot = mascot && mascot !== "none" && mascot !== "tba" 
            ? (text.toLowerCase().includes(mascot) || title.toLowerCase().includes(mascot))
            : false;
            
          const contentHasAlias = aliases.find(a => text.toLowerCase().includes(a) || title.toLowerCase().includes(a));

          // Base validation relies on alias matching anywhere (including URL path)
          const matchedAlias = aliases.find(
            (a) =>
              text.toLowerCase().includes(a) ||
              title.toLowerCase().includes(a) ||
              candidate.toLowerCase().includes(a.replace(/\s+/g, "")),
          );

          if (!matchedAlias && !contentHasMascot) {
            log("      ✕ School alias/mascot mismatch.");
            isTopUrl = false;
            continue;
          }

          // V11 GUESSED URL (TIER 4) DOMAIN SQUATTER PREVENTION:
          // If the URL is guessed, the alias or mascot MUST be in the page text or title.
          // Matching the URL string is not enough, because a domain squatter registers the exact alias.
          if (item.isGuessed && !contentHasAlias && !contentHasMascot) {
            log("      ✕ Guessed URL rejected (squatter prevention): Alias or Mascot not found in page content.");
            isTopUrl = false;
            continue;
          }

          // V9 contamination check (state-aware)
          const culprit = checkContamination(
            title,
            camp.university,
            allSchoolNames,
            camp.headCoach // Pass coach to prevent false positives (e.g. Lane Burroughs)
          );
          if (culprit) {
            log(`      ✕ Contamination (${culprit}). Skip.`);
            isTopUrl = false;
            continue;
          }

          const validationReason = matchedAlias || mascot || "Unknown";
          log(
            `   → ✅ VALIDATED for ${camp.university} (alias/mascot: "${validationReason}")`,
          );

          const pageEmails = harvestEmails(text);
          if (pageEmails.length > 0) bestEmails.push(...pageEmails);

          // V12.6 Portal Detection
          const detectedPlatform = detectPortalPlatform(candidate, text);
          if (detectedPlatform) {
            camp.portalPlatform = detectedPlatform;
            log(`      🖥️  [Portal] Detected: ${detectedPlatform}`);
          }

          let fullText = text;
          const crawledUrls = new Set([candidate]);
          
          // Pre-extract links from the main page
          const subLinks = await p.$$eval("a", (els) =>
            els.map((a) => ({
              href: a.href || "",
              text: (a.innerText || "").toLowerCase().trim(),
            })),
          );

          const pagesToCrawl = [{ url: candidate, depth: 0 }];
          let pagesScanned = 0;

          const mainHost = new URL(candidate).hostname.replace(/^www\./, "");
          log(`   → Sub-crawling (Domain Restricted to: ${mainHost})...`);

          while (pagesToCrawl.length > 0 && pagesScanned < MAX_SUB_CRAWL_PAGES) {
            const current = pagesToCrawl.shift();
            if (current.depth >= MAX_SUB_CRAWL_DEPTH) continue;

            let links = [];
            if (current.url === candidate) {
              // We already have the links from the initial page load via p.$$eval
              links = subLinks;
            } else {
              // Need to load the subpage and get its links
              try {
                const sp = await browser.newPage();
                await sp.goto(current.url, {
                  waitUntil: "domcontentloaded",
                  timeout: 25000,
                });
                const st = await getPageText(sp);
                pagesScanned++;

                if (!pageHasNoEvents(st)) {
                  const hasBaseball = st.toLowerCase().includes("baseball");
                  const hasCamp = /camp|clinic|register|prospect|summer/i.test(st);
                  if (hasBaseball || hasCamp) {
                    log(`      ⭐ [D${current.depth}] ${current.url.substring(0, 70)}`);
                    fullText += "\n" + st;
                    const subEmails = harvestEmails(st);
                    if (subEmails.length > 0) bestEmails.push(...subEmails);
                  } else {
                    log(`      ↳ [D${current.depth}] ${current.url.substring(0, 70)}`);
                  }
                  
                  // Get new links if we haven't reached max depth
                  if (current.depth + 1 < MAX_SUB_CRAWL_DEPTH) {
                    links = await sp.$$eval("a", (els) =>
                      els.map((a) => ({
                        href: a.href || "",
                        text: (a.innerText || "").toLowerCase().trim(),
                      })),
                    );
                  }
                }
                await sp.close();
              } catch (e) {
                // log(`      ✕ Sub-crawl error on ${current.url}: ${e.message}`);
              }
            }

            // ── V11 SUB-CRAWL RULE: startsWith ONLY ──────────────────────────────
            // The ONLY rule: every link must start with the validated candidate URL.
            // Strip hash fragments and query strings before comparison.
            // No platform checks. No domain checks. No keyword bypasses. Just startsWith.
            const candidateNorm = candidate.split("#")[0].split("?")[0].replace(/\/$/, "").toLowerCase();

            for (const l of links) {
              if (!l.href || !l.href.startsWith("http")) continue;
              if (isBlacklistedUrl(l.href)) continue;
              if (isSearchEngineUrl(l.href)) continue;

              // Normalize: strip hash + query string
              const linkNorm = l.href.split("#")[0].split("?")[0].replace(/\/$/, "").toLowerCase();

              // Skip if same page (already crawled or same as candidate)
              if (linkNorm === candidateNorm) continue;
              if (crawledUrls.has(linkNorm)) continue;

              // THE RULE: only follow sub-pages of the validated URL
              // V12: Added exception for 'External Bridges' (high-confidence portable links)
              const linkUrl = l.href.split("#")[0].split("?")[0];
              const isLockViolated = !linkNorm.startsWith(candidateNorm);
              const isBridge = isLockViolated && isExternalBridge(linkUrl, l.text, camp.university);

              if (isLockViolated && !isBridge) continue;
              
              if (isBridge) {
                // V12.1: Check for contamination ON THE BRIDGE LINK TEXT
                // This prevents Arizona (Wildcats) from jumping to ASU (Sun Devils) links
                const culprit = checkContamination(l.text || "", camp.university, allSchoolNames);
                if (culprit) {
                   log(`   → ⚠️ Blocked Contaminated Bridge: "${(l.text || "").substring(0,30)}" (belongs to ${culprit})`);
                   continue;
                }
                log(`   → 🌉 Crossing External Bridge: ${linkUrl}`);
              }

              crawledUrls.add(linkNorm);
              pagesToCrawl.push({ url: l.href.split("#")[0].split("?")[0], depth: current.depth + 1 });
            }
          }

          // ── Phase C: Extract ────────────────────────────────────────────
          let campTiers = [];
          if (shouldExtractField(camp, "campDates") || shouldExtractField(camp, "cost")) {
            campTiers = extractDataFromText(
              fullText,
              camp.university,
              allSchoolNames,
            );
          }

          let fulfilledTarget = false;

          // Process dates & costs if found
          if ((shouldExtractField(camp, "campDates") || shouldExtractField(camp, "cost")) && campTiers.length > 0) {
            camp.campTiers = campTiers;
            
            // V12.5 Concise Date Summary: Limit to first 3 and add count for more
            const uniqueDateStrings = [...new Set(campTiers.map((t) => t.dates))];
            if (uniqueDateStrings.length > 3) {
              camp.dates = uniqueDateStrings.slice(0, 3).join(" | ") + ` ... [+${uniqueDateStrings.length - 3} more]`;
            } else {
              camp.dates = uniqueDateStrings.join(" | ");
            }
            camp.campUrl = candidate;
            camp.sourceUrl = candidate; // V9: separate field for UI fidelity

            // Synthesise cost range from tiers
            const costs = campTiers
              .map((t) => t.cost)
              .filter((c) => c !== "TBA" && c !== "FREE");
            if (costs.length > 0) {
              COST_NUMERIC_PATTERN.lastIndex = 0;
              const amounts = costs
                .flatMap((c) =>
                  [...c.matchAll(/\$[\d,]+/g)].map((m) =>
                    parseInt(m[0].replace(/[$,]/g, ""), 10),
                  ),
                )
                .filter(
                  (n) => !isNaN(n) && n >= PRICE_THRESHOLDS.CRITICAL_ANOMALY,
                );
              if (amounts.length > 0) {
                const minC = Math.min(...amounts);
                const maxC = Math.max(...amounts);
                camp.cost = minC === maxC ? `$${minC}` : `$${minC} - $${maxC}`;
              }
            } else if (
              costs.length === 0 &&
              campTiers.some((t) => t.cost === "FREE")
            ) {
              camp.cost = "FREE";
            }

            clearRecheckFlag(camp, "campDates");
            clearRecheckFlag(camp, "cost");
            fulfilledTarget = true;
          }

          // Process emails if requested and found
          if (shouldExtractField(camp, "email") && bestEmails.length > 0) {
            // V9 dual contact fields — never overwrite existing pointOfContact name
            const uniqueEmails = [...new Set(bestEmails)].slice(0, 2);
            camp.email = uniqueEmails[0]; // Authoritative email field
            camp.campPOCEmail = uniqueEmails[0]; // Backup mapping alias 
            
            const nameOnly = getCoachName(camp);
            if (nameOnly && (!camp.pointOfContact || camp.pointOfContact === "N/A"))
              camp.pointOfContact = nameOnly;
              
            // Try to extract name near email from page text (e.g. "Email Drew Bishop at...")
            if (!camp.pointOfContact || camp.pointOfContact === "N/A") {
              const pageName = extractNameNearEmail(fullText);
              if (pageName) camp.pointOfContact = pageName;
            }

            // Update display-string 'contact' for backward compatibility and UI
            const displayName = camp.pointOfContact && camp.pointOfContact !== "N/A" 
              ? camp.pointOfContact 
              : nameOnly || "Athletics Office";

            camp.contact = `${displayName} | ${uniqueEmails[0]}`;
            
            clearRecheckFlag(camp, "email");
            clearRecheckFlag(camp, "poc");
            fulfilledTarget = true;
          }

          // Evaluate success based on run type
          if (isFullExtractionRun(camp)) {
            // Full run requires tiers to be considered a URL success
            if (campTiers.length > 0) {
              camp.auditStatus = "EXTRACTED";
              camp.lastUpdateDate = Date.now();
              camp.datesUpdateDate = new Date().toISOString();
              success = true;
              log(`   → 🎯 SUCCESS — ${campTiers.length} tiers | Cost: ${camp.cost || "TBA"}`);
              break;
            }
          } else {
            // Targeted run: if we fulfilled the specific target, it's a success
            if (fulfilledTarget) {
              camp.auditStatus = "TARGETED_RECOVERY";
              camp.lastUpdateDate = Date.now();
              // Only update date timestamp if we actually modified dates
              if (campTiers.length > 0) camp.datesUpdateDate = new Date().toISOString();
              
              success = true;
              log(`   → 🎯 TARGETED SUCCESS — Recovered specifically requested fields.`);
              break;
            }
          }
        } catch (e) {
          log(`   → ✕ Error on ${candidate}: ${e.message.substring(0, 80)}`);
        }
        isTopUrl = false;
      }

      // Save any emails harvested even if no camp data found
      if (!success) {
        if (bestEmails.length > 0) {
          const uniqueEmails = [...new Set(bestEmails)].slice(0, 2);
          camp.email = uniqueEmails[0];
          if (camp.contact && !camp.contact.includes("@")) {
            camp.contact = `${camp.contact} | ${uniqueEmails[0]}`;
          }
          log(`   → 📧 Saved email (no camp data): ${uniqueEmails[0]}`);
        }
        log(`   → ❌ No 2026 summer camp data found for ${camp.university}`);
        camp.extractionResult = "no_data";
      } else {
        camp.extractionResult = "enriched";
      }

      camp.lastChecked = new Date().toISOString();
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
      log(`   → [DB_UPDATED] Saved.`);
    } catch (err) {
      log(`   → ERROR: ${err.message}`);
    } finally {
      clearTimeout(schoolTimeout);
      await p.close().catch(() => {});
    }
    
    // Memory release logic for massive queues
    if (i >= 19 && i < toProcess.length - 1) {
      log(`\n🛑 Batch limit reached (20 schools). Releasing memory...`);
      await browser.close();
      return { batchLimitReached: true };
    }
  }

  await browser.close();
  log(`\n🏁 V${CURRENT_SCRIPT_VERSION} Extraction Complete.`);
  log(
    `   Final: ${data.filter((d) => d.campTiers && d.campTiers.length > 0).length} schools with data out of ${data.length}`,
  );
}

module.exports = {
  runExtraction,
  extractDataFromText,
  harvestEmails,
  extractNameNearEmail,
  pageHasNoEvents,
  checkContamination,
};
