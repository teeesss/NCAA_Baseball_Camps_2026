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
  scoreUrl: centralizedScoreUrl,
  isSearchEngineUrl,
} = require("./url_validator");
const { PRICE_THRESHOLDS, SCHOOL_TIMEOUT_MS } = require("./config");

// ── URL Quality Gate: unwrap + validate candidate URLs ──
// Called before storing any campUrl to guarantee quality
function unwrapCandidate(candidate, schoolName) {
  // Step 1: Unwrap DDG/Yahoo/Bing search proxy redirects
  let url = unwrapUrl(candidate);

  // Step 2: Reject search engine URLs themselves
  if (isSearchEngineUrl(url)) {
    return { passed: false, reason: "search_engine_redirect", url: null };
  }

  // Step 3: Reject blacklisted domains (centralized)
  if (isBlacklistedUrl(url)) {
    return { passed: false, reason: "blacklisted_domain", url: null };
  }

  // Step 4: Reject generic .edu root pages
  if (isGenericPage(url)) {
    return { passed: false, reason: "generic_page", url: null };
  }

  // Step 5: Require camp-relevant path
  if (!isCampRelatedUrl(url)) {
    return { passed: false, reason: "not_camp_related", url: null };
  }

  return { passed: true, url };
}

// Load master data
let data = JSON.parse(fs.readFileSync("camps_data.json", "utf8"));
const allSchoolNames = data.map((d) => d.university);

// SCHOOL_TIMEOUT_MS imported from config.js (single source of truth)
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const LOG_FILE = path.join(__dirname, "extraction_all.log");
function log(msg) {
  const timestamp = new Date().toLocaleTimeString();
  const formatted = `[${timestamp}] ${msg}`;
  console.log(formatted);
  try {
    fs.appendFileSync(LOG_FILE, formatted + "\n", "utf8");
  } catch (e) {}
}

// ─── Utility: Helpers ──────────────────────────────────────────
function getCoachSearch(camp) {
  if (!camp.campPOC || camp.campPOC.includes("TBA")) return "";
  let raw = camp.campPOC
    .split("|")[0]
    .replace(/\(.*?\)/g, "")
    .trim();
  if (raw.includes("@") || raw.length < 3) return "";
  return raw;
}

function checkContamination(title, text, targetUni) {
  const titleLower = title.toLowerCase();
  const targetLower = targetUni.toLowerCase();
  for (let other of allSchoolNames) {
    if (other === targetUni) continue;
    const otherLower = other.toLowerCase();
    let escapedOther = otherLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let regex = new RegExp(`\\b${escapedOther}\\b`, "i");

    // If the other school is in the title, and the target school isn't... contamination!
    if (regex.test(titleLower)) {
      if (
        !targetLower.includes(otherLower) &&
        !titleLower.includes(targetLower)
      )
        return other;
    }
  }
  return null;
}

function scoreUrl(url, school, isGuessed = false) {
  return centralizedScoreUrl(url, school, getMascot, getCoachSearch);
}

