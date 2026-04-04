/**
 * DEEP URL AUDIT & SMART EXTRACTION ENGINE
 * ═══════════════════════════════════════════════════════════════
 * Validates every DI school's campUrl by opening it in a stealth
 * browser, checking for school identity, and extracting camp data.
 *
 * Usage:
 *   node deep_url_audit.js                    -- all DI schools
 *   node deep_url_audit.js --batch=1          -- schools 1-50
 *   node deep_url_audit.js --batch=2          -- schools 51-100
 *   node deep_url_audit.js --school="Kansas"  -- single school
 *   node deep_url_audit.js --limit=10         -- first 10
 *   node deep_url_audit.js --force            -- re-audit already audited schools
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// Stealth Puppeteer
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const { getMascot, getUniversityAliases, MASCOT_LOOKUP } = require('./src/utils/mascot_lookup.js');
const { isContaminated, isStrictBoundaryMatch } = require('./src/utils/contamination_check.js');

// ── Files ────────────────────────────────────────────────────
const DATA_FILE      = path.join(__dirname, 'camps_data.json');
const {
    BLACKLISTED_DOMAINS,
    OFFICIAL_PLATFORMS,
    DATE_PATTERNS,
    COST_PATTERN,
    EMAIL_PATTERN
} = require('./src/utils/config');

// ── CLI Args ─────────────────────────────────────────────────
const args = process.argv.slice(2);
const argMap = {};
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    let [key, value] = arg.replace(/^--/, '').split('=');
    if (value === undefined && i + 1 < args.length && !args[i+1].startsWith('--')) {
      value = args[++i];
    }
    const finalValue = value === undefined ? true : (value === 'false' ? false : (value === 'true' ? true : value));
    
    if (argMap[key]) {
      if (!Array.isArray(argMap[key])) argMap[key] = [argMap[key]];
      argMap[key].push(finalValue);
    } else {
      argMap[key] = finalValue;
    }
  }
}
const BATCH_NUM    = argMap.batch  ? parseInt(argMap.batch)  : null;
const BATCH_SIZE   = 50;
const SCHOOL_FILTER = argMap.school || null;
const LIMIT        = argMap.limit  ? parseInt(argMap.limit)  : Infinity;
const MAX_PROCESSED_THIS_RUN = 15; // User requested 15 schools limit per restart
const FORCE_REAUDIT = !!argMap.force;
const FAST_MODE = !!argMap.fast; // Skip Phase 0 (search consensus) if a URL exists
const RESTART_EXIT_CODE = 88; // Custom code to signal a batch-limit restart

// ── Logging ──────────────────────────────────────────────────
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logStream.write(line + '\n');
}

// OFFICIAL_PLATFORMS removed - using central config.js


const SEARCH_ENGINES = [
  {
    name: 'DuckDuckGo',
    url: (q) => `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}&ia=web`,
    selector: '.result__a',
    hrefAttr: 'href'
  },
  {
    name: 'Yahoo',
    url: (q) => `https://search.yahoo.com/search?p=${encodeURIComponent(q)}`,
    selector: 'h3.title a, div.algo h3 a, .compTitle a',
    hrefAttr: 'href'
  },
  {
    name: 'Brave',
    url: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}`,
    selector: '.snippet a[href]',
    hrefAttr: 'href'
  }
];

// Google has been completely removed due to aggressive CAPTCHA blocking.

// Regex constants and subdomain lists removed - imported from config.js

// ── Stealth Browser Config ───────────────────────────────────
const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--window-size=1920,1080',
  '--lang=en-US,en',
  '--disable-web-security',
  '--ignore-certificate-errors',
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ── Human-like delays ────────────────────────────────────────
function humanDelay(min = 800, max = 2500) {
  return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}

async function humanScroll(page) {
  await page.evaluate(() => {
    window.scrollBy(0, 200 + Math.random() * 400);
  });
  await humanDelay(300, 800);
}

async function humanMouseMove(page) {
  const x = 200 + Math.floor(Math.random() * 800);
  const y = 200 + Math.floor(Math.random() * 400);
  await page.mouse.move(x, y, { steps: 5 + Math.floor(Math.random() * 10) });
}

// ── URL Utilities ────────────────────────────────────────────
function isBlacklisted(url) {
  if (!url) return true;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.endsWith('.gov')) return true;
    if (SUBDOMAIN_BLACKLIST.some(s => hostname.startsWith(s))) return true;
    return BLACKLISTED_DOMAINS.some(d => hostname.includes(d));
  } catch { return false; }
}

function isOfficialPlatform(url) {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const hasBaseballKeyword = hostname.includes('baseball') && (hostname.includes('camp') || hostname.includes('clinic'));
    return OFFICIAL_PLATFORMS.some(p => hostname.includes(p)) || hostname.endsWith('.edu') || hasBaseballKeyword;
  } catch { return false; }
}

/**
 * Clean redirect-wrapped URLs from Yahoo/Bing results.
 */
