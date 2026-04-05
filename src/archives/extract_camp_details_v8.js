/**
 * NCAA Baseball Camp Extractor — V8 Ultra-Fidelity
 *
 * FIXES vs V7:
 *  1. Summer-only dates — June, July, August ONLY (no full-year scan)
 *  2. Search queries — "camp" now always included; mascot query prioritized
 *  3. Contact/coach detection — checks if contact field is TBA/email/junk
 *     before building coach-name search queries (no more bad query strings)
 *  4. Cost extraction — no upper cap; captures $75 through $1,300+ elite camps
 *  5. Relaxed extraction gating — baseball OR camp keyword (either is enough)
 *  6. URL scoring — coach last name in URL = +35 pts; school name in URL = +25
 *  7. Coach-name-as-URL signal — camp portals named after coach scored higher
 *  8. Targets: schools with scriptVersion < 8 AND no isVerified
 *  9. Log file: extraction_v8.log (clean slate per run)
 */

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const {
  getMascot,
  buildSearchQuery,
  getUniversityAliases,
} = require("./mascot_lookup");

// ── Config ─────────────────────────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, "camps_data.json");
const LOG_FILE = path.join(__dirname, "extraction_v8.log");
const SCHOOL_TIMEOUT_MS = 80000;
const RESTART_EVERY = 10;
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// Clear log on fresh run
try {
  fs.writeFileSync(
    LOG_FILE,
    `=== V8 Extraction Started ${new Date().toISOString()} ===\n`,
  );
} catch (e) {}

let data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
const allSchoolNames = data.map((d) => d.university);

// ── Logging ───────────────────────────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toLocaleTimeString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + "\n", "utf8");
  } catch (e) {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * FIX #3: Properly extract coach name from contact field.
 * Returns empty string if contact is TBA, an email address, or too short.
 * contact field formats: "Coach Name", "Coach Name | email@edu", "TBA", ""
 */
function getCoachName(camp) {
  if (!camp.contact) return "";
  // Take everything before the pipe (email separator)
  let raw = camp.contact.split("|")[0].trim();
  // Strip anything in parentheses like "(Head Coach)"
  raw = raw.replace(/\(.*?\)/g, "").trim();
  // Reject: TBA, email addresses, single words that look like placeholders, too short
  if (!raw) return "";
  if (raw.toLowerCase() === "tba") return "";
  if (raw.toLowerCase().includes("tba")) return "";
  if (raw.includes("@")) return "";
  if (raw.length < 4) return "";
  // Must look like a name: at least two words, only letters/spaces/hyphens/apostrophes
  if (!/^[A-Za-z][A-Za-z'\-\.]+(?:\s+[A-Za-z][A-Za-z'\-\.]+)+$/.test(raw))
    return "";
  return raw;
}

function checkContamination(title, targetUni) {
  const titleLower = title.toLowerCase();
  const targetLower = targetUni.toLowerCase();
  for (let other of allSchoolNames) {
    if (other === targetUni) continue;
    const oLower = other.toLowerCase();
    // Bidirectional: skip if one is substring of the other (e.g. "Kansas" in "Arkansas")
    if (targetLower.includes(oLower) || oLower.includes(targetLower)) continue;
    const escaped = oLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(titleLower)) return other;
  }
  return null;
}

/**
 * FIX #6 & #7: Score URLs — coach last name in URL is a strong signal.
 * Also handles school-name-as-campUrl pattern.
 */
