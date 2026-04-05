/**
 * NCAA Baseball Camp Extractor — V9 Multi-Point Fidelity
 *
 * UPGRADES vs V8:
 *  1. Source tracking: camp.sourceUrl reflects precisely where data was matched.
 *  2. Dual Contact: camp.pointOfContact (name) and camp.email are distinct.
 *  3. Strict Contamination: "Alabama" vs "Alabama State" handled with word boundaries.
 *  4. Index-based Rotation: Engine rotation (DDG/Bing/Yahoo) is deterministic by DB index.
 *  5. Blacklist: surveygizmo.com officially added.
 *  6. Registration URL Fidelity: Visit Site points to validated sourceUrl.
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
const LOG_FILE = path.join(__dirname, "extraction_v9.log");
const SCHOOL_TIMEOUT_MS = 90000;
const RESTART_EVERY = 10;
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// Clear log
try {
  fs.writeFileSync(
    LOG_FILE,
    `=== V9 Extraction Started ${new Date().toISOString()} ===\n`,
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCoachName(camp) {
  // If we already have a pointOfContact name, use it
  const input = camp.pointOfContact || camp.contact || "";
  if (!input) return "";
  let raw = input.split("|")[0].trim();
  raw = raw.replace(/\(.*?\)/g, "").trim();
  if (raw.toLowerCase().includes("tba")) return "";
  if (raw.includes("@")) return "";
  if (raw.length < 4) return "";
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

    // Strict "State" check: "Alabama" vs "Alabama State"
    const targetIsState = targetLower.includes(" state");
    const otherIsState = oLower.includes(" state");

    if (targetIsState !== otherIsState) {
      // One is State, one is not. If the names are identical otherwise, check strict.
      const targetBase = targetLower
        .replace(/ state| university| college/g, "")
        .trim();
      const otherBase = oLower
        .replace(/ state| university| college/g, "")
        .trim();
      if (targetBase === otherBase) {
        // Highly dangerous pair (Alabama vs Alabama State).
        // If title has "State" and target is NOT State, ERROR.
        // If title lacks "State" and target IS State, ERROR.
        const titleHasState = titleLower.includes(" state");
        if (titleHasState !== targetIsState) return other;
      }
    }

    // Substring check (Arkansas vs Kansas)
    if (targetLower.includes(oLower) || oLower.includes(targetLower)) continue;

    const escaped = oLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(titleLower)) return other;
  }
  return null;
}

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

  // Strict Contamination Penalty: Alabama vs Alabama State in URL
  const targetIsState = s.includes(" state");
  const hasStateInUrl = u.includes("state");
  if (s.includes("alabama")) {
    if (targetIsState && !hasStateInUrl && u.includes("rolltide")) score -= 150;
    if (!targetIsState && hasStateInUrl && u.includes("alasu")) score -= 150;
  }

  if (u.includes("baseball")) score += 40;
  if (u.includes("camp") || u.includes("clinic")) score += 30;
  if (u.includes("/sports/baseball")) score += 15;

  if (coach && coach.split(" ").length >= 2) {
    const lastName = coach.split(" ").pop();
    if (lastName && lastName.length > 3 && u.includes(lastName)) score += 35;
  }
  if (mascot && mascot.length > 3 && u.includes(mascot.replace(/\s+/g, "")))
    score += 20;

  const shortS = s
    .replace(/university|state|college| of /gi, "")
    .trim()
    .replace(/\s+/g, "");
  if (shortS.length > 3 && u.includes(shortS)) score += 15;

  if (
    u.includes("ryzer.com") ||
    u.includes("totalcamps.com") ||
    u.includes("active.com")
  )
    score += 60;
  if (isGuessed) score -= 40;

  const bad = [
    "wikipedia",
    "espn",
    "facebook",
    "twitter",
    "instagram",
    "fandom",
    "warrennolan",
    "surveygizmo.com",
  ];
  if (bad.some((b) => u.includes(b))) score -= 150;

  return score;
}

function extractDataFromText(fullText) {
  const campTiers = [];
  const lines = fullText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 4);

  const SUMMER_MONTH_NAMES = "Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?";
  const SUMMER_NUMERIC =
    "(?:0?[67]|0?8)\\/(?:0[1-9]|[12]\\d|3[01])(?:\\/(?:2026|26))?";
  const DATE_PATTERN = new RegExp(
    `(?:(?:${SUMMER_MONTH_NAMES})\\s+\\d{1,2}|${SUMMER_NUMERIC})`,
    "gi",
  );
  const COST_PATTERN =
    /(?:\$[\d,]+(?:\.\d{2})?(?:\s*[-–\/]\s*\$[\d,]+(?:\.\d{2})?)?(?:\s*\+)?|FREE|Complimentary)/i;

  for (let j = 0; j < lines.length; j++) {
    const line = lines[j];
    if (!DATE_PATTERN.test(line)) {
      DATE_PATTERN.lastIndex = 0;
      continue;
    }
    DATE_PATTERN.lastIndex = 0;

    const block = lines
      .slice(Math.max(0, j - 2), Math.min(lines.length, j + 5))
      .join(" | ");
    const low = block.toLowerCase();

    if (
      low.includes(" vs ") ||
      low.includes("box score") ||
      low.includes("2024")
    )
      continue;
    if (!/camp|clinic|prospect|showcase|baseball/i.test(block)) continue;

    const dateMatches = [
      ...block.matchAll(new RegExp(DATE_PATTERN.source, "gi")),
    ].map((m) => m[0]);
    if (dateMatches.length === 0) continue;

    const costMatch = block.match(COST_PATTERN);
    campTiers.push({
      name: (
        block.match(
          /([A-Z][A-Za-z\s\/&-]+(?:Camp|Clinic|Prospect|Elite))/,
        )?.[1] || "Baseball Camp"
      ).trim(),
      dates: dateMatches.join(", "),
      cost: costMatch ? costMatch[0].trim() : "TBA",
    });
  }

  const seen = new Set();
  return campTiers.filter((t) => {
    const key = t.name.toLowerCase() + "::" + t.dates.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function harvestEmails(text) {
  const matches = text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || [];
  return [
    ...new Set(matches.filter((e) => !/bootstrap|example|domain/i.test(e))),
  ];
}

async function runSearchQueries(page, camp, idx) {
  const engine = PROVIDERS[idx % PROVIDERS.length];
  const mascot = getMascot(camp.university) || "";
  const coach = getCoachName(camp);
  log(`   → [ENGINE] ${engine.name} (idx ${(idx % 3) + 1}/3)`);

  const q = mascot
    ? `${camp.university} ${mascot} baseball camps 2026`
    : `"${camp.university}" baseball camps 2026`;
  const links = [];
  try {
    await page.goto(engine.url(q), {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    const found = await page.evaluate(
      (sel) => Array.from(document.querySelectorAll(sel)).map((a) => a.href),
      engine.selector,
    );
    links.push(
      ...found.filter(
        (h) =>
          h && h.startsWith("http") && !h.includes(engine.name.toLowerCase()),
      ),
    );
  } catch (e) {
    log(`      ✕ [${engine.name}] Error: ${e.message.substring(0, 40)}`);
  }

  // Coach search if needed
  if (links.length < 5 && coach) {
    const q2 = `${coach} baseball camp 2026`;
    try {
      await page.goto(engine.url(q2), {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      const found2 = await page.evaluate(
        (sel) => Array.from(document.querySelectorAll(sel)).map((a) => a.href),
        engine.selector,
      );
      links.push(
        ...found2.filter(
          (h) =>
            h && h.startsWith("http") && !h.includes(engine.name.toLowerCase()),
        ),
      );
    } catch (e) {}
  }
  return [...new Set(links)];
}

// ── MAIN RUNNER ────────────────────────────────────────────────────────────────
const run = async () => {
  const toProcess = data.filter(
    (d) => (!d.isChecked || (d.scriptVersion || 0) < 9) && !d.isVerified,
  );
  log(
    `\n🚀 V9 Multi-Point Engine Starting. Target: ${toProcess.length} schools.`,
  );

  let browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"],
  });

  for (let i = 0; i < toProcess.length; i++) {
    const camp = toProcess[i];
    const masterIdx = data.indexOf(camp);

    if (i > 0 && i % RESTART_EVERY === 0) {
      await browser.close();
      browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox"],
      });
    }

    log(
      `\n[${i + 1}/${toProcess.length}] ${camp.university} (idx: ${masterIdx})`,
    );
    const p = await browser.newPage();
    await p.setViewport({ width: 1920, height: 1080 });
    await p.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    );

    camp.isChecked = true;
    camp.scriptVersion = 9;

    try {
      const searchLinks = await runSearchQueries(p, camp, masterIdx);
      const scored = searchLinks
        .map((u) => ({ url: u, score: scoreUrl(u, camp) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

      const aliases = getUniversityAliases(camp.university);
      let successFound = false;

      for (const item of scored) {
        if (item.score < 0) continue;
        log(`   → Trying: ${item.url.substring(0, 70)} [${item.score}]`);
        try {
          await p.goto(item.url, {
            waitUntil: "domcontentloaded",
            timeout: 15000,
          });
          const text = await p.evaluate(() => document.body.innerText);
          const title = await p.title();

          // Validation
          const matchedAlias = aliases.find(
            (a) =>
              text.toLowerCase().includes(a) || title.toLowerCase().includes(a),
          );
          if (!matchedAlias) continue;
          if (checkContamination(title, camp.university)) continue;

          log(`   → ✅ Validated.`);

          // Gather sub-links
          const subLinks = await p.$$eval("a", (els) =>
            els
              .map((a) => a.href)
              .filter((h) => h.startsWith("http"))
              .slice(0, 6),
          );
          let fullText = text;
          const emails = harvestEmails(text);

          for (const sl of subLinks) {
            try {
              const sp = await browser.newPage();
              await sp.goto(sl, {
                waitUntil: "domcontentloaded",
                timeout: 10000,
              });
              const st = await sp.evaluate(() => document.body.innerText);
              if (st.toLowerCase().includes("baseball")) {
                log(`      ↳ Sub-page captured.`);
                fullText += "\n" + st;
                emails.push(...harvestEmails(st));
              }
              await sp.close();
            } catch (e) {}
          }

          const tiers = extractDataFromText(fullText);
          if (tiers.length > 0) {
            camp.campTiers = tiers;
            camp.dates = [...new Set(tiers.map((t) => t.dates))].join(" | ");
            camp.campUrl = item.url; // Registration Site
            camp.sourceUrl = item.url; // Fidelity Tracking

            // Emails & POC
            const finalEmails = [...new Set(emails)].slice(0, 2);
            if (finalEmails.length > 0) camp.email = finalEmails.join(", ");
            const nameOnly = getCoachName(camp);
            if (nameOnly) camp.pointOfContact = nameOnly;

            log(`   → 🎯 SUCCESS! Found ${tiers.length} camps.`);
            successFound = true;
            break;
          }
        } catch (e) {}
      }

      if (!successFound) log(`   → ❌ No summer data.`);
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
      log(`   → ERROR: ${e.message}`);
    }
    await p.close();
  }

  await browser.close();
  log(`🏁 Done.`);
};

run();
