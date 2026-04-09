const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { getMascot } = require("./mascot_lookup");
const { SCHOOL_TIMEOUT_MS } = require("./config"); // Central config — no hardcoding

// Load master data
let data = JSON.parse(fs.readFileSync("verify_target.json", "utf8"));
const allSchoolNames = data.map((d) => d.university);

// SCHOOL_TIMEOUT_MS imported from config.js (single source of truth)
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// ─── Utility: Helpers ──────────────────────────────────────────
function getUniversityAliases(name) {
  let aliases = [name.toLowerCase()];
  let clean = name
    .replace(
      /University of | University| State University|College of | College/g,
      "",
    )
    .trim();
  if (clean !== name) aliases.push(clean.toLowerCase());
  if (name.includes("Louisiana State")) aliases.push("lsu");
  if (name.includes("Mississippi")) aliases.push("ole miss");
  const m = getMascot(name);
  if (m) aliases.push(m.toLowerCase());
  return [...new Set(aliases)];
}

function getCoachSearch(camp) {
  if (!camp.campPOC || camp.campPOC.includes("TBA")) return "";
  let raw = camp.campPOC.split("|")[0].trim();
  if (raw.includes("@") || raw.includes("(") || raw.length < 3) return "";
  return raw;
}

function checkContamination(title, text, targetUni) {
  const titleLower = title.toLowerCase();
  const targetLower = targetUni.toLowerCase();
  for (let other of allSchoolNames) {
    if (other === targetUni) continue;
    if (
      titleLower.includes(other.toLowerCase()) &&
      !targetLower.includes(other.toLowerCase())
    )
      return other;
  }
  return null;
}

function scoreUrl(url, school, isGuessed = false) {
  if (!url) return -100;
  let score = 0;
  let u = url.toLowerCase();
  let s = (school.university || "").toLowerCase();
  let coach = getCoachSearch(school).toLowerCase();
  let mascot = (school.mascot || "").toLowerCase();

  if (u.includes("baseball")) score += 40;
  if (u.includes("camp") || u.includes("clinic")) score += 20;
  if (u.includes("/sports/baseball")) score += 15;
  if (coach && coach.length > 2 && u.includes(coach.split(" ")[0])) score += 35; // Match last name
  if (mascot && u.includes(mascot)) score += 20;
  if (u.includes(s.replace(/\s+/g, ""))) score += 25;

  if (
    u.includes("ryzer.com") ||
    u.includes("totalcamps.com") ||
    u.includes("active.com")
  )
    score += 50;
  if (u.endsWith(".edu")) score += 10;
  if (isGuessed) score -= 40; // Penalty for speculative guessing to prioritize real search results

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
  ];
  if (bad.some((b) => u.includes(b))) score -= 100;

  return score;
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
    if (
      /(?:jun|jul|aug|june|july|august)\w*\s+\d/i.test(line) ||
      /\b0?[6-8]\/\d{1,2}/.test(line)
    ) {
      let block = lines
        .slice(Math.max(0, j - 3), Math.min(lines.length, j + 6))
        .join(" | ");
      let low = block.toLowerCase();

      // Skip past years and reviews
      if (low.includes("2025") || low.includes("2024")) continue;
      if (
        low.includes("review") ||
        low.includes("recommend") ||
        low.includes("amazing") ||
        low.includes("nike")
      )
        continue;
      if (
        low.includes("basketball") ||
        low.includes("soccer") ||
        low.includes("softball")
      )
        continue;

      let nameMatch = block.match(
        /([A-Z0-9][A-Za-z0-9\s\/&]+(?:Camp|Clinic|Prospect|Showcase|Elite|Year-Round|Program))/,
      );
      let dateMatch = block.match(
        /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2})|(?:\b0?[6-8]\/\d{1,2})/gi,
      );
      let costMatch = block.match(/\$\d+/);

      if (dateMatch) {
        campTiers.push({
          name: nameMatch ? nameMatch[1].trim() : "Upcoming Camp",
          dates: dateMatch.slice(0, 3).join(", "),
          cost: costMatch ? costMatch[0] : "TBA",
        });
      }
    }
  }
  return campTiers.filter(
    (v, i, a) =>
      a.findIndex((t) => t.name === v.name && t.dates === v.dates) === i,
  );
}