function scoreUrl(url, school, isGuessed = false) {
  if (!url) return -100;
  let score = 0;
  const u = url.toLowerCase();
  const s = (school.university || "").toLowerCase();
  const coach = getCoachName(school).toLowerCase();
  const mascot = (
    school.mascot ||
    getMascot(school.university) ||
    ""
  ).toLowerCase();

  if (u.includes("baseball")) score += 40;
  if (u.includes("camp") || u.includes("clinic")) score += 30;
  if (u.includes("/sports/baseball")) score += 15;

  // FIX #7: Coach last name in URL (camp portals named after coach)
  if (coach && coach.split(" ").length >= 2) {
    const lastName = coach.split(" ").pop();
    if (lastName && lastName.length > 3 && u.includes(lastName)) score += 35;
  }

  if (mascot && mascot.length > 3 && u.includes(mascot.replace(/\s+/g, "")))
    score += 20;

  // School name variants in URL
  const cleanS = s.replace(/\s+/g, "");
  if (cleanS.length > 3 && u.includes(cleanS)) score += 25;
  const shortS = s
    .replace(/university|state|college| of /gi, "")
    .trim()
    .replace(/\s+/g, "");
  if (shortS.length > 3 && u.includes(shortS)) score += 15;

  // Premium camp portals
  if (
    u.includes("ryzer.com") ||
    u.includes("totalcamps.com") ||
    u.includes("active.com")
  )
    score += 60;
  if (
    u.includes("prestocamp") ||
    u.includes("campsite") ||
    u.includes("imleagues")
  )
    score += 30;
  if (u.endsWith(".edu")) score += 10;
  if (isGuessed) score -= 40;

  // Penalize schedule/roster/news pages
  if (u.includes("/schedule") || u.includes("/roster") || u.includes("/scores"))
    score -= 35;
  if (
    u.includes("/news/") ||
    u.includes("/article/") ||
    u.includes("/release/")
  )
    score -= 20;

  // Hard blacklist
  const bad = [
    "wikipedia",
    "espn",
    "facebook",
    "twitter",
    "instagram",
    "fandom",
    "warrennolan",
    "newsbreak",
    "ussportscamps",
    "zhihu",
    "reddit",
    "yelp",
    "tripadvisor",
    "search.yahoo.com",
    "images.search",
    "bing.com/images",
    "thebaseballcube",
    "ratemyprofessors",
    "niche.com",
    "collegeconfidential",
    "surveygizmo.com",
  ];
  if (bad.some((b) => u.includes(b))) score -= 100;

  return score;
}

// ── Extraction Engine ──────────────────────────────────────────────────────────
/**
 * FIX #1: Summer-only date detection — June, July, August ONLY.
 * FIX #4: Cost pattern has no upper cap ($75 → $1,300+).
 * FIX #5: Relaxed gating — baseball OR camp keyword is sufficient.
 */
