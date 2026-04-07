/**
 * extraction_engine.js — V10 Unified Authoritative Extraction Engine
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

const fs   = require("fs");
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
  GENERIC_EMAIL_PREFIXES,
  BROWSER_RESTART_EVERY,
  SCHOOL_TIMEOUT_MS,
  CURRENT_SCRIPT_VERSION,
  isWrongSport,
} = require("./config");

const DATA_FILE = path.join(__dirname, "../../camps_data.json");
const LOG_FILE  = path.join(__dirname, "../../smart_extract.log");

const logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
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
  let raw = input.split("|")[0].trim().replace(/\(.*?\)/g, "").trim();
  if (!raw || raw.toLowerCase().includes("tba")) return "";
  if (raw.includes("@") || raw.length < 4) return "";
  if (!/^[A-Za-z][A-Za-z'\-.]+(?:\s+[A-Za-z][A-Za-z'\-.]+)+$/.test(raw)) return "";
  return raw;
}

/**
 * Build URL guesses (school name + abbreviation + mascot + coach last name variants).
 * Pulled from V8 — most comprehensive set.
 */
function buildGuessedUrls(camp) {
  const guessed = [];
  const cleanUni = camp.university
    .replace(/The /gi, "").replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const shortName = camp.university
    .replace(/University|State|College| of/gi, "").trim()
    .replace(/\s+/g, "").toLowerCase();
  const mascot = (camp.mascot || getMascot(camp.university) || "")
    .toLowerCase().replace(/\s+/g, "");
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
    if (GENERIC_EMAIL_PREFIXES.some((g) => lower.startsWith(g + "@"))) return false;
    if (/bootstrap|example|domain|noreply|sentry|webmaster/i.test(lower)) return false;
    if (BLACKLISTED_DOMAINS.some((b) => lower.includes(b))) return false;
    return true;
  });
  return [...new Set(cleaned)].sort((a, b) => {
    const aScore = (a.includes(".edu") ? 10 : 0) + (a.toLowerCase().includes("baseball") ? 5 : 0);
    const bScore = (b.includes(".edu") ? 10 : 0) + (b.toLowerCase().includes("baseball") ? 5 : 0);
    return bScore - aScore;
  }).slice(0, 3);
}

/**
 * Contamination check: V9 state-aware version.
 * "Alabama" vs "Alabama State" handled correctly with word boundaries.
 * Also handles bidirectional substring (Kansas in Arkansas).
 */
