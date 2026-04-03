/**
 * test_v7.js
 * Tests the V7 extractor against a known good school (Michigan State)
 * and a historically difficult one (Virginia).
 * Runs without modifying camps_data.json.
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const { getMascot, getUniversityAliases } = require('./mascot_lookup');

const delay = ms => new Promise(res => setTimeout(res, ms));

// Load just the logic from v7 (inline the key functions)
// ── Extraction function (copied from v7) ──────────────────────────────────────
function extractDataFromText(fullText) {
    const campTiers = [];
    const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 4);
    const MONTH_NAMES = 'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
    const DATE_PATTERN = new RegExp(
        `(?:(?:${MONTH_NAMES})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s*[-–]\\s*\\d{1,2}(?:st|nd|rd|th)?)?(?:,?\\s*20\\d{2})?)|` +
        `(?:\\b(?:0?[1-9]|1[0-2])\\/(?:0?[1-9]|[12]\\d|3[01])(?:\\/(?:20)?2[5-9])?)`,
    'gi');
    const CAMP_NAME_PATTERN = /([A-Z][A-Za-z0-9\s\/&\-]+(?:Camp|Clinic|Prospect|Showcase|Elite|Year-Round|Program|Academy|Session|Tournament|Tryout))/;
    const COST_PATTERN = /(?:\$[\d,]+(?:\.\d{2})?(?:\s*[-–]\s*\$[\d,]+(?:\.\d{2})?)?|FREE|Complimentary|No cost)/i;
    const SKIP_KEYWORDS = [' vs ', ' vs. ', ' @ ', ' at ', 'tournament standings', 'box score'];
    const SPORT_CONTAMINATION = ['basketball', 'soccer', 'volleyball', 'swimming', 'wrestling', 'tennis', 'lacrosse'];
    const STALE_YEARS = ['2024', '2023', '2022'];

    for (let j = 0; j < lines.length; j++) {
        const line = lines[j];
        if (!DATE_PATTERN.test(line)) { DATE_PATTERN.lastIndex = 0; continue; }
        DATE_PATTERN.lastIndex = 0;
        const block = lines.slice(Math.max(0, j - 3), Math.min(lines.length, j + 7)).join(' | ');
        const low = block.toLowerCase();
        if (SKIP_KEYWORDS.some(k => low.includes(k))) continue;
        if (STALE_YEARS.some(y => low.includes(y))) continue;
        if (/\d{1,2}:\d{2}\s*(?:am|pm)/i.test(block)) continue;
        const hasCampKeyword = /camp|clinic|prospect|showcase|register|enroll|sign.?up|instruction/i.test(block);
        const hasBaseballKeyword = /baseball|pitcher|batter|hitting|infield|outfield/i.test(block);
        const hasBadSport = SPORT_CONTAMINATION.some(s => low.includes(s));
        if (hasBadSport && !hasBaseballKeyword) continue;
        if (!hasCampKeyword && !hasBaseballKeyword) continue;

        const dateMatches = [...block.matchAll(new RegExp(DATE_PATTERN.source, 'gi'))].map(m => m[0]).slice(0, 4);
        if (dateMatches.length === 0) continue;
        const nameMatch = block.match(CAMP_NAME_PATTERN);
        const costMatch = block.match(COST_PATTERN);
        campTiers.push({
            name: nameMatch ? nameMatch[1].trim() : 'Baseball Camp',
            dates: dateMatches.join(', '),
            cost: costMatch ? costMatch[0].trim() : 'TBA',
        });
    }
    const seen = new Set();
    return campTiers.filter(t => {
        const key = t.name + '::' + (t.dates.split(',')[0] || '').trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

const TEST_SCHOOLS = [
    { university: 'Michigan State', campUrl: 'https://www.baseballcampsmsu.com/', mascot: 'Spartans' },
    { university: 'Virginia',       campUrl: 'https://virginiasports.com/sports/baseball', mascot: 'Cavaliers' },
    { university: 'Alabama',        campUrl: 'https://www.alabamabaseballcamps.com/', mascot: 'Crimson Tide' },
];

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

    for (const school of TEST_SCHOOLS) {
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`TEST: ${school.university}`);
        console.log(`${'═'.repeat(60)}`);

        const p = await browser.newPage();
        await p.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

        try {
            const resp = await p.goto(school.campUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            console.log(`Status: ${resp.status()}`);

            let fullText = await p.evaluate(() => document.body.innerText);

            // Sub-crawl
            const links = await p.$$eval('a', els =>
                els.map(a => ({ href: a.href || '', text: (a.innerText || '').toLowerCase() }))
                   .filter(l => l.href.startsWith('http') && /camp|register|clinic|prospect/.test(l.href + l.text))
            );
            console.log(`Sub-links: ${links.length}`);
            for (const sl of links.slice(0, 5)) {
                try {
                    const sp = await browser.newPage();
                    await sp.goto(sl.href, { waitUntil: 'domcontentloaded', timeout: 10000 });
                    const st = await sp.evaluate(() => document.body.innerText);
                    if (/baseball|camp|clinic/i.test(st)) {
                        fullText += '\n' + st;
                        console.log(`  ⭐ ${sl.href.substring(0, 70)}`);
                    }
                    await sp.close();
                } catch(e) {}
            }

            const tiers = extractDataFromText(fullText);
            console.log(`\nRESULT: ${tiers.length} tiers extracted.`);
            tiers.slice(0, 5).forEach(t => console.log(`  ✓ [${t.cost}] "${t.name}" — ${t.dates}`));

        } catch(e) {
            console.log(`ERROR: ${e.message}`);
        } finally {
            await p.close();
        }
    }

    await browser.close();
    console.log('\n✅ Test complete.');
})();