function extractDataFromText(fullText) {
  const campTiers = [];
  const lines = fullText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 4);

  // FIX #1: SUMMER ONLY — June, July, August
  // Matches: "June 15", "Jun 15-18", "July 7th", "August 3, 2026", 6/15/2026, 07/08/26, etc.
  const SUMMER_MONTH_NAMES = "Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?";
  const SUMMER_NUMERIC =
    "(?:0?[67]|0?8)\\/(?:0[1-9]|[12]\\d|3[01])(?:\\/(?:2026|26))?"; // 6/xx, 7/xx, 8/xx with optional /2026 or /26 ONLY
  const DATE_PATTERN = new RegExp(
    `(?:(?:${SUMMER_MONTH_NAMES})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s*[-–]\\s*\\d{1,2}(?:st|nd|rd|th)?)?(?:,?\\s*20\\d{2})?)` +
      `|(?:${SUMMER_NUMERIC})`,
    "gi",
  );

  const CAMP_NAME_PATTERN =
    /([A-Z][A-Za-z0-9\s\/&\-]+(?:Camp|Clinic|Prospect|Showcase|Elite|Year-Round|Program|Academy|Session|Tournament|Tryout))/;

  // FIX #4: No upper cap on cost — captures $75 through $1,300+ and ranges
  const COST_PATTERN =
    /(?:\$[\d,]+(?:\.\d{2})?(?:\s*[-–\/]\s*\$[\d,]+(?:\.\d{2})?)?(?:\s*\+)?|FREE|Complimentary|No cost|Free of charge)/i;

  const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi;

  // Skip patterns
  const SKIP_KEYWORDS = [
    " vs ",
    " vs. ",
    " @ ",
    " at ",
    "tournament standings",
    "box score",
    "game recap",
  ];
  const SPORT_CONTAMINATION = [
    "basketball",
    "soccer",
    "volleyball",
    "swimming",
    "wrestling",
    "tennis",
    "lacrosse",
    "gymnastics",
  ];
  const STALE_YEARS = ["2024", "2023", "2022", "2021"];

  for (let j = 0; j < lines.length; j++) {
    const line = lines[j];
    if (!DATE_PATTERN.test(line)) {
      DATE_PATTERN.lastIndex = 0;
      continue;
    }
    DATE_PATTERN.lastIndex = 0;

    const block = lines
      .slice(Math.max(0, j - 3), Math.min(lines.length, j + 7))
      .join(" | ");
    const low = block.toLowerCase();

    // Skip: game schedules, old years, wrong sports
    if (SKIP_KEYWORDS.some((k) => low.includes(k))) continue;
    if (STALE_YEARS.some((y) => low.includes(y))) continue;
    if (/\d{1,2}:\d{2}\s*(?:am|pm)/i.test(block)) continue; // game times

    // FIX #5: RELAXED — baseball OR camp keyword is enough (not both required)
    const hasCampKeyword =
      /camp|clinic|prospect|showcase|register|enroll|sign.?up|instruction|lesson/i.test(
        block,
      );
    const hasBaseballKeyword =
      /baseball|pitcher|batter|hitting|infield|outfield|pitching|catching/i.test(
        block,
      );
    const hasBadSport = SPORT_CONTAMINATION.some((s) => low.includes(s));

    // Skip if clearly a non-baseball sport page with no baseball keyword
    if (hasBadSport && !hasBaseballKeyword) continue;
    // FIX #5: Only need one of the two — baseball OR camp
    if (!hasCampKeyword && !hasBaseballKeyword) continue;

    // Extract data
    const dateMatches = [
      ...block.matchAll(new RegExp(DATE_PATTERN.source, "gi")),
    ]
      .map((m) => m[0])
      .slice(0, 4);
    if (dateMatches.length === 0) continue;

    const nameMatch = block.match(CAMP_NAME_PATTERN);
    const costMatch = block.match(COST_PATTERN);
    const emailMatches = [...block.matchAll(EMAIL_PATTERN)].map((m) => m[0]);

    campTiers.push({
      name: nameMatch ? nameMatch[1].trim() : "Baseball Camp",
      dates: dateMatches.join(", "),
      cost: costMatch ? costMatch[0].trim() : "TBA",
      emails: emailMatches,
    });
  }

  // Deduplicate by name + first date
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
      `       📋 [Tiers] ${filtered.length} entries. Sample: ${filtered
        .slice(0, 2)
        .map((t) => `"${t.name}" (${t.dates.split(",")[0]})`)
        .join(" | ")}`,
    );
  } else {
    log(`       📋 [Tiers] None found (no summer dates Jun/Jul/Aug).`);
  }

  return filtered;
}

// ── Email Harvesting ───────────────────────────────────────────────────────────
function harvestEmails(text) {
  const matches = text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || [];
  const sorted = [...new Set(matches)].sort((a, b) => {
    const aScore =
      (a.includes(".edu") ? 10 : 0) +
      (a.toLowerCase().includes("baseball") ? 5 : 0);
    const bScore =
      (b.includes(".edu") ? 10 : 0) +
      (b.toLowerCase().includes("baseball") ? 5 : 0);
    return bScore - aScore;
  });
  return sorted.slice(0, 3);
}

// ── Build URL Candidates ───────────────────────────────────────────────────────
function buildGuessedUrls(camp) {
  const guessed = [];
  let cleanUni = camp.university
    .replace(/The /gi, "")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
  let shortName = camp.university
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
  // FIX #7: Coach-name-as-URL guess
  if (coach && coach.split(" ").length >= 2) {
    const lastName = coach.split(" ").pop();
    if (lastName && lastName.length > 3) {
      guessed.push(`https://www.${lastName}baseballcamp.com`);
      guessed.push(`https://www.${lastName}baseball.com`);
    }
  }
  return [...new Set(guessed)];
}