// ─── EXTRACTION LOGIC (Strictly 2026) ─────────────────────────
function extractDataFromText(fullText) {
  let campTiers = [];
  let lines = fullText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 5);
  for (let j = 0; j < lines.length; j++) {
    let line = lines[j];
    // Capture any 2026 dates across all months
    if (
      /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}/i.test(
        line,
      ) ||
      /\b(0?[1-9]|1[0-2])\/\d{1,2}/.test(line)
    ) {
      let block = lines
        .slice(Math.max(0, j - 3), Math.min(lines.length, j + 6))
        .join(" | ");
      let low = block.toLowerCase();

      // --- STRICT FILTERS ---
      // 1. Skip schedule-like lines
      if (
        low.includes(" vs ") ||
        low.includes(" vs. ") ||
        low.includes(" @ ") ||
        low.includes(" vs ") ||
        /\d{1,2}:\d{2}\s*(?:am|pm)/i.test(block)
      )
        continue;

      // 2. Only capture 2026 or near-future dates. Skip old years.
      if (low.includes("2025") || low.includes("2024")) continue;

      // 3. Skip unrelated sports
      if (
        low.includes("basketball") ||
        low.includes("soccer") ||
        low.includes("softball") ||
        low.includes("volleyball")
      )
        continue;

      // 4. Require explicit camp terminology in the immediate block
      const campKeywords = [
        "camp",
        "clinic",
        "prospect",
        "showcase",
        "elite",
        "program",
        "instruction",
        "lesson",
      ];
      if (!campKeywords.some((k) => low.includes(k))) continue;

      let nameMatch = block.match(
        /([A-Z0-9][A-Za-z0-9\s\/&]+(?:Camp|Clinic|Prospect|Showcase|Elite|Year-Round|Program))/,
      );
      let dateMatch = block.match(
        /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}(?:\w{2})?)|(?:\b(0?[1-9]|1[0-2])\/\d{1,2})/gi,
      );
      // Extract the FULL dollar amount (e.g. $295.00 not just $295, $1,350 not just $1)
      let costMatch = block.match(/\$[\d,]+(?:\.\d{2})?/);

      if (dateMatch && nameMatch) {
        if (costMatch) {
          // Validate the extracted price — anything under $5 is almost certainly
          // a deposit placeholder, early-bird teaser, or parsing artifact
          // (e.g. "$1" from ryzer.com pages that show "$100" but regex grabs the first digit)
          const rawCost = costMatch[0];
          const numeric = parseFloat(rawCost.replace(/[\$,]/g, ""));
          if (isNaN(numeric) || numeric < PRICE_THRESHOLDS.CRITICAL_ANOMALY) {
            log(
              `       ⚠️ [Price] Rejected suspicious price "${rawCost}" (value: ${numeric}). Setting to TBA.`,
            );
            campTiers.push({
              name: nameMatch[1].trim(),
              dates: dateMatch.slice(0, 3).join(", "),
              cost: "TBA",
            });
          } else {
            campTiers.push({
              name: nameMatch[1].trim(),
              dates: dateMatch.slice(0, 3).join(", "),
              cost: rawCost,
            });
          }
        } else {
          campTiers.push({
            name: nameMatch[1].trim(),
            dates: dateMatch.slice(0, 3).join(", "),
            cost: "TBA",
          });
        }
      }
    }
  }
  const filtered = campTiers.filter(
    (v, i, a) =>
      a.findIndex((t) => t.name === v.name && t.dates === v.dates) === i,
  );
  if (filtered.length > 0) {
    log(
      `       📋 [Tiers] Found ${filtered.length} entries. Preview: ${filtered
        .slice(0, 2)
        .map((t) => t.name)
        .join(" | ")}...`,
    );
  } else {
    log(`       📋 [Tiers] No verified camp sessions found on this page.`);
  }
  return filtered;
}