function cleanSearchUrl(raw) {
  if (!raw) return null;
  // Yahoo redirect
  if (raw.includes('r.search.yahoo.com') || raw.includes('/RU=')) {
    const match = raw.match(/\/RU=([^/]+)\//);
    if (match) return decodeURIComponent(match[1]);
  }
  // Bing redirect
  if (raw.includes('bing.com/ck/a')) {
    const match = raw.match(/u=a1(.+?)&/);
    if (match) {
      try { return Buffer.from(match[1], 'base64').toString('utf8'); } catch {}
    }
  }
  // DuckDuckGo uddg param
  if (raw.includes('duckduckgo.com') && raw.includes('uddg=')) {
    const match = raw.match(/uddg=([^&]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return raw;
}

// ══════════════════════════════════════════════════════════════
//  CORE: PAGE VALIDATION
// ══════════════════════════════════════════════════════════════
/**
 * Validates whether a page belongs to the target school.
 * Returns { valid: true/false, confidence: 0-100, reason: string, pageText: string }
 */
async function validatePage(page, url, school, allUniversities, options = {}) {
  try {
    const schoolName = school.university;
    const mascot = (getMascot(schoolName) || '').toLowerCase();
    const aliases = getUniversityAliases(schoolName);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await humanDelay(1500, 3000);
    await humanScroll(page);

    const pageText = await page.evaluate(() => document.body?.innerText || '');
    const pageTitle = await page.evaluate(() => document.title || '');
    const combined = (pageText + ' ' + pageTitle).toLowerCase();

    let confidence = 0;
    const reasons = [];

    // 1. Check school name in page (Strict boundary match)
    if (isStrictBoundaryMatch(combined, schoolName)) {
      confidence += 30;
      reasons.push(`School name "${schoolName}" found`);
    }

    // 2. Check mascot (only if not a shared mascot that could cause contamination)
    if (mascot && combined.includes(mascot)) {
      confidence += 25;
      reasons.push(`Mascot "${mascot}" found`);
    }

    // 3. Check aliases
    for (const alias of aliases) {
      if (alias.length >= 4 && combined.includes(alias.toLowerCase())) {
        confidence += 15;
        reasons.push(`Alias "${alias}" found`);
        break; // one alias is enough for bonus
      }
    }

    // 4. Baseball keyword check
    const baseballWords = ['baseball', 'camp', 'clinic', 'prospect', 'diamond'];
    const hasBaseball = baseballWords.some(w => combined.includes(w));
    if (hasBaseball) {
      confidence += 15;
      reasons.push('Baseball/camp keywords found');
    }

    // 5. Official platform bonus
    if (isOfficialPlatform(url)) {
      confidence += 10;
      reasons.push('Official platform (.edu or known camp host)');
    }

    // 5b. Consensus bonus
    if (options.isConsensus) {
      confidence += 40;
      reasons.push(`🎯 SEARCH CONSENSUS: Multiple engines identified this site`);
    }

    // 6. Contamination check
    const contaminated = isContaminated(combined, schoolName, allUniversities, MASCOT_LOOKUP);
    if (contaminated) {
      confidence -= 60;
      reasons.push('⚠️ CONTAMINATION: name/mascot overlap with another school');
    }

    // 6.b Global Mascot Hostname Contamination
    for (const [uni, m] of Object.entries(MASCOT_LOOKUP)) {
        if (uni === schoolName) continue;
        if (!m || m.length < 5) continue; // Skip generic mascots like "Tigers"
        
        const rivalM = m.toLowerCase();
        // Skip shared mascots (e.g. "Knights" for UCF & Bellarmine)
        if (mascot && rivalM === mascot) continue;

        if (url.toLowerCase().includes(rivalM) && !combined.includes(mascot)) {
            confidence -= 80;
            reasons.push(`⚠️ CROSS-SCHOOL: URL contains mascot "${rivalM}" of ${uni}`);
            break; 
        }
    }

    // 6.c Missing Target Mascot Penalty
    if (mascot && !combined.includes(mascot) && !url.toLowerCase().includes(mascot)) {
        if (!isOfficialPlatform(url)) {
            confidence -= 30;
            reasons.push(`⚠️ IDENTITY: Mascot "${mascot}" missing from page text and URL`);
        } else {
            reasons.push(`ℹ️ Mascot "${mascot}" missing from text, but site is official athletics portal`);
        }
    }

    // 7. Blacklist check on final URL
    const finalUrl = page.url();
    if (isBlacklisted(finalUrl)) {
      confidence -= 80;
      reasons.push(`❌ BLACKLISTED domain in final URL: ${finalUrl}`);
    }

    return {
      valid: confidence >= 30,
      confidence,
      reason: reasons.join('; '),
      pageText,
      finalUrl
    };
  } catch (err) {
    return {
      valid: false,
      confidence: 0,
      reason: `Page load error: ${err.message.substring(0, 80)}`,
      pageText: '',
      finalUrl: url
    };
  }
}

// ══════════════════════════════════════════════════════════════
//  CORE: EXTRACT CAMP DATA FROM PAGE
// ══════════════════════════════════════════════════════════════
function extractDataFromText(text) {
  const result = {};
  // Skip extraction if it is a Team Camp or legacy 2025 content
  const lowerText = text.toLowerCase();
  const isTeamCamp = lowerText.includes('team camp') && !lowerText.includes('individual');
  const isLegacy2025 = lowerText.includes('2025') && !lowerText.includes('2026');
  
  if (isTeamCamp || isLegacy2025) {
    return result;
  }

  // Dates
  const allDates = [];
  for (const p of DATE_PATTERNS) {
    p.lastIndex = 0;
    let m;
    while ((m = p.exec(text)) !== null) allDates.push(m[0].trim());
  }
  const uniqueDates = [...new Set(allDates)];
  if (uniqueDates.length > 0 && uniqueDates.length <= 12) {
    result.dates = uniqueDates.join(' | ');
  }

  // Cost
  const costs = [];
  COST_PATTERN.lastIndex = 0;
  let m;
  while ((m = COST_PATTERN.exec(text)) !== null) {
    const val = parseInt(m[1].replace(/,/g, ''), 10);
    if (val >= 100 && val <= 1500) costs.push({ raw: '$' + m[1], value: val });
  }
  if (costs.length > 0) {
    result.costs = costs.map(c => c.raw);
    result.primaryCost = costs[0].raw;
  }

  // Email
  EMAIL_PATTERN.lastIndex = 0;
  const emails = [];
  while ((m = EMAIL_PATTERN.exec(text)) !== null) emails.push(m[0].toLowerCase());
  const cleanEmails = emails.filter(e =>
    !BLACKLISTED_DOMAINS.some(b => e.includes(b)) &&
    !e.includes('sentry') && !e.includes('example') && !e.includes('noreply') &&
    !e.includes('wordpress') && !e.includes('privacy')
  );
  if (cleanEmails.length > 0) {
    result.email = cleanEmails.find(e => e.endsWith('.edu')) || cleanEmails[0];
  }

  // POC / Contact names (Basic heuristics)
  const pocMatch = text.match(/(?:contact|coach|director|questions)\b[:\s-]*([A-Z][a-z]+ [A-Z][a-z]+)/);
  if (pocMatch) {
      result.campPOC = pocMatch[1];
  }

  return result;
}

/**
 * Deep extraction: crawl sub-links for additional camp data.
 */
async function deepExtract(page, landingUrl, school, allUniversities) {
  const result = {
    dates: null,
    cost: null,
    email: null,
    campPOC: null,
    campTiers: [],
    address: null,
    subLinks: []
  };

  try {
    // Extract from landing page first
    const landingText = await page.evaluate(() => document.body?.innerText || '');
    const landingData = extractDataFromText(landingText);
    Object.assign(result, landingData);

    // Find sub-links to crawl
    const subLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({ href: (typeof a.href === 'string' ? a.href : ''), text: (a.textContent || '').trim().toLowerCase() }))
        .filter(l => l.href.startsWith('http'))
        .filter(l => {
          const combined = (l.href + ' ' + l.text).toLowerCase();
          return ['baseball', 'camp', 'clinic', 'register', 'prospect', 'signup',
                  'sign-up', 'detail', 'schedule', 'event'].some(k => combined.includes(k));
        })
        .slice(0, 6);
    });

    // Deduplicate and filter
    const visited = new Set([landingUrl, page.url()]);
    const goodSubLinks = subLinks
      .map(l => ({ ...l, href: cleanSearchUrl(l.href) || l.href }))
      .filter(l => !visited.has(l.href) && !isBlacklisted(l.href))
      .slice(0, 3);

    for (const link of goodSubLinks) {
      try {
        log(`      ↳ Sub-crawl: ${link.href.substring(0, 80)}`);
        // Capture mailto links specifically
        const mailtos = await page.evaluate(() => 
            Array.from(document.querySelectorAll('a[href^="mailto:"]'))
                .map(a => a.href.replace('mailto:', '').split('?')[0].toLowerCase())
        );
        
        await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await humanDelay(1000, 2000);

        const subText = await page.evaluate(() => document.body?.innerText || '');
        const subData = extractDataFromText(subText);
        
        // Add mailtos found on this sub-page
        if (mailtos.length > 0 && !subData.email) {
            subData.email = mailtos[0];
        }

        // Merge: only fill gaps, never overwrite
        if (!result.dates && subData.dates) result.dates = subData.dates;
        if (!result.primaryCost && subData.primaryCost) {
          result.cost = subData.primaryCost;
          result.costs = subData.costs;
        }
        if (!result.email && subData.email) result.email = subData.email;

        result.subLinks.push(link.href);
        visited.add(link.href);
      } catch (err) {
        log(`      ✕ Sub-crawl error: ${err.message.substring(0, 40)}`);
      }
    }

    // Set cost from primary if not already set
    if (!result.cost && result.primaryCost) {
      result.cost = result.primaryCost;
    }

  } catch (err) {
    log(`    ❌ Deep extract error: ${err.message.substring(0, 60)}`);
  }

  return result;
}

// ══════════════════════════════════════════════════════════════
//  CORE: MULTI-ENGINE CONSENSUS SEARCH
// ══════════════════════════════════════════════════════════════
async function consensusSearch(page, school, allUniversities, excludeUrl = null, isDeepMode = false) {
  const mascot = getMascot(school.university) || '';
  const baseQuery = mascot ? `${school.university} ${mascot}` : school.university;
  
  let searchTerm = `${baseQuery} baseball camp`;
  if (isDeepMode) {
      searchTerm = `${baseQuery} baseball camp 2026 registration official`;
      log(`  🚀 DEEP SEARCH MODE: "${searchTerm}"`);
  } else {
      log(`  🔍 Consensus search: "${searchTerm}"${excludeUrl ? ' (Excluding previous)' : ''}`);
  }

  const engineResults = {}; // { engineName: [urls] }
  const engines = [...SEARCH_ENGINES];

  for (const engine of engines) {
    try {
      log(`    → ${engine.name}...`);
      await page.goto(engine.url(searchTerm), { waitUntil: 'domcontentloaded', timeout: 20000 });
      await humanDelay(1500, 3000);
      await humanMouseMove(page);

      const results = await page.evaluate((sel) => {
        return Array.from(document.querySelectorAll(sel))
          .map(a => a.href)
          .filter(h => h && h.startsWith('http'))
          .slice(0, 5);
      }, engine.selector);

      // Clean URLs (Yahoo/Bing wrap in redirects)
      const cleaned = results
        .map(u => cleanSearchUrl(u))
        .filter(u => u && !isBlacklisted(u) && (!excludeUrl || !u.includes(new URL(excludeUrl).hostname)));

      engineResults[engine.name] = cleaned;
      log(`    ✓ ${engine.name}: ${cleaned.length} results${cleaned[0] ? ' → ' + cleaned[0].substring(0, 60) : ''}`);

    } catch (err) {
      log(`    ✕ ${engine.name} error: ${err.message.substring(0, 40)}`);
      engineResults[engine.name] = [];
    }
  }

  // Consensus: find URL domains that appear across multiple engines
  const engineHits = {}; // domain -> Set of engines
  const urlByDomain = {};
  const depth = isDeepMode ? 10 : 3;

  for (const [engineName, urls] of Object.entries(engineResults)) {
    for (const url of urls.slice(0, depth)) { 
      try {
        const domain = new URL(url).hostname.replace('www.', '');
        if (!engineHits[domain]) engineHits[domain] = new Set();
        engineHits[domain].add(engineName);
        if (!urlByDomain[domain]) urlByDomain[domain] = url; // keep first seen
      } catch {}
    }
  }

  // Sort by calculated score instead of just consensus count
  // Sort by calculated score: Engine Agreement is primary (multiplied by 100)
  function getUrlScore(domain, url) {
    let score = engineHits[domain].size * 100; // Primary: Engine Agreement
    const lowerUrl = url.toLowerCase();
    
    // Tie-breakers
    // Bonus for dedicated baseball camp domains
    if (domain.includes('baseball') && (domain.includes('camp') || domain.includes('clinic'))) {
      score += 25; // Tie-breaker bonus for exact baseball camp domains
    }
    
    // Penalty for generic/irrelevant edu paths without baseball markers
    if (domain.endsWith('.edu') && !lowerUrl.includes('baseball') && !lowerUrl.includes('athletics') && !lowerUrl.includes('sports')) {
      score -= 100; // Heavy penalty for generic .edu homepages
    }
    
    // Official platform bonus
    if (isOfficialPlatform(url)) {
      score += 10;
    }
    
    return score;
  }

  const ranked = Object.entries(engineHits)
    .sort((a, b) => {
      const scoreA = getUrlScore(a[0], urlByDomain[a[0]]);
      const scoreB = getUrlScore(b[0], urlByDomain[b[0]]);
      return scoreB - scoreA;
    });

  if (ranked.length > 0) {
    const topDomain = ranked[0][0];
    const topCount = ranked[0][1].size;
    const bestUrl = urlByDomain[topDomain];
    const confidence = topCount >= 2 ? 'HIGH' : 'MEDIUM';
    log(`  🎯 Consensus: ${topDomain} (${topCount} engines agree) → ${confidence} confidence`);
    return { url: bestUrl, confidence, domain: topDomain, engineAgreement: topCount };
  }

  // Fallback: return first available result from any engine
  for (const urls of Object.values(engineResults)) {
    if (urls.length > 0) {
      log(`  ⚠️ No consensus — using best available: ${urls[0].substring(0, 60)}`);
      return { url: urls[0], confidence: 'LOW', domain: null, engineAgreement: 0 };
    }
  }

  log(`  ❌ No search results found`);
  return null;
}

// ══════════════════════════════════════════════════════════════
//  MAIN RUN
// ══════════════════════════════════════════════════════════════
async function run() {
  log('\n' + '═'.repeat(70));
  log('DEEP URL AUDIT — Starting');
  log('═'.repeat(70));

  const masterData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const allUniversities = masterData.map(x => x.university);

  // Filter to DI, skip human-verified (unless --school targets them)
  let queue = masterData.filter(s => s.division === 'DI');

  // If --school is set, include human-verified for targeted audits
  if (!SCHOOL_FILTER) {
    queue = queue.filter(s => !s.isHumanVerified);
  }

  // Skip already audited unless --force OR targeted school audit
  // RE-AUDIT LOGIC: Rerun if thin data (dates="TBA") or if audit failed previously
  if (!FORCE_REAUDIT && !SCHOOL_FILTER) {
    queue = queue.filter(s => {
      // 1. Not audited yet? Proceed.
      if (!s.isUrlAudited) return true;
      
      // 2. Already audited but previously failed? Rerun for deep search.
      if (['URL_MISMATCH', 'NO_DATA', 'ERROR', 'URL_BLACKLISTED'].includes(s.auditStatus)) return true;
      
      // 3. Audited but missing core data (Dates or Cost)? Rerun for quick dive.
      const isThin = (s.dates === 'TBA' || !s.dates) || (s.cost === 'TBA' || !s.cost);
      if (isThin && s.division === 'DI') return true;
      
      return false;
    });
  }

  // Sort: schools WITH urls first (validation), then WITHOUT (search needed)
  queue.sort((a, b) => {
    const aHas = (a.campUrl && a.campUrl.startsWith('http')) ? 0 : 1;
    const bHas = (b.campUrl && b.campUrl.startsWith('http')) ? 0 : 1;
    return aHas - bHas;
  });

  // Apply filters
  if (SCHOOL_FILTER) {
    const filters = (Array.isArray(SCHOOL_FILTER) ? SCHOOL_FILTER : [SCHOOL_FILTER]).filter(f => typeof f === 'string');
    const filteredQueue = queue.filter(s => {
      return filters.some(f => {
        const filterLower = f.toLowerCase().trim();
        // Exact match
        if (s.university.toLowerCase() === filterLower) return true;
        // Word boundary regex
        const escaped = filterLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\b${escaped}\\b`, 'i');
        return re.test(s.university);
      });
    });
    
    if (filteredQueue.length > 0) {
      queue = filteredQueue;
    }
    log(`🔎 School filter: [${Array.isArray(SCHOOL_FILTER) ? SCHOOL_FILTER.join(', ') : SCHOOL_FILTER}] → ${queue.length} match(es)`);
  }

  if (BATCH_NUM) {
    const start = (BATCH_NUM - 1) * BATCH_SIZE;
    const end = start + BATCH_SIZE;
    queue = queue.slice(start, end);
    log(`📦 Batch ${BATCH_NUM}: schools ${start + 1}-${Math.min(end, start + queue.length)}`);
  }

  if (LIMIT < Infinity) {
    queue = queue.slice(0, LIMIT);
  }

  log(`📋 Processing ${queue.length} DI schools...\n`);

  if (queue.length === 0) {
    log('✅ No schools to process. All DI schools are audited or human-verified.');
    return;
  }

  // Load existing report
  let report = [];
  if (fs.existsSync(REPORT_FILE)) {
    try { report = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf8')); } catch {}
  }

  // Launch stealth browser
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: BROWSER_ARGS,
    ignoreHTTPSErrors: true,
  });

  const newBlacklistDomains = {};
  let processed = 0;
  let passed = 0;
  let fixed = 0;
  let flagged = 0;

  for (const school of queue) {
    if (processed >= MAX_PROCESSED_THIS_RUN) {
      log(`\n🛑 Batch limit (${MAX_PROCESSED_THIS_RUN}) reached. Signaling watchdog for restart...`);
      await browser.close();
      saveProgress(masterData, report);
      process.exit(RESTART_EXIT_CODE); 
    }

    const idx = masterData.findIndex(x => x.university === school.university);
    const record = masterData[idx];
    processed++;

    log(`\n[${'─'.repeat(60)}]`);
    log(`[${processed}/${queue.length}] ${school.university} (${school.conference || 'N/A'})`);
    log(`  Current URL: ${record.campUrl || '(none)'}`);

    const page = await browser.newPage();
    await page.setUserAgent(randomUA());
    await page.setViewport({ width: 1920, height: 1080 });
    const REFERERS = ['https://www.google.com/', 'https://www.bing.com/', 'https://search.yahoo.com/', 'https://duckduckgo.com/', 'https://www.facebook.com/'];
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    });

    const schoolReport = {
      university: school.university,
      conference: school.conference,
      originalUrl: record.campUrl || null,
      status: 'PENDING',
      confidence: 0,
      newUrl: null,
      pricingMatch: null,
      extractedData: {},
      notes: [],
      timestamp: new Date().toISOString()
    };

    let pageClosed = false;
    let searchResult = null;
    let initialUrlValidated = false;

    try {
      // ── PHASE 0: Pre-emptive Search Consensus (Skip in FAST_MODE if URL exists) ──────

      if (FAST_MODE && record.campUrl && record.campUrl.includes('http') && !isBlacklisted(record.campUrl)) {
          log(`  🏃 FAST MODE: Using existing URL...`);
      } else {
          if (record.campUrl && isBlacklisted(record.campUrl)) {
              log(`  ℹ️ CLEANUP MODE: Existing URL is blacklisted (Junk/Aggregator). Initiating search for official portal...`);
              record.campUrl = null;
          }
          log(`  🌐 Executing pre-emptive consensus search...`);
          searchResult = await consensusSearch(page, school, allUniversities);
      }
      
      if (searchResult && searchResult.engineAgreement >= 2) {
        log(`  ⭐ High Consensus Achieved (${searchResult.engineAgreement} engines). Prioritizing over database.`);
        if (record.campUrl !== searchResult.url) {
            log(`    ♻️ Flushing old data due to new domain...`);
            record.dates = 'TBA';
            record.cost = 'TBA';
            record.details = '';
            record.email = '';
            record.campPOC = '';
            record.campTiers = [];
        }
        record.campUrl = searchResult.url;
      } else if (searchResult && !record.campUrl) {
        log(`  ℹ️ Utilizing best search candidate...`);
        record.campUrl = searchResult.url;
      }
      
      // ── PHASE 1: Validate existing (or newly injected) URL ───────────────────
      if (record.campUrl && record.campUrl.startsWith('http')) {
        // Quick blacklist check
        if (isBlacklisted(record.campUrl)) {
          log(`  ❌ BLACKLISTED URL — skipping to search`);
          schoolReport.status = 'URL_BLACKLISTED';
          schoolReport.notes.push(`Blacklisted domain: ${record.campUrl}`);
          record.campUrl = null;
        } else {
          log(`  🔗 Validating current/search URL...`);
          const isConsensus = !!(searchResult && searchResult.engineAgreement >= 2 && record.campUrl === searchResult.url);
          const validation = await validatePage(page, record.campUrl, school, allUniversities, { isConsensus });

          log(`  → Confidence: ${validation.confidence} | Valid: ${validation.valid}`);
          log(`  → ${validation.reason}`);

          if (validation.valid) {
            schoolReport.status = 'PASS';
            schoolReport.confidence = validation.confidence;
            passed++;

            // Extract data from the valid page
            log(`  ✅ URL valid — extracting data...`);
            const extracted = await deepExtract(page, record.campUrl, school, allUniversities);
            schoolReport.extractedData = extracted;

            // Check if we actually found useful camp data
            const hasDates = !!(extracted.dates && extracted.dates !== 'TBA' && !extracted.dates.includes('April 03, 2026')); // Skip today false-positive
            const hasCost = !!(extracted.cost && extracted.cost !== 'TBA');
            const isSpecializedPlatform = OFFICIAL_PLATFORMS.some(p => record.campUrl.toLowerCase().includes(p));
            
            // If it's a generic university domain and we only have dates (no cost/poc), it's likely a false positive
            const isThinResults = (!hasDates || (!hasCost && !isSpecializedPlatform && !extracted.email));

            if (isThinResults) {
                log(`  ⚠️ Results too thin on "${record.campUrl}" (Dates: ${hasDates}, Cost: ${hasCost}). Falling back to search...`);
                schoolReport.notes.push('Valid school domain but data is thin (missing cost/email); triggering search fallback');
                searchResult = null; // CRITICAL: Prevent circular re-assignment of this thin URL
                record.campUrl = null; // IMPORTANT: null out so Phase 2 executes
            } else {
                // Persist status back to record
                record.auditStatus = schoolReport.status;
                record.isUrlAudited = true; // Mark as audited regardless
                record.lastAuditDate = new Date().toISOString();

                // Map fields back to record...
                if (schoolReport.extractedData) {
                  if (schoolReport.extractedData.dates && schoolReport.extractedData.dates !== 'TBA') record.dates = schoolReport.extractedData.dates;
                  if (schoolReport.extractedData.cost && schoolReport.extractedData.cost !== 'TBA') record.cost = schoolReport.extractedData.cost;
                  if (schoolReport.extractedData.contact && schoolReport.extractedData.contact !== 'TBA') record.contact = schoolReport.extractedData.contact;
                  if (schoolReport.extractedData.email && schoolReport.extractedData.email !== 'TBA') record.email = schoolReport.extractedData.email;
                }

                // Auto-fill missing data
                let dataUpdated = false;

            // Overwrite camp-specific data with fresh extraction results
            // (Only for DI schools being audited; human-verified ones are skipped by queue filtering)
            if (extracted.dates && extracted.dates !== 'TBA') {
              record.dates = extracted.dates;
              log(`    📅 Dates: ${extracted.dates.substring(0, 50)}`);
              dataUpdated = true;
            }

            if (extracted.cost && extracted.cost !== 'TBA') {
              record.cost = extracted.cost;
              log(`    💰 Cost: ${extracted.cost}`);
              dataUpdated = true;
            }

            if (extracted.email) {
              record.email = extracted.email;
              log(`    📧 Email: ${extracted.email}`);
              dataUpdated = true;
            }

            if (extracted.campPOC) {
              record.campPOC = extracted.campPOC;
              log(`    👤 POC: ${extracted.campPOC}`);
              dataUpdated = true;
            } else if (extracted.email && (!record.campPOC || record.campPOC.includes('@'))) {
              // Only overwrite POC with email if current POC is empty or already an email
              record.campPOC = extracted.email;
              log(`    👤 POC (Email): ${extracted.email}`);
              dataUpdated = true;
            }

            if (extracted.address && extracted.address !== 'On-campus facility') {
                record.address = extracted.address;
                log(`    📍 Address: ${extracted.address.substring(0, 40)}`);
                dataUpdated = true;
            }
            if (extracted.campTiers && extracted.campTiers.length > 0) {
                record.campTiers = extracted.campTiers;
                log(`    📋 Camp Tiers: ${extracted.campTiers.length} items (Refreshed)`);
                dataUpdated = true;
            }

            if (dataUpdated) fixed++;

            // Mark as audited
            record.isUrlAudited = true;
            record.lastAuditDate = new Date().toISOString();
            record.auditConfidence = validation.confidence;

            // Go to next school
            await page.close();
            pageClosed = true;
            schoolReport.newUrl = record.campUrl;
            report.push(schoolReport);
            saveProgress(masterData, report);
            initialUrlValidated = true; // Signal we are done with this school
            continue;
          }
        } else {
            // URL failed validation
            schoolReport.status = 'URL_MISMATCH';
            schoolReport.notes.push(`Validation failed: ${validation.reason}`);
            log(`  ❌ URL MISMATCH — blanking and searching for correct URL`);

            // Track mismatch domain for potential blacklisting
            try {
              const badDomain = new URL(record.campUrl).hostname.replace('www.', '');
              newBlacklistDomains[badDomain] = (newBlacklistDomains[badDomain] || 0) + 1;
            } catch {}

            record.campUrl = null;
            searchResult = null; // CRITICAL: Prevent circular re-assignment of the same failed URL
            flagged++;
          }
        }
      } else {
        schoolReport.status = 'NO_URL';
        log(`  ℹ️ No URL — searching...`);
      }

      if (initialUrlValidated) {
        // Skip search if we already successfully validated and extracted data
      } else if (searchResult && searchResult.engineAgreement >= 2 && !record.campUrl) {
        // Only re-use consensus if the URL hasn't already failed validation
        log(`  ⭐ High Consensus Achieved (${searchResult.engineAgreement} engines). Prioritizing over database.`);
        record.campUrl = searchResult.url;
      }
      
      // Phase 2: Fallback search if no valid URL yet
      if (!initialUrlValidated && !record.campUrl) {
        log(`  ℹ️ Validation failed or yielded no data. Executing fallback consensus search...`);
        searchResult = await consensusSearch(page, school, allUniversities, schoolReport.originalUrl);
      }

      if (searchResult && !record.campUrl) {
        log(`  🔍 Best candidate: ${searchResult.url.substring(0, 80)}`);

        // Validate the found URL
        const isConsensus = searchResult.engineAgreement >= 2;
        const validation = await validatePage(page, searchResult.url, school, allUniversities, { isConsensus });
        log(`  → Validation: confidence=${validation.confidence} valid=${validation.valid}`);

        if (validation.valid) {
          record.campUrl = validation.finalUrl || searchResult.url;
          record.sourceUrl = validation.finalUrl || searchResult.url;
          schoolReport.newUrl = record.campUrl;
          schoolReport.confidence = validation.confidence;
          schoolReport.status = schoolReport.status === 'URL_MISMATCH' ? 'FIXED' : 'FOUND';

          log(`  ✅ Valid URL found: ${record.campUrl.substring(0, 80)}`);

          // FLUSH old data because we moved to a new domain
          log(`    ♻️ Flushing old data due to domain change...`);
          record.dates = 'TBA';
          record.cost = 'TBA';
          record.email = null;
          record.campPOC = null;
          record.campTiers = [];
          record.address = 'On-campus facility';

          // Extract data
          const extracted = await deepExtract(page, record.campUrl, school, allUniversities);
          schoolReport.extractedData = extracted;

          // Auto-fill
          if (extracted.dates && extracted.dates !== 'TBA') {
            record.dates = extracted.dates;
            log(`    📅 Dates: ${extracted.dates.substring(0, 50)}`);
          }
          if (extracted.cost && (!record.cost || record.cost === 'TBA' || record.cost === 'Contact for pricing')) {
            record.cost = extracted.cost;
            log(`    💰 Cost: ${extracted.cost}`);
          }
          if (extracted.email && !record.email) {
            record.email = extracted.email;
            log(`    📧 Email: ${extracted.email}`);
          }

          fixed++;
        } else {
          log(`  ⚠️ Search result failed validation — flagging`);
          schoolReport.status = 'FLAGGED';
          schoolReport.notes.push(`Search found ${searchResult.url} but validation failed: ${validation.reason}`);
        }
      } 
      
      // ── PHASE 3: Automate Deep Search if everything failed ────────────────
      if (!record.campUrl && !initialUrlValidated) {
          log(`  🕵️ Standard search failed. Attempting DEEP SEARCH with expanded depth...`);
          const deepSearch = await consensusSearch(page, school, allUniversities, schoolReport.originalUrl, true);
          
          if (deepSearch && deepSearch.url) {
              const validation = await validatePage(page, deepSearch.url, school, allUniversities, { isConsensus: deepSearch.engineAgreement >= 2 });
              if (validation.valid) {
                  log(`  ✅ DEEP SEARCH SUCCESS: ${deepSearch.url}`);
                  record.campUrl = validation.finalUrl || deepSearch.url;
                  schoolReport.newUrl = record.campUrl;
                  schoolReport.status = 'FIXED';
                  
                  // Extract data with flush
                  log(`    ♻️ Flushing old data...`);
                  record.dates = 'TBA'; record.cost = 'TBA'; record.email = null; record.campTiers = [];
                  const extracted = await deepExtract(page, record.campUrl, school, allUniversities);
                  record.dates = extracted.dates || 'TBA';
                  record.cost = extracted.cost || 'TBA';
                  record.email = extracted.email || null;
                  fixed++;
              } else {
                  log(`  ❌ Deep search result failed validation: ${validation.reason}`);
              }
          } else {
              log(`  ❌ No valid URL found via deep search`);
          }
      }

      if (!record.campUrl) {
          schoolReport.status = schoolReport.status === 'NO_URL' ? 'NO_DATA' : schoolReport.status;
      }

      // Mark as audited regardless
      record.isUrlAudited = true;
      record.lastAuditDate = new Date().toISOString();

      // Recompute verification flags
      const hasUrl = !!(record.campUrl && record.campUrl.startsWith('http'));
      const hasDates = !!(record.dates && record.dates !== 'TBA' && /\d/.test(record.dates));
      const hasCost = !!(record.cost && /\$/.test(record.cost));
      record.autoVerified = hasUrl && hasDates && hasCost;
      record.autoVerifiedPartial = hasUrl && (hasDates || hasCost) && !(hasDates && hasCost);

    } catch (err) {
      log(`  💥 Error: ${err.message}`);
      schoolReport.status = 'ERROR';
      schoolReport.notes.push(err.message.substring(0, 100));
    } finally {
      if (!pageClosed) {
        try { await page.close(); } catch {}
      }
    }

    // Final persistence to record
    record.auditStatus = schoolReport.status || 'UNKNOWN';
    record.isUrlAudited = true;
    record.lastAuditAttempt = new Date().toISOString();

    report.push(schoolReport);
    saveProgress(masterData, report);
  }

  await browser.close();

  // ── Post-processing: blacklist expansion ─────────────────
  const newBlacklists = Object.entries(newBlacklistDomains)
    .filter(([domain, count]) => count >= 3)
    .map(([domain]) => domain);

  if (newBlacklists.length > 0) {
    log(`\n🚫 New blacklist candidates (3+ mismatches):`);
    newBlacklists.forEach(d => log(`   → ${d}`));
    // Save to report but don't auto-modify smart_extract.js
    report.push({ type: 'BLACKLIST_CANDIDATES', domains: newBlacklists });
  }

  // Final save
  saveProgress(masterData, report);

  log(`\n${'═'.repeat(70)}`);
  log(`DEEP URL AUDIT — Complete`);
  log(`  Processed: ${processed}`);
  log(`  Passed:    ${passed}`);
  log(`  Fixed:     ${fixed}`);
  log(`  Flagged:   ${flagged}`);
  log(`  Report:    ${REPORT_FILE}`);
  log('═'.repeat(70) + '\n');
}

function saveProgress(data, report) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
}

run().catch(err => {
  log(`💥 Fatal error: ${err.message}\n${err.stack}`);
  process.exit(1);
});