// ── Search Engine Definitions ──────────────────────────────────────────────────────
const PROVIDERS = [
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

// ── Search Engine Queries ──────────────────────────────────────────────────────
// ONE engine per school — strictly:
//   School 0 → DDG | School 1 → Bing | School 2 → Yahoo | School 3 → DDG ...
// NO fallback. If the engine returns nothing, we just have fewer candidates.
// schoolIdx is the loop counter from the main run() for loop.
async function runSearchQueries(page, camp, schoolIdx) {
  const engine = PROVIDERS[schoolIdx % PROVIDERS.length];
  const mascot = getMascot(camp.university) || "";
  const coach = getCoachName(camp);

  log(
    `   → [ENGINE] ${engine.name} (school slot ${(schoolIdx % PROVIDERS.length) + 1}/3)`,
  );

  // Build queries — all run through the same single engine
  const queries = [];
  if (mascot) queries.push(`${camp.university} ${mascot} baseball camps 2026`);
  queries.push(`"${camp.university}" baseball camps 2026`);
  if (coach) queries.push(`${coach} baseball camp 2026`);
  const cleanName = camp.university
    .replace(/University|State|College| of/gi, "")
    .trim();
  if (cleanName !== camp.university && cleanName.length > 3) {
    queries.push(`${cleanName} baseball camps 2026`);
  }

  const links = [];
  for (const q of queries.slice(0, 3)) {
    try {
      log(`      ↳ [${engine.name}] ${q.substring(0, 70)}`);
      await page.goto(engine.url(q), {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      const found = await page.evaluate((sel) => {
        return Array.from(document.querySelectorAll(sel))
          .map((a) => a.href)
          .filter(
            (h) =>
              h &&
              h.startsWith("http") &&
              !h.includes("duckduckgo.com") &&
              !h.includes("bing.com/search") &&
              !h.includes("yahoo.com/search"),
          );
      }, engine.selector);
      if (found && found.length > 0) {
        links.push(...found);
        log(`      ✓ [${engine.name}] ${found.length} results`);
      } else {
        log(`      ✕ [${engine.name}] 0 results for this query`);
      }
    } catch (e) {
      log(`      ✕ [${engine.name}] error: ${e.message.substring(0, 60)}`);
    }
    await delay(1200 + Math.random() * 600);
  }

  return [...new Set(links.filter((l) => l && l.startsWith("http")))];
}

// ── MAIN RUNNER ────────────────────────────────────────────────────────────────
const run = async () => {
  // FIX #8: Target schools with scriptVersion < 8 and not manually verified
  const toProcess = data.filter(
    (d) => (!d.isChecked || (d.scriptVersion || 0) < 8) && !d.isVerified,
  );
  log(
    `\n🚀 V8 Ultra-Fidelity Engine Starting. Target: ${toProcess.length} schools.`,
  );
  log(
    `   Database: ${data.length} total | ${data.filter((d) => d.isVerified).length} verified | ${data.filter((d) => d.campTiers && d.campTiers.length > 0).length} with data`,
  );
  log(
    `   Filters: SUMMER ONLY (Jun/Jul/Aug) | Relaxed gating (baseball OR camp) | Coach-name queries validated`,
  );

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
    // Periodic browser restart every RESTART_EVERY schools
    if (i > 0 && i % RESTART_EVERY === 0) {
      log(
        `\n[SYSTEM] Periodic browser restart at school ${i}/${toProcess.length}...`,
      );
      await browser.close().catch(() => {});
      await delay(2000);
      browser = await puppeteer.launch({
        headless: "new",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--window-size=1920,1080",
          "--disable-blink-features=AutomationControlled",
        ],
        ignoreDefaultArgs: ["--enable-automation"],
      });
    }

    const camp = toProcess[i];
    log(`\n${"═".repeat(60)}`);
    log(`[${i + 1}/${toProcess.length}] Processing: ${camp.university}`);
    const coachDisplay = getCoachName(camp);
    log(
      `   Coach: ${coachDisplay || "(none/TBA)"} | Contact raw: "${camp.contact || ""}"`,
    );
    log(`${"═".repeat(60)}`);

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

    // CHECKPOINT: mark school before processing to ensure resumption safety
    camp.isChecked = true;
    camp.scriptVersion = 8;
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

    const schoolTimeout = setTimeout(() => {
      log(`   ⏰ School timeout hit for ${camp.university}. Closing page.`);
      p.close().catch(() => {});
    }, SCHOOL_TIMEOUT_MS);

    try {
      // ── Phase A: Build URL candidate list ─────────────────────────
      let searchLinks = [];

      // Always try existing campUrl first if valid
      if (
        camp.campUrl &&
        camp.campUrl.startsWith("http") &&
        !camp.campUrl.includes("warrennolan")
      ) {
        log(`   → Priority URL from DB: ${camp.campUrl}`);
        searchLinks.push(camp.campUrl);
      }

      // Run multi-engine search
      const indexInMaster = data.indexOf(camp);
      const engineResults = await runSearchQueries(p, camp, indexInMaster);
      searchLinks.push(...engineResults);

      // Add URL-pattern guesses
      const guessed = buildGuessedUrls(camp);

      // Score and rank all candidates
      const scored = [
        ...searchLinks.map((u) => ({
          url: u,
          score: scoreUrl(u, camp, false),
        })),
        ...guessed.map((u) => ({ url: u, score: scoreUrl(u, camp, true) })),
      ]
        .sort((a, b) => b.score - a.score)
        .filter(
          (x, idx, self) => self.findIndex((y) => y.url === x.url) === idx,
        ) // dedupe
        .filter((x) => x.score > -50)
        .slice(0, 18);

      log(`   → ${scored.length} candidates. Top 3:`);
      scored
        .slice(0, 3)
        .forEach((s) =>
          log(
            `      ${s.score >= 50 ? "★" : s.score >= 20 ? "•" : "○"} [${String(s.score).padStart(3)}] ${s.url}`,
          ),
        );

      // ── Phase B: Validate & Sub-Crawl ─────────────────────────────
      const aliases = getUniversityAliases(camp.university);
      let success = false;
      let bestEmails = [];

      for (const item of scored) {
        const candidate = item.url;
        try {
          log(`\n   → Navigating [${item.score}]: ${candidate}`);
          const resp = await p.goto(candidate, {
            waitUntil: "domcontentloaded",
            timeout: 15000,
          });
          if (!resp || resp.status() >= 400) {
            log(`      ✕ HTTP ${resp?.status() || "error"}`);
            continue;
          }

          await delay(600 + Math.random() * 400);
          let text = await p.evaluate(() => document.body?.innerText || "");
          let title = (await p.title()) || "";

          // School alias check
          const matchedAlias = aliases.find(
            (a) =>
              text.toLowerCase().includes(a) ||
              title.toLowerCase().includes(a) ||
              candidate.toLowerCase().includes(a.replace(/\s+/g, "")),
          );
          if (!matchedAlias) {
            log(`      ✕ School alias mismatch.`);
            continue;
          }

          // Bidirectional contamination check
          const culprit = checkContamination(title, camp.university);
          if (culprit) {
            log(`      ✕ Contamination (${culprit}). Skip.`);
            continue;
          }

          log(
            `   → ✅ VALIDATED for ${camp.university} (alias: "${matchedAlias}")`,
          );

          const pageEmails = harvestEmails(text);
          if (pageEmails.length > 0) bestEmails.push(...pageEmails);

          let fullText = text;

          // ── Phase B.2: Deep Sub-Crawl (6 links) ───────────────
          const subLinks = await p.$$eval("a", (els) =>
            els.map((a) => ({
              href: a.href || "",
              text: (a.innerText || "").toLowerCase().trim(),
            })),
          );

          const campKeywords = [
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
          ];
          const blacklist = [
            "wikipedia",
            "facebook",
            "twitter",
            "instagram",
            "youtube",
            "espn",
            "fandom",
            "reddit",
            "warrennolan",
            "surveygizmo.com",
          ];
          const alreadyQueued = new Set([candidate]);

          const filteredSub = subLinks
            .filter((l) => {
              if (!l.href || !l.href.startsWith("http")) return false;
              if (alreadyQueued.has(l.href)) return false;
              const hl = l.href.toLowerCase();
              if (blacklist.some((b) => hl.includes(b))) return false;
              if (
                hl.includes("/schedule") ||
                hl.includes("/roster") ||
                hl.includes("/scores")
              )
                return false;
              if (hl.includes("/news/") || hl.includes("/article/"))
                return false;

              const hasCampKw = campKeywords.some(
                (k) => hl.includes(k) || l.text.includes(k),
              );
              if (hasCampKw) return true;

              // Allow same-domain pages that aren't news/articles
              try {
                const mainHost = new URL(candidate).hostname;
                const subHost = new URL(l.href).hostname;
                if (mainHost === subHost) return true;
              } catch (e) {}
              return false;
            })
            .slice(0, 6);

          log(`   → Sub-crawling ${filteredSub.length} pages...`);
          for (const sl of filteredSub) {
            alreadyQueued.add(sl.href);
            try {
              const sp = await browser.newPage();
              await sp.goto(sl.href, {
                waitUntil: "domcontentloaded",
                timeout: 12000,
              });
              const st = await sp.evaluate(
                () => document.body?.innerText || "",
              );
              const hasBaseballContent = st.toLowerCase().includes("baseball");
              const hasCampContent =
                /camp|clinic|register|prospect|summer/i.test(st);

              if (hasBaseballContent || hasCampContent) {
                log(`      ⭐ ${sl.href.substring(0, 70)}`);
                fullText += "\n" + st;
                const subEmails = harvestEmails(st);
                if (subEmails.length > 0) bestEmails.push(...subEmails);
              } else {
                log(`      ↳ ${sl.href.substring(0, 70)}`);
              }
              await sp.close();
            } catch (e) {
              /* ignore sub-page errors */
            }
          }

          // ── Phase C: Extract Camp Data ─────────────────────────
          const campTiers = extractDataFromText(fullText);

          if (campTiers.length > 0) {
            camp.campTiers = campTiers;
            camp.dates = [...new Set(campTiers.map((t) => t.dates))].join(
              " | ",
            );
            camp.campUrl = candidate;

            // FIX #4: Merge best cost range — no upper cap
            const costs = campTiers
              .map((t) => t.cost)
              .filter((c) => c !== "TBA");
            if (costs.length > 0) {
              const amounts = costs.flatMap((c) =>
                [...c.matchAll(/\$[\d,]+/g)].map((m) =>
                  parseInt(m[0].replace(/[$,]/g, "")),
                ),
              );
              if (amounts.length > 0) {
                const minC = Math.min(...amounts);
                const maxC = Math.max(...amounts);
                camp.cost = minC === maxC ? `$${minC}` : `$${minC} - $${maxC}`;
              }
            }

            // FIX #3: Merge harvested emails into contact — never overwrite a real name
            const uniqueEmails = [...new Set(bestEmails)].slice(0, 2);
            if (uniqueEmails.length > 0) {
              const currentContact = camp.contact || "";
              const hasEmail = currentContact.includes("@");
              if (!hasEmail) {
                camp.contact = currentContact
                  ? `${currentContact} | ${uniqueEmails[0]}`
                  : uniqueEmails[0];
              }
            }

            success = true;
            log(
              `   → 🎯 SUCCESS — ${campTiers.length} tiers. Cost: ${camp.cost || "TBA"} | Dates: ${camp.dates.substring(0, 60)}`,
            );
            break;
          }
        } catch (e) {
          log(`   → ✕ Error on ${candidate}: ${e.message.substring(0, 80)}`);
        }
      }

      // Save any emails found even if no camp data
      if (!success) {
        if (bestEmails.length > 0) {
          const uniqueEmails = [...new Set(bestEmails)].slice(0, 2);
          const currentContact = camp.contact || "";
          const hasEmail = currentContact.includes("@");
          if (!hasEmail) {
            camp.contact = currentContact
              ? `${currentContact} | ${uniqueEmails[0]}`
              : uniqueEmails[0];
            log(`   → 📧 Saved email (no camp data): ${uniqueEmails[0]}`);
          }
        }
        log(`   → ❌ No 2026 summer camp data found for ${camp.university}`);
      }

      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
      log(`   → [DB_UPDATED] Saved.`);
    } catch (err) {
      log(`   → ERROR: ${err.message}`);
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } finally {
      clearTimeout(schoolTimeout);
      await p.close().catch(() => {});
    }
  }

  await browser.close();
  log(`\n🏁 V8 Extraction Complete.`);
  log(
    `   Final: ${data.filter((d) => d.campTiers && d.campTiers.length > 0).length} schools with data out of ${data.length}`,
  );
};

run().catch((err) => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
