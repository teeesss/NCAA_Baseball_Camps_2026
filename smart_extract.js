'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { MASCOT_LOOKUP } = require('./src/utils/mascot_lookup.js');

const QUEUE_FILE = path.join(__dirname, 'missing_data_queue.json');
const DATA_FILE = path.join(__dirname, 'camps_data.json');
const BLACKLIST_FILE = path.join(__dirname, 'blacklist.json');
const LOG_FILE = path.join(__dirname, 'smart_extract.log');

const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logStream.write(line + '\n');
}

const args = process.argv.slice(2);
const argMap = {};
for (const a of args) {
  const [k, v] = a.replace(/^--/, '').split('=');
  argMap[k] = v || true;
}
const SCHOOL_FILTER = argMap.school || null;

const BLACKLISTED_DOMAINS = JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8')).domains;

// ── Sport Exclusivity: Reject non-baseball pages (FIX: llm-issues-prompt #2) ──
const REJECT_SPORTS = ['football', 'basketball', 'soccer', 'tennis', 'swimming', 'golf', 'volleyball', 'wrestling', 'lacrosse', 'softball', 'hockey', 'track and field'];
function isWrongSport(text) {
    const lower = text.toLowerCase();
    if (lower.includes('baseball')) return false; // Baseball content present = OK
    return REJECT_SPORTS.some(sport => lower.includes(sport + ' camp') || lower.includes(sport + ' clinic'));
}

// ── Team Camp / Legacy Detection (FIX: llm-issues-prompt #3, ISS-006) ──
function isTeamCampOrLegacy(text) {
    const lower = text.toLowerCase();
    const isTeamOnly = lower.includes('team camp') && !lower.includes('individual');
    const isLegacy   = lower.includes('2025') && !lower.includes('2026');
    return isTeamOnly || isLegacy;
}

const DATE_PATTERNS = [
  /\b(jun|jul|aug)[a-z]*\.?\s+\d{1,2}(?:[-–]\d{1,2})?,?\s*2026/gi,
  /\b0?[678]\/\d{1,2}\/2026/g,
  /\b2026[-/]0?[678][-/]\d{2}/g,
];
const COST_PATTERN = /\$\s*(\d[\d,.]*(?:\.\d{2})?)/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function unwrapUrl(url) {
    try {
        let u = new URL(url);
        // DDG uses uddg=, Yahoo uses RU=
        let real = u.searchParams.get('uddg') || u.searchParams.get('RU');
        if (real) return real;
    } catch(e) {}
    return url;
}

function extractData(text, url) {
    // FIX: llm-issues-prompt #2 — Sport Exclusivity
    if (isWrongSport(text)) {
        log(`    ⚠️ REJECTED: Page is not about baseball`);
        return { dates: null, cost: null, costVal: null, email: null, url };
    }

    // FIX: llm-issues-prompt — Team Camp / Legacy filtering
    if (isTeamCampOrLegacy(text)) {
        log(`    ⚠️ REJECTED: Team camp only or legacy 2025 page`);
        return { dates: null, cost: null, costVal: null, email: null, url };
    }

    let datesList = [];
    for (const pat of DATE_PATTERNS) {
        pat.lastIndex = 0;
        let m;
        while ((m = pat.exec(text)) !== null) {
            datesList.push(m[0].trim());
        }
    }
    const dates = datesList.length ? [...new Set(datesList)].slice(0, 3).join(' | ') : null;

    let bestCost = null;
    let costRaw = null;
    let costs = [];
    COST_PATTERN.lastIndex = 0;
    let m2;
    while ((m2 = COST_PATTERN.exec(text)) !== null) {
        let val = parseFloat(m2[1].replace(/,/g, ''));
        costs.push(val);
    }
    if (costs.length) {
        // FIX: llm-issues-prompt #3 — Cost filtering ($100-$1500, flag >$500)
        let validCosts = costs.filter(c => c >= 100 && c <= 1500);
        if (validCosts.length) {
            validCosts.sort((a,b) => a-b); // Prefer lowest individual price
            bestCost = validCosts[0];
            costRaw = `$${bestCost}`;
            if (bestCost > 500) {
                log(`    ⚠️ High price detected ($${bestCost}) — verify not team/showcase`);
            }
        }
    }

    // FIX: llm-issues-prompt #3 — Baseball-context email extraction
    let emailsList = [];
    const sections = text.split(/\n\s*\n/);
    for (const section of sections) {
        const sectionLower = section.toLowerCase();
        // Primary gate: section must mention 'baseball' or 'camp' (not other sports' coaches)
        const hasBaseballContext = sectionLower.includes('baseball') || sectionLower.includes('camp');
        // Secondary gate: 'coach'/'contact' only valid WITH baseball context
        const hasContactContext = (sectionLower.includes('coach') || sectionLower.includes('contact')) && hasBaseballContext;
        // Reject sections that are clearly about other sports
        const isOtherSport = ['basketball', 'football', 'soccer', 'volleyball', 'softball', 'tennis', 'swimming'].some(s => sectionLower.includes(s)) && !sectionLower.includes('baseball');
        
        if ((hasBaseballContext || hasContactContext) && !isOtherSport) {
            EMAIL_PATTERN.lastIndex = 0;
            let m3;
            while ((m3 = EMAIL_PATTERN.exec(section)) !== null) {
                let e = m3[0].toLowerCase();
                if (!BLACKLISTED_DOMAINS.some(b => e.includes(b)) && !e.includes('example') && !e.includes('noreply') && !e.includes('sentry')) {
                    emailsList.push(e);
                }
            }
        }
    }
    // Fallback: if no context-filtered email, try full page but prefer .edu
    if (emailsList.length === 0) {
        EMAIL_PATTERN.lastIndex = 0;
        let m3;
        while ((m3 = EMAIL_PATTERN.exec(text)) !== null) {
            let e = m3[0].toLowerCase();
            if (!BLACKLISTED_DOMAINS.some(b => e.includes(b)) && !e.includes('example') && !e.includes('noreply') && e.endsWith('.edu')) {
                emailsList.push(e);
            }
        }
    }
    const email = emailsList.length ? emailsList[0] : null;

    return { dates, cost: costRaw, costVal: bestCost, email, url };
}

