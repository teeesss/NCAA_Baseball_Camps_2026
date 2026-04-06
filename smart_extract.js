"use strict";

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const { MASCOT_LOOKUP } = require("./src/utils/mascot_lookup.js");
const { isContaminated } = require("./src/utils/contamination_check.js");
const ALL_SCHOOLS = Object.keys(MASCOT_LOOKUP);

const QUEUE_FILE = path.join(__dirname, "missing_data_queue.json");
const DATA_FILE = path.join(__dirname, "camps_data.json");
const BLACKLIST_FILE = path.join(__dirname, "blacklist.json");
const LOG_FILE = path.join(__dirname, "smart_extract.log");

const logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logStream.write(line + "\n");
}

function safeWriteJSON(filepath, data) {
  const tmp = filepath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filepath);
}

const args = process.argv.slice(2);
const argMap = {};
for (const a of args) {
  const [k, v] = a.replace(/^--/, "").split("=");
  argMap[k] = v || true;
}
const SCHOOL_FILTER = argMap.school || null;
const SCHOOL_LIMIT = argMap.limit ? parseInt(argMap.limit, 10) : null;

// ── Load config (single source of truth) ────────────────────────────
const {
  BLACKLISTED_DOMAINS,
  isBlacklistedUrl,
  REJECT_SPORTS,
  isWrongSport,
  isTeamCampOrLegacy,
  DATE_PATTERNS,
  COST_PATTERN,
  EMAIL_PATTERN,
  COST_RANGE,
  GENERIC_EMAIL_PREFIXES,
  CURRENT_SCRIPT_VERSION,
} = require("./src/utils/config");

function unwrapUrl(url) {
  try {
    let u = new URL(url);
    // DDG uses uddg=, Yahoo uses RU=
    let real = u.searchParams.get("uddg") || u.searchParams.get("RU");
    if (real) return real;
  } catch (e) {}
  return url;
}