// ─── MAIN RUNNER ──────────────────────────────────────────────
const run = async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const data = JSON.parse(fs.readFileSync("camps_data.json", "utf8"));
  const toProcess = data.filter(
    (d) => (!d.isChecked || (d.scriptVersion || 0) < 5) && !d.isVerified,
  );

  console.log(
    `Starting V5 Ultra-Fidelity Stabilization. Target: ${toProcess.length} schools.`,
  );

  for (let i = 0; i < toProcess.length; i++) {
    let camp = toProcess[i];
    console.log(
      `\n════════════════════════════════════════════════════════════`,
    );
    console.log(
      `[${i + 1}/${toProcess.length}] Processing: ${camp.university}`,
    );
    console.log(`════════════════════════════════════════════════════════════`);

    const p = await browser.newPage();
    await p.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    );

    try {
      camp.isChecked = true;
      camp.scriptVersion = 5;
      fs.writeFileSync("camps_data.json", JSON.stringify(data, null, 2));

      // 1. DUO-SEARCH (Multi-Engine Collection)
      let searchLinks = [];
      const queries = [`${camp.university} baseball camp 2026`];
      const coach = getCoachSearch(camp);
      if (coach) queries.push(`${coach} baseball camp 2026`);

      console.log(`   -> Search queries: ${queries.join(" | ")}`);
      for (let q of queries) {
        try {
          // 1. DuckDuckGo (Primary - Robust & Simple)
          await p.goto(
            `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
            { waitUntil: "domcontentloaded", timeout: 10000 },
          );
          let ddgLinks = await p.evaluate(() =>
            Array.from(document.querySelectorAll(".result__a")).map(
              (a) => a.href,
            ),
          );
          if (ddgLinks && ddgLinks.length > 3) {
            searchLinks = [...searchLinks, ...ddgLinks];
          } else {
            // 2. Bing (Secondary - Broad)
            console.log(`      ↳ DDG sparse. Trying Bing...`);
            await p.goto(
              `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
              { waitUntil: "domcontentloaded", timeout: 10000 },
            );
            let bingLinks = await p.evaluate(() => {
              const found = Array.from(
                document.querySelectorAll(
                  '#b_results .b_algo h2 a, #b_results .b_algo a[href^="http"]',
                ),
              ).map((a) => a.href);
              return found.filter(
                (l) => l && l.startsWith("http") && !l.includes("bing.com"),
              );
            });
            if (bingLinks && bingLinks.length > 2) {
              searchLinks = [...searchLinks, ...bingLinks];
            } else {
              // 3. Ask.com (Tertiary - Lightweight)
              console.log(`      ↳ Bing sparse. Trying Ask...`);
              await p.goto(
                `https://www.ask.com/web?q=${encodeURIComponent(q)}`,
                { waitUntil: "domcontentloaded", timeout: 10000 },
              );
              let askLinks = await p.evaluate(() =>
                Array.from(
                  document.querySelectorAll(
                    ".PartialSearchResults-item-title-link",
                  ),
                ).map((a) => a.href),
              );
              if (askLinks && askLinks.length > 0) {
                searchLinks = [...searchLinks, ...askLinks];
              } else {
                // 4. Yahoo (Backup)
                console.log(`      ↳ Ask sparse. Trying Yahoo...`);
                await p.goto(
                  `https://search.yahoo.com/search?p=${encodeURIComponent(q)}`,
                  { waitUntil: "domcontentloaded", timeout: 10000 },
                );
                let yahooLinks = await p.evaluate(() =>
                  Array.from(document.querySelectorAll(".title a")).map(
                    (a) => a.href,
                  ),
                );
                if (yahooLinks) searchLinks = [...searchLinks, ...yahooLinks];
              }
            }
          }
        } catch (e) {}
        await delay(1000); // Respect search engines
      }

      // URL Pattern Guessing (Strategic & Penalized)
      let cleanUni = camp.university
        .replace(/The /gi, "")
        .replace(/\s+/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();
      let guessed = [];
      if (cleanUni.length < 25) {
        // Avoid absurdly long invalid domains
        guessed.push(`https://www.${cleanUni}baseballcamps.com`);
        guessed.push(`https://www.${cleanUni}baseballevents.com`);
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
        .filter((x) => x.url && x.url.startsWith("http"))
        .sort((a, b) => b.score - a.score)
        .filter(
          (x, idx, self) => self.findIndex((y) => y.url === x.url) === idx,
        )
        .slice(0, 20); // Deep traversal as requested

      console.log(`   -> Candidate URLs prioritized: ${scored.length}`);
      scored
        .slice(0, 5)
        .forEach((s) =>
          console.log(
            `      ${s.score >= 50 ? "★" : "•"} [${s.score.toString().padStart(3)}] ${s.url}`,
          ),
        );

      let success = false;
      const aliases = getUniversityAliases(camp.university);

      for (let item of scored) {
        let candidate = item.url;
        try {
          console.log(`\n   -> Navigating [${item.score}]: ${candidate}`);
          const resp = await p.goto(candidate, {
            waitUntil: "domcontentloaded",
            timeout: 15000,
          });
          if (!resp || resp.status() >= 400) {
            console.log(`      ✕ Unreachable/Error.`);
            continue;
          }
          await delay(1500);
          let text = await p.evaluate(() => document.body.innerText);
          let title = await p.title();

          if (
            !aliases.some(
              (a) =>
                text.toLowerCase().includes(a) ||
                title.toLowerCase().includes(a) ||
                candidate.includes(a.replace(/\s+/g, "")),
            )
          ) {
            console.log(`      ✕ School name mismatch. Skip.`);
            continue;
          }
          if (checkContamination(title, text, camp.university)) {
            console.log(`      ✕ Contamination check failed. Skip.`);
            continue;
          }

          console.log(`   -> ✅ Page VALIDATED for ${camp.university}`);
          let fullText = text;

          // 2. ANTI-BLOAT SUB-CRAWL
          let subLinks = await p.$$eval("a", (els) =>
            els.map((a) => ({ href: a.href, text: a.innerText.toLowerCase() })),
          );
          const excludePatterns = [
            "/roster",
            "/schedule",
            "/news",
            "/article",
            "/player",
            "/staff",
            "/shop",
            "/ticket",
            "/game",
            "/scores",
          ];

          let filteredSub = subLinks
            .filter((l) => {
              if (!l.href || !l.href.startsWith("http")) return false;
              let hl = l.href.toLowerCase();
              if (
                hl.includes("facebook") ||
                hl.includes("twitter") ||
                hl.includes("google.com")
              )
                return false;
              if (
                excludePatterns.some((e) => hl.includes(e)) &&
                !hl.includes("camp") &&
                !l.text.includes("camp")
              )
                return false;
              return [
                "camp",
                "clinic",
                "prospect",
                "register",
                "tier",
                "detail",
              ].some((k) => hl.includes(k) || l.text.includes(k));
            })
            .slice(0, 8);

          console.log(`   -> Crawling ${filteredSub.length} sub-links...`);
          for (let sl of filteredSub) {
            try {
              const sp = await browser.newPage();
              await sp.goto(sl.href, {
                waitUntil: "domcontentloaded",
                timeout: 10000,
              });
              let st = await sp.evaluate(() => document.body.innerText);
              if (st && st.toLowerCase().includes("baseball")) {
                console.log(`      ⭐ ${sl.href.substring(0, 55)}... [✓]`);
                fullText += "\n" + st;
              }
              await sp.close();
            } catch (e) {}
          }

          // 3. EXTRACTION
          let campTiers = extractDataFromText(fullText);
          if (campTiers.length > 0) {
            console.log(
              `   -> 🎯 SUCCESS — Progress saved. Found ${campTiers.length} tiers.`,
            );
            camp.campTiers = campTiers;
            camp.dates =
              [...new Set(campTiers.map((t) => t.dates))].join(" | ") + " 2026";
            camp.campUrl = candidate;
            camp.confidenceScore = 100;
            success = true;
            break;
          } else {
            console.log(`      ✕ No 2026 date patterns found in text.`);
          }
        } catch (e) {
          console.log(`      ✕ Error: ${e.message}`);
        }
      }

      if (!success)
        console.log(`   -> ❌ No 2026 dates found at any candidate.`);
      fs.writeFileSync("camps_data.json", JSON.stringify(data, null, 2));
    } catch (err) {
      console.log(`   -> ERROR: ${err.message}`);
    } finally {
      await p.close().catch(() => {});
    }
  }
  await browser.close();
};

run();