async function searchEngine(page, urlTemplate, engineName) {
    try {
        await page.goto(urlTemplate, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise(r => setTimeout(r, 1200));
        
        let sel = engineName === 'DDG' ? '.result__a' : 'h3.title a, div.algo h3 a, .compTitle a';
        const links = await page.evaluate((selector) => {
            return Array.from(document.querySelectorAll(selector))
                .map(a => ({ href: a.href, title: (a.textContent || '').toLowerCase() }))
                .filter(h => h.href.startsWith('http') && !h.href.includes('yahoo.com/search') && !h.href.includes('duckduckgo.com/html'));
        }, sel);
        
        // FIX: llm-issues-prompt #1 — Search Result Validation & Year Prioritization
        const rejectPatterns = ['ticket', 'seatgeek', 'stubhub', 'merchandise', 'shop', 'football', 'basketball', 'soccer', 'tennis', 'swimming'];
        
        // Score and sort results: prefer 2026, penalize 2025, reject wrong sport/tickets
        const scored = links
            .map(l => {
                let clean = unwrapUrl(l.href);
                let url = clean.toLowerCase();
                let title = l.title;
                
                // Immediate rejection
                if (BLACKLISTED_DOMAINS.some(b => clean.includes(b))) return null;
                if (rejectPatterns.some(p => url.includes(p) || title.includes(p))) return null;
                
                let score = 0;
                if (url.includes('baseball')) score += 20;
                if (url.includes('camp') || title.includes('camp')) score += 10;
                if (url.includes('2026')) score += 50;     // Strong preference for 2026
                if (url.includes('2025')) score -= 100;    // Heavy penalty for 2025
                if (url.endsWith('.edu') || url.includes('.edu/')) score += 5;
                
                return { url: clean, score };
            })
            .filter(Boolean)
            .sort((a, b) => b.score - a.score);
        
        return scored.length > 0 ? scored[0].url : null;
    } catch(e) {
        log(`    ✕ [${engineName}] Error: ${e.message.substring(0,40)}`);
    }
    return null;
}

function isUrlGeneric(url) {
    if (!url) return true;
    try {
        let u = new URL(url);
        let p = u.pathname.replace(/\/$/, '').toLowerCase();
        return p === '' || p === '/' || p === '/athletics' || p === '/sports' || p === '/baseball';
    } catch(e) { return true; }
}

async function run() {
    log('🚀 DEAD SIMPLE EXTRACT starting...');
    if (!fs.existsSync(QUEUE_FILE)) return log('❌ queue missing');

    const queueData = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    let queue = queueData.queue;
    if (SCHOOL_FILTER) queue = queue.filter(s => s.university.toLowerCase().includes(SCHOOL_FILTER.toLowerCase()));

    const masterData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const masterMap = {};
    for (const r of masterData) masterMap[r.university] = r;

    let browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    let processed=0;
    for (const meta of queue) {
        const record = masterMap[meta.university];
        if (!record) continue;

        // Skip verified ones unless forced or missing everything
        if (record.isVerified && meta.missing.length <= 1 && meta.missing[0] !== 'campUrl') {
            log(`⏭️ SKIP ${record.university} - verified`);
            continue;
        }

        log(`\n[${++processed}/${queue.length}] ${record.university} | Missing: ${meta.missing.join(', ')}`);
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');
        
        try {
            let targetUrl = record.campUrl;
            let costVal = record.cost ? parseFloat(record.cost.replace(/[^0-9.]/g, '')) : 0;
            // Overwrite if < $100 or > $1500 (team camps), or flagged team pricing
            let needsRepull = (costVal > 0 && costVal < 100) || costVal > 1500;

            if (!targetUrl || meta.missing.includes('campUrl') || needsRepull || isUrlGeneric(targetUrl)) {
                let mascot = MASCOT_LOOKUP[record.university] || '';
                let q = `${record.university} ${mascot} baseball camp`.trim();
                log(`  🔍 Search: ${q}`);
                
                let ddgUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}&ia=web`;
                let yahooUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(q)}`;

                let ddg1 = await searchEngine(page, ddgUrl, 'DDG');
                let yahoo1 = await searchEngine(page, yahooUrl, 'Yahoo');

                targetUrl = ddg1 || yahoo1;
                
                let cleanDdg = ddg1 ? ddg1.split('?')[0].replace(/\/$/, '') : null;
                let cleanYahoo = yahoo1 ? yahoo1.split('?')[0].replace(/\/$/, '') : null;
                
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
                await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await new Promise(r => setTimeout(r, 1500));
                let text = await page.evaluate(() => document.body?.innerText || '');
                let ex = extractData(text, targetUrl);

                // ONE sub-link check if we missed data
                if (!ex.dates && !ex.cost) {
                    const portal = await page.evaluate(() => {
                        let links = Array.from(document.querySelectorAll('a[href]'));
                        let match = links.find(a => /camp|register|shop|event/i.test(a.textContent) || /camp|register|shop|event/i.test(a.href));
                        return match ? match.href : null;
                    });
                    if (portal && portal.startsWith('http') && portal !== targetUrl) {
                        log(`  ↳ Trying one sub-page: ${portal}`);
                        try {
                            await page.goto(portal, { waitUntil: 'domcontentloaded', timeout: 15000 });
                            await new Promise(r => setTimeout(r, 1500));
                            let text2 = await page.evaluate(() => document.body?.innerText || '');
                            let ex2 = extractData(text2, portal);
                            if (ex2.dates || ex2.cost) ex = ex2;
                        } catch(e) { /* ignore subpage fail */ }
                    }
                }

                if (needsRepull || meta.missing.includes('cost') || !record.cost || record.cost === 'TBA') {
                    if (ex.cost) { record.cost = ex.cost; log(`  ✅ cost: ${ex.cost}`); }
                }
                if (needsRepull || meta.missing.includes('dates') || !record.dates || record.dates === 'TBA') {
                    if (ex.dates) { record.dates = ex.dates; log(`  ✅ dates: ${ex.dates.substring(0,50)}`); }
                }
                if (meta.missing.includes('email') || !record.contact?.includes('@')) {
                    if (ex.email) {
                        let base = record.contact ? record.contact.split('|')[0].trim() : '';
                        record.contact = base ? `${base} | ${ex.email}` : ex.email;
                        log(`  ✅ email: ${ex.email}`);
                    }
                }
                
                // Clear old stale if URL fundamentally changed
                if (record.campUrl && record.campUrl !== ex.url) {
                    if (!ex.dates && record.dates) record.dates = 'TBA';
                    if (!ex.cost && record.cost) record.cost = 'TBA';
                }
                record.campUrl = ex.url;
            }

            // Mark processed
            record.isChecked = true;
            record.scriptVersion = 14; 
            fs.writeFileSync(DATA_FILE, JSON.stringify(masterData, null, 2));

        } catch(e) {
            log(`  ❌ Err: ${e.message}`);
        }
        await page.close();
    }
    await browser.close();
    log(`✅ DONE`);
}

run();