function extractData(text, url, schoolName) {
  // FIX: llm-issues-prompt #2 — Sport Exclusivity
  if (isWrongSport(text)) {
    log(`    ⚠️ REJECTED: Page is not about baseball`);
    return { dates: null, cost: null, costVal: null, email: null, url };
  }

  // REMOVED: isTeamCampOrLegacy rejection — official school camps (including
  // "team camps") are valid data sources. Dates are filtered per-school during URL selection.

  let datesList = [];
  for (const pat of DATE_PATTERNS) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(text)) !== null) {
      datesList.push(m[0].trim());
    }
  }
  const dates = datesList.length
    ? [...new Set(datesList)].slice(0, 3).join(" | ")
    : null;

  let bestCost = null;
  let costRaw = null;
  let costs = [];
  const campKeywords =
    /camp|clinic|registration|register|fee|tuition|cost|price|per\s+player/gi;

  let match;
  while ((match = campKeywords.exec(text)) !== null) {
    const window = text.substring(
      Math.max(0, match.index - 150),
      Math.min(text.length, match.index + 150),
    );
    COST_PATTERN.lastIndex = 0;
    let costMatch;
    while ((costMatch = COST_PATTERN.exec(window)) !== null) {
      const val = parseFloat(costMatch[1].replace(/,/g, ""));
      if (val >= COST_RANGE.MIN && val <= COST_RANGE.MAX) costs.push(val);
    }
  }

  if (costs.length) {
    let validCosts = [...new Set(costs)].sort((a, b) => a - b);
    bestCost = validCosts[0];
    costRaw =
      validCosts.length > 1
        ? validCosts
            .slice(0, 3)
            .map((c) => `$${c}`)
            .join(" / ")
        : `$${bestCost}`;
    if (bestCost > 500) log(`    ⚠️ High price detected ($${bestCost})`);
  }

  // FIX: llm-issues-prompt #3 — Baseball-context email extraction
  let emailsList = [];
  const sections = text.split(/\n\s*\n/);
  for (const section of sections) {
    const sectionLower = section.toLowerCase();
    const hasBaseballContext =
      sectionLower.includes("baseball") || sectionLower.includes("camp");
    const hasContactContext =
      (sectionLower.includes("coach") || sectionLower.includes("contact")) &&
      hasBaseballContext;
    const isOtherSport =
      [
        "basketball",
        "football",
        "soccer",
        "volleyball",
        "softball",
        "tennis",
        "swimming",
      ].some((s) => sectionLower.includes(s)) &&
      !sectionLower.includes("baseball");

    const GENERIC_ADMIN_EMAILS = [
      "admissions",
      "communications",
      "privacy",
      "info",
      "enroll",
      "undergraduate",
      "accessibility",
      "registrar",
      "web-accessibility",
    ];

    if ((hasBaseballContext || hasContactContext) && !isOtherSport) {
      EMAIL_PATTERN.lastIndex = 0;
      let m3;
      while ((m3 = EMAIL_PATTERN.exec(section)) !== null) {
        let e = m3[0].toLowerCase();
        const isGeneric = GENERIC_EMAIL_PREFIXES.some((g) =>
          e.startsWith(g + "@"),
        );
        if (
          !isGeneric &&
          !BLACKLISTED_DOMAINS.some((b) => e.includes(b)) &&
          !e.includes("example") &&
          !e.includes("noreply") &&
          !e.includes("sentry")
        ) {
          emailsList.push(e);
        }
      }
    }
  }

  let email = emailsList.length ? emailsList[0] : null;
  if (!email) {
    const emailMatch = text.match(EMAIL_PATTERN);
    if (emailMatch) {
      const VALID_TLDS = ["edu", "com", "org", "net"];
      for (let e of emailMatch) {
        e = e.toLowerCase();
        const parts = e.split("@");
        if (parts[0].length < 3) continue;
        const tld = parts[1].split(".").pop();
        if (
          VALID_TLDS.includes(tld) &&
          !BLACKLISTED_DOMAINS.some((b) => e.includes(b))
        ) {
          email = e;
          break;
        }
      }
    }
  }

  let campPOC = null;
  const pocMatch = text.match(
    /(?:Camp|Director|Coordinator|Admin|Contact)\s+(?:of|for|Name)?\s*:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i,
  );
  if (pocMatch) {
    campPOC = pocMatch[1].trim();
    if (
      ["Baseball", "Clinic", "Registration", "Staff", "Athletics"].some(
        (word) => campPOC.includes(word),
      )
    )
      campPOC = null;
  }

  // Cross-school email contamination check
  // e.g. UNLV page should not return olemissbaseball@gmail.com
  if (email && schoolName) {
    const emailLower = email.toLowerCase();
    const schoolLower = schoolName.toLowerCase();
    const schoolMascot = (MASCOT_LOOKUP[schoolName] || "").toLowerCase();
    for (const [uni, mascot] of Object.entries(MASCOT_LOOKUP)) {
      if (uni.toLowerCase() === schoolLower) continue;
      const otherShort = uni.toLowerCase().replace(/\s+/g, "");
      const otherMascot = mascot.toLowerCase();
      // Check if email local part or domain clearly references another school
      const emailLocal = emailLower.split("@")[0];
      const emailDomain = (emailLower.split("@")[1] || "").replace(/\./g, "");
      const emailNoAt = emailLocal + emailDomain;
      if (
        otherShort.length > 3 &&
        emailNoAt.includes(otherShort) &&
        !text.toLowerCase().includes(schoolLower)
      ) {
        log(
          `    ⚠️ Cross-school email skipped: ${email} → likely belongs to "${uni}"`,
        );
        email = null;
        break;
      }
      if (
        otherMascot.length > 3 &&
        emailNoAt.includes(otherMascot.replace(/\s+/g, "")) &&
        !schoolMascot.includes(otherMascot.replace(/\s+/g, ""))
      ) {
        log(
          `    ⚠️ Cross-school email skipped: ${email} → likely belongs to "${uni}"`,
        );
        email = null;
        break;
      }
    }
  }

  return { dates, cost: costRaw, costVal: bestCost, email, url, campPOC };
}