// ─── MAIN RUNNER ──────────────────────────────────────────────
const run = async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--window-size=1920,1080",
      "--disable-blink-features=AutomationControlled",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  // Bump to Script Version 6 for final fidelity push
  const toProcess = data.filter(
    (d) => (!d.isChecked || (d.scriptVersion || 0) < 6) && !d.isVerified,
  );

  log(
    `Starting V6 Ultra-Fidelity Stabilization. Target: ${toProcess.length} schools.`,
  );

  for (let i = 0; i < toProcess.length; i++) {
    let camp = toProcess[i];
    log(`\n════════════════════════════════════════════════════════════`);
    log(`[${i + 1}/${toProcess.length}] Processing: ${camp.university}`);
    log(`════════════════════════════════════════════════════════════`);

    const p = await browser.newPage();

    // --- STEALTH PATCHES (MAKE US LOOK HUMAN) ---
    await p.setViewport({
      width: 1920 + Math.floor(Math.random() * 100),
      height: 1080 + Math.floor(Math.random() * 100),
    });
    await p.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    );

    // --- STEALTH EVOLUTION ---
    await p.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      Object.defineProperty(navigator, "deviceMemory", { get: () => 8 });
      Object.defineProperty(navigator, "hardwareConcurrency", {
        get: () => 16,
      });
    });

    const humanMove = async (page) => {
      const target = {
        x: 300 + Math.random() * 800,
        y: 300 + Math.random() * 600,
      };
      const steps = 30 + Math.floor(Math.random() * 10);
      for (let j = 1; j <= steps; j++) {
        await page.mouse.move(target.x * (j / steps), target.y * (j / steps));
      }
      await delay(400 + Math.random() * 600);
    };

    try {
      camp.isChecked = true;
      camp.scriptVersion = 6;
      fs.writeFileSync("camps_data.json", JSON.stringify(data, null, 2));

      // 1. IMPROVED SEARCH QUERIES
      let searchLinks = [];
      let queries = [buildSearchQuery(camp)];
      const coach = getCoachSearch(camp);
      if (coach) queries.push(`${coach} baseball camp 2026`);

      // Add a "clean" name query for better results
      let cleanQuery = camp.university
        .replace(/university|state|college/gi, "")
        .trim();
      if (cleanQuery !== camp.university && cleanQuery.length > 3) {
        queries.push(`${cleanQuery} baseball camp 2026`);
      }

      log(`   -> Search queries: ${queries.join(" | ")}`);

      const providers = [
        {
          name: "Bing",
          search: async (q) => {
            await p.goto(
              `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
              { waitUntil: "domcontentloaded", timeout: 30000 },
            );
            return await p.evaluate(() =>
              Array.from(
                document.querySelectorAll("#b_results .b_algo h2 a, h2 a"),
              ).map((a) => a.href),
            );
          },
        },
        {
          name: "Yahoo",
          search: async (q) => {
            await p.goto(
              `https://search.yahoo.com/search?p=${encodeURIComponent(q)}`,
              { waitUntil: "domcontentloaded", timeout: 30000 },
            );
            return await p.evaluate(() =>
              Array.from(
                document.querySelectorAll(
                  ".title a, .compTitle a, #web h3 a, .algo a",
                ),
              ).map((a) => a.href),
            );
          },
        },
      ];

      for (let provider of providers) {
        let providerResults = 0;
        for (let q of queries) {
          if (providerResults >= 8) break;
          try {
            log(`      ↳ [${provider.name}] searching: ${q}`);
            let links = await provider.search(q);
            if (links && links.length > 0) {
              searchLinks.push(...links);
              providerResults += links.length;
            }
          } catch (e) {
            log(`      ✕ [${provider.name}] error: ${e.message}`);
          }
          await delay(1500);
        }
      }

      // Clean links
      searchLinks = [...new Set(searchLinks)].filter(
        (l) => l && l.startsWith("http"),
      );

      // 2. SMARTER URL GUESSING
      let guessed = [];
      let cleanUni = camp.university
        .replace(/The /gi, "")
        .replace(/\s+/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();
      if (cleanUni.length < 30) {
        guessed.push(`https://www.${cleanUni}baseballcamps.com`);
        guessed.push(`https://www.${cleanUni}baseballevents.com`);
      }
      // Short name guessing (e.g. Truman State University -> trumanbaseballcamps.com)
      let shortName = camp.university
        .replace(/University|State|College| of/gi, "")
        .trim()
        .replace(/\s+/g, "")
        .toLowerCase();
      if (shortName.length > 2 && shortName !== cleanUni) {
        guessed.push(`https://www.${shortName}baseballcamps.com`);
      }

      let scored = [
        ...searchLinks.map((u) => ({
          url: u,
          score: scoreUrl(u, camp, false),
          isGuessed: false,
        })),
        ...guessed.map((u) => ({
          url: u,
          score: scoreUrl(u, camp, true),
          isGuessed: true,
        })),
      ]
        .sort((a, b) => b.score - a.score)
        .filter(
          (x, idx, self) => self.findIndex((y) => y.url === x.url) === idx,
        )
        .slice(0, 15);

      log(`   -> Candidate URLs prioritized: ${scored.length}`);
      scored
        .slice(0, 3)
        .forEach((s) =>
          log(
            `      ${s.score >= 50 ? "★" : "•"} [${s.score.toString().padStart(3)}] ${s.url}`,
          ),
        );

      let success = false;
      const aliases = getUniversityAliases(camp.university);

      for (let item of scored) {
        let candidate = item.url;
        try {
          log(`\n   -> Navigating [${item.score}]: ${candidate}`);
          const resp = await p.goto(candidate, {
            waitUntil: "domcontentloaded",
            timeout: 15000,
          });
          if (!resp || resp.status() >= 400) continue;

          await humanMove(p);
          let text = await p.evaluate(() => document.body.innerText);
          let title = (await p.title()) || "";

          // VALIDATION: Does the page actually mention THIS school?
          if (
            !aliases.some(
              (a) =>
                text.toLowerCase().includes(a) ||
                title.toLowerCase().includes(a) ||
                candidate.toLowerCase().includes(a.replace(/\s+/g, "")),
            )
          ) {
            log(`      ✕ School name mismatch.`);
            continue;
          }

          // CONTAMINATION: Is this an opponent's schedule page?
          const culprit = checkContamination(title, text, camp.university);
          if (culprit) {
            log(`      ✕ Contamination suspected (${culprit}). Skip.`);
            continue;
          }

          log(`   -> ✅ Page VALIDATED for ${camp.university}`);
          let fullText = text;

          // SUB-CRAWL
          let subLinks = await p.$$eval("a", (els) =>
            els.map((a) => ({
              href: a.href,
              text: (a.innerText || "").toLowerCase(),
            })),
          );
          let filteredSub = subLinks
            .filter((l) => {
              if (!l.href || !l.href.startsWith("http")) return false;
              // Skip blacklisted domains (centralized check)
              if (isBlacklistedUrl(l.href)) return false;
              // Skip search engine redirects
              if (isSearchEngineUrl(l.href)) return false;
              // Only crawl internal or camp-specific external links
              if (
                l.href.includes("camp") ||
                l.href.includes("register") ||
                l.href.includes("detail") ||
                l.href.includes("prospect") ||
                l.href.includes("clinic")
              )
                return true;
              // Same-origin internal links are safe
              try {
                const mainHost = new URL(candidate).hostname;
                const subHost = new URL(l.href).hostname;
                if (mainHost === subHost) return true;
              } catch (e) {}
              return false;
            })
            .slice(0, 8);

          log(`   -> Crawling ${filteredSub.length} sub-links...`);
          for (let sl of filteredSub) {
            try {
              const sp = await browser.newPage();
              await sp.goto(sl.href, {
                waitUntil: "domcontentloaded",
                timeout: 10000,
              });
              let st = await sp.evaluate(() => document.body.innerText);
              if (st && st.toLowerCase().includes("baseball"))
                fullText += "\n" + st;
              await sp.close();
            } catch (e) {}
          }

          // EXTRACTION
          let campTiers = extractDataFromText(fullText);
          if (campTiers.length > 0) {
            log(`   -> 🎯 SUCCESS — Found ${campTiers.length} tiers.`);
            camp.campTiers = campTiers;
            camp.dates =
              [...new Set(campTiers.map((t) => t.dates))].join(" | ") + " 2026";
            // URL quality gate: validate, unwrap, and ensure camp-relevant
            const validated = unwrapCandidate(candidate, camp.university);
            camp.campUrl = validated.url;
            if (!validated.passed) {
              log(
                `      ⚠️ URL failed quality gate: ${validated.reason}. Using validated fallback.`,
              );
            }
            camp.isVerified = false; // Mark for final check
            success = true;
            break;
          }
        } catch (e) {}
      }

      if (!success) log(`   -> ❌ No 2026 dates found.`);
      fs.writeFileSync("camps_data.json", JSON.stringify(data, null, 2));
    } catch (err) {
      log(`   -> ERROR: ${err.message}`);
    } finally {
      await p.close().catch(() => {});
    }
  }
  await browser.close();
};

run();
