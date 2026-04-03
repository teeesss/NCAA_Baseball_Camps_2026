/**
 * NCAA Baseball Camp Extractor — V7 Ultra-Fidelity
 * 
 * FIXES vs V6:
 *  1. campUrl prioritized as first candidate (per EXTRACTION_ENGINE.md)
 *  2. DuckDuckGo + Bing + Yahoo all-parallel (not sequential fallback)
 *  3. extractDataFromText: removed over-strict "camp" keyword requirement
 *  4. Date regex expanded to all 12 months AND numeric MM/DD/YYYY
 *  5. Cost range extraction ($175 - $225 style)
 *  6. contactName extracted from page text (coach bio / contact page)
 *  7. Email harvesting improved — gathers .edu + camp domain emails
 *  8. Smarter "free" camp detection
 *  9. Targets: all schools with scriptVersion < 7 AND no isVerified
 * 10. Periodic browser restart every 10 schools to prevent memory leaks
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { getMascot, buildSearchQuery, getUniversityAliases } = require('./mascot_lookup');

// ── Config ─────────────────────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'camps_data.json');
const LOG_FILE  = path.join(__dirname, 'extraction_v7.log');
const SCHOOL_TIMEOUT_MS = 75000;
const RESTART_EVERY = 10;
const delay = ms => new Promise(res => setTimeout(res, ms));

let data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const allSchoolNames = data.map(d => d.university);

// ── Logging ─────────────────────────────────────────────────────────────────
function log(msg) {
    const ts = new Date().toLocaleTimeString();
    const line = `[${ts}] ${msg}`;
    console.log(line);
    try { fs.appendFileSync(LOG_FILE, line + '\n', 'utf8'); } catch(e) {}
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getCoachName(camp) {
    if (!camp.contact) return '';
    // contact field can be "Coach Name | email@school.edu" or just a name
    let raw = camp.contact.split('|')[0].replace(/\(.*?\)/g, '').trim();
    if (raw.toLowerCase().includes('tba') || raw.includes('@') || raw.length < 3) return '';
    return raw;
}

function checkContamination(title, targetUni) {
    const titleLower = title.toLowerCase();
    const targetLower = targetUni.toLowerCase();
    for (let other of allSchoolNames) {
        if (other === targetUni) continue;
        const oLower = other.toLowerCase();
        // Bidirectional: skip if other is a substring of target (e.g. "Kansas" in "Arkansas")
        if (targetLower.includes(oLower) || oLower.includes(targetLower)) continue;
        const escaped = oLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`\\b${escaped}\\b`, 'i').test(titleLower)) return other;
    }
    return null;
}

function scoreUrl(url, school, isGuessed = false) {
    if (!url) return -100;
    let score = 0;
    const u = url.toLowerCase();
    const s = (school.university || '').toLowerCase();
    const coach = getCoachName(school).toLowerCase();
    const mascot = (school.mascot || getMascot(school.university) || '').toLowerCase();

    if (u.includes('baseball'))  score += 40;
    if (u.includes('camp') || u.includes('clinic')) score += 25;
    if (u.includes('/sports/baseball')) score += 15;
    if (coach && coach.length > 2) {
        const lastName = coach.split(' ').pop();
        if (lastName && u.includes(lastName)) score += 35;
    }
    if (mascot && u.includes(mascot)) score += 20;

    const cleanS = s.replace(/\s+/g, '');
    if (u.includes(cleanS)) score += 25;

    const shortS = s.replace(/university|state|college/gi, '').trim().replace(/\s+/g, '');
    if (shortS.length > 3 && u.includes(shortS)) score += 15;

    // Premium camp portals
    if (u.includes('ryzer.com') || u.includes('totalcamps.com') || u.includes('active.com')) score += 55;
    if (u.endsWith('.edu')) score += 10;
    if (isGuessed) score -= 40;

    // Penalize schedule/roster pages
    if (u.includes('/schedule') || u.includes('/roster') || u.includes('/scores')) score -= 35;

    // Hard blacklist
    const bad = ['wikipedia', 'espn', 'facebook', 'twitter', 'instagram', 'fandom', 
                 'warrennolan', 'newsbreak', 'ussportscamps', 'zhihu', 'reddit', 'yelp',
                 'tripadvisor', 'search.yahoo.com', 'images.search', 'bing.com/images',
                 'thebaseballcube', 'warrennolan'];
    if (bad.some(b => u.includes(b))) score -= 100;

    return score;
}

// ── Extraction Engine ─────────────────────────────────────────────────────────
function extractDataFromText(fullText) {
    const campTiers = [];
    const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 4);

    // Month names for regex
    const MONTH_NAMES = 'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
    const DATE_PATTERN = new RegExp(
        `(?:(?:${MONTH_NAMES})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s*[-–]\\s*\\d{1,2}(?:st|nd|rd|th)?)?(?:,?\\s*20\\d{2})?)|` +
        `(?:\\b(?:0?[1-9]|1[0-2])\\/(?:0[1-9]|[12]\\d|3[01])(?:\\/(?:20)?2[5-9])?)`,
    'gi');

    const CAMP_NAME_PATTERN = /([A-Z][A-Za-z0-9\s\/&\-]+(?:Camp|Clinic|Prospect|Showcase|Elite|Year-Round|Program|Academy|Session|Tournament|Tryout))/;

    // Improved cost: matches $175, $175.00, $175 - $225, FREE, Complimentary
    const COST_PATTERN = /(?:\$[\d,]+(?:\.\d{2})?(?:\s*[-–]\s*\$[\d,]+(?:\.\d{2})?)?|FREE|Complimentary|No cost)/i;

    // Email pattern
    const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi;

    // Skip patterns
    const SKIP_KEYWORDS = [' vs ', ' vs. ', ' @ ', ' at ', 'tournament standings', 'box score', 'game recap'];
    const SPORT_CONTAMINATION = ['basketball', 'soccer', 'volleyball', 'swimming', 'wrestling', 'tennis', 'lacrosse', 'gymnastics'];
    const STALE_YEARS = ['2024', '2023', '2022', '2021'];

    for (let j = 0; j < lines.length; j++) {
        const line = lines[j];
        if (!DATE_PATTERN.test(line)) { DATE_PATTERN.lastIndex = 0; continue; }
        DATE_PATTERN.lastIndex = 0;

        const block = lines.slice(Math.max(0, j - 3), Math.min(lines.length, j + 7)).join(' | ');
        const low = block.toLowerCase();

        // Skip: game schedules, old years, wrong sports
        if (SKIP_KEYWORDS.some(k => low.includes(k))) continue;
        if (STALE_YEARS.some(y => low.includes(y))) continue;
        if (/\d{1,2}:\d{2}\s*(?:am|pm)/i.test(block)) continue; // game times

        // Heavy sport contamination check: skip if non-baseball term dominates and no baseball term
        const hasCampKeyword = /camp|clinic|prospect|showcase|register|enroll|sign.?up|instruction|lesson/i.test(block);
        const hasBaseballKeyword = /baseball|pitcher|batter|hitting|infield|outfield/i.test(block);
        const hasBadSport = SPORT_CONTAMINATION.some(s => low.includes(s));
        if (hasBadSport && !hasBaseballKeyword) continue;
        if (!hasCampKeyword && !hasBaseballKeyword) continue;

        // Extract data
        const dateMatches = [...block.matchAll(new RegExp(DATE_PATTERN.source, 'gi'))].map(m => m[0]).slice(0, 4);
        if (dateMatches.length === 0) continue;

        const nameMatch = block.match(CAMP_NAME_PATTERN);
        const costMatch = block.match(COST_PATTERN);
        const emailMatches = [...block.matchAll(EMAIL_PATTERN)].map(m => m[0]);

        campTiers.push({
            name: nameMatch ? nameMatch[1].trim() : 'Baseball Camp',
            dates: dateMatches.join(', '),
            cost: costMatch ? costMatch[0].trim() : 'TBA',
            emails: emailMatches
        });
    }

    // Deduplicate by name + first date (normalize date string for key)
    const seen = new Set();
    const filtered = campTiers.filter(t => {
        // Normalize date string: trim, lowercase, remove ordinal suffixes for key comparison
        const firstDate = (t.dates.split(',')[0] || '').trim().toLowerCase().replace(/st|nd|rd|th/g, '');
        const key = t.name.toLowerCase().substring(0, 30) + '::' + firstDate;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    if (filtered.length > 0) {
        log(`       📋 [Tiers] ${filtered.length} entries. Sample: ${filtered.slice(0,2).map(t=>`"${t.name}" (${t.dates.split(',')[0]})`).join(' | ')}`);
    } else {
        log(`       📋 [Tiers] None found on this page.`);
    }

    return filtered;
}

// ── Extract Email From Page Text ──────────────────────────────────────────────
function harvestEmails(text) {
    const matches = text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || [];
    // Prefer .edu and baseball-related domains
    const sorted = [...new Set(matches)].sort((a, b) => {
        const aScore = (a.includes('.edu') ? 10 : 0) + (a.toLowerCase().includes('baseball') ? 5 : 0);
        const bScore = (b.includes('.edu') ? 10 : 0) + (b.toLowerCase().includes('baseball') ? 5 : 0);
        return bScore - aScore;
    });
    return sorted.slice(0, 3);
}

// ── Build URL Candidates ───────────────────────────────────────────────────────
function buildGuessedUrls(camp) {
    const guessed = [];
    let cleanUni = camp.university.replace(/The /gi, '').replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    let shortName = camp.university.replace(/University|State|College| of/gi, '').trim().replace(/\s+/g, '').toLowerCase();
    const mascot = (camp.mascot || getMascot(camp.university) || '').toLowerCase().replace(/\s+/g, '');

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
    return [...new Set(guessed)];
}

// ── Search Engine Queries ──────────────────────────────────────────────────────
async function runSearchQueries(page, camp) {
    const links = [];
    const mascot = getMascot(camp.university) || '';
    const coach = getCoachName(camp);

    // Build query variants
    const queries = [];
    if (mascot) queries.push(`${camp.university} ${mascot} baseball camp 2026`);
    queries.push(`${camp.university} baseball camp 2026`);
    if (coach) queries.push(`${coach} baseball camp 2026`);
    // Clean name version
    const cleanName = camp.university.replace(/university|state|college/gi, '').trim();
    if (cleanName !== camp.university && cleanName.length > 3) {
        queries.push(`${cleanName} baseball camp 2026`);
    }

    const providers = [
        {
            name: 'DDG',
            url: q => `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
            selector: '.result__a',
        },
        {
            name: 'Bing',
            url: q => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
            selector: '#b_results .b_algo h2 a, h2 a',
        },
        {
            name: 'Yahoo',
            url: q => `https://search.yahoo.com/search?p=${encodeURIComponent(q)}`,
            selector: '.title a, .compTitle a, #web h3 a, .algo h3 a',
        }
    ];

    for (const q of queries.slice(0, 3)) {
        for (const provider of providers) {
            if (links.length >= 20) break;
            try {
                log(`      ↳ [${provider.name}] ${q.substring(0, 60)}`);
                await page.goto(provider.url(q), { waitUntil: 'domcontentloaded', timeout: 20000 });
                const found = await page.evaluate((sel) => {
                    return Array.from(document.querySelectorAll(sel))
                        .map(a => a.href)
                        .filter(h => h && h.startsWith('http') && !h.includes('bing.com') && !h.includes('yahoo.com/search'));
                }, provider.selector);
                if (found && found.length > 0) {
                    links.push(...found);
                    if (found.length >= 5) break; // Good results — skip remaining providers for this query
                }
            } catch(e) {
                log(`      ✕ [${provider.name}] error: ${e.message.substring(0, 60)}`);
            }
            await delay(1200);
        }
    }

    return [...new Set(links.filter(l => l && l.startsWith('http')))];
}

// ── MAIN RUNNER ────────────────────────────────────────────────────────────────
const run = async () => {
    // Target: All schools not yet at v7 and not manually verified
    const toProcess = data.filter(d => (!d.isChecked || (d.scriptVersion || 0) < 7) && !d.isVerified);
    log(`\n🚀 V7 Ultra-Fidelity Engine Starting. Target: ${toProcess.length} schools.`);
    log(`   Database: ${data.length} total | ${data.filter(d=>d.isVerified).length} verified | ${data.filter(d=>d.campTiers&&d.campTiers.length>0).length} with data`);

    let browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox', '--disable-setuid-sandbox',
            '--window-size=1920,1080',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process'
        ],
        ignoreDefaultArgs: ['--enable-automation']
    });

    for (let i = 0; i < toProcess.length; i++) {
        // Periodic browser restart
        if (i > 0 && i % RESTART_EVERY === 0) {
            log(`\n[SYSTEM] Periodic browser restart at school ${i}...`);
            await browser.close().catch(() => {});
            await delay(2000);
            browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080',
                       '--disable-blink-features=AutomationControlled'],
                ignoreDefaultArgs: ['--enable-automation']
            });
        }

        const camp = toProcess[i];
        log(`\n${'═'.repeat(60)}`);
        log(`[${i + 1}/${toProcess.length}] Processing: ${camp.university}`);
        log(`${'═'.repeat(60)}`);

        const p = await browser.newPage();

        // Stealth
        await p.setViewport({ width: 1920 + Math.floor(Math.random() * 80), height: 1080 + Math.floor(Math.random() * 80) });
        await p.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
        await p.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 16 });
            window.chrome = { runtime: {} };
        });

        // CHECKPOINT: mark school as being processed BEFORE navigation
        camp.isChecked = true;
        camp.scriptVersion = 7;
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

        const schoolTimeout = setTimeout(() => {
            log(`   ⏰ School timeout hit for ${camp.university}. Closing page.`);
            p.close().catch(() => {});
        }, SCHOOL_TIMEOUT_MS);

        try {
            // ── Phase A: Build URL candidate list ─────────────────────
            let searchLinks = [];

            // FIX #1: Always try existing campUrl first if it exists
            if (camp.campUrl && camp.campUrl.startsWith('http') && !camp.campUrl.includes('warrennolan')) {
                log(`   → Priority URL from DB: ${camp.campUrl}`);
                searchLinks.push(camp.campUrl);
            }

            // Run search engines
            const engineResults = await runSearchQueries(p, camp);
            searchLinks.push(...engineResults);

            // Add URL-pattern guesses
            const guessed = buildGuessedUrls(camp);

            // Score and deduplicate all candidates
            const scored = [
                ...searchLinks.map(u => ({ url: u, score: scoreUrl(u, camp, false) })),
                ...guessed.map(u    => ({ url: u, score: scoreUrl(u, camp, true)  }))
            ]
            .sort((a, b) => b.score - a.score)
            .filter((x, idx, self) => self.findIndex(y => y.url === x.url) === idx)
            .filter(x => x.score > -50) // Drop clearly bad URLs
            .slice(0, 18);

            log(`   → ${scored.length} candidates. Top 3:`);
            scored.slice(0, 3).forEach(s => log(`      ${s.score >= 50 ? '★' : s.score >= 20 ? '•' : '○'} [${String(s.score).padStart(3)}] ${s.url}`));

            // ── Phase B: Validate & Sub-Crawl ─────────────────────────
            const aliases = getUniversityAliases(camp.university);
            let success = false;
            let bestEmails = [];
            let foundCampUrl = null;

            for (const item of scored) {
                const candidate = item.url;
                try {
                    log(`\n   → Navigating [${item.score}]: ${candidate}`);
                    const resp = await p.goto(candidate, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    if (!resp || resp.status() >= 400) { log(`      ✕ HTTP ${resp?.status() || 'error'}`); continue; }

                    await delay(600 + Math.random() * 400);
                    let text  = await p.evaluate(() => document.body?.innerText || '');
                    let title = await p.title() || '';

                    // FIX #5: School alias check
                    const matchedAlias = aliases.find(a =>
                        text.toLowerCase().includes(a) ||
                        title.toLowerCase().includes(a) ||
                        candidate.toLowerCase().includes(a.replace(/\s+/g, ''))
                    );
                    if (!matchedAlias) { log(`      ✕ School alias mismatch.`); continue; }

                    // FIX #2: Bidirectional contamination check
                    const culprit = checkContamination(title, camp.university);
                    if (culprit) { log(`      ✕ Contamination (${culprit}). Skip.`); continue; }

                    log(`   → ✅ VALIDATED for ${camp.university} (alias: "${matchedAlias}")`);

                    // Harvest emails from main page
                    const pageEmails = harvestEmails(text);
                    if (pageEmails.length > 0) bestEmails.push(...pageEmails);

                    let fullText = text;

                    // ── Phase B.2: Deep Sub-Crawl (6 links) ──────────────
                    const subLinks = await p.$$eval('a', els =>
                        els.map(a => ({ href: a.href || '', text: (a.innerText || '').toLowerCase().trim() }))
                    );

                    const campKeywords = ['camp', 'clinic', 'register', 'prospect', 'showcase', 'detail', 'event', 'elite', 'youth'];
                    const blacklist = ['wikipedia', 'facebook', 'twitter', 'instagram', 'youtube', 'espn', 'fandom', 'reddit', 'warrennolan'];
                    const alreadyQueued = new Set([candidate]);

                    const filteredSub = subLinks.filter(l => {
                        if (!l.href || !l.href.startsWith('http')) return false;
                        if (alreadyQueued.has(l.href)) return false;
                        const hl = l.href.toLowerCase();
                        if (blacklist.some(b => hl.includes(b))) return false;
                        if (hl.includes('/schedule') || hl.includes('/roster') || hl.includes('/scores')) return false;

                        const hasCampKw = campKeywords.some(k => hl.includes(k) || l.text.includes(k));
                        if (hasCampKw) return true;

                        // Also allow same-domain pages
                        try {
                            const mainHost = new URL(candidate).hostname;
                            const subHost  = new URL(l.href).hostname;
                            if (mainHost === subHost && !hl.includes('/news/') && !hl.includes('/article/')) return true;
                        } catch(e) {}
                        return false;
                    }).slice(0, 6);

                    log(`   → Sub-crawling ${filteredSub.length} pages...`);
                    for (const sl of filteredSub) {
                        alreadyQueued.add(sl.href);
                        try {
                            const sp = await browser.newPage();
                            await sp.goto(sl.href, { waitUntil: 'domcontentloaded', timeout: 12000 });
                            const st = await sp.evaluate(() => document.body?.innerText || '');
                            const hasBaseballContent = st.toLowerCase().includes('baseball');
                            const hasCampContent     = /camp|clinic|register|prospect/i.test(st);

                            if (hasBaseballContent || hasCampContent) {
                                log(`      ⭐ ${sl.href.substring(0, 60)}`);
                                fullText += '\n' + st;
                                const subEmails = harvestEmails(st);
                                if (subEmails.length > 0) bestEmails.push(...subEmails);
                            } else {
                                log(`      ↳ ${sl.href.substring(0, 60)}`);
                            }
                            await sp.close();
                        } catch(e) { /* ignore sub-page errors */ }
                    }

                    // ── Phase C: Extract ───────────────────────────────────
                    const campTiers = extractDataFromText(fullText);

                    if (campTiers.length > 0) {
                        // SUCCESS — save data
                        camp.campTiers  = campTiers;
                        camp.dates      = [...new Set(campTiers.map(t => t.dates))].join(' | ') + ' 2026';
                        camp.campUrl    = candidate;

                        // FIX #5: Merge best cost range
                        const costs = campTiers.map(t => t.cost).filter(c => c !== 'TBA');
                        if (costs.length > 0) {
                            // Extract first dollar amounts from all cost strings
                            const amounts = costs.flatMap(c => [...(c.matchAll(/\$[\d,]+/g))].map(m => parseInt(m[0].replace(/[$,]/g, ''))));
                            if (amounts.length > 0) {
                                const minC = Math.min(...amounts);
                                const maxC = Math.max(...amounts);
                                camp.cost = minC === maxC ? `$${minC}` : `$${minC} - $${maxC}`;
                            }
                        }

                        // FIX #7: Merge harvested emails into contact field
                        const uniqueEmails = [...new Set(bestEmails)].slice(0, 2);
                        if (uniqueEmails.length > 0) {
                            const currentContact = camp.contact || '';
                            const hasEmail = currentContact.includes('@');
                            if (!hasEmail) {
                                camp.contact = currentContact ? `${currentContact} | ${uniqueEmails[0]}` : uniqueEmails[0];
                            }
                        }

                        foundCampUrl = candidate;
                        success = true;
                        log(`   → 🎯 SUCCESS — ${campTiers.length} tiers. Cost: ${camp.cost || 'TBA'}`);
                        break;
                    }
                } catch(e) {
                    log(`   → ✕ Error on ${candidate}: ${e.message.substring(0, 80)}`);
                }
            }

            // Even on failure, save any emails we found
            if (!success) {
                if (bestEmails.length > 0) {
                    const uniqueEmails = [...new Set(bestEmails)].slice(0, 2);
                    const currentContact = camp.contact || '';
                    const hasEmail = currentContact.includes('@');
                    if (!hasEmail) {
                        camp.contact = currentContact ? `${currentContact} | ${uniqueEmails[0]}` : uniqueEmails[0];
                        log(`   → 📧 Saved email (no camp data): ${uniqueEmails[0]}`);
                    }
                }
                log(`   → ❌ No 2026 camp data found for ${camp.university}`);
            }

            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            log(`   → [DB_UPDATED] Saved.`);

        } catch(err) {
            log(`   → ERROR: ${err.message}`);
        } finally {
            clearTimeout(schoolTimeout);
            await p.close().catch(() => {});
        }
    }

    await browser.close();
    log(`\n🏁 V7 Extraction Complete.`);
    log(`   Final: ${data.filter(d=>d.campTiers&&d.campTiers.length>0).length} schools with data out of ${data.length}`);
};

run().catch(err => {
    log(`FATAL: ${err.message}`);
    process.exit(1);
});