async function searchEngine(page, urlTemplate, engineName) {
  try {
    await page.goto(urlTemplate, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await new Promise((r) => setTimeout(r, 1200));

    let sel =
      engineName === "DDG"
        ? ".result__a"
        : "h3.title a, div.algo h3 a, .compTitle a";
    const links = await page.evaluate((selector) => {
      return Array.from(document.querySelectorAll(selector))
        .map((a) => ({
          href: a.href,
          title: (a.textContent || "").toLowerCase(),
        }))
        .filter(
          (h) =>
            h.href.startsWith("http") &&
            !h.href.includes("yahoo.com/search") &&
            !h.href.includes("duckduckgo.com/html"),
        );
    }, sel);

    const rejectPatterns = [
      "ticket",
      "seatgeek",
      "stubhub",
      "merchandise",
      "shop",
      "football",
      "basketball",
      "soccer",
      "tennis",
      "swimming",
      "news",
      "article",
      "release",
      "giving",
      "donate",
      "fundraise",
      "givesmart",
      // Ad/promo redirects — these are API redirect links, not actual camp pages
      "/api/",
      "/promotions/",
      "/adserver",
      "/track?",
      "/click?",
      "/redirect?",
      "bkstr.com",
    ];

    const scored = links
      .map((l) => {
        let clean = unwrapUrl(l.href);
        let url = clean.toLowerCase();
        let title = l.title;

        if (BLACKLISTED_DOMAINS.some((b) => clean.includes(b))) return null;
        if (rejectPatterns.some((p) => url.includes(p) || title.includes(p)))
          return null;

        let score = 0;
        if (url.includes("baseball")) score += 20;
        if (url.includes("camp") || title.includes("camp")) score += 10;
        if (url.includes("2026")) score += 50;
        if (url.includes("2025")) score -= 100;
        if (url.endsWith(".edu") || url.includes(".edu/")) score += 5;

        return { url: clean, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return scored.length > 0 ? scored[0].url : null;
  } catch (e) {
    log(`    ✕ [${engineName}] Error: ${e.message.substring(0, 40)}`);
  }
  return null;
}

function checkSubPageContamination(text, targetSchool) {
  const targetLower = targetSchool.toLowerCase().replace(/\s+/g, "");
  const targetMascot = (MASCOT_LOOKUP[targetSchool] || "").toLowerCase();
  const textLower = text.toLowerCase().replace(/\s+/g, "");

  // Conference opponent whitelist — big programs naturally appear on
  // schedule, roster, facility, and news pages within the same conference.
  // Not contamination if the target school shares a conference page
  // with these programs.
  const CONFERENCE_OPPONENTS = new Set([
    "alabama",
    "arizona",
    "arizonastate",
    "auburn",
    "baylor",
    "clemson",
    "duke",
    "florida",
    "floridastate",
    "georgia",
    "georgiatech",
    "kentucky",
    "louisiana",
    "louisianatech",
    "louisville",
    "lsu",
    "maryland",
    "miami",
    "miamioh",
    "michigan",
    "michiganstate",
    "mississippi",
    "mississippistate",
    "northcarolina",
    "northcarolinastate",
    "northwestern",
    "notredame",
    "ohiostate",
    "oklahoma",
    "oklahomastate",
    "olemiss",
    "oregon",
    "oregonstate",
    "pennstate",
    "southcarolina",
    "stanford",
    "texas",
    "texasa&m",
    "texaschristian",
    "texastech",
    "tennessee",
    "ucla",
    "usc",
    "utah",
    "vanderbilt",
    "virginia",
    "virginiatech",
    "washington",
    "washingtonstate",
    "wakeforest",
    "westvirginia",
    "iowa",
    "iowastate",
    "indiana",
    "illinois",
    "kansas",
    "kansasstate",
    "nebraska",
    "arkansas",
    "arkansasstate",
    "cincinnati",
    "colorado",
    "bostoncollege",
    "louisianastate",
    "california",
    "smu",
  ]);

  for (const [uni, mascot] of Object.entries(MASCOT_LOOKUP)) {
    if (uni.toLowerCase() === targetSchool.toLowerCase()) continue;
    const uniLower = uni.toLowerCase().replace(/\s+/g, "");
    const mascotNorm = mascot.toLowerCase().replace(/[^a-z]/g, "");

    // Skip conference opponents — normal on schedule/conference pages
    if (CONFERENCE_OPPONENTS.has(uniLower)) continue;

    // Word-boundary check for unis (min 7 chars) prevents false positives
    if (uniLower.length > 6) {
      const re = new RegExp(uniLower.replace(/[^a-z0-9]/g, ""), "i");
      if (re.test(textLower)) {
        if (
          !uniLower.includes(targetLower) &&
          !targetLower.includes(uniLower)
        ) {
          log(
            '    \u26a0\ufe0f Sub-page contaminated with "' +
              uni +
              '" - skipping',
          );
          return true;
        }
      }
    }

    // Skip common mascot words that appear in non-school contexts
    const GENERIC_MASCOT_WORDS = new Set([
      "eagles",
      "falcons",
      "hawks",
      "knights",
      "lions",
      "tigers",
      "bears",
      "bulls",
      "wolves",
      "panthers",
      "warriors",
      "pioneers",
      "scouts",
      "pride",
    ]);
    if (GENERIC_MASCOT_WORDS.has(mascotNorm)) continue;

    // Mascot: require word-boundary match (min 5 chars)
    if (mascotNorm.length > 4) {
      const mascotWord = new RegExp("\\b" + mascotNorm + "\\b", "i");
      if (mascotWord.test(text)) {
        const targetNorm = targetMascot.replace(/[^a-z]/g, "");
        if (
          !targetNorm.includes(mascotNorm) &&
          !mascotNorm.includes(targetNorm)
        ) {
          log(
            '    \u26a0\ufe0f Sub-page contaminated with "' +
              mascot +
              '" - skipping',
          );
          return true;
        }
      }
    }
  }

  return false;
}
function isAdRedirectUrl(url) {
  if (!url) return false;
  const u = url.toLowerCase();
  return (
    u.includes("/api/") ||
    u.includes("/promotions/") ||
    u.includes("/adserver") ||
    u.includes("/click?") ||
    u.includes("/redirect?") ||
    u.includes("/track?") ||
    u.includes("bkstr.com") ||
    u.includes("seatgeek.com") ||
    u.includes("stubhub.com")
  );
}

function isUrlGeneric(url) {
  if (!url) return true;
  try {
    let u = new URL(url);
    let p = u.pathname.replace(/\/$/, "").toLowerCase();
    return (
      p === "" ||
      p === "/" ||
      p === "/athletics" ||
      p === "/sports" ||
      p === "/baseball"
    );
  } catch (e) {
    return true;
  }
}

async function run() {
  log(`🚀 STARTING BATCH`);

  // Backup before starting
  const BACKUP = DATA_FILE.replace(".json", `_backup_${Date.now()}.json`);
  fs.copyFileSync(DATA_FILE, BACKUP);
  log(`📦 Backup created: ${path.basename(BACKUP)}`);

  if (!fs.existsSync(QUEUE_FILE)) return log("❌ queue missing");

  const queueData = JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8"));
  let queue = queueData.queue;
  if (SCHOOL_FILTER)
    queue = queue.filter((s) =>
      s.university.toLowerCase().includes(SCHOOL_FILTER.toLowerCase()),
    );

  const masterData = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const masterMap = {};
  for (const r of masterData) masterMap[r.university] = r;

  let browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--window-size=1920,1080",
    ],
  });

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  let processed = 0;
  for (const meta of queue) {
    const record = masterMap[meta.university];
    if (!record) continue;

    // Skip verified ones unless forced or missing everything
    if (
      record.isVerified &&
      meta.missing.length <= 1 &&
      meta.missing[0] !== "campUrl"
    ) {
      log(`⏭️ SKIP ${record.university} - verified`);
      continue;
    }

    log(
      `\n[${++processed}/${queue.length}] ${record.university} | Missing: ${meta.missing.join(", ")}`,
    );
    if (SCHOOL_LIMIT && processed > SCHOOL_LIMIT) {
      log(`\n⏹️  LIMIT REACHED (${SCHOOL_LIMIT} schools). Exiting.`);
      break;
    }
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    );

    // Randomize viewport (makes us look like different devices)
    await page.setViewport({
      width: 1920 + Math.floor(Math.random() * 100),
      height: 1080 + Math.floor(Math.random() * 100),
    });

    // Human-like mouse movement before interacting
    const humanMove = async (pg) => {
      const target = {
        x: 300 + Math.random() * 800,
        y: 300 + Math.random() * 600,
      };
      const steps = 30 + Math.floor(Math.random() * 10);
      for (let j = 1; j <= steps; j++) {
        await pg.mouse.move(target.x * (j / steps), target.y * (j / steps), {
          steps: 5,
        });
      }
      await delay(400 + Math.random() * 600);
    };

    try {
      let ex = {
        dates: null,
        cost: null,
        costVal: null,
        email: null,
        url: null,
        campPOC: null,
      };
      let targetUrl = record.campUrl;
      let costVal = record.cost
        ? parseFloat(record.cost.replace(/[^0-9.]/g, ""))
        : 0;
      // Overwrite if < $100 or > $1500 (team camps), or flagged team pricing
      let needsRepull = (costVal > 0 && costVal < 100) || costVal > 1500;

      if (
        !targetUrl ||
        meta.missing.includes("campUrl") ||
        needsRepull ||
        isUrlGeneric(targetUrl) ||
        isAdRedirectUrl(targetUrl)
      ) {
        let mascot = MASCOT_LOOKUP[record.university] || "";
        let q = `${record.university} ${mascot} baseball camp`.trim();
        log(`  🔍 Search: ${q}`);

        let ddgUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}&ia=web`;
        let yahooUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(q)}`;

        let ddg1 = await searchEngine(page, ddgUrl, "DDG");
        let yahoo1 = await searchEngine(page, yahooUrl, "Yahoo");

        targetUrl = ddg1 || yahoo1;

        let cleanDdg = ddg1 ? ddg1.split("?")[0].replace(/\/$/, "") : null;
        let cleanYahoo = yahoo1
          ? yahoo1.split("?")[0].replace(/\/$/, "")
          : null;

        if (cleanDdg && cleanYahoo && cleanDdg === cleanYahoo) {
          log(`  ★ Consensus match: ${targetUrl}`);
        } else if (targetUrl) {
          log(`  ★ Engine #1: ${targetUrl}`);
        }
      }

      if (!targetUrl) {
        log(`  ❌ No URL found.`);
      } else {
        log(`  ↳ Scraping: ${targetUrl}`);
        // domcontentloaded + manual wait avoids endless networkidle timeouts on .edu SPAs
        await page.goto(targetUrl, {
          waitUntil: "domcontentloaded",
          timeout: 45000,
        });
        await page.waitForSelector("body", { timeout: 5000 }).catch(() => {});
        // Wait for dynamic content to render
        await new Promise((r) => setTimeout(r, 3000));
        let text = await page.evaluate(() => document.body?.innerText || "");

        // Initial extraction to see if main page has data
        ex = extractData(text, targetUrl, record.university);

        // Deep sub-crawl (V6: top 8 links matching camp/register/detail/showcase)
        let fullText = text;
        if (!ex.dates && !ex.cost) {
          const subLinks = await page.evaluate((currentUrl) => {
            const keywords =
              /camp|register|detail|showcase|elite|clinics|pricing/i;
            const links = Array.from(document.querySelectorAll("a[href]"));
            return links
              .filter((a) => {
                if (!a.href || !a.href.startsWith("http")) return false;
                if (a.href === currentUrl) return false;
                // Skip social media, video, ticket sites, and PDFs
                const skipBad = [
                  "twitter.com",
                  "x.com",
                  "facebook.com",
                  "instagram.com",
                  "tiktok.com",
                  "youtube.com",
                  "vimeo.com",
                  "ticketmaster.com",
                  "stubhub.com",
                ];
                if (skipBad.some((b) => a.href.includes(b))) return false;
                // PDFs trigger net::ERR_ABORTED (Chrome treats as download)
                if (a.href.toLowerCase().includes(".pdf")) return false;
                const sameOrigin =
                  new URL(currentUrl).hostname === new URL(a.href).hostname;
                if (!sameOrigin) {
                  // Only follow external links if they match camp keywords
                  return keywords.test(a.href);
                }
                return (
                  keywords.test(a.href) || keywords.test(a.textContent || "")
                );
              })
              .map((a) => ({ href: a.href, text: a.textContent || "" }))
              .slice(0, 8);
          }, targetUrl);

          log(`  ↳ Crawling ${subLinks.length} sub-links...`);
          for (const sl of subLinks) {
            try {
              await page.goto(sl.href, {
                waitUntil: "domcontentloaded",
                timeout: 30000,
              });
              await page.evaluate(
                () => new Promise((r) => setTimeout(r, 1500)),
              );
              let subText = await page.evaluate(
                () => document.body?.innerText || "",
              );
              if (subText && subText.toLowerCase().includes("baseball")) {
                // ── Multi-level contamination guards ──
                // Only check external sub-links for contamination
                // Same-origin links are already verified as belonging to this school
                try {
                  const currentHost = new URL(targetUrl).hostname.toLowerCase();
                  const subHost = new URL(sl.href).hostname.toLowerCase();
                  if (currentHost !== subHost) {
                    // External link: full contamination check
                    if (checkSubPageContamination(subText, record.university)) {
                      continue;
                    }
                  }
                } catch (e) {}

                // Always check emails for cross-school contamination
                const emailMatches =
                  subText.match(
                    /[a-zA-Z._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
                  ) || [];
                let emailSkipped = false;
                for (const emailRaw of emailMatches) {
                  const e = emailRaw.toLowerCase();
                  const eLocal = e.split("@")[0];
                  if (eLocal.length < 3) continue;
                  for (const [uni] of Object.entries(MASCOT_LOOKUP)) {
                    if (uni.toLowerCase() === record.university.toLowerCase())
                      continue;
                    const otherNorm = uni.toLowerCase().replace(/[^a-z]/g, "");
                    const emailNoAt =
                      eLocal + (e.split("@")[1] || "").replace(/\./g, "");
                    if (otherNorm.length > 3 && emailNoAt.includes(otherNorm)) {
                      log(
                        `    ⚠️ Sub-page email (${emailRaw}) belongs to "${uni}" - skipping sub-page`,
                      );
                      emailSkipped = true;
                      break;
                    }
                  }
                  if (emailSkipped) break;
                }
                if (emailSkipped) continue;

                fullText += "\n" + subText;
                log(
                  `  ↳ Sub: ${sl.href.substring(0, 60)}... found baseball content`,
                );
              }
            } catch (e) {
              /* ignore sub-page fail */
            }
          }
          await page
            .goto(targetUrl, {
              waitUntil: "domcontentloaded",
              timeout: 20000,
            })
            .catch(() => {});
        }

        ex = extractData(fullText, targetUrl, record.university);

        const firstPrice = record.cost
          ? parseFloat(
              (record.cost.match(/\d[\d,.]*/) || ["0"])[0].replace(/,/g, ""),
            )
          : 0;
        let needsRepull =
          (firstPrice > 0 && firstPrice < 100) || firstPrice > 1500;

        if (
          needsRepull ||
          meta.missing.includes("cost") ||
          !record.cost ||
          record.cost === "TBA"
        ) {
          if (ex.cost) {
            record.cost = ex.cost;
            log(`  ✅ cost: ${ex.cost}`);
          }
        }
        if (
          needsRepull ||
          meta.missing.includes("dates") ||
          !record.dates ||
          record.dates === "TBA"
        ) {
          if (ex.dates) {
            record.dates = ex.dates;
            log(`  ✅ dates: ${ex.dates.substring(0, 50)}`);
          }
        }
        if (meta.missing.includes("email") || !record.email) {
          if (ex.email) {
            record.email = ex.email;
            log(`  ✅ email: ${ex.email}`);
          }
        }

        if (ex.campPOC) {
          record.campPOC = ex.campPOC;
          log(`  ✅ POC: ${ex.campPOC}`);
        }

        // Clear old stale if URL fundamentally changed
        if (ex.url && record.campUrl && record.campUrl !== ex.url) {
          if (!ex.dates && record.dates) record.dates = "TBA";
          if (!ex.cost && record.cost) record.cost = "TBA";
        }
        if (ex.url) record.campUrl = ex.url;
      }

      // Mark processed
      record.isChecked = true;
      record.scriptVersion = 14;
      record.extractionResult =
        ex.dates || ex.cost || ex.email ? "enriched" : "no_data";
      record.lastChecked = new Date().toISOString();

      safeWriteJSON(DATA_FILE, masterData);
    } catch (e) {
      log(`  ❌ Err: ${e.message}`);
    }
    await page.close();
  }
  await browser.close();
  log(`✅ DONE`);
}

run();