function checkContamination(title, targetUni, allSchoolNames) {
  const titleLower = title.toLowerCase();
  const targetLower = targetUni.toLowerCase();
  const targetIsState = targetLower.includes(" state");

  for (const other of allSchoolNames) {
    if (other === targetUni) continue;
    const oLower = other.toLowerCase();

    // State-aware pair check (Alabama vs Alabama State)
    const otherIsState = oLower.includes(" state");
    if (targetIsState !== otherIsState) {
      const targetBase = targetLower.replace(/ state| university| college/g, "").trim();
      const otherBase  = oLower.replace(/ state| university| college/g, "").trim();
      if (targetBase === otherBase) {
        const titleHasState = titleLower.includes(" state");
        if (titleHasState !== targetIsState) return other;
      }
    }

    // Bidirectional substring skip (Arkansas contains Kansas)
    if (targetLower.includes(oLower) || oLower.includes(targetLower)) continue;

    const escaped = oLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(titleLower)) return other;
  }
  return null;
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
function extractDataFromText(fullText) {
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
    "gi"
  );

  const SKIP_KEYWORDS = [" vs ", " vs. ", " @ ", " at ", "tournament standings", "box score", "game recap"];
  const SPORT_CONTAMINATION = ["basketball", "soccer", "volleyball", "swimming", "wrestling", "tennis", "lacrosse", "gymnastics"];

  for (let j = 0; j < lines.length; j++) {
    const line = lines[j];
    DATE_TEST.lastIndex = 0;
    if (!DATE_TEST.test(line)) continue;

    const block = lines.slice(Math.max(0, j - 3), Math.min(lines.length, j + 7)).join(" | ");
    const low   = block.toLowerCase();

    // Skip game schedules
    if (SKIP_KEYWORDS.some((k) => low.includes(k))) continue;
    if (/\d{1,2}:\d{2}\s*(?:am|pm)/i.test(block)) continue;

    // Skip stale years
    if (STALE_YEARS.some((y) => low.includes(y) && !low.includes("2026"))) continue;

    // Sport contamination: skip if non-baseball sport detected without baseball keyword
    const hasCampKeyword    = /camp|clinic|prospect|showcase|register|enroll|sign.?up|instruction|lesson/i.test(block);
    const hasBaseballKeyword = /baseball|pitcher|batter|hitting|infield|outfield|pitching|catching/i.test(block);
    const hasBadSport       = SPORT_CONTAMINATION.some((s) => low.includes(s));
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
      // Validate price floor using PRICE_THRESHOLDS
      COST_NUMERIC_PATTERN.lastIndex = 0;
      const numMatch = COST_NUMERIC_PATTERN.exec(rawCost);
      if (numMatch) {
        const val = parseFloat(numMatch[1].replace(/,/g, ""));
        if (!isNaN(val) && val >= PRICE_THRESHOLDS.CRITICAL_ANOMALY) {
          cost = rawCost;
        } else {
          log(`       ⚠️ [Price] Rejected suspicious price "${rawCost}" (val: ${val}). Setting TBA.`);
        }
      } else {
        // FREE, Complimentary, etc. — keep as-is
        cost = rawCost;
      }
    }

    // Extract camp name
    CAMP_NAME_PATTERN.lastIndex = 0;
    const nameMatch = CAMP_NAME_PATTERN.exec(block);
    const name = nameMatch ? nameMatch[1].trim() : "Baseball Camp";

    campTiers.push({ name, dates: uniqueDates.join(", "), cost });
  }

  // Deduplicate: normalize dates (strip ordinals) for comparison key
  const seen = new Set();
  const filtered = campTiers.filter((t) => {
    const firstDate = (t.dates.split(",")[0] || "").trim().toLowerCase().replace(/st|nd|rd|th/g, "");
    const key = t.name.toLowerCase().substring(0, 30) + "::" + firstDate;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (filtered.length > 0) {
    log(`       📋 [Tiers] ${filtered.length} found. Sample: ${filtered.slice(0, 2).map((t) => `"${t.name}"`).join(" | ")}`);
  } else {
    log("       📋 [Tiers] None found on this page.");
  }

  return filtered;
}

// ── Search Engine Query Runner ────────────────────────────────────────────────
/**
 * Run search queries for a school using round-robin engine rotation.
 * Uses SEARCH_PROVIDERS from config.js — no hardcoding.
 */
async function runSearchQueries(page, camp, dbIndex) {
  const engine  = SEARCH_PROVIDERS[dbIndex % SEARCH_PROVIDERS.length];
  const mascot  = getMascot(camp.university) || "";
  const coach   = getCoachName(camp);

  log(`   → [ENGINE] ${engine.name} (rotation slot ${(dbIndex % SEARCH_PROVIDERS.length) + 1}/${SEARCH_PROVIDERS.length})`);

  const queries = [];
  if (mascot) queries.push(`${camp.university} ${mascot} baseball camps 2026`);
  queries.push(`"${camp.university}" baseball camps 2026`);
  if (coach) queries.push(`${coach} baseball camp 2026`);
  const cleanName = camp.university.replace(/University|State|College| of/gi, "").trim();
  if (cleanName !== camp.university && cleanName.length > 3)
    queries.push(`${cleanName} baseball camps 2026`);

  const links = [];
  for (const q of queries.slice(0, 3)) {
    try {
      log(`      ↳ [${engine.name}] ${q.substring(0, 70)}`);
      await page.goto(engine.url(q), { waitUntil: "domcontentloaded", timeout: 20000 });
      const found = await page.evaluate((sel) =>
        Array.from(document.querySelectorAll(sel))
          .map((a) => a.href)
          .filter((h) => h && h.startsWith("http")),
        engine.selector
      );
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
      await page.goto(engine.url(q2), { waitUntil: "domcontentloaded", timeout: 20000 });
      const found2 = await page.evaluate((sel) =>
        Array.from(document.querySelectorAll(sel)).map((a) => a.href).filter((h) => h && h.startsWith("http")),
        engine.selector
      );
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
async function runExtraction({ schoolFilter = null, limit = null, forceRequeue = false } = {}) {
  let data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const allSchoolNames = data.map((d) => d.university);

  // Queue: schools that need processing
  let toProcess = data.filter((d) => {
    if (d.isVerified) return false; // Never touch manually verified
    if (!forceRequeue && d.isChecked && (d.scriptVersion || 0) >= CURRENT_SCRIPT_VERSION) return false;
    return true;
  });

  if (schoolFilter) {
    const filters = schoolFilter.toLowerCase().split(",").map((s) => s.trim());
    toProcess = toProcess.filter((d) =>
      filters.some((f) => d.university.toLowerCase().includes(f))
    );
  }
  if (limit) toProcess = toProcess.slice(0, limit);

  log(`\n🚀 V${CURRENT_SCRIPT_VERSION} Unified Engine Starting. Target: ${toProcess.length} schools.`);
  log(`   Database: ${data.length} total | ${data.filter((d) => d.isVerified).length} verified`);

  // Backup before run
  const backup = DATA_FILE.replace(".json", `_backup_${Date.now()}.json`);
  fs.copyFileSync(DATA_FILE, backup);
  log(`📦 Backup: ${path.basename(backup)}`);

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
      log(`\n[SYSTEM] Restarting browser at school ${i}/${toProcess.length}...`);
      await browser.close().catch(() => {});
      await delay(2000);
      browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1920,1080"],
        ignoreDefaultArgs: ["--enable-automation"],
      });
    }

    const camp = toProcess[i];
    const dbIndex = data.indexOf(camp);

    log(`\n${"═".repeat(60)}`);
    log(`[${i + 1}/${toProcess.length}] Processing: ${camp.university}`);
    log(`   Coach: ${getCoachName(camp) || "(none/TBA)"} | Version: ${camp.scriptVersion || 0}`);
    log("═".repeat(60));

    const p = await browser.newPage();

    // Stealth settings
    await p.setViewport({ width: 1920 + Math.floor(Math.random() * 80), height: 1080 + Math.floor(Math.random() * 80) });
    await p.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
    await p.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      Object.defineProperty(navigator, "deviceMemory", { get: () => 8 });
      Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 16 });
      window.chrome = { runtime: {} };
    });

    // CHECKPOINT: mark school before processing so watchdog/restart can skip it safely
    camp.isChecked    = true;
    camp.scriptVersion = CURRENT_SCRIPT_VERSION;
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

    // Per-school timeout guard
    const schoolTimeout = setTimeout(() => {
      log(`   ⏰ Timeout (${SCHOOL_TIMEOUT_MS / 1000}s) for ${camp.university}. Closing page.`);
      p.close().catch(() => {});
    }, SCHOOL_TIMEOUT_MS);

    try {
      // ── Phase A: Build URL candidate list ─────────────────────────────────
      let searchLinks = [];

      // V7/V8 priority: always try existing campUrl from DB first
      if (camp.campUrl && camp.campUrl.startsWith("http") && !isBlacklistedUrl(camp.campUrl)) {
        log(`   → Priority DB URL: ${camp.campUrl}`);
        searchLinks.push(camp.campUrl);
      }

      // Search engine results (round-robin rotation)
      const engineResults = await runSearchQueries(p, camp, dbIndex);
      searchLinks.push(...engineResults);

      // URL pattern guesses
      const guessed = buildGuessedUrls(camp);

      // Score, dedupe, drop clearly bad URLs, take top 18
      const scored = [
        ...searchLinks.map((u) => ({ url: u, score: scoreUrl(u, camp, false), isGuessed: false })),
        ...guessed.map((u) => ({ url: u, score: scoreUrl(u, camp, true), isGuessed: true })),
      ]
        .sort((a, b) => b.score - a.score)
        .filter((x, idx, self) => self.findIndex((y) => y.url === x.url) === idx)
        .filter((x) => x.score > -50)
        .slice(0, 18);

      log(`   → ${scored.length} candidates. Top 3:`);
      scored.slice(0, 3).forEach((s) =>
        log(`      ${s.score >= 50 ? "★" : s.score >= 20 ? "•" : "○"} [${String(s.score).padStart(3)}] ${s.url}`)
      );

      // ── Phase B: Validate & Sub-Crawl ─────────────────────────────────────
      const aliases  = getUniversityAliases(camp.university);
      let success    = false;
      let bestEmails = [];
      let isTopUrl   = true; // First in scored list = highest priority

      for (const item of scored) {
        const candidate = item.url;
        try {
          log(`\n   → Navigating [${item.score}]: ${candidate}`);
          const resp = await p.goto(candidate, { waitUntil: "domcontentloaded", timeout: 15000 });
          if (!resp || resp.status() >= 400) {
            log(`      ✕ HTTP ${resp?.status() || "error"}`);
            isTopUrl = false;
            continue;
          }

          await delay(600 + Math.random() * 400);
          const text  = await p.evaluate(() => document.body?.innerText || "");
          const title = (await p.title()) || "";

          // ── "No Upcoming Events" — smart hybrid (Decision 2C) ──
          if (pageHasNoEvents(text)) {
            if (isTopUrl && item.score >= 50) {
              // Top/official portal says no events → mark TBA authoritatively
              log(`      ⚠️ Official portal says no upcoming events. Marking TBA.`);
              camp.cost      = "TBA";
              camp.dates     = "TBA";
              camp.campTiers = [];
              camp.details   = "Official portal confirms no 2026 camps posted yet.";
              camp.auditStatus = "NO_EVENTS_CONFIRMED";
              camp.lastUpdateDate = Date.now();
              fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            } else {
              log(`      ↷ Lower-ranked page has no events — skipping, trying next.`);
            }
            isTopUrl = false;
            continue;
          }

          // School alias match check
          const matchedAlias = aliases.find(
            (a) =>
              text.toLowerCase().includes(a) ||
              title.toLowerCase().includes(a) ||
              candidate.toLowerCase().includes(a.replace(/\s+/g, ""))
          );
          if (!matchedAlias) {
            log("      ✕ School alias mismatch.");
            isTopUrl = false;
            continue;
          }

          // V9 contamination check (state-aware)
          const culprit = checkContamination(title, camp.university, allSchoolNames);
          if (culprit) {
            log(`      ✕ Contamination (${culprit}). Skip.`);
            isTopUrl = false;
            continue;
          }

          log(`   → ✅ VALIDATED for ${camp.university} (alias: "${matchedAlias}")`);

          const pageEmails = harvestEmails(text);
          if (pageEmails.length > 0) bestEmails.push(...pageEmails);

          let fullText = text;

          // ── Phase B.2: Deep Sub-Crawl ───────────────────────────────────
          const subLinks = await p.$$eval("a", (els) =>
            els.map((a) => ({ href: a.href || "", text: (a.innerText || "").toLowerCase().trim() }))
          );

          const alreadyQueued = new Set([candidate]);

          const filteredSub = subLinks
            .filter((l) => {
              if (!l.href || !l.href.startsWith("http")) return false;
              if (alreadyQueued.has(l.href)) return false;
              const hl = l.href.toLowerCase();
              if (isBlacklistedUrl(l.href)) return false;
              if (isSearchEngineUrl(l.href)) return false;
              if (hl.includes("/schedule") || hl.includes("/roster") || hl.includes("/news/") || hl.includes("/article/")) return false;
              const hasCampKw = SUB_CRAWL_KEYWORDS.some((k) => hl.includes(k) || l.text.includes(k));
              if (hasCampKw) return true;
              try {
                const mainHost = new URL(candidate).hostname;
                const subHost  = new URL(l.href).hostname;
                if (mainHost === subHost) return true;
              } catch (e) {}
              return false;
            })
            .slice(0, 8);

          log(`   → Sub-crawling ${filteredSub.length} pages...`);
          for (const sl of filteredSub) {
            alreadyQueued.add(sl.href);
            try {
              const sp = await browser.newPage();
              await sp.goto(sl.href, { waitUntil: "domcontentloaded", timeout: 12000 });
              const st = await sp.evaluate(() => document.body?.innerText || "");

              if (pageHasNoEvents(st)) {
                log(`      ↷ Sub-page has no events — skipping.`);
                await sp.close();
                continue;
              }

              const hasBaseball = st.toLowerCase().includes("baseball");
              const hasCamp     = /camp|clinic|register|prospect|summer/i.test(st);
              if (hasBaseball || hasCamp) {
                log(`      ⭐ ${sl.href.substring(0, 70)}`);
                fullText += "\n" + st;
                const subEmails = harvestEmails(st);
                if (subEmails.length > 0) bestEmails.push(...subEmails);
              } else {
                log(`      ↳ ${sl.href.substring(0, 70)}`);
              }
              await sp.close();
            } catch (e) { /* ignore sub-page errors */ }
          }

          // ── Phase C: Extract ────────────────────────────────────────────
          const campTiers = extractDataFromText(fullText);

          if (campTiers.length > 0) {
            camp.campTiers  = campTiers;
            camp.dates      = [...new Set(campTiers.map((t) => t.dates))].join(" | ");
            camp.campUrl    = candidate;
            camp.sourceUrl  = candidate; // V9: separate field for UI fidelity

            // Synthesise cost range from tiers
            const costs = campTiers.map((t) => t.cost).filter((c) => c !== "TBA" && c !== "FREE");
            if (costs.length > 0) {
              COST_NUMERIC_PATTERN.lastIndex = 0;
              const amounts = costs.flatMap((c) =>
                [...c.matchAll(/\$[\d,]+/g)].map((m) => parseInt(m[0].replace(/[$,]/g, ""), 10))
              ).filter((n) => !isNaN(n) && n >= PRICE_THRESHOLDS.CRITICAL_ANOMALY);
              if (amounts.length > 0) {
                const minC = Math.min(...amounts);
                const maxC = Math.max(...amounts);
                camp.cost = minC === maxC ? `$${minC}` : `$${minC} - $${maxC}`;
              }
            } else if (costs.length === 0 && campTiers.some((t) => t.cost === "FREE")) {
              camp.cost = "FREE";
            }

            // V9 dual contact fields — never overwrite existing pointOfContact name
            const uniqueEmails = [...new Set(bestEmails)].slice(0, 2);
            if (uniqueEmails.length > 0) {
              camp.email = uniqueEmails[0]; // Authoritative email field
              const nameOnly = getCoachName(camp);
              if (nameOnly && !camp.pointOfContact) camp.pointOfContact = nameOnly;
              // Preserve legacy contact field for HTML rendering (append if no email yet)
              if (camp.contact && !camp.contact.includes("@")) {
                camp.contact = `${camp.contact} | ${uniqueEmails[0]}`;
              }
            }

            camp.auditStatus    = "EXTRACTED";
            camp.lastUpdateDate = Date.now();
            camp.datesUpdateDate = new Date().toISOString();

            success = true;
            log(`   → 🎯 SUCCESS — ${campTiers.length} tiers | Cost: ${camp.cost || "TBA"}`);
            break;
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
  }

  await browser.close();
  log(`\n🏁 V${CURRENT_SCRIPT_VERSION} Extraction Complete.`);
  log(`   Final: ${data.filter((d) => d.campTiers && d.campTiers.length > 0).length} schools with data out of ${data.length}`);
}

module.exports = { runExtraction, extractDataFromText, harvestEmails, pageHasNoEvents };
